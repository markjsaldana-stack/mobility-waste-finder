#!/usr/bin/env python3
"""Generate the synthetic August 2026 carrier invoice.

The file is constructed so the seven detection rules produce the exact
totals in the product brief. Re-run only if the sample needs regenerating.
"""

from __future__ import annotations

import csv
import random
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, timedelta
from pathlib import Path

RNG = random.Random(202608)

PLANS = {
    "Business Unlimited Pro": {"monthly_cents": 8500, "data": 999},
    "Business Unlimited Plus": {"monthly_cents": 6500, "data": 999},
    "Pooled 15GB": {"monthly_cents": 4800, "data": 15},
    "Pooled 5GB": {"monthly_cents": 3200, "data": 5},
    "Pooled 2GB": {"monthly_cents": 2400, "data": 2},
    "Voice + Text Only": {"monthly_cents": 1800, "data": 0},
    "IoT / Telematics 500MB": {"monthly_cents": 950, "data": 0.5},
}

DEPTS = [
    ("Field Operations", "CC-4100"),
    ("Sales", "CC-2200"),
    ("Engineering", "CC-3100"),
    ("Finance", "CC-1100"),
    ("Human Resources", "CC-1200"),
    ("Executive", "CC-1000"),
    ("Logistics", "CC-1800"),
    ("Customer Support", "CC-2500"),
    ("IT", "CC-1500"),
    ("Facilities", "CC-1600"),
]

CARRIERS = ["Verizon", "AT&T", "T-Mobile"]
PHONES = [
    "iPhone 15",
    "iPhone 15 Pro",
    "iPhone 14",
    "iPhone 14 Pro",
    "iPhone 13",
    "iPhone SE (3rd gen)",
    "Samsung Galaxy S24",
    "Samsung Galaxy S23",
    "Google Pixel 8",
    "Google Pixel 7",
]
IOT_DEVICES = ["Samsara VG34", "Geotab GO9", "CalAmp LMU-3030", "Verizon IOT Tracker"]

FIRST = [
    "Jordan", "Avery", "Casey", "Riley", "Quinn", "Morgan", "Cameron", "Reese",
    "Skyler", "Harper", "Rowan", "Parker", "Finley", "Hayden", "Elliot", "Sage",
    "Alex", "Sam", "Taylor", "Jamie", "Drew", "Charlie", "Emerson", "Blake",
    "Marley", "Dakota", "Phoenix", "River", "Eden", "Shiloh", "Amari", "Kai",
    "Nico", "Remy", "Sasha", "Devon", "Kerry", "Logan", "Pat", "Chris",
    "Priya", "Mei", "Luis", "Sofia", "Omar", "Elena", "Hiro", "Amina",
    "Diego", "Fatima", "Noah", "Leila", "Mateo", "Ines", "Jonas", "Hana",
    "Ibrahim", "Clara", "Ravi", "Nora", "Theo", "Yara", "Kenji", "Marta",
    "Andre", "Sana", "Victor", "Lila", "Hassan", "Greta",
]
LAST = [
    "Hale", "Ortiz", "Nguyen", "Patel", "Brooks", "Khan", "Singh", "Walsh",
    "Vargas", "Cho", "Berg", "Diaz", "Okafor", "Larsen", "Moreau", "Sato",
    "Klein", "Rahman", "Iversen", "Costa", "Novak", "Dubois", "Andersen",
    "Rossi", "Hoffman", "Petrov", "Nasser", "Okonkwo", "Silva", "Bergstrom",
    "MacLeod", "Fernandez", "Johansson", "Kowalski", "Bennett", "Hughes",
    "Sanders", "Fitzgerald", "Yamamoto", "Lindqvist", "Almeida", "Brennan",
    "Schultz", "Ibrahim", "Nakamura", "Olsen", "Carmichael", "Reyes",
    "Whitaker", "Gupta", "Lambert", "Nielsen", "Castillo", "Murray",
]

COLUMNS = [
    "line_id",
    "phone_number",
    "assigned_employee",
    "employee_id",
    "department",
    "cost_center",
    "carrier",
    "plan_name",
    "plan_monthly_cost",
    "data_allowance_gb",
    "data_used_gb",
    "data_used_gb_prev1",
    "data_used_gb_prev2",
    "voice_minutes_used",
    "sms_count",
    "feature_charges",
    "overage_charges",
    "international_roaming_charges",
    "total_monthly_charge",
    "line_status",
    "device_model",
    "activation_date",
    "contract_end_date",
    "billing_period",
]


def cents_to_dollars(cents: int) -> str:
    return f"{cents / 100:.2f}"


def distribute(n: int, total: int, min_each: int = 0) -> list[int]:
    if n == 0:
        return []
    if n * min_each > total:
        raise ValueError(f"cannot distribute {total} across {n} with min {min_each}")
    extra = total - n * min_each
    if extra == 0:
        return [min_each] * n
    weights = [RNG.random() + 0.2 for _ in range(n)]
    s = sum(weights)
    parts = [min_each + int(extra * w / s) for w in weights]
    parts[-1] += (min_each * n + extra) - sum(parts)
    # Repair negatives created by rounding on the last slot
    i = 0
    while parts[-1] < min_each and i < n - 1:
        take = min(parts[i] - min_each, min_each - parts[-1])
        if take > 0:
            parts[i] -= take
            parts[-1] += take
        i += 1
    assert sum(parts) == total, (sum(parts), total, parts)
    assert all(p >= min_each for p in parts), parts
    return parts


def rand_date(start: date, end: date) -> date:
    span = (end - start).days
    return start + timedelta(days=RNG.randint(0, span))


@dataclass
class Person:
    name: str
    employee_id: str
    department: str
    cost_center: str


class PersonFactory:
    def __init__(self) -> None:
        self.n = 0
        self.used_names: set[str] = set()

    def next(self, dept: tuple[str, str] | None = None) -> Person:
        self.n += 1
        dept_name, cc = dept if dept else RNG.choice(DEPTS)
        while True:
            name = f"{RNG.choice(FIRST)} {RNG.choice(LAST)}"
            if name not in self.used_names:
                self.used_names.add(name)
                break
        return Person(name, f"E-{self.n:04d}", dept_name, cc)


@dataclass
class Row:
    assigned_employee: str
    employee_id: str
    department: str
    cost_center: str
    carrier: str
    plan_name: str
    plan_monthly_cost_cents: int
    data_allowance_gb: float
    data_used_gb: float
    data_used_gb_prev1: float
    data_used_gb_prev2: float
    voice_minutes_used: int
    sms_count: int
    feature_charges_cents: int
    overage_charges_cents: int
    international_roaming_charges_cents: int
    line_status: str
    device_model: str
    activation_date: str
    contract_end_date: str
    billing_period: str = "2026-08"
    line_id: str = ""
    phone_number: str = ""

    @property
    def total_cents(self) -> int:
        return (
            self.plan_monthly_cost_cents
            + self.feature_charges_cents
            + self.overage_charges_cents
            + self.international_roaming_charges_cents
        )


def money_fields(cents: int, plan_cents: int) -> tuple[int, int]:
    """Return (feature_cents, total_cents) given a target total and plan."""
    features = cents - plan_cents
    if features < 0:
        raise ValueError(f"target {cents} below plan {plan_cents}")
    return features, cents


def device_for(plan_name: str) -> str:
    if plan_name.startswith("IoT"):
        return RNG.choice(IOT_DEVICES)
    return RNG.choice(PHONES)


def carrier() -> str:
    return RNG.choices(CARRIERS, weights=[45, 35, 20])[0]


def activation_and_contract(in_term: bool | None = None) -> tuple[str, str]:
    act = rand_date(date(2023, 1, 15), date(2026, 5, 1))
    if in_term is True:
        end = rand_date(date(2026, 10, 1), date(2027, 8, 31))
    elif in_term is False:
        end = rand_date(date(2025, 6, 1), date(2026, 7, 31))
    else:
        end = act + timedelta(days=730)
    return act.isoformat(), end.isoformat()


def gb(lo: float, hi: float) -> float:
    return round(RNG.uniform(lo, hi), 2)


def make_charge_row(
    *,
    person: Person | None,
    plan_name: str,
    total_cents: int,
    status: str = "Active",
    data_used: float = 8.0,
    prev1: float = 7.5,
    prev2: float = 9.0,
    voice: int = 120,
    sms: int = 40,
    overage: int = 0,
    roaming: int = 0,
    in_term: bool | None = None,
    dept: tuple[str, str] | None = None,
) -> Row:
    plan = PLANS[plan_name]
    features = total_cents - plan["monthly_cents"] - overage - roaming
    if features < 0:
        raise ValueError(
            f"{plan_name}: total {total_cents} < plan+overage+roam "
            f"{plan['monthly_cents'] + overage + roaming}"
        )
    dept_name, cc = (dept if dept else (
        (person.department, person.cost_center) if person else RNG.choice(DEPTS)
    ))
    act, end = activation_and_contract(in_term)
    return Row(
        assigned_employee=person.name if person else "",
        employee_id=person.employee_id if person else "",
        department=dept_name,
        cost_center=cc,
        carrier=carrier(),
        plan_name=plan_name,
        plan_monthly_cost_cents=plan["monthly_cents"],
        data_allowance_gb=plan["data"],
        data_used_gb=data_used,
        data_used_gb_prev1=prev1,
        data_used_gb_prev2=prev2,
        voice_minutes_used=voice,
        sms_count=sms,
        feature_charges_cents=features,
        overage_charges_cents=overage,
        international_roaming_charges_cents=roaming,
        line_status=status,
        device_model=device_for(plan_name),
        activation_date=act,
        contract_end_date=end,
    )


def plans_for(names: list[str]) -> list[str]:
    return names


def build() -> list[Row]:
    people = PersonFactory()
    rows: list[Row] = []

    # --- 1. Suspended: 19 lines, $1,163.81 ---
    suspended_plans = (
        ["Business Unlimited Pro"] * 4
        + ["Business Unlimited Plus"] * 4
        + ["Pooled 15GB"] * 3
        + ["Pooled 5GB"] * 3
        + ["Pooled 2GB"] * 3
        + ["Voice + Text Only"] * 1
        + ["IoT / Telematics 500MB"] * 1
    )
    assert len(suspended_plans) == 19
    sus_mins = [PLANS[p]["monthly_cents"] for p in suspended_plans]
    sus_totals = [m + e for m, e in zip(sus_mins, distribute(19, 116381 - sum(sus_mins)))]
    for plan_name, total in zip(suspended_plans, sus_totals):
        p = people.next(("Field Operations", "CC-4100"))
        # Suspended lines may still have residual usage from before suspension
        used = gb(0.0, 3.5) if not plan_name.startswith("IoT") and "Voice" not in plan_name else gb(0.0, 0.2)
        rows.append(
            make_charge_row(
                person=p,
                plan_name=plan_name,
                total_cents=total,
                status="Suspended",
                data_used=used,
                prev1=gb(0.0, 4.0),
                prev2=gb(0.0, 5.0),
                voice=RNG.randint(0, 40),
                sms=RNG.randint(0, 15),
                dept=("Field Operations", "CC-4100"),
            )
        )

    # --- 2. Unassigned: 30 lines, $1,252.88 ---
    unassigned_plans = (
        ["Business Unlimited Plus"] * 4
        + ["Pooled 15GB"] * 6
        + ["Pooled 5GB"] * 8
        + ["Pooled 2GB"] * 6
        + ["Voice + Text Only"] * 4
        + ["IoT / Telematics 500MB"] * 2
    )
    assert len(unassigned_plans) == 30
    una_mins = [PLANS[p]["monthly_cents"] for p in unassigned_plans]
    una_totals = [m + e for m, e in zip(una_mins, distribute(30, 125288 - sum(una_mins)))]
    una_depts = [
        ("Field Operations", "CC-4100"),
        ("Logistics", "CC-1800"),
        ("Facilities", "CC-1600"),
    ]
    for plan_name, total in zip(unassigned_plans, una_totals):
        dept = RNG.choice(una_depts)
        used = gb(0.2, 12.0) if PLANS[plan_name]["data"] else 0.0
        voice = RNG.randint(20, 400) if "IoT" not in plan_name else 0
        rows.append(
            make_charge_row(
                person=None,
                plan_name=plan_name,
                total_cents=total,
                data_used=used,
                prev1=gb(0.1, 11.0) if PLANS[plan_name]["data"] else 0.0,
                prev2=gb(0.0, 10.0) if PLANS[plan_name]["data"] else 0.0,
                voice=voice,
                sms=RNG.randint(0, 80),
                dept=dept,
            )
        )

    # --- 3. Zero usage: 40 lines, $2,421.75 ---
    zero_plans = (
        ["Business Unlimited Pro"] * 8
        + ["Business Unlimited Plus"] * 10
        + ["Pooled 15GB"] * 8
        + ["Pooled 5GB"] * 6
        + ["Pooled 2GB"] * 4
        + ["Voice + Text Only"] * 4
    )
    assert len(zero_plans) == 40
    zero_mins = [PLANS[p]["monthly_cents"] for p in zero_plans]
    zero_totals = [m + e for m, e in zip(zero_mins, distribute(40, 242175 - sum(zero_mins)))]
    zero_depts = [("Field Operations", "CC-4100")] * 22 + [("Customer Support", "CC-2500")] * 12 + [("Facilities", "CC-1600")] * 6
    RNG.shuffle(zero_depts)
    for i, (plan_name, total) in enumerate(zip(zero_plans, zero_totals)):
        p = people.next(zero_depts[i])
        in_term = i < 18
        rows.append(
            make_charge_row(
                person=p,
                plan_name=plan_name,
                total_cents=total,
                data_used=0.0,
                prev1=0.0,
                prev2=0.0,
                voice=0,
                sms=RNG.randint(0, 2),
                in_term=in_term,
                dept=zero_depts[i],
            )
        )

    # --- Clean lines (380), including 32 duplicate primaries ---
    clean_plans = (
        ["Business Unlimited Pro"] * 40
        + ["Business Unlimited Plus"] * 80
        + ["Pooled 15GB"] * 70
        + ["Pooled 5GB"] * 90
        + ["Pooled 2GB"] * 50
        + ["Voice + Text Only"] * 30
        + ["IoT / Telematics 500MB"] * 20
    )
    assert len(clean_plans) == 380
    RNG.shuffle(clean_plans)
    clean_rows: list[Row] = []
    for plan_name in clean_plans:
        dept = RNG.choice(DEPTS)
        p = people.next(dept)
        allowance = PLANS[plan_name]["data"]
        if allowance >= 15:
            used = gb(5.2, 28.0)
            prev1 = gb(5.1, 26.0)
            prev2 = gb(5.4, 30.0)
            voice = RNG.randint(80, 900)
            sms = RNG.randint(20, 400)
        elif allowance == 5:
            used = gb(1.5, 4.8)
            prev1 = gb(1.2, 4.7)
            prev2 = gb(1.0, 4.9)
            voice = RNG.randint(40, 500)
            sms = RNG.randint(10, 200)
        elif allowance == 2:
            used = gb(0.3, 1.8)
            prev1 = gb(0.2, 1.9)
            prev2 = gb(0.4, 1.7)
            voice = RNG.randint(30, 400)
            sms = RNG.randint(8, 150)
        elif allowance == 0.5:
            used = gb(0.05, 0.35)
            prev1 = gb(0.04, 0.40)
            prev2 = gb(0.06, 0.38)
            voice = 0
            sms = 0
        else:  # voice only — must have voice so they are not zero-usage
            used = 0.0
            prev1 = 0.0
            prev2 = 0.0
            voice = RNG.randint(40, 700)
            sms = RNG.randint(20, 250)
        # Placeholder features; we'll rebase to the remaining spend later
        clean_rows.append(
            make_charge_row(
                person=p,
                plan_name=plan_name,
                total_cents=PLANS[plan_name]["monthly_cents"] + 800,  # ~$8 insurance placeholder
                data_used=used,
                prev1=prev1,
                prev2=prev2,
                voice=voice,
                sms=sms,
                dept=dept,
            )
        )

    # --- 4. Duplicate: 32 lines, $1,354.82 ---
    # Pick 32 heavy-use clean primaries so they themselves are not flagged.
    primaries = [r for r in clean_rows if r.data_used_gb >= 5]
    RNG.shuffle(primaries)
    primaries = primaries[:32]
    dup_plans = (
        ["Business Unlimited Plus"] * 6
        + ["Pooled 15GB"] * 8
        + ["Pooled 5GB"] * 10
        + ["Pooled 2GB"] * 6
        + ["Voice + Text Only"] * 2
    )
    assert len(dup_plans) == 32
    dup_mins = [PLANS[p]["monthly_cents"] for p in dup_plans]
    dup_totals = [m + e for m, e in zip(dup_mins, distribute(32, 135482 - sum(dup_mins)))]
    for plan_name, total, primary in zip(dup_plans, dup_totals, primaries):
        used = gb(0.05, 1.85)  # < 2 GB, but not a 3-period zero
        rows.append(
            make_charge_row(
                person=Person(
                    primary.assigned_employee,
                    primary.employee_id,
                    primary.department,
                    primary.cost_center,
                ),
                plan_name=plan_name,
                total_cents=total,
                data_used=used,
                prev1=gb(0.0, 1.6),
                prev2=gb(0.0, 1.9),
                voice=RNG.randint(0, 25),
                sms=RNG.randint(0, 12),
                dept=(primary.department, primary.cost_center),
            )
        )

    # --- 5. International: 11 lines, savings $832.00 (roaming sums to $1,932) ---
    roam_cents = distribute(11, 193200, min_each=11000)  # each > $100
    intl_plans = ["Business Unlimited Pro"] * 6 + ["Business Unlimited Plus"] * 5
    for plan_name, roam in zip(intl_plans, roam_cents):
        p = people.next(("Sales", "CC-2200"))
        features = RNG.randint(0, 1500)
        rows.append(
            make_charge_row(
                person=p,
                plan_name=plan_name,
                total_cents=PLANS[plan_name]["monthly_cents"] + features + roam,
                data_used=gb(6.0, 22.0),
                prev1=gb(5.5, 20.0),
                prev2=gb(7.0, 24.0),
                voice=RNG.randint(100, 600),
                sms=RNG.randint(30, 200),
                roaming=roam,
                dept=("Sales", "CC-2200"),
            )
        )

    # --- 6. Chronic overage: 26 lines, savings $1,721.19 ---
    # All on Pooled 5GB: save = overage - $33.00
    overage_cents = distribute(26, 257919, min_each=4500)
    over_depts = [("Customer Support", "CC-2500")] * 16 + [("Sales", "CC-2200")] * 10
    RNG.shuffle(over_depts)
    for overage, dept in zip(overage_cents, over_depts):
        p = people.next(dept)
        features = RNG.randint(0, 1200)
        rows.append(
            make_charge_row(
                person=p,
                plan_name="Pooled 5GB",
                total_cents=3200 + features + overage,
                data_used=gb(6.5, 14.0),
                prev1=gb(5.8, 13.0),
                prev2=gb(6.0, 12.5),
                voice=RNG.randint(80, 500),
                sms=RNG.randint(20, 180),
                overage=overage,
                dept=dept,
            )
        )

    # --- 7. Oversized: 52 lines, $2,020.00 ---
    oversize_plans = (
        ["Business Unlimited Pro"] * 22
        + ["Business Unlimited Plus"] * 22
        + ["Pooled 15GB"] * 8
    )
    oversize_depts = (
        [("Engineering", "CC-3100")] * 22
        + [("IT", "CC-1500")] * 18
        + [("Executive", "CC-1000")] * 12
    )
    RNG.shuffle(oversize_depts)
    for plan_name, dept in zip(oversize_plans, oversize_depts):
        p = people.next(dept)
        features = RNG.randint(0, 1400)
        used = gb(0.4, 4.7)  # < 5, but not three-period zero
        rows.append(
            make_charge_row(
                person=p,
                plan_name=plan_name,
                total_cents=PLANS[plan_name]["monthly_cents"] + features,
                data_used=used,
                prev1=gb(0.3, 4.8),
                prev2=gb(0.5, 4.6),
                voice=RNG.randint(15, 200),
                sms=RNG.randint(5, 80),
                dept=dept,
            )
        )

    # Rebase clean-line features so all 590 rows sum to $38,119.12
    TARGET_TOTAL = 3811912
    flagged_sum = sum(r.total_cents for r in rows)
    clean_plan_sum = sum(r.plan_monthly_cost_cents for r in clean_rows)
    remaining = TARGET_TOTAL - flagged_sum - clean_plan_sum
    if remaining < 0:
        raise SystemExit(
            f"clean plan sum leaves negative features: remaining={remaining} "
            f"flagged={flagged_sum} clean_plans={clean_plan_sum}"
        )
    extras = distribute(len(clean_rows), remaining, min_each=0)
    for r, extra in zip(clean_rows, extras):
        r.feature_charges_cents = extra

    rows.extend(clean_rows)

    assert len(rows) == 590, len(rows)
    assert sum(r.total_cents for r in rows) == TARGET_TOTAL

    RNG.shuffle(rows)
    for i, r in enumerate(rows, start=1):
        r.phone_number = format_phone(i)
    rows.sort(key=lambda r: (r.cost_center, r.phone_number))
    for i, r in enumerate(rows, start=1):
        r.line_id = f"L-{i:05d}"

    return rows


def format_phone(i: int) -> str:
    return f"555-010-{i:04d}"


def to_csv_dict(r: Row) -> dict:
    return {
        "line_id": r.line_id,
        "phone_number": r.phone_number,
        "assigned_employee": r.assigned_employee,
        "employee_id": r.employee_id,
        "department": r.department,
        "cost_center": r.cost_center,
        "carrier": r.carrier,
        "plan_name": r.plan_name,
        "plan_monthly_cost": cents_to_dollars(r.plan_monthly_cost_cents),
        "data_allowance_gb": r.data_allowance_gb if r.data_allowance_gb != 0.5 else "0.5",
        "data_used_gb": f"{r.data_used_gb:.2f}",
        "data_used_gb_prev1": f"{r.data_used_gb_prev1:.2f}",
        "data_used_gb_prev2": f"{r.data_used_gb_prev2:.2f}",
        "voice_minutes_used": r.voice_minutes_used,
        "sms_count": r.sms_count,
        "feature_charges": cents_to_dollars(r.feature_charges_cents),
        "overage_charges": cents_to_dollars(r.overage_charges_cents),
        "international_roaming_charges": cents_to_dollars(r.international_roaming_charges_cents),
        "total_monthly_charge": cents_to_dollars(r.total_cents),
        "line_status": r.line_status,
        "device_model": r.device_model,
        "activation_date": r.activation_date,
        "contract_end_date": r.contract_end_date,
        "billing_period": r.billing_period,
    }


def to_cents(value: str | float | int) -> int:
    return int(round(float(value) * 100))


def analyze(rows: list[Row]) -> None:
    """Python mirror of the TS engine — used to confirm the sample before UI work."""
    emp_counts: dict[str, int] = defaultdict(int)
    for r in rows:
        if r.employee_id:
            emp_counts[r.employee_id] += 1

    claimed: set[int] = set()
    groups = {
        "suspended": 0,
        "unassigned": 0,
        "zero_usage": 0,
        "duplicate": 0,
        "international": 0,
        "overage": 0,
        "oversized": 0,
    }
    savings = {k: 0 for k in groups}
    counts = {k: 0 for k in groups}

    def claim(i: int, cat: str, save: int) -> None:
        claimed.add(i)
        counts[cat] += 1
        savings[cat] += save

    for i, r in enumerate(rows):
        if r.line_status == "Suspended" and r.total_cents > 0:
            claim(i, "suspended", r.total_cents)

    for i, r in enumerate(rows):
        if i in claimed:
            continue
        if r.assigned_employee.strip() == "":
            claim(i, "unassigned", r.total_cents)

    for i, r in enumerate(rows):
        if i in claimed:
            continue
        if (
            r.data_used_gb == 0
            and r.data_used_gb_prev1 == 0
            and r.data_used_gb_prev2 == 0
            and r.voice_minutes_used == 0
        ):
            claim(i, "zero_usage", r.total_cents)

    for i, r in enumerate(rows):
        if i in claimed:
            continue
        if r.employee_id and emp_counts[r.employee_id] > 1 and r.data_used_gb < 2:
            claim(i, "duplicate", r.total_cents)

    for i, r in enumerate(rows):
        if i in claimed:
            continue
        if r.international_roaming_charges_cents > 0:
            claim(i, "international", max(0, r.international_roaming_charges_cents - 10000))

    for i, r in enumerate(rows):
        if i in claimed:
            continue
        if r.overage_charges_cents > 0:
            claim(i, "overage", max(0, r.plan_monthly_cost_cents + r.overage_charges_cents - 6500))

    for i, r in enumerate(rows):
        if i in claimed:
            continue
        if r.data_allowance_gb in (999, 15) and r.data_used_gb < 5:
            claim(i, "oversized", max(0, r.plan_monthly_cost_cents - 3200))

    total_spend = sum(r.total_cents for r in rows)
    total_save = sum(savings.values())
    print(f"Lines analyzed                 {len(rows)}")
    print(f"Total monthly spend            {cents_to_dollars(total_spend)}")
    print(f"Annualized spend               {cents_to_dollars(total_spend * 12)}")
    print()
    expected = {
        "suspended": (19, 116381),
        "unassigned": (30, 125288),
        "zero_usage": (40, 242175),
        "duplicate": (32, 135482),
        "international": (11, 83200),
        "overage": (26, 172119),
        "oversized": (52, 202000),
    }
    ok = True
    for cat, (exp_n, exp_s) in expected.items():
        n, s = counts[cat], savings[cat]
        mark = "OK" if (n, s) == (exp_n, exp_s) else "FAIL"
        if mark == "FAIL":
            ok = False
        print(f"{mark:4} {cat:16} {n:3} lines  ${cents_to_dollars(s):>10}/mo  ${cents_to_dollars(s*12):>10}/yr")
    print()
    print(f"TOTAL                          {sum(counts.values())} lines  ${cents_to_dollars(total_save)}/mo  ${cents_to_dollars(total_save*12)}/yr")
    print(f"Reduction                      {total_save / total_spend * 100:.1f}%")
    if not ok or sum(counts.values()) != 210 or total_save != 1076645:
        raise SystemExit("sample does not match expected totals")
    print("\nSample matches the brief.")


def main() -> None:
    rows = build()
    analyze(rows)
    out = Path(__file__).resolve().parents[1] / "public" / "brightfin_sample_invoice_2026-08.csv"
    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=COLUMNS)
        writer.writeheader()
        for r in rows:
            writer.writerow(to_csv_dict(r))
    print(f"Wrote {out}")


if __name__ == "__main__":
    main()

import { FINDING_CATEGORIES, type Analysis, type Finding, type FindingCategory, type FindingGroup, type InvoiceRow } from "./types"
import { formatGb, formatMoney, fromCents, toCents } from "./money"

/**
 * Plan catalog is hardcoded. Right-sizing math has to assume a real
 * alternative, and the alternative has to be the same every time or the
 * headline number moves. These are the published business-plan rates.
 */
export const PLAN_CATALOG = [
  { name: "Business Unlimited Pro", monthly: 85, dataGb: 999 },
  { name: "Business Unlimited Plus", monthly: 65, dataGb: 999 },
  { name: "Pooled 15GB", monthly: 48, dataGb: 15 },
  { name: "Pooled 5GB", monthly: 32, dataGb: 5 },
  { name: "Pooled 2GB", monthly: 24, dataGb: 2 },
  { name: "Voice + Text Only", monthly: 18, dataGb: 0 },
  { name: "IoT / Telematics 500MB", monthly: 9.5, dataGb: 0.5 },
] as const

export const UNLIMITED_PLUS_COST = PLAN_CATALOG[1].monthly
export const POOLED_5GB_COST = PLAN_CATALOG[3].monthly
export const GLOBAL_ADDON_COST = 100

export const CATEGORY_META: Record<
  FindingCategory,
  { label: string; action: string }
> = {
  suspended: {
    label: "Suspended lines still billing",
    action: "Cancel — suspended, still accruing feature charges.",
  },
  unassigned: {
    label: "Unassigned lines",
    action: "No owner of record. Confirm against HR roster, then cancel.",
  },
  zero_usage: {
    label: "Zero usage, 3 periods",
    action: "Dormant 90+ days. Suspend, then cancel at contract end.",
  },
  duplicate: {
    label: "Duplicate lines per employee",
    action: "Second line for this employee with minimal usage. Consolidate.",
  },
  international: {
    label: "International day-pass bleed",
    action: "Frequent traveler paying per-day. Move to a global plan.",
  },
  overage: {
    label: "Chronic overage",
    action: "Undersized plan. Overage costs more than the next tier up.",
  },
  oversized: {
    label: "Oversized plan for usage",
    action: "Paying for unlimited, using under 5 GB. Right-size to 5 GB pooled.",
  },
}

function lastDayOfPeriod(billingPeriod: string): string {
  const [year, month] = billingPeriod.split("-").map(Number)
  if (!year || !month) return billingPeriod
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return `${year}-${String(month).padStart(2, "0")}-${String(last).padStart(2, "0")}`
}

function stillInContract(row: InvoiceRow): boolean {
  return row.contractEndDate > lastDayOfPeriod(row.billingPeriod)
}

function primarySibling(row: InvoiceRow, rows: InvoiceRow[]): InvoiceRow | null {
  const siblings = rows
    .filter((r) => r.employeeId && r.employeeId === row.employeeId && r.lineId !== row.lineId)
    .sort((a, b) => b.dataUsedGb - a.dataUsedGb)
  return siblings[0] ?? null
}

function finding(
  category: FindingCategory,
  row: InvoiceRow,
  monthlyCents: number,
  math: string,
  extra: { inContract?: boolean | null; sibling?: InvoiceRow | null } = {},
): Finding {
  return {
    category,
    row,
    monthlySavings: fromCents(monthlyCents),
    annualSavings: fromCents(monthlyCents * 12),
    action: CATEGORY_META[category].action,
    math,
    inContract: extra.inContract ?? null,
    sibling: extra.sibling ?? null,
  }
}

/**
 * First matching rule owns the line. Without that, categories double-count
 * and the recoverable number inflates — the credibility problem every ROI
 * calculator on the internet has.
 */
export function analyze(rows: InvoiceRow[], sample = false): Analysis {
  const claimed = new Set<string>()
  const findings: Finding[] = []

  const employeeCounts = new Map<string, number>()
  for (const row of rows) {
    const id = row.employeeId.trim()
    if (!id) continue
    employeeCounts.set(id, (employeeCounts.get(id) ?? 0) + 1)
  }

  const claim = (row: InvoiceRow, f: Finding) => {
    claimed.add(row.lineId)
    findings.push(f)
  }

  for (const row of rows) {
    if (row.lineStatus === "Suspended" && toCents(row.totalMonthlyCharge) > 0) {
      const features = formatMoney(row.featureCharges)
      claim(
        row,
        finding(
          "suspended",
          row,
          toCents(row.totalMonthlyCharge),
          `${formatMoney(row.totalMonthlyCharge)} still billing on a suspended line (${formatMoney(row.planMonthlyCost)} plan + ${features} features). Cancel saves ${formatMoney(row.totalMonthlyCharge * 12)}/yr.`,
        ),
      )
    }
  }

  for (const row of rows) {
    if (claimed.has(row.lineId)) continue
    if (row.assignedEmployee.trim() === "") {
      claim(
        row,
        finding(
          "unassigned",
          row,
          toCents(row.totalMonthlyCharge),
          `No owner of record. ${formatMoney(row.planMonthlyCost)} ${row.planName}, billed ${formatMoney(row.totalMonthlyCharge)} this period. Confirm against HR roster, then cancel — saves ${formatMoney(row.totalMonthlyCharge * 12)}/yr.`,
        ),
      )
    }
  }

  for (const row of rows) {
    if (claimed.has(row.lineId)) continue
    if (
      row.dataUsedGb === 0 &&
      row.dataUsedGbPrev1 === 0 &&
      row.dataUsedGbPrev2 === 0 &&
      row.voiceMinutesUsed === 0
    ) {
      const inTerm = stillInContract(row)
      const contractNote = inTerm
        ? `Contract ends ${row.contractEndDate} — an ETF conversation, not a blind cancel.`
        : `Contract ended ${row.contractEndDate}. Suspend, then cancel.`
      claim(
        row,
        finding(
          "zero_usage",
          row,
          toCents(row.totalMonthlyCharge),
          `0 GB and 0 minutes across three periods. ${formatMoney(row.planMonthlyCost)} ${row.planName}. ${contractNote} Saves ${formatMoney(row.totalMonthlyCharge * 12)}/yr.`,
          { inContract: inTerm },
        ),
      )
    }
  }

  for (const row of rows) {
    if (claimed.has(row.lineId)) continue
    const id = row.employeeId.trim()
    if (id && (employeeCounts.get(id) ?? 0) > 1 && row.dataUsedGb < 2) {
      const sibling = primarySibling(row, rows)
      const siblingBit = sibling
        ? `${formatGb(row.dataUsedGb)} GB this period vs. ${formatGb(sibling.dataUsedGb)} GB on ${sibling.phoneNumber}`
        : `${formatGb(row.dataUsedGb)} GB this period`
      const who = row.assignedEmployee || id
      claim(
        row,
        finding(
          "duplicate",
          row,
          toCents(row.totalMonthlyCharge),
          `Second line for ${who}. ${siblingBit}. ${formatMoney(row.planMonthlyCost)} plan. Consolidate saves ${formatMoney(row.totalMonthlyCharge * 12)}/yr.`,
          { sibling },
        ),
      )
    }
  }

  for (const row of rows) {
    if (claimed.has(row.lineId)) continue
    if (row.internationalRoamingCharges > 0) {
      const save = Math.max(0, toCents(row.internationalRoamingCharges) - toCents(GLOBAL_ADDON_COST))
      claim(
        row,
        finding(
          "international",
          row,
          save,
          `${formatMoney(row.internationalRoamingCharges)} in day-pass charges. A global add-on is ${formatMoney(GLOBAL_ADDON_COST)}/mo. Move over, save ${formatMoney(fromCents(save))}/mo (${formatMoney(fromCents(save * 12))}/yr).`,
        ),
      )
    }
  }

  for (const row of rows) {
    if (claimed.has(row.lineId)) continue
    if (row.overageCharges > 0) {
      const save = Math.max(
        0,
        toCents(row.planMonthlyCost) + toCents(row.overageCharges) - toCents(UNLIMITED_PLUS_COST),
      )
      claim(
        row,
        finding(
          "overage",
          row,
          save,
          `${formatMoney(row.planMonthlyCost)} plan + ${formatMoney(row.overageCharges)} overage = ${formatMoney(row.planMonthlyCost + row.overageCharges)}. Unlimited Plus is ${formatMoney(UNLIMITED_PLUS_COST)}. Upgrade saves ${formatMoney(fromCents(save))}/mo (${formatMoney(fromCents(save * 12))}/yr).`,
        ),
      )
    }
  }

  for (const row of rows) {
    if (claimed.has(row.lineId)) continue
    if ((row.dataAllowanceGb === 999 || row.dataAllowanceGb === 15) && row.dataUsedGb < 5) {
      const save = Math.max(0, toCents(row.planMonthlyCost) - toCents(POOLED_5GB_COST))
      claim(
        row,
        finding(
          "oversized",
          row,
          save,
          `${formatMoney(row.planMonthlyCost)} plan, ${formatGb(row.dataUsedGb)} GB used, downgrade to ${formatMoney(POOLED_5GB_COST)}, saves ${formatMoney(fromCents(save * 12))}/yr.`,
        ),
      )
    }
  }

  const groups: FindingGroup[] = FINDING_CATEGORIES.map((category) => {
    const items = findings.filter((f) => f.category === category)
    const monthlyCents = items.reduce((sum, f) => sum + toCents(f.monthlySavings), 0)
    return {
      category,
      label: CATEGORY_META[category].label,
      action: CATEGORY_META[category].action,
      findings: items,
      monthlySavings: fromCents(monthlyCents),
      annualSavings: fromCents(monthlyCents * 12),
    }
  })

  const totalMonthlyCents = rows.reduce((sum, r) => sum + toCents(r.totalMonthlyCharge), 0)
  const recoverableCents = findings.reduce((sum, f) => sum + toCents(f.monthlySavings), 0)
  const periods = [...new Set(rows.map((r) => r.billingPeriod).filter(Boolean))]

  const byCc = new Map<string, { dept: Map<string, number>; lines: number; monthly: number }>()
  for (const f of findings) {
    const cc = f.row.costCenter || "—"
    const entry = byCc.get(cc) ?? { dept: new Map(), lines: 0, monthly: 0 }
    entry.lines += 1
    entry.monthly += toCents(f.monthlySavings)
    const dept = f.row.department || "—"
    entry.dept.set(dept, (entry.dept.get(dept) ?? 0) + 1)
    byCc.set(cc, entry)
  }

  const costCenterWaste = [...byCc.entries()]
    .map(([costCenter, entry]) => {
      const department = [...entry.dept.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—"
      return {
        costCenter,
        department,
        lineCount: entry.lines,
        monthlySavings: fromCents(entry.monthly),
        annualSavings: fromCents(entry.monthly * 12),
      }
    })
    .sort((a, b) => b.monthlySavings - a.monthlySavings)
    .slice(0, 3)

  return {
    rows,
    findings,
    groups,
    lineCount: rows.length,
    flaggedLineCount: findings.length,
    totalMonthlySpend: fromCents(totalMonthlyCents),
    annualizedSpend: fromCents(totalMonthlyCents * 12),
    recoverableMonthly: fromCents(recoverableCents),
    recoverableAnnual: fromCents(recoverableCents * 12),
    reductionPct: totalMonthlyCents === 0 ? 0 : (recoverableCents / totalMonthlyCents) * 100,
    billingPeriod: periods.length === 1 ? periods[0] : periods.join(", ") || "—",
    costCenterWaste,
    sample,
  }
}

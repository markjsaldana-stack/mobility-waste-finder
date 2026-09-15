# Mobility Waste Finder

A browser-only audit of a wireless carrier invoice. Drop in a CSV export, get the specific lines that are wasting money, and print a one-page memo Finance can actually read.

Built as a working demo for a Brightfin conversation. The job of Brightfin’s public savings estimator is to qualify a lead and start a savings conversation — by asking the buyer to guess their own waste. This tool does the same marketing job with evidence instead of a slider.

Your file never leaves the browser. There is no backend, no login, and no upload.

## Run locally

```bash
npm install
npm run dev
```

Opens on [http://127.0.0.1:43127](http://127.0.0.1:43127). Use **the sample invoice** on the empty state if you do not have a file.

```bash
npm test    # locks the sample file to the published totals
npm run build
npm run preview
```

## What it does

Parses a carrier invoice CSV in memory and runs seven detection rules, **in order**. The first rule to match a line owns it. Categories do not overlap, so the headline number does not double-count.

1. Suspended lines still billing
2. Unassigned lines (no employee of record)
3. Zero usage across three billing periods
4. Duplicate lines per employee (low-use second line)
5. International day-pass bleed vs. a $100 global add-on
6. Chronic overage vs. Business Unlimited Plus
7. Oversized plan (unlimited or 15 GB, using under 5 GB) vs. Pooled 5GB

Right-sizing math uses a hardcoded plan catalog in `src/engine/analyze.ts`. That file is the whole detection engine.

The findings view is for the IT manager. **Memo to Finance** is the printable one-pager (`window.print()`, no PDF library): recoverable annual spend, the category table, top three cost centers, and an explicit list of what an invoice alone cannot see.

## Sample file

`public/brightfin_sample_invoice_2026-08.csv` is a synthetic 590-line enterprise export for August 2026. Expected result:

| | Lines | Monthly | Annual |
| --- | ---: | ---: | ---: |
| Suspended lines still billing | 19 | $1,163.81 | $13,965.72 |
| Unassigned lines | 30 | $1,252.88 | $15,034.56 |
| Zero usage, 3 periods | 40 | $2,421.75 | $29,061.00 |
| Duplicate lines per employee | 32 | $1,354.82 | $16,257.84 |
| International day-pass bleed | 11 | $832.00 | $9,984.00 |
| Chronic overage | 26 | $1,721.19 | $20,654.28 |
| Oversized plan for usage | 52 | $2,020.00 | $24,240.00 |
| **Total recoverable** | **210** | **$10,766.45** | **$129,197.40** |

That is 28.2% of $38,119.12 monthly spend ($457,429.44 annualized), inside Brightfin’s published 20–30% average cost reduction.

Regenerate only if the brief’s numbers change:

```bash
npm run generate-sample
```

## CSV columns

The parser expects the header in the sample file: `line_id`, `phone_number`, `assigned_employee`, `employee_id`, `department`, `cost_center`, `carrier`, `plan_name`, `plan_monthly_cost`, `data_allowance_gb` (999 = unlimited, 0 = none), usage for this period plus two prior periods, `voice_minutes_used`, `sms_count`, `feature_charges`, `overage_charges`, `international_roaming_charges`, `total_monthly_charge`, `line_status`, `device_model`, `activation_date`, `contract_end_date`, `billing_period`.

## Deploy

Static Vite app. Any static host works.

```bash
npm run build
npx vercel dist
```

Or connect the repo to Vercel and use the default Vite preset. No environment variables.

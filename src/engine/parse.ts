import Papa from "papaparse"
import type { InvoiceRow, ParseResult } from "./types"
import { toCents } from "./money"

export const REQUIRED_COLUMNS = [
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
] as const

const NUMERIC_COLUMNS = [
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
] as const

function cleanHeader(header: string): string {
  return header.replace(/^\uFEFF/, "").trim()
}

function parseNumber(raw: string, field: string, lineId: string): number | string {
  const trimmed = raw.trim()
  if (trimmed === "") {
    return 0
  }
  const cleaned = trimmed.replace(/[$,]/g, "")
  const n = Number(cleaned)
  if (!Number.isFinite(n)) {
    return `Line ${lineId || "(unknown)"}: “${field}” is not a number (${raw}).`
  }
  return n
}

function asRow(record: Record<string, string>): InvoiceRow | string {
  const lineId = (record.line_id ?? "").trim()
  const nums: Record<(typeof NUMERIC_COLUMNS)[number], number> = {
    plan_monthly_cost: 0,
    data_allowance_gb: 0,
    data_used_gb: 0,
    data_used_gb_prev1: 0,
    data_used_gb_prev2: 0,
    voice_minutes_used: 0,
    sms_count: 0,
    feature_charges: 0,
    overage_charges: 0,
    international_roaming_charges: 0,
    total_monthly_charge: 0,
  }

  for (const field of NUMERIC_COLUMNS) {
    const result = parseNumber(record[field] ?? "", field, lineId)
    if (typeof result === "string") return result
    nums[field] = result
  }

  return {
    lineId,
    phoneNumber: (record.phone_number ?? "").trim(),
    assignedEmployee: (record.assigned_employee ?? "").trim(),
    employeeId: (record.employee_id ?? "").trim(),
    department: (record.department ?? "").trim(),
    costCenter: (record.cost_center ?? "").trim(),
    carrier: (record.carrier ?? "").trim(),
    planName: (record.plan_name ?? "").trim(),
    planMonthlyCost: toCents(nums.plan_monthly_cost) / 100,
    dataAllowanceGb: nums.data_allowance_gb,
    dataUsedGb: nums.data_used_gb,
    dataUsedGbPrev1: nums.data_used_gb_prev1,
    dataUsedGbPrev2: nums.data_used_gb_prev2,
    voiceMinutesUsed: Math.round(nums.voice_minutes_used),
    smsCount: Math.round(nums.sms_count),
    featureCharges: toCents(nums.feature_charges) / 100,
    overageCharges: toCents(nums.overage_charges) / 100,
    internationalRoamingCharges: toCents(nums.international_roaming_charges) / 100,
    totalMonthlyCharge: toCents(nums.total_monthly_charge) / 100,
    lineStatus: (record.line_status ?? "").trim(),
    deviceModel: (record.device_model ?? "").trim(),
    activationDate: (record.activation_date ?? "").trim(),
    contractEndDate: (record.contract_end_date ?? "").trim(),
    billingPeriod: (record.billing_period ?? "").trim(),
  }
}

export function parseInvoiceCsv(text: string): ParseResult {
  const trimmed = text.replace(/^\uFEFF/, "").trim()
  if (!trimmed) {
    return { ok: false, error: "The file is empty." }
  }

  const parsed = Papa.parse<Record<string, string>>(trimmed, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: cleanHeader,
  })

  if (parsed.errors.length > 0 && parsed.data.length === 0) {
    const first = parsed.errors[0]
    return {
      ok: false,
      error: `Couldn’t read this file as CSV${first.row != null ? ` (row ${first.row + 1})` : ""}. ${first.message}`,
    }
  }

  const headers = (parsed.meta.fields ?? []).map(cleanHeader)
  if (headers.length === 0) {
    return { ok: false, error: "Couldn’t find a header row. Export the invoice as CSV with column names in the first row." }
  }

  const missing = REQUIRED_COLUMNS.filter((col) => !headers.includes(col))
  if (missing.length > 0) {
    const shown = missing.slice(0, 8).join(", ")
    const more = missing.length > 8 ? ` (+${missing.length - 8} more)` : ""
    return {
      ok: false,
      error: `This doesn’t look like a carrier invoice export. Missing columns: ${shown}${more}.`,
    }
  }

  const records = parsed.data.filter((row) =>
    Object.values(row).some((value) => String(value ?? "").trim() !== ""),
  )

  if (records.length === 0) {
    return { ok: false, error: "The file has a header row but no data lines." }
  }

  const rows: InvoiceRow[] = []
  const problems: string[] = []
  for (const record of records) {
    const result = asRow(record)
    if (typeof result === "string") {
      problems.push(result)
      if (problems.length >= 5) break
      continue
    }
    if (!result.lineId) {
      problems.push(`A row is missing line_id (around data row ${rows.length + 1}).`)
      if (problems.length >= 5) break
      continue
    }
    rows.push(result)
  }

  if (problems.length > 0 && rows.length === 0) {
    return { ok: false, error: problems[0] }
  }
  if (problems.length > 0) {
    return {
      ok: false,
      error: `Couldn’t parse ${problems.length === 5 ? "5+" : problems.length} row${problems.length === 1 ? "" : "s"}. ${problems[0]}`,
    }
  }

  return { ok: true, rows }
}

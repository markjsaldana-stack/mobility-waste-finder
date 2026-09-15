import Papa from "papaparse"
import { REQUIRED_COLUMNS, type FieldKey } from "./fields"
import type { ColumnMapping } from "./mapping"
import { toCents } from "./money"
import type { InvoiceRow, ParseResult } from "./types"

export { REQUIRED_COLUMNS } from "./fields"

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

const DATA_GB_FIELDS = new Set<FieldKey>([
  "data_allowance_gb",
  "data_used_gb",
  "data_used_gb_prev1",
  "data_used_gb_prev2",
])

export type CsvTable = {
  headers: string[]
  records: Record<string, string>[]
}

export type TableResult = { ok: true; table: CsvTable } | { ok: false; error: string }

function cleanHeader(header: string): string {
  return header.replace(/^\uFEFF/, "").trim()
}

function parseNumber(raw: string, field: string, lineId: string): number | string {
  const trimmed = raw.trim()
  if (trimmed === "") {
    return 0
  }
  const cleaned = trimmed.replace(/[$,]/g, "")
  if (/^unlimited$/i.test(cleaned) && field === "data_allowance_gb") {
    return 999
  }
  const n = Number(cleaned)
  if (!Number.isFinite(n)) {
    return `Line ${lineId || "(unknown)"}: “${field}” is not a number (${raw}).`
  }
  return n
}

function scaleIfNeeded(n: number, header: string, field: FieldKey): number {
  if (!DATA_GB_FIELDS.has(field)) return n
  const h = header.toLowerCase()
  if (/\b(kb|kilobyte)s?\b/.test(h)) return n / (1024 * 1024)
  if (/\b(mb|megabyte)s?\b/.test(h) && !/\bgb\b/.test(h)) return n / 1024
  return n
}

export function parseCsvTable(text: string): TableResult {
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

  const headers = (parsed.meta.fields ?? []).map(cleanHeader).filter(Boolean)
  if (headers.length === 0) {
    return { ok: false, error: "Couldn’t find a header row. Export the invoice as CSV with column names in the first row." }
  }

  const records = parsed.data.filter((row) =>
    Object.values(row).some((value) => String(value ?? "").trim() !== ""),
  )

  if (records.length === 0) {
    return { ok: false, error: "The file has a header row but no data lines." }
  }

  return { ok: true, table: { headers, records } }
}

function cell(record: Record<string, string>, header: string): string {
  return String(record[header] ?? "").trim()
}

export function rowsFromMapping(table: CsvTable, mapping: ColumnMapping): ParseResult {
  const rows: InvoiceRow[] = []
  const problems: string[] = []
  const src = (key: FieldKey) => mapping[key]

  for (let i = 0; i < table.records.length; i++) {
    const record = table.records[i]
    const mapped: Record<string, string> = {}
    for (const key of REQUIRED_COLUMNS) {
      const header = src(key)
      mapped[key] = header ? cell(record, header) : ""
    }

    const lineId = mapped.line_id || `L-${String(i + 1).padStart(5, "0")}`
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

    let bad: string | null = null
    for (const field of NUMERIC_COLUMNS) {
      const header = src(field)
      const result = parseNumber(header ? mapped[field] : "", field, lineId)
      if (typeof result === "string") {
        bad = result
        break
      }
      nums[field] = header ? scaleIfNeeded(result, header, field) : 0
    }
    if (bad) {
      problems.push(bad)
      if (problems.length >= 5) break
      continue
    }

    let total = toCents(nums.total_monthly_charge) / 100
    if (!src("total_monthly_charge")) {
      total =
        (toCents(nums.plan_monthly_cost) +
          toCents(nums.feature_charges) +
          toCents(nums.overage_charges) +
          toCents(nums.international_roaming_charges)) /
        100
    }

    rows.push({
      lineId,
      phoneNumber: mapped.phone_number,
      assignedEmployee: mapped.assigned_employee,
      employeeId: mapped.employee_id,
      department: mapped.department,
      costCenter: mapped.cost_center,
      carrier: mapped.carrier,
      planName: mapped.plan_name,
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
      totalMonthlyCharge: total,
      lineStatus: mapped.line_status || (src("line_status") ? mapped.line_status : "Active"),
      deviceModel: mapped.device_model,
      activationDate: mapped.activation_date,
      contractEndDate: mapped.contract_end_date,
      billingPeriod: mapped.billing_period,
    })
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

export function parseInvoiceCsv(text: string): ParseResult {
  const table = parseCsvTable(text)
  if (!table.ok) return table
  const missing = REQUIRED_COLUMNS.filter((col) => !table.table.headers.includes(col))
  if (missing.length > 0) {
    const shown = missing.slice(0, 8).join(", ")
    const more = missing.length > 8 ? ` (+${missing.length - 8} more)` : ""
    return {
      ok: false,
      error: `This doesn’t look like a carrier invoice export. Missing columns: ${shown}${more}.`,
    }
  }
  const mapping = Object.fromEntries(REQUIRED_COLUMNS.map((key) => [key, key])) as ColumnMapping
  return rowsFromMapping(table.table, mapping)
}

export function hasChargeColumn(mapping: ColumnMapping): boolean {
  return Boolean(mapping.total_monthly_charge || mapping.plan_monthly_cost)
}

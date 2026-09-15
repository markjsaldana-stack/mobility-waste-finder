import Papa from "papaparse"
import { REQUIRED_COLUMNS, type FieldKey } from "./fields"
import { detectHeaderRow, type ColumnMapping } from "./mapping"
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
  headerRow: number
  rawRows: string[][]
  defaultPeriod: string
}

export type TableResult = { ok: true; table: CsvTable } | { ok: false; error: string }

function cleanHeader(header: string): string {
  return header.replace(/^\uFEFF/, "").trim()
}

function uniqueHeaders(headers: string[]): string[] {
  const seen = new Map<string, number>()
  return headers.map((raw, i) => {
    const base = cleanHeader(raw) || `Column ${i + 1}`
    const n = (seen.get(base) ?? 0) + 1
    seen.set(base, n)
    return n === 1 ? base : `${base} (${n})`
  })
}

function isSummaryRow(row: string[]): boolean {
  const first = String(row[0] ?? "").trim()
  return /^(grand\s+total|report\s+total|totals?|subtotal)$/i.test(first)
}

function rowHasValue(row: string[]): boolean {
  return row.some((c) => String(c ?? "").trim() !== "")
}

function preambleBillingPeriod(rows: string[][], headerRow: number): string {
  for (let i = 0; i < headerRow; i++) {
    const row = rows[i] ?? []
    for (let j = 0; j < row.length; j++) {
      const label = String(row[j] ?? "").replace(/:$/, "").trim()
      if (/^billing period$/i.test(label) || /^bill period$/i.test(label)) {
        return String(row[j + 1] ?? "").trim()
      }
    }
  }
  return ""
}

export function parseRawRows(text: string): { ok: true; rows: string[][] } | { ok: false; error: string } {
  const trimmed = text.replace(/^\uFEFF/, "")
  if (!trimmed.trim()) {
    return { ok: false, error: "The file is empty." }
  }

  const parsed = Papa.parse<string[]>(trimmed, {
    header: false,
    skipEmptyLines: false,
  })

  if (parsed.errors.length > 0 && parsed.data.length === 0) {
    const first = parsed.errors[0]
    return {
      ok: false,
      error: `Couldn’t read this file as CSV${first.row != null ? ` (row ${first.row + 1})` : ""}. ${first.message}`,
    }
  }

  const rows = parsed.data.map((row) => (Array.isArray(row) ? row.map((c) => String(c ?? "")) : []))
  if (!rows.some(rowHasValue)) {
    return { ok: false, error: "The file is empty." }
  }
  return { ok: true, rows }
}

export function tableFromHeaderRow(rawRows: string[][], headerRow: number): CsvTable {
  const idx = Math.max(0, Math.min(headerRow, Math.max(0, rawRows.length - 1)))
  const headerSource = rawRows[idx] ?? []
  const width = Math.max(headerSource.length, ...rawRows.slice(idx + 1).map((r) => r.length), 1)
  const padded = Array.from({ length: width }, (_, i) => headerSource[i] ?? "")
  const headers = uniqueHeaders(padded)
  const records: Record<string, string>[] = []
  for (const row of rawRows.slice(idx + 1)) {
    if (!rowHasValue(row) || isSummaryRow(row)) continue
    const record: Record<string, string> = {}
    for (let i = 0; i < headers.length; i++) {
      record[headers[i]] = String(row[i] ?? "").trim()
    }
    records.push(record)
  }
  return {
    headers,
    records,
    headerRow: idx,
    rawRows,
    defaultPeriod: preambleBillingPeriod(rawRows, idx),
  }
}

function parseNumber(raw: string, field: string, lineId: string): number | string {
  const trimmed = raw.trim()
  if (!trimmed || /^(n\/?a|null|nil|none|-|—|–|\.)$/i.test(trimmed)) {
    return 0
  }
  if (DATA_GB_FIELDS.has(field as FieldKey) && /^(unl|unltd|unlimited|inf|∞)$/i.test(trimmed)) {
    return field === "data_allowance_gb" ? 999 : 0
  }
  const cleaned = trimmed.replace(/[$,]/g, "").replace(/\s*(tb|gb|mb|kb)\s*$/i, "").trim()
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
  const raw = parseRawRows(text)
  if (!raw.ok) return raw
  const headerRow = detectHeaderRow(raw.rows)
  const table = tableFromHeaderRow(raw.rows, headerRow)
  if (table.headers.length === 0) {
    return { ok: false, error: "Couldn’t find a header row. Pick the row that names the columns." }
  }
  if (table.records.length === 0) {
    return { ok: false, error: "The file has a header row but no data lines." }
  }
  return { ok: true, table }
}

function cell(record: Record<string, string>, header: string): string {
  return String(record[header] ?? "").trim()
}

function normalizeStatus(raw: string): string {
  const t = raw.trim().toLowerCase()
  if (!t) return "Active"
  if (/^(a|act|active|open|enabled)$/.test(t)) return "Active"
  if (/^(s|sus|susp|suspend|suspended|inactive|disabled)$/.test(t)) return "Suspended"
  if (t === "cancelled" || t === "canceled" || t === "closed") return raw.trim()
  return raw.trim()
}

function normalizeEmployee(raw: string): string {
  const t = raw.trim()
  if (!t || /^(n\/?a|-|—|–|\.|null|none|spare|unassigned)$/i.test(t)) return ""
  return t
}

export function rowsFromMapping(table: CsvTable, mapping: ColumnMapping): ParseResult {
  const rows: InvoiceRow[] = []
  const problems: string[] = []
  const src = (key: FieldKey) => mapping[key]
  const seenIds = new Map<string, number>()

  for (let i = 0; i < table.records.length; i++) {
    const record = table.records[i]
    const mapped: Record<string, string> = {}
    for (const key of REQUIRED_COLUMNS) {
      const header = src(key)
      mapped[key] = header ? cell(record, header) : ""
    }

    let lineId = mapped.line_id || `L-${String(i + 1).padStart(5, "0")}`
    const seen = (seenIds.get(lineId) ?? 0) + 1
    seenIds.set(lineId, seen)
    if (mapped.line_id && seen > 1) lineId = `${lineId}·${seen}`

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

    const totalMissing = !src("total_monthly_charge") || mapped.total_monthly_charge.trim() === ""
    let total = toCents(nums.total_monthly_charge) / 100
    if (totalMissing) {
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
      assignedEmployee: normalizeEmployee(mapped.assigned_employee),
      employeeId: normalizeEmployee(mapped.employee_id),
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
      lineStatus: src("line_status") ? normalizeStatus(mapped.line_status) : "Active",
      deviceModel: mapped.device_model,
      activationDate: mapped.activation_date,
      contractEndDate: mapped.contract_end_date,
      billingPeriod: mapped.billing_period || table.defaultPeriod || "",
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

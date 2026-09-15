import { FIELD_META, REQUIRED_COLUMNS, SKIP, type FieldKey } from "./fields"

export type ColumnMapping = Record<FieldKey, string>

export function normalizeHeader(value: string): string {
  return value
    .toLowerCase()
    .replace(/#/g, "number")
    .replace(/[^a-z0-9]+/g, "")
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  const curr = new Array<number>(b.length + 1)
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost)
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j]
  }
  return prev[b.length]
}

function scoreHeader(header: string, field: (typeof FIELD_META)[number]): number {
  const h = normalizeHeader(header)
  if (!h) return 0
  const key = normalizeHeader(field.key)
  if (h === key) return 100
  if (field.aliases.includes(h)) return 96
  if (h === normalizeHeader(field.label)) return 94
  for (const alias of [key, ...field.aliases]) {
    if (alias.length >= 4 && (h.includes(alias) || alias.includes(h))) {
      return 82
    }
  }
  const dist = Math.min(levenshtein(h, key), ...field.aliases.map((alias) => levenshtein(h, alias)))
  const basis = Math.max(h.length, key.length, 1)
  const ratio = 1 - dist / basis
  if (ratio >= 0.78) return Math.round(60 + ratio * 20)
  return 0
}

/** Greedy 1:1 match. Unmatched fields default to Don't include. */
export function suggestMapping(headers: string[]): ColumnMapping {
  const mapping = Object.fromEntries(REQUIRED_COLUMNS.map((key) => [key, SKIP])) as ColumnMapping
  const pairs: { field: FieldKey; header: string; score: number }[] = []
  for (const field of FIELD_META) {
    for (const header of headers) {
      const score = scoreHeader(header, field)
      if (score >= 70) pairs.push({ field: field.key, header, score })
    }
  }
  pairs.sort((a, b) => b.score - a.score)
  const usedFields = new Set<FieldKey>()
  const usedHeaders = new Set<string>()
  for (const pair of pairs) {
    if (usedFields.has(pair.field) || usedHeaders.has(pair.header)) continue
    mapping[pair.field] = pair.header
    usedFields.add(pair.field)
    usedHeaders.add(pair.header)
  }
  return mapping
}

export function skippedFields(mapping: ColumnMapping): FieldKey[] {
  return REQUIRED_COLUMNS.filter((key) => !mapping[key])
}

export function schemaIsComplete(headers: string[]): boolean {
  return REQUIRED_COLUMNS.every((col) => headers.includes(col))
}

export function sampleValues(
  records: Record<string, string>[],
  header: string,
  limit = 2,
): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const row of records) {
    const raw = String(row[header] ?? "").trim()
    if (!raw || seen.has(raw)) continue
    seen.add(raw)
    out.push(raw.length > 36 ? `${raw.slice(0, 34)}…` : raw)
    if (out.length >= limit) break
  }
  return out
}

export function unusedHeaders(headers: string[], mapping: ColumnMapping): string[] {
  const used = new Set(Object.values(mapping).filter(Boolean))
  return headers.filter((h) => !used.has(h))
}

function looksLikeDataCell(cell: string): boolean {
  const t = cell.trim()
  if (/^\$?-?\d[\d,]*(\.\d+)?$/.test(t)) return true
  if (/^\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}$/.test(t)) return true
  if (/^INV[-_]/i.test(t)) return true
  if (/^E\d{3,}$/i.test(t)) return true
  if (/^CC-\d+/i.test(t)) return true
  return false
}

/** How many cells in a row look like known invoice column names. */
export function headerMatchCount(cells: string[]): number {
  let n = 0
  for (const cell of cells) {
    if (!cell.trim()) continue
    if (FIELD_META.some((field) => scoreHeader(cell, field) >= 70)) n++
  }
  return n
}

/**
 * Find the first row that looks like column headers. Title rows and
 * “Account: / Billing Period:” banners score too low to win.
 */
export function detectHeaderRow(rows: string[][]): number {
  let bestIdx = 0
  let best = -1
  const limit = Math.min(rows.length, 50)
  for (let i = 0; i < limit; i++) {
    const row = rows[i] ?? []
    const cells = row.map((c) => String(c ?? "").trim()).filter(Boolean)
    if (cells.length < 3) continue
    const remaining = rows.slice(i + 1).filter((r) => r.some((c) => String(c ?? "").trim()))
    if (remaining.length === 0) continue
    const hits = headerMatchCount(cells)
    const dataRatio = cells.filter(looksLikeDataCell).length / cells.length
    let score = hits * 12 + Math.min(cells.length, 24)
    if (dataRatio > 0.35) score *= 0.15
    if (hits < 3) score *= 0.35
    if (score > best) {
      best = score
      bestIdx = i
    }
  }
  return bestIdx
}

export function headerRowPreview(row: string[], max = 4): string {
  const cells = row.map((c) => String(c ?? "").trim()).filter(Boolean)
  if (cells.length === 0) return "(empty)"
  const shown = cells.slice(0, max).join(", ")
  return cells.length > max ? `${shown}…` : shown
}

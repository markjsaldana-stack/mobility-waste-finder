import { useMemo, useState } from "react"
import { CATEGORY_META } from "./engine/analyze"
import { FIELD_META, SKIP, type FieldKey } from "./engine/fields"
import type { ColumnMapping } from "./engine/mapping"
import { headerRowPreview, sampleValues, suggestMapping, unusedHeaders } from "./engine/mapping"
import { hasChargeColumn, tableFromHeaderRow, type CsvTable } from "./engine/parse"
import { formatInt } from "./format"

type Props = {
  table: CsvTable
  initial: ColumnMapping
  fileName?: string
  onApply: (mapping: ColumnMapping, table: CsvTable) => void
  onCancel: () => void
  onSample: () => void
  error: string | null
}

export function ColumnMapper({ table, initial, fileName, onApply, onCancel, onSample, error }: Props) {
  const [headerRow, setHeaderRow] = useState(table.headerRow)
  const built = useMemo(() => tableFromHeaderRow(table.rawRows, headerRow), [table.rawRows, headerRow])
  const [mapping, setMapping] = useState<ColumnMapping>(initial)
  const unused = unusedHeaders(built.headers, mapping)
  const canContinue = hasChargeColumn(mapping)

  const skippedRules = useMemo(() => {
    const labels = new Set<string>()
    for (const field of FIELD_META) {
      if (mapping[field.key]) continue
      for (const rule of field.rules) labels.add(CATEGORY_META[rule].label)
    }
    return [...labels]
  }, [mapping])

  const rowChoices = useMemo(() => {
    const out: number[] = []
    const limit = Math.min(table.rawRows.length, 40)
    for (let i = 0; i < limit; i++) {
      const row = table.rawRows[i] ?? []
      if (i === headerRow || row.some((c) => String(c ?? "").trim())) out.push(i)
    }
    return out
  }, [table.rawRows, headerRow])

  const setField = (key: FieldKey, value: string) => {
    setMapping((prev) => ({ ...prev, [key]: value }))
  }

  const pickHeaderRow = (index: number) => {
    setHeaderRow(index)
    const next = tableFromHeaderRow(table.rawRows, index)
    setMapping(suggestMapping(next.headers))
  }

  return (
    <main className="mapper">
      <p className="empty-kicker">Schedule 0 — Column map</p>
      <p className="empty-lead">
        This file doesn’t use the standard export headers. Match each field to a column, or skip it.
        Skipped tests simply won’t run.
      </p>
      <p className="mapper-meta">
        {fileName ? <span>{fileName} · </span> : null}
        {formatInt(built.records.length)} rows · {formatInt(built.headers.length)} columns
      </p>

      <label className="mapper-header-row">
        <span>Header row</span>
        <select
          className="mapper-select"
          value={headerRow}
          onChange={(e) => pickHeaderRow(Number(e.target.value))}
        >
          {rowChoices.map((i) => (
            <option key={i} value={i}>
              Row {i + 1} — {headerRowPreview(table.rawRows[i] ?? [])}
            </option>
          ))}
        </select>
        {headerRow !== 0 ? (
          <span className="mapper-header-note">
            Title rows above this are ignored. Billing period in the banner, if present, is kept.
          </span>
        ) : null}
      </label>

      <div className="mapper-wrap">
        <table className="mapper-table">
          <thead>
            <tr>
              <th scope="col">This field</th>
              <th scope="col">Your column</th>
              <th scope="col">Sample</th>
            </tr>
          </thead>
          <tbody>
            {FIELD_META.map((field) => {
              const chosen = mapping[field.key]
              const samples = chosen ? sampleValues(built.records, chosen) : []
              return (
                <tr key={field.key}>
                  <th scope="row">
                    <span className="mapper-label">{field.label}</span>
                    <span className="mapper-hint">{field.hint}</span>
                  </th>
                  <td>
                    <select
                      className="mapper-select"
                      value={built.headers.includes(chosen) ? chosen : SKIP}
                      onChange={(e) => setField(field.key, e.target.value)}
                      aria-label={field.label}
                    >
                      <option value={SKIP}>Don’t include</option>
                      {built.headers.map((header) => (
                        <option key={header} value={header}>
                          {header}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="mapper-sample">
                    {samples.length > 0 ? samples.join(" · ") : chosen ? "—" : "Skipped"}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {skippedRules.length > 0 ? (
        <p className="mapper-note">Won’t be tested: {skippedRules.join("; ")}.</p>
      ) : null}

      {unused.length > 0 ? (
        <p className="mapper-note">
          Not used: {unused.slice(0, 12).join(", ")}
          {unused.length > 12 ? ` (+${unused.length - 12} more)` : ""}.
        </p>
      ) : null}

      {!canContinue ? (
        <p className="error" role="alert">
          Map a billed amount — total monthly charge or plan monthly cost — or there is nothing to
          recover.
        </p>
      ) : null}

      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mapper-actions">
        <button
          type="button"
          className="primary-btn"
          disabled={!canContinue}
          onClick={() => onApply(mapping, built)}
        >
          Review this file
        </button>
        <button type="button" className="text-btn" onClick={onCancel}>
          Choose another file
        </button>
        <button type="button" className="text-btn" onClick={onSample}>
          Use the sample invoice
        </button>
      </div>
    </main>
  )
}

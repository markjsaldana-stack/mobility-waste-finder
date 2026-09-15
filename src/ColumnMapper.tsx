import { useMemo, useState } from "react"
import { CATEGORY_META } from "./engine/analyze"
import { FIELD_META, SKIP, type FieldKey } from "./engine/fields"
import type { ColumnMapping } from "./engine/mapping"
import { sampleValues, unusedHeaders } from "./engine/mapping"
import { hasChargeColumn, type CsvTable } from "./engine/parse"
import { formatInt } from "./format"

type Props = {
  table: CsvTable
  initial: ColumnMapping
  fileName?: string
  onApply: (mapping: ColumnMapping) => void
  onCancel: () => void
  onSample: () => void
  error: string | null
}

export function ColumnMapper({ table, initial, fileName, onApply, onCancel, onSample, error }: Props) {
  const [mapping, setMapping] = useState<ColumnMapping>(initial)
  const unused = unusedHeaders(table.headers, mapping)
  const canContinue = hasChargeColumn(mapping)

  const skippedRules = useMemo(() => {
    const labels = new Set<string>()
    for (const field of FIELD_META) {
      if (mapping[field.key]) continue
      for (const rule of field.rules) labels.add(CATEGORY_META[rule].label)
    }
    return [...labels]
  }, [mapping])

  const setField = (key: FieldKey, value: string) => {
    setMapping((prev) => ({ ...prev, [key]: value }))
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
        {formatInt(table.records.length)} rows · {formatInt(table.headers.length)} columns
      </p>

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
              const samples = chosen ? sampleValues(table.records, chosen) : []
              return (
                <tr key={field.key}>
                  <th scope="row">
                    <span className="mapper-label">{field.label}</span>
                    <span className="mapper-hint">{field.hint}</span>
                  </th>
                  <td>
                    <select
                      className="mapper-select"
                      value={chosen}
                      onChange={(e) => setField(field.key, e.target.value)}
                      aria-label={field.label}
                    >
                      <option value={SKIP}>Don’t include</option>
                      {table.headers.map((header) => (
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
        <p className="mapper-note">
          Won’t be tested: {skippedRules.join("; ")}.
        </p>
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
        <button type="button" className="primary-btn" disabled={!canContinue} onClick={() => onApply(mapping)}>
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

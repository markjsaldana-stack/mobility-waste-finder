import { useCallback, useEffect, useRef, useState } from "react"
import { ColumnMapper } from "./ColumnMapper"
import { EmptyState } from "./EmptyState"
import { FindingsView } from "./FindingsView"
import { MemoView } from "./MemoView"
import { ReviewingView } from "./ReviewingView"
import { analyze } from "./engine/analyze"
import { REQUIRED_COLUMNS } from "./engine/fields"
import { schemaIsComplete, skippedFields, suggestMapping, type ColumnMapping } from "./engine/mapping"
import { parseCsvTable, parseInvoiceCsv, rowsFromMapping, type CsvTable } from "./engine/parse"
import type { Analysis } from "./engine/types"

const SAMPLE_PATH = "/sample_invoice_2026-08.csv"
const REVIEW_MS = 820

type Screen = "findings" | "memo"

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

export default function App() {
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [incoming, setIncoming] = useState<Analysis | null>(null)
  const [pending, setPending] = useState<{ table: CsvTable; mapping: ColumnMapping; fileName: string } | null>(
    null,
  )
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [screen, setScreen] = useState<Screen>("findings")
  const reviewTimer = useRef<number | null>(null)

  const clearReviewTimer = useCallback(() => {
    if (reviewTimer.current != null) {
      window.clearTimeout(reviewTimer.current)
      reviewTimer.current = null
    }
  }, [])

  useEffect(() => () => clearReviewTimer(), [clearReviewTimer])

  const present = useCallback(
    (next: Analysis) => {
      clearReviewTimer()
      setError(null)
      setPending(null)
      setScreen("findings")
      if (prefersReducedMotion()) {
        setIncoming(null)
        setAnalysis(next)
        return
      }
      setAnalysis(null)
      setIncoming(next)
      reviewTimer.current = window.setTimeout(() => {
        setAnalysis(next)
        setIncoming(null)
        reviewTimer.current = null
      }, REVIEW_MS)
    },
    [clearReviewTimer],
  )

  const runMapped = useCallback(
    (table: CsvTable, mapping: ColumnMapping, sample: boolean) => {
      const parsed = rowsFromMapping(table, mapping)
      if (!parsed.ok) {
        setError(parsed.error)
        return
      }
      present(
        analyze(parsed.rows, {
          sample,
          skipped: skippedFields(mapping),
        }),
      )
    },
    [present],
  )

  const runSampleText = useCallback(
    (text: string) => {
      const parsed = parseInvoiceCsv(text)
      if (!parsed.ok) {
        clearReviewTimer()
        setIncoming(null)
        setAnalysis(null)
        setPending(null)
        setError(parsed.error)
        return
      }
      present(analyze(parsed.rows, { sample: true }))
    },
    [clearReviewTimer, present],
  )

  const onFile = useCallback(
    async (file: File) => {
      setBusy(true)
      setError(null)
      try {
        const text = await file.text()
        const table = parseCsvTable(text)
        if (!table.ok) {
          clearReviewTimer()
          setIncoming(null)
          setAnalysis(null)
          setPending(null)
          setError(table.error)
          return
        }
        if (schemaIsComplete(table.table.headers)) {
          const mapping = Object.fromEntries(REQUIRED_COLUMNS.map((key) => [key, key])) as ColumnMapping
          runMapped(table.table, mapping, false)
          return
        }
        clearReviewTimer()
        setAnalysis(null)
        setIncoming(null)
        setPending({
          table: table.table,
          mapping: suggestMapping(table.table.headers),
          fileName: file.name,
        })
      } catch {
        clearReviewTimer()
        setIncoming(null)
        setAnalysis(null)
        setPending(null)
        setError("Couldn’t read that file. Export the invoice as CSV and try again.")
      } finally {
        setBusy(false)
      }
    },
    [clearReviewTimer, runMapped],
  )

  const onSample = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(SAMPLE_PATH)
      if (!res.ok) throw new Error("missing sample")
      const text = await res.text()
      runSampleText(text)
    } catch {
      clearReviewTimer()
      setIncoming(null)
      setAnalysis(null)
      setPending(null)
      setError("The sample invoice failed to load. Check that the app was built with the CSV in /public.")
    } finally {
      setBusy(false)
    }
  }, [clearReviewTimer, runSampleText])

  const reset = useCallback(() => {
    clearReviewTimer()
    setAnalysis(null)
    setIncoming(null)
    setPending(null)
    setError(null)
    setScreen("findings")
  }, [clearReviewTimer])

  const ready = analysis != null
  const reviewing = incoming != null && analysis == null

  return (
    <div className="desk">
      <div className="page">
        <header className="masthead no-print">
          <div className="masthead-left">
            <p className="wordmark">Mobility Waste Finder</p>
            <p className="masthead-sub">Mark Inc. · a findings document, not a dashboard.</p>
          </div>
          <div className="masthead-right">
            <p className="masthead-stamp">Confidential · in-browser</p>
            <p className="masthead-privacy">Your file never leaves your browser.</p>
          </div>
        </header>

        {ready && analysis ? (
          <>
            <nav className="view-switch no-print" aria-label="Document views">
              <div className="view-tabs">
                <button
                  type="button"
                  className={screen === "findings" ? "is-active" : undefined}
                  onClick={() => setScreen("findings")}
                >
                  Findings
                </button>
                <button
                  type="button"
                  className={screen === "memo" ? "is-active" : undefined}
                  onClick={() => setScreen("memo")}
                >
                  Memo to Finance
                </button>
              </div>
              <div className="view-actions">
                <button type="button" className="text-btn" onClick={() => window.print()}>
                  Print memo
                </button>
              </div>
            </nav>
            <div className="screen-only findings-enter" hidden={screen !== "findings"}>
              <FindingsView analysis={analysis} onUpload={onFile} uploadBusy={busy} />
            </div>
            <div className={screen === "memo" ? undefined : "memo-offscreen"}>
              <MemoView analysis={analysis} onUpload={onFile} uploadBusy={busy} />
            </div>
          </>
        ) : reviewing && incoming ? (
          <ReviewingView lineCount={incoming.lineCount} period={incoming.billingPeriod} />
        ) : pending ? (
          <ColumnMapper
            table={pending.table}
            initial={pending.mapping}
            fileName={pending.fileName}
            error={error}
            onApply={(mapping, mappedTable) => runMapped(mappedTable, mapping, false)}
            onCancel={reset}
            onSample={onSample}
          />
        ) : (
          <EmptyState error={error} busy={busy} onFile={onFile} onSample={onSample} />
        )}

        <footer className="colophon no-print">
          <p>Parsed on this page. The invoice is never uploaded.</p>
        </footer>
      </div>
    </div>
  )
}

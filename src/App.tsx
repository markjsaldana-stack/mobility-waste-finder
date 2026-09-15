import { useCallback, useEffect, useRef, useState } from "react"
import { EmptyState } from "./EmptyState"
import { FindingsView } from "./FindingsView"
import { MemoView } from "./MemoView"
import { ReviewingView } from "./ReviewingView"
import { analyze } from "./engine/analyze"
import { parseInvoiceCsv } from "./engine/parse"
import type { Analysis } from "./engine/types"

const SAMPLE_PATH = "/brightfin_sample_invoice_2026-08.csv"
const REVIEW_MS = 820

type Screen = "findings" | "memo"

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

export default function App() {
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [incoming, setIncoming] = useState<Analysis | null>(null)
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

  const run = useCallback(
    (text: string, sample: boolean) => {
      const parsed = parseInvoiceCsv(text)
      if (!parsed.ok) {
        clearReviewTimer()
        setIncoming(null)
        setAnalysis(null)
        setError(parsed.error)
        return
      }
      present(analyze(parsed.rows, sample))
    },
    [clearReviewTimer, present],
  )

  const onFile = useCallback(
    async (file: File) => {
      setBusy(true)
      setError(null)
      try {
        const text = await file.text()
        const sample = /brightfin_sample_invoice/i.test(file.name)
        run(text, sample)
      } catch {
        clearReviewTimer()
        setIncoming(null)
        setAnalysis(null)
        setError("Couldn’t read that file. Export the invoice as CSV and try again.")
      } finally {
        setBusy(false)
      }
    },
    [clearReviewTimer, run],
  )

  const onSample = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(SAMPLE_PATH)
      if (!res.ok) throw new Error("missing sample")
      const text = await res.text()
      run(text, true)
    } catch {
      clearReviewTimer()
      setIncoming(null)
      setAnalysis(null)
      setError("The sample invoice failed to load. Check that the app was built with the CSV in /public.")
    } finally {
      setBusy(false)
    }
  }, [clearReviewTimer, run])

  const reset = useCallback(() => {
    clearReviewTimer()
    setAnalysis(null)
    setIncoming(null)
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
            <p className="masthead-sub">A findings document, not a dashboard.</p>
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
                <button type="button" className="text-btn" onClick={reset}>
                  Analyze another file
                </button>
              </div>
            </nav>
            <div className="screen-only findings-enter" hidden={screen !== "findings"}>
              <FindingsView analysis={analysis} />
            </div>
            <div className={screen === "memo" ? undefined : "memo-offscreen"}>
              <MemoView analysis={analysis} />
            </div>
          </>
        ) : reviewing && incoming ? (
          <ReviewingView lineCount={incoming.lineCount} period={incoming.billingPeriod} />
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

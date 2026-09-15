import { useCallback, useState } from "react"
import { EmptyState } from "./EmptyState"
import { FindingsView } from "./FindingsView"
import { MemoView } from "./MemoView"
import { analyze } from "./engine/analyze"
import { parseInvoiceCsv } from "./engine/parse"
import type { Analysis } from "./engine/types"

const SAMPLE_PATH = "/brightfin_sample_invoice_2026-08.csv"

type Screen = "findings" | "memo"

export default function App() {
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [screen, setScreen] = useState<Screen>("findings")

  const run = useCallback((text: string, sample: boolean) => {
    const parsed = parseInvoiceCsv(text)
    if (!parsed.ok) {
      setAnalysis(null)
      setError(parsed.error)
      return
    }
    setError(null)
    setScreen("findings")
    setAnalysis(analyze(parsed.rows, sample))
  }, [])

  const onFile = useCallback(
    async (file: File) => {
      setBusy(true)
      setError(null)
      try {
        const text = await file.text()
        const sample = /brightfin_sample_invoice/i.test(file.name)
        run(text, sample)
      } catch {
        setAnalysis(null)
        setError("Couldn’t read that file. Export the invoice as CSV and try again.")
      } finally {
        setBusy(false)
      }
    },
    [run],
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
      setAnalysis(null)
      setError("The sample invoice failed to load. Check that the app was built with the CSV in /public.")
    } finally {
      setBusy(false)
    }
  }, [run])

  const reset = useCallback(() => {
    setAnalysis(null)
    setError(null)
    setScreen("findings")
  }, [])

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

        {analysis ? (
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
            <div className="screen-only" hidden={screen !== "findings"}>
              <FindingsView analysis={analysis} />
            </div>
            <div className={screen === "memo" ? undefined : "memo-offscreen"}>
              <MemoView analysis={analysis} />
            </div>
          </>
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

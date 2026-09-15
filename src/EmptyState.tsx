import { useCallback, useId, useState } from "react"

type Props = {
  error: string | null
  busy: boolean
  onFile: (file: File) => void
  onSample: () => void
}

export function EmptyState({ error, busy, onFile, onSample }: Props) {
  const inputId = useId()
  const [over, setOver] = useState(false)

  const takeFiles = useCallback(
    (files: FileList | null) => {
      const file = files?.[0]
      if (file) onFile(file)
    },
    [onFile],
  )

  return (
    <main className="empty">
      <p className="empty-lead">
        Drop a carrier invoice export. You get the lines that are wasting money, what to do
        about each one, and a one-page memo for Finance.
      </p>

      <label
        htmlFor={inputId}
        className={over ? "dropzone is-over" : "dropzone"}
        onDragEnter={(e) => {
          e.preventDefault()
          setOver(true)
        }}
        onDragOver={(e) => {
          e.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setOver(false)
          takeFiles(e.dataTransfer.files)
        }}
      >
        <input
          id={inputId}
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          disabled={busy}
          onChange={(e) => {
            takeFiles(e.target.files)
            e.currentTarget.value = ""
          }}
        />
        <span className="dropzone-kicker">CSV · one billing period</span>
        <span className="dropzone-title">{busy ? "Reading invoice…" : "Drop the export here"}</span>
        <span className="dropzone-sub">or click to choose a file</span>
      </label>

      <p className="empty-sample">
        <button type="button" className="text-btn" onClick={onSample} disabled={busy}>
          Use the sample invoice
        </button>
        <span className="dot" aria-hidden="true">
          ·
        </span>
        <span>590 lines, August 2026, synthetic.</span>
      </p>

      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}

      <p className="privacy">Your file never leaves your browser.</p>
    </main>
  )
}

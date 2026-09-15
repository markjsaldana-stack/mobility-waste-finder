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
      <p className="empty-kicker">Carrier invoice export</p>
      <p className="empty-lead">
        Drop the file. You get the lines that are wasting money, what to do about each one, and a
        one-page memo for Finance.
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
        <span className="crop crop-tl" aria-hidden="true" />
        <span className="crop crop-tr" aria-hidden="true" />
        <span className="crop crop-bl" aria-hidden="true" />
        <span className="crop crop-br" aria-hidden="true" />
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
        <span className="dropzone-kicker">Schedule A · CSV · one billing period</span>
        <span className="dropzone-title">{busy ? "Reading invoice…" : "Attach the export"}</span>
        <span className="dropzone-sub">Drop the file here, or click to choose one</span>
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
    </main>
  )
}

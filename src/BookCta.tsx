import { useEffect, useId, useRef, useState } from "react"
import {
  HUBSPOT_FORM_ID,
  HUBSPOT_PORTAL_ID,
  HUBSPOT_REGION,
  loadHubSpotForms,
} from "./hubspot"

type Props = {
  sample?: boolean
  onUpload?: (file: File) => void
  uploadBusy?: boolean
}

export function BookCta({ sample = false, onUpload, uploadBusy = false }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const openRef = useRef(false)
  const titleId = useId()
  const fileId = useId()
  const [open, setOpen] = useState(false)
  const [instanceId, setInstanceId] = useState("")
  const [scriptReady, setScriptReady] = useState(false)
  const [formReady, setFormReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const el = dialogRef.current
    return () => el?.close()
  }, [])

  useEffect(() => {
    if (!open) return
    const markReady = () => setFormReady(true)
    window.addEventListener("hs-form-event:on-ready", markReady)
    return () => window.removeEventListener("hs-form-event:on-ready", markReady)
  }, [open])

  const show = () => {
    openRef.current = true
    setError(null)
    setFormReady(false)
    setScriptReady(false)
    setInstanceId(crypto.randomUUID())
    setOpen(true)
    dialogRef.current?.showModal()
    loadHubSpotForms()
      .then(() => {
        if (openRef.current) setScriptReady(true)
      })
      .catch((err: unknown) => {
        if (openRef.current) {
          setError(err instanceof Error ? err.message : "Couldn’t load the booking form.")
        }
      })
  }

  const close = () => {
    openRef.current = false
    setOpen(false)
    setScriptReady(false)
    dialogRef.current?.close()
  }

  return (
    <aside className="book-cta no-print">
      <p className="book-cta-lead">Ready to see clearly and spend better?</p>
      <button type="button" className="book-cta-btn" aria-haspopup="dialog" onClick={show}>
        Book a time with Mark Inc.
      </button>
      {sample && onUpload ? (
        <p className="book-cta-alt">
          <label htmlFor={fileId} className={uploadBusy ? "text-btn is-disabled" : "text-btn"}>
            Or upload your own spreadsheet
          </label>
          <input
            id={fileId}
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            disabled={uploadBusy}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) onUpload(file)
              e.currentTarget.value = ""
            }}
          />
        </p>
      ) : null}

      <dialog
        ref={dialogRef}
        className="book-dialog"
        aria-labelledby={titleId}
        onClose={() => {
          openRef.current = false
          setOpen(false)
          setScriptReady(false)
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) close()
        }}
      >
        <div className="book-dialog-sheet">
          <p id={titleId} className="book-dialog-copy">
            Book a time with Mark Inc.
          </p>
          <p className="book-dialog-note">
            Enter your work email and you’ll be able to book a time with us. No spreadsheet
            information is saved or stored.
          </p>
          {!error && !formReady ? <p className="book-hs-loading">Loading the booking form…</p> : null}
          {scriptReady && instanceId && !error ? (
            <div
              className="hs-form-frame book-hs-mount"
              data-region={HUBSPOT_REGION}
              data-form-id={HUBSPOT_FORM_ID}
              data-portal-id={HUBSPOT_PORTAL_ID}
              data-instance-id={instanceId}
            />
          ) : null}
          {error ? (
            <p className="book-form-error" role="alert">
              {error}
            </p>
          ) : null}
          <button type="button" className="book-dialog-close" onClick={close}>
            Cancel
          </button>
        </div>
      </dialog>
    </aside>
  )
}

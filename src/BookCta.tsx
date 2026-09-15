import { useEffect, useId, useRef, useState } from "react"
import { loadHubSpotForms, mountHubSpotForm } from "./hubspot"

type Props = {
  sample?: boolean
  onUpload?: (file: File) => void
  uploadBusy?: boolean
}

export function BookCta({ sample = false, onUpload, uploadBusy = false }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const fileId = useId()
  const formMountId = `hs-form-${useId().replaceAll(":", "")}`
  const [open, setOpen] = useState(false)
  const [formReady, setFormReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const el = dialogRef.current
    return () => el?.close()
  }, [])

  useEffect(() => {
    if (!open) return
    let cancelled = false

    const markReady = () => {
      if (!cancelled) setFormReady(true)
    }
    window.addEventListener("hs-form-event:on-ready", markReady)

    const node = document.getElementById(formMountId)
    const observer = node
      ? new MutationObserver(() => {
          if (node.querySelector("iframe")) markReady()
        })
      : null
    if (node && observer) observer.observe(node, { childList: true, subtree: true })

    loadHubSpotForms()
      .then(() => {
        if (cancelled) return
        mountHubSpotForm(formMountId)
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Couldn’t load the booking form.")
        }
      })

    return () => {
      cancelled = true
      window.removeEventListener("hs-form-event:on-ready", markReady)
      observer?.disconnect()
      const mount = document.getElementById(formMountId)
      if (mount) mount.replaceChildren()
    }
  }, [open, formMountId])

  const show = () => {
    setError(null)
    setFormReady(false)
    setOpen(true)
    dialogRef.current?.showModal()
  }

  const close = () => {
    setOpen(false)
    dialogRef.current?.close()
  }

  return (
    <aside className="book-cta no-print">
      <p className="book-cta-lead">Ready to see clearly and spend better?</p>
      <button type="button" className="book-cta-btn" aria-haspopup="dialog" onClick={show}>
        Book a time with Brightfin
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
        onClose={() => setOpen(false)}
        onClick={(e) => {
          if (e.target === e.currentTarget) close()
        }}
      >
        <div className="book-dialog-sheet">
          <p id={titleId} className="book-dialog-copy">
            Book a time with Brightfin
          </p>
          <p className="book-dialog-note">
            Enter your work email and you’ll be able to book a time with us. No spreadsheet
            information is saved or stored.
          </p>
          {!error && !formReady ? <p className="book-hs-loading">Loading the booking form…</p> : null}
          <div id={formMountId} className="book-hs-mount" hidden={Boolean(error)} />
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

import { useEffect, useId, useRef, useState, type FormEvent } from "react"
import { submitLead } from "./hubspot"

type Props = {
  sample?: boolean
  onUpload?: (file: File) => void
  uploadBusy?: boolean
}

export function BookCta({ sample = false, onUpload, uploadBusy = false }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const emailId = useId()
  const firstId = useId()
  const lastId = useId()
  const companyId = useId()
  const fileId = useId()
  const [email, setEmail] = useState("")
  const [firstname, setFirstname] = useState("")
  const [lastname, setLastname] = useState("")
  const [company, setCompany] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  useEffect(() => {
    const el = dialogRef.current
    return () => el?.close()
  }, [])

  const resetForm = () => {
    setEmail("")
    setFirstname("")
    setLastname("")
    setCompany("")
    setBusy(false)
    setError(null)
    setSent(false)
  }

  const open = () => {
    resetForm()
    dialogRef.current?.showModal()
  }

  const close = () => {
    dialogRef.current?.close()
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const trimmed = email.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError("Enter a work email so Brightfin can follow up.")
      return
    }
    setBusy(true)
    setError(null)
    try {
      await submitLead({ email: trimmed, firstname, lastname, company })
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn’t reach HubSpot. Try again.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <aside className="book-cta no-print">
      <p className="book-cta-lead">Ready to see clearly and spend better?</p>
      <button type="button" className="book-cta-btn" aria-haspopup="dialog" onClick={open}>
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
        onClick={(e) => {
          if (e.target === e.currentTarget) close()
        }}
      >
        <div className="book-dialog-sheet">
          {sent ? (
            <>
              <p id={titleId} className="book-dialog-copy">
                You’re on the list. Brightfin will follow up at {email.trim()}.
              </p>
              <p className="book-dialog-note">The invoice never left this browser.</p>
              <button type="button" className="book-dialog-close" onClick={close}>
                Close
              </button>
            </>
          ) : (
            <form className="book-form" onSubmit={onSubmit}>
              <p id={titleId} className="book-dialog-copy">
                Book a time with Brightfin
              </p>
              <p className="book-dialog-note">
                Leave a work email. HubSpot gets the lead — not the spreadsheet.
              </p>
              <div className="book-form-row">
                <label htmlFor={firstId}>
                  First name
                  <input
                    id={firstId}
                    name="firstname"
                    autoComplete="given-name"
                    value={firstname}
                    onChange={(e) => setFirstname(e.target.value)}
                  />
                </label>
                <label htmlFor={lastId}>
                  Last name
                  <input
                    id={lastId}
                    name="lastname"
                    autoComplete="family-name"
                    value={lastname}
                    onChange={(e) => setLastname(e.target.value)}
                  />
                </label>
              </div>
              <label htmlFor={emailId}>
                Work email
                <input
                  id={emailId}
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <label htmlFor={companyId}>
                Company
                <input
                  id={companyId}
                  name="company"
                  autoComplete="organization"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                />
              </label>
              {error ? (
                <p className="book-form-error" role="alert">
                  {error}
                </p>
              ) : null}
              <button type="submit" className="book-cta-btn book-form-submit" disabled={busy}>
                {busy ? "Sending…" : "Send to Brightfin"}
              </button>
              <button type="button" className="book-dialog-close" onClick={close}>
                Cancel
              </button>
            </form>
          )}
        </div>
      </dialog>
    </aside>
  )
}

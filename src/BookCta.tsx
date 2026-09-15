import { useEffect, useId, useRef } from "react"

export function BookCta() {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const copyId = useId()

  useEffect(() => {
    const el = dialogRef.current
    return () => el?.close()
  }, [])

  const open = () => {
    dialogRef.current?.showModal()
  }

  const close = () => {
    dialogRef.current?.close()
  }

  return (
    <aside className="book-cta no-print">
      <p className="book-cta-lead">Ready to see clearly and spend better?</p>
      <button type="button" className="book-cta-btn" aria-haspopup="dialog" onClick={open}>
        Book a time with Brightfin
      </button>

      <dialog
        ref={dialogRef}
        className="book-dialog"
        aria-labelledby={copyId}
        onClick={(e) => {
          if (e.target === e.currentTarget) close()
        }}
      >
        <div className="book-dialog-sheet">
          <p id={copyId} className="book-dialog-copy">
            This is just a demo, but in real life, we’d send you to a calendar to book a time :)
          </p>
          <button type="button" className="book-dialog-close" onClick={close}>
            Close
          </button>
        </div>
      </dialog>
    </aside>
  )
}

import { useEffect, useId, useRef, useState } from "react"

const TREATMENTS = [
  { id: "solid", label: "Solid" },
  { id: "cyan", label: "Cyan" },
  { id: "band", label: "Band" },
] as const

type Treatment = (typeof TREATMENTS)[number]["id"]

type Props = {
  picker?: boolean
}

export function BookCta({ picker = false }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const copyId = useId()
  const [treatment, setTreatment] = useState<Treatment>("solid")

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
    <aside className={`book-cta is-${treatment} no-print`}>
      <p className="book-cta-lead">Ready to see clearly and spend better?</p>
      <button type="button" className="book-cta-btn" aria-haspopup="dialog" onClick={open}>
        Book a time with Brightfin
      </button>
      {picker ? (
        <div className="cta-picker" role="tablist" aria-label="CTA treatments">
          {TREATMENTS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={treatment === item.id}
              className={treatment === item.id ? "is-active" : undefined}
              onClick={() => setTreatment(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}

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

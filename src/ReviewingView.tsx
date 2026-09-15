import { formatInt, formatPeriod } from "./format"

type Props = {
  lineCount: number
  period: string
}

export function ReviewingView({ lineCount, period }: Props) {
  return (
    <div className="reviewing" role="status" aria-live="polite">
      <p className="empty-kicker">Invoice received</p>
      <p className="reviewing-title">Reviewing {formatInt(lineCount)} lines</p>
      <p className="reviewing-sub">
        {formatPeriod(period)}. First matching rule owns the line — categories will not overlap.
      </p>
      <div className="review-track" aria-hidden="true">
        <span className="review-bar" />
      </div>
    </div>
  )
}

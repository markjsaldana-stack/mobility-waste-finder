import { useState } from "react"
import { BookCta } from "./BookCta"
import type { Analysis, Finding, FindingGroup } from "./engine/types"
import { formatMoney } from "./engine/money"
import { formatInt, formatPct, formatPeriod } from "./format"

type Props = {
  analysis: Analysis
}

export function FindingsView({ analysis }: Props) {
  const [open, setOpen] = useState<string | null>(null)

  return (
    <div className="findings">
      {analysis.sample ? (
        <p className="sample-mark">Sample data — synthetic invoice for demonstration.</p>
      ) : null}

      <section className="headline" aria-label="Recoverable spend">
        <p className="headline-kicker">Recoverable annual spend</p>
        <p className="headline-number">{formatMoney(analysis.recoverableAnnual)}</p>
        <p className="headline-sub">
          {formatMoney(analysis.totalMonthlySpend)} analyzed this period ·{" "}
          {formatMoney(analysis.annualizedSpend)} annualized · {formatPct(analysis.reductionPct)} of
          spend
        </p>
        <BookCta picker />
        <dl className="headline-meta">
          <div>
            <dt>Period</dt>
            <dd>{formatPeriod(analysis.billingPeriod)}</dd>
          </div>
          <div className="num">
            <dt>Lines analyzed</dt>
            <dd>{formatInt(analysis.lineCount)}</dd>
          </div>
          <div className="num">
            <dt>Lines flagged</dt>
            <dd>{formatInt(analysis.flaggedLineCount)}</dd>
          </div>
          <div className="num">
            <dt>Recoverable / mo</dt>
            <dd>{formatMoney(analysis.recoverableMonthly)}</dd>
          </div>
        </dl>
      </section>

      <div className="ledger-wrap">
        <p className="schedule-label">Schedule 1 — Findings by category</p>
        <table className="ledger">
          <caption className="sr-only">Findings by category</caption>
          <thead>
            <tr>
              <th scope="col">Finding</th>
              <th scope="col" className="num">
                Lines
              </th>
              <th scope="col" className="num">
                Monthly
              </th>
              <th scope="col" className="num">
                Annual
              </th>
            </tr>
          </thead>
          {analysis.groups.map((group) => (
            <GroupBlock
              key={group.category}
              group={group}
              expanded={open === group.category}
              notTested={analysis.skippedRules.includes(group.category)}
              onToggle={() => setOpen(open === group.category ? null : group.category)}
            />
          ))}
          <tfoot>
            <tr>
              <th scope="row">Total recoverable</th>
              <td className="num">{formatInt(analysis.flaggedLineCount)}</td>
              <td className="num">{formatMoney(analysis.recoverableMonthly)}</td>
              <td className="num">{formatMoney(analysis.recoverableAnnual)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {analysis.skippedRules.length > 0 ? (
        <p className="rule-note">
          Not tested (no column mapped):{" "}
          {analysis.skippedRules
            .map((rule) => analysis.groups.find((g) => g.category === rule)?.label ?? rule)
            .join("; ")}
          .
        </p>
      ) : null}

      <p className="rule-note">
        A line is claimed by the first rule it matches. Categories do not overlap — which is why
        this number is smaller, and more defensible, than stacking every heuristic on the same row.
      </p>
    </div>
  )
}

function GroupBlock({
  group,
  expanded,
  notTested,
  onToggle,
}: {
  group: FindingGroup
  expanded: boolean
  notTested: boolean
  onToggle: () => void
}) {
  const empty = group.findings.length === 0
  return (
    <tbody className={expanded ? "group is-open" : "group"}>
      <tr>
        <th scope="row">
          <button
            type="button"
            className="group-btn"
            aria-expanded={expanded}
            disabled={empty}
            onClick={onToggle}
          >
            <span className="chevron" aria-hidden="true">
              {empty ? "·" : expanded ? "▾" : "▸"}
            </span>
            <span>
              <span className="group-label">{group.label}</span>
              <span className="group-action">
                {notTested ? "Not tested — no column mapped for this rule." : group.action}
              </span>
            </span>
          </button>
        </th>
        <td className="num">{notTested || empty ? "—" : formatInt(group.findings.length)}</td>
        <td className="num">{notTested || empty ? "—" : formatMoney(group.monthlySavings)}</td>
        <td className="num">{notTested || empty ? "—" : formatMoney(group.annualSavings)}</td>
      </tr>
      {expanded
        ? group.findings.map((item) => <LineRow key={item.row.lineId} finding={item} />)
        : null}
    </tbody>
  )
}

function LineRow({ finding }: { finding: Finding }) {
  const { row } = finding
  const contract =
    finding.inContract === true ? "in contract" : finding.inContract === false ? "contract ended" : null
  const meta = [row.planName, row.costCenter, row.department, row.carrier].filter(Boolean)
  return (
    <tr className="line">
      <td colSpan={4}>
        <div className="line-block">
          <div className="line-head">
            <span className="line-id">{row.lineId}</span>
            <span className="line-phone">{row.phoneNumber}</span>
            <span className="line-who">
              {row.assignedEmployee || "Unassigned"}
              {row.employeeId ? ` · ${row.employeeId}` : ""}
            </span>
            <span className="line-save">
              <span className="num">{formatMoney(finding.monthlySavings)}/mo</span>
              <span className="num">{formatMoney(finding.annualSavings)}/yr</span>
            </span>
          </div>
          {meta.length > 0 || contract ? (
            <p className="line-mid">
              {meta.join(" · ")}
              {contract ? <span className="line-contract">{contract}</span> : null}
            </p>
          ) : null}
          <p className="line-math">{finding.math}</p>
        </div>
      </td>
    </tr>
  )
}

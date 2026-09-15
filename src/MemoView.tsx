import type { Analysis } from "./engine/types"
import { formatMoney } from "./engine/money"
import { formatInt, formatPct, formatPeriod } from "./format"

type Props = {
  analysis: Analysis
}

export function MemoView({ analysis }: Props) {
  const period = formatPeriod(analysis.billingPeriod)

  return (
    <article className="memo-page">
      <header className="memo-letterhead">
        <div>
          <p className="memo-mark">Mobility Waste Finding</p>
          <p className="memo-firm">Prepared from the attached carrier invoice</p>
        </div>
        <p className="memo-exhibit">Exhibit A</p>
      </header>

      <dl className="memo-header">
        <div>
          <dt>To</dt>
          <dd>Finance / IT Cost Management</dd>
        </div>
        <div>
          <dt>From</dt>
          <dd>Wireless invoice review</dd>
        </div>
        <div>
          <dt>Re</dt>
          <dd>Recoverable spend on mobile lines — {period}</dd>
        </div>
        <div>
          <dt>Period</dt>
          <dd>
            {period} · {formatInt(analysis.lineCount)} lines · {formatMoney(analysis.annualizedSpend)}{" "}
            annualized
          </dd>
        </div>
      </dl>

      {analysis.sample ? (
        <p className="sample-mark memo-sample">Sample data — synthetic invoice for demonstration.</p>
      ) : null}

      <section className="memo-number">
        <p className="headline-kicker">Recoverable annual spend</p>
        <p className="headline-number">{formatMoney(analysis.recoverableAnnual)}</p>
        <p className="headline-sub">
          {formatMoney(analysis.recoverableMonthly)} per month · {formatPct(analysis.reductionPct)} of
          current wireless spend
        </p>
      </section>

      <table className="memo-table">
        <caption>Findings</caption>
        <thead>
          <tr>
            <th scope="col">Category</th>
            <th scope="col" className="num">
              Lines
            </th>
            <th scope="col" className="num">
              Annual impact
            </th>
            <th scope="col">Recommended action</th>
          </tr>
        </thead>
        <tbody>
          {analysis.groups
            .filter((g) => g.findings.length > 0)
            .map((g) => (
              <tr key={g.category}>
                <td>{g.label}</td>
                <td className="num">{formatInt(g.findings.length)}</td>
                <td className="num">{formatMoney(g.annualSavings)}</td>
                <td className="memo-action">{g.action}</td>
              </tr>
            ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">Total</th>
            <td className="num">{formatInt(analysis.flaggedLineCount)}</td>
            <td className="num">{formatMoney(analysis.recoverableAnnual)}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>

      <table className="memo-table">
        <caption>Top cost centers by waste — route to an owner</caption>
        <thead>
          <tr>
            <th scope="col">Cost center</th>
            <th scope="col">Department</th>
            <th scope="col" className="num">
              Lines
            </th>
            <th scope="col" className="num">
              Annual impact
            </th>
          </tr>
        </thead>
        <tbody>
          {analysis.costCenterWaste.map((cc) => (
            <tr key={cc.costCenter}>
              <td className="mono-id">{cc.costCenter}</td>
              <td>{cc.department}</td>
              <td className="num">{formatInt(cc.lineCount)}</td>
              <td className="num">{formatMoney(cc.annualSavings)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="memo-limits">
        This analysis is limited to what a single-period invoice can prove. It cannot see full
        contract terms or ETFs, pooled-plan true-up across lines, devices out of warranty, or
        anything on cloud or SaaS. Those questions need the invoice, the contract, and the HR roster
        in the same place — which is the work this finding is meant to start, not finish.
      </p>
    </article>
  )
}

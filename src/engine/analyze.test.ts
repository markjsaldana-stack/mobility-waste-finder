import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { analyze } from "./analyze"
import { parseInvoiceCsv } from "./parse"
import { toCents } from "./money"

const csv = readFileSync("public/sample_invoice_2026-08.csv", "utf8")

describe("sample invoice", () => {
  const parsed = parseInvoiceCsv(csv)
  if (!parsed.ok) {
    throw new Error(parsed.error)
  }
  const analysis = analyze(parsed.rows, true)

  it("parses 590 lines and the published spend", () => {
    expect(analysis.lineCount).toBe(590)
    expect(toCents(analysis.totalMonthlySpend)).toBe(3811912)
    expect(toCents(analysis.annualizedSpend)).toBe(45742944)
  })

  it("matches every category total from the brief", () => {
    const expected: Record<string, { lines: number; monthlyCents: number }> = {
      suspended: { lines: 19, monthlyCents: 116381 },
      unassigned: { lines: 30, monthlyCents: 125288 },
      zero_usage: { lines: 40, monthlyCents: 242175 },
      duplicate: { lines: 32, monthlyCents: 135482 },
      international: { lines: 11, monthlyCents: 83200 },
      overage: { lines: 26, monthlyCents: 172119 },
      oversized: { lines: 52, monthlyCents: 202000 },
    }

    for (const group of analysis.groups) {
      const exp = expected[group.category]
      expect(group.findings.length, group.category).toBe(exp.lines)
      expect(toCents(group.monthlySavings), group.category).toBe(exp.monthlyCents)
      expect(toCents(group.annualSavings), group.category).toBe(exp.monthlyCents * 12)
    }
  })

  it("does not double-count lines", () => {
    const ids = analysis.findings.map((f) => f.row.lineId)
    expect(new Set(ids).size).toBe(ids.length)
    expect(analysis.flaggedLineCount).toBe(210)
    expect(toCents(analysis.recoverableMonthly)).toBe(1076645)
    expect(toCents(analysis.recoverableAnnual)).toBe(12919740)
    expect(analysis.reductionPct.toFixed(1)).toBe("28.2")
  })
})

describe("parseInvoiceCsv", () => {
  it("surfaces missing columns instead of a blank screen", () => {
    const result = parseInvoiceCsv("foo,bar\n1,2\n")
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toMatch(/Missing columns/)
    }
  })

  it("rejects an empty file", () => {
    const result = parseInvoiceCsv("   ")
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toMatch(/empty/i)
    }
  })
})

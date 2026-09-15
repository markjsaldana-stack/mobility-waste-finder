import { describe, expect, it } from "vitest"
import { analyze } from "./analyze"
import { SKIP } from "./fields"
import { schemaIsComplete, suggestMapping } from "./mapping"
import { parseCsvTable, rowsFromMapping } from "./parse"

describe("suggestMapping", () => {
  it("maps a Verizon-style export without requiring our headers", () => {
    const headers = [
      "Wireless Number",
      "User Name",
      "Employee ID",
      "Department",
      "Cost Center",
      "Carrier",
      "Rate Plan",
      "MRC",
      "Data Allowance (GB)",
      "Data Usage (GB)",
      "Prior Month Usage (GB)",
      "Two Months Ago Usage (GB)",
      "Voice Minutes",
      "SMS",
      "Features",
      "Overage",
      "Roaming",
      "Current Charges",
      "Status",
      "Device",
      "Activation Date",
      "Contract End",
      "Bill Period",
    ]
    const mapping = suggestMapping(headers)
    expect(mapping.phone_number).toBe("Wireless Number")
    expect(mapping.assigned_employee).toBe("User Name")
    expect(mapping.employee_id).toBe("Employee ID")
    expect(mapping.plan_name).toBe("Rate Plan")
    expect(mapping.plan_monthly_cost).toBe("MRC")
    expect(mapping.total_monthly_charge).toBe("Current Charges")
    expect(mapping.line_status).toBe("Status")
    expect(mapping.international_roaming_charges).toBe("Roaming")
    expect(mapping.overage_charges).toBe("Overage")
    expect(schemaIsComplete(headers)).toBe(false)
  })

  it("leaves weak matches as Don't include", () => {
    const mapping = suggestMapping(["Foo", "Bar", "Baz"])
    expect(mapping.phone_number).toBe(SKIP)
    expect(mapping.total_monthly_charge).toBe(SKIP)
  })
})

describe("rowsFromMapping", () => {
  it("applies a mapping and skips unassigned when that column is omitted", () => {
    const csv = [
      "Wireless Number,User Name,MRC,Current Charges,Status",
      "555-010-0001,Ada Lovelace,32.00,40.00,Active",
      "555-010-0002,,18.00,18.00,Suspended",
    ].join("\n")
    const table = parseCsvTable(csv)
    if (!table.ok) throw new Error(table.error)
    const mapping = suggestMapping(table.table.headers)
    mapping.assigned_employee = SKIP
    const parsed = rowsFromMapping(table.table, mapping)
    if (!parsed.ok) throw new Error(parsed.error)
    expect(parsed.rows).toHaveLength(2)
    expect(parsed.rows[0].lineId).toMatch(/^L-/)
    expect(parsed.rows[0].phoneNumber).toBe("555-010-0001")
    const analysis = analyze(parsed.rows, { skipped: ["assigned_employee"] })
    expect(analysis.skippedRules).toContain("unassigned")
    expect(analysis.groups.find((g) => g.category === "unassigned")?.findings).toHaveLength(0)
    expect(analysis.groups.find((g) => g.category === "suspended")?.findings).toHaveLength(1)
  })
})

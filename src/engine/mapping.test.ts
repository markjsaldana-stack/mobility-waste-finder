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

const NATIONAL_BANNER = `NATIONAL ACCOUNTS - WIRELESS BILLING DETAIL EXPORT
Account:,0412-88-3910,,Billing Period:,08/01/2026 - 08/31/2026
Generated:,09/03/2026 02:14 AM CT,,Currency:,USD

Invoice #,Wireless Number,Subscriber,Emp ID,Cost Ctr,Carrier/Vendor,Rate Plan Description,MRC,Data Allowance,Data Usage (MB),Prior Mo Usage (MB),Voice Min,Msgs,Feature Chgs,Overage,Intl Chgs,Total Charges,Status,Equipment,Activation Dt,Contract Exp
INV-2026-08-42728,(337) 555-2568,"WHITLOCK, YARA",E10035,CC-4100,AT&T MOBILITY,POOLED 15 GB,$48.00,15 GB,"11,178","12,121",128,171,,$0.00,$0.00,$48.00,A,APPLE IPAD 10,10/30/25,
INV-2026-08-42058,(608) 555-9002,"REYES, ELI",E10049,CC-4400,T-MOBILE US,POOLED 5 GB,$32.00,5 GB,,0,0,0,$15.99,$0.00,,$47.99,Susp,CRADLEPOINT IBR900,02/05/2022,02/15/2027
INV-2026-08-47640,(833) 555-7423,SPARE,,CC-3000,VERIZON WIRELESS,BUS UNL PLUS,$65.00,UNL,-,0,0,0,$11.99,$0.00,$0.00,$76.99,active,APPLE IPHONE 15,2021-03-19,
GRAND TOTAL,3 lines,,,`

describe("banner exports", () => {
  it("finds headers below the title row and maps the national-accounts columns", () => {
    const table = parseCsvTable(NATIONAL_BANNER)
    if (!table.ok) throw new Error(table.error)
    expect(table.table.headerRow).toBe(4)
    expect(table.table.headers[0]).toBe("Invoice #")
    expect(table.table.headers).toContain("Wireless Number")
    expect(table.table.defaultPeriod).toBe("08/01/2026 - 08/31/2026")
    expect(table.table.records).toHaveLength(3)

    const mapping = suggestMapping(table.table.headers)
    expect(mapping.phone_number).toBe("Wireless Number")
    expect(mapping.assigned_employee).toBe("Subscriber")
    expect(mapping.employee_id).toBe("Emp ID")
    expect(mapping.cost_center).toBe("Cost Ctr")
    expect(mapping.plan_monthly_cost).toBe("MRC")
    expect(mapping.total_monthly_charge).toBe("Total Charges")
    expect(mapping.line_status).toBe("Status")
    expect(mapping.data_used_gb).toBe("Data Usage (MB)")
    expect(mapping.data_used_gb_prev1).toBe("Prior Mo Usage (MB)")

    const parsed = rowsFromMapping(table.table, mapping)
    if (!parsed.ok) throw new Error(parsed.error)
    expect(parsed.rows[0].billingPeriod).toBe("08/01/2026 - 08/31/2026")
    expect(parsed.rows[0].dataAllowanceGb).toBe(15)
    expect(parsed.rows[0].lineStatus).toBe("Active")
    expect(parsed.rows[1].lineStatus).toBe("Suspended")
    expect(parsed.rows[2].assignedEmployee).toBe("")
    expect(parsed.rows[2].dataAllowanceGb).toBe(999)
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

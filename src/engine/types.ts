export type InvoiceRow = {
  lineId: string
  phoneNumber: string
  assignedEmployee: string
  employeeId: string
  department: string
  costCenter: string
  carrier: string
  planName: string
  planMonthlyCost: number
  dataAllowanceGb: number
  dataUsedGb: number
  dataUsedGbPrev1: number
  dataUsedGbPrev2: number
  voiceMinutesUsed: number
  smsCount: number
  featureCharges: number
  overageCharges: number
  internationalRoamingCharges: number
  totalMonthlyCharge: number
  lineStatus: string
  deviceModel: string
  activationDate: string
  contractEndDate: string
  billingPeriod: string
}

export const FINDING_CATEGORIES = [
  "suspended",
  "unassigned",
  "zero_usage",
  "duplicate",
  "international",
  "overage",
  "oversized",
] as const

export type FindingCategory = (typeof FINDING_CATEGORIES)[number]

export type Finding = {
  category: FindingCategory
  row: InvoiceRow
  monthlySavings: number
  annualSavings: number
  action: string
  math: string
  inContract: boolean | null
  sibling: InvoiceRow | null
}

export type FindingGroup = {
  category: FindingCategory
  label: string
  action: string
  findings: Finding[]
  monthlySavings: number
  annualSavings: number
}

export type CostCenterWaste = {
  costCenter: string
  department: string
  lineCount: number
  monthlySavings: number
  annualSavings: number
}

export type Analysis = {
  rows: InvoiceRow[]
  findings: Finding[]
  groups: FindingGroup[]
  lineCount: number
  flaggedLineCount: number
  totalMonthlySpend: number
  annualizedSpend: number
  recoverableMonthly: number
  recoverableAnnual: number
  reductionPct: number
  billingPeriod: string
  costCenterWaste: CostCenterWaste[]
  sample: boolean
}

export type ParseResult =
  | { ok: true; rows: InvoiceRow[] }
  | { ok: false; error: string }

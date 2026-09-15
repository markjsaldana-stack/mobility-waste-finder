/** Integer cents. Invoice math stays in cents so $10,766.45 does not drift. */
export function toCents(n: number): number {
  return Math.round(n * 100)
}

export function fromCents(cents: number): number {
  return cents / 100
}

export function formatMoney(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n)
}

export function formatGb(n: number): string {
  if (Number.isInteger(n)) return String(n)
  return n.toFixed(2).replace(/0+$/, "").replace(/\.$/, "")
}

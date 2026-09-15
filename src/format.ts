export function formatPeriod(period: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(period)
  if (!match) return period
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ]
  const month = months[Number(match[2]) - 1]
  return month ? `${month} ${match[1]}` : period
}

export function formatInt(n: number): string {
  return new Intl.NumberFormat("en-US").format(n)
}

export function formatPct(n: number): string {
  return `${n.toFixed(1)}%`
}

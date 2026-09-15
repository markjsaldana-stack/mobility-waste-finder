const PORTAL_ID = import.meta.env.VITE_HUBSPOT_PORTAL_ID || "52017559"
const FORM_ID = import.meta.env.VITE_HUBSPOT_FORM_ID || "ec8e3ff9-31f1-4957-abfa-226db430c7ba"

export const HUBSPOT_SUBMIT_URL = `https://api.hsforms.com/submissions/v3/integration/submit/${PORTAL_ID}/${FORM_ID}`

export type LeadFields = {
  email: string
  firstname?: string
  lastname?: string
  company?: string
}

export function hubspotPayload(fields: LeadFields, pageUri: string, pageName: string, hutk?: string) {
  const entries = [
    { name: "email", value: fields.email.trim() },
    { name: "firstname", value: fields.firstname?.trim() ?? "" },
    { name: "lastname", value: fields.lastname?.trim() ?? "" },
    { name: "company", value: fields.company?.trim() ?? "" },
  ].filter((field) => field.value)

  const context: Record<string, string> = { pageUri, pageName }
  if (hutk) context.hutk = hutk

  return { fields: entries, context }
}

function readHutk(): string | undefined {
  const match = document.cookie.match(/(?:^|;\s*)hubspotutk=([^;]+)/)
  return match?.[1]
}

export async function submitLead(fields: LeadFields): Promise<void> {
  const res = await fetch(HUBSPOT_SUBMIT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(
      hubspotPayload(fields, window.location.href, "Mobility Waste Finder", readHutk()),
    ),
  })
  if (!res.ok) {
    let detail = ""
    try {
      const body = (await res.json()) as { message?: string; errors?: { message?: string }[] }
      detail = body.errors?.map((e) => e.message).filter(Boolean).join(" ") || body.message || ""
    } catch {
      detail = await res.text().catch(() => "")
    }
    throw new Error(detail || `HubSpot returned ${res.status}.`)
  }
}

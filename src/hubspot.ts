export const HUBSPOT_PORTAL_ID = import.meta.env.VITE_HUBSPOT_PORTAL_ID || "52017559"
export const HUBSPOT_FORM_ID = import.meta.env.VITE_HUBSPOT_FORM_ID || "ec8e3ff9-31f1-4957-abfa-226db430c7ba"
export const HUBSPOT_REGION = "na1"
export const HUBSPOT_SCRIPT_SRC = `https://js.hsforms.net/forms/embed/${HUBSPOT_PORTAL_ID}.js`

let loading: Promise<void> | null = null

export function hubSpotFrameAttributes(instanceId: string): Record<string, string> {
  return {
    class: "hs-form-frame",
    "data-region": HUBSPOT_REGION,
    "data-form-id": HUBSPOT_FORM_ID,
    "data-portal-id": HUBSPOT_PORTAL_ID,
    "data-instance-id": instanceId,
  }
}

export function loadHubSpotForms(): Promise<void> {
  if (typeof document === "undefined") {
    return Promise.reject(new Error("Couldn’t load the booking form."))
  }
  if (loading) return loading
  loading = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${HUBSPOT_SCRIPT_SRC}"]`,
    )
    if (existing) {
      if (existing.dataset.hsLoaded === "true") {
        resolve()
        return
      }
      existing.addEventListener(
        "load",
        () => {
          existing.dataset.hsLoaded = "true"
          resolve()
        },
        { once: true },
      )
      existing.addEventListener(
        "error",
        () => {
          loading = null
          reject(new Error("Couldn’t load the booking form."))
        },
        { once: true },
      )
      return
    }
    const script = document.createElement("script")
    script.src = HUBSPOT_SCRIPT_SRC
    script.async = true
    script.onload = () => {
      script.dataset.hsLoaded = "true"
      resolve()
    }
    script.onerror = () => {
      loading = null
      reject(new Error("Couldn’t load the booking form."))
    }
    document.head.appendChild(script)
  })
  return loading
}

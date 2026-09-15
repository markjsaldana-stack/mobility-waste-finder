import { describe, expect, it } from "vitest"
import {
  HUBSPOT_FORM_ID,
  HUBSPOT_PORTAL_ID,
  HUBSPOT_REGION,
  HUBSPOT_SCRIPT_SRC,
  hubSpotFrameAttributes,
} from "./hubspot"

describe("HubSpot booking embed", () => {
  it("loads HubSpot’s native form so conditional fields run on their side", () => {
    expect(HUBSPOT_PORTAL_ID).toBe("52017559")
    expect(HUBSPOT_FORM_ID).toBe("ec8e3ff9-31f1-4957-abfa-226db430c7ba")
    expect(HUBSPOT_SCRIPT_SRC).toBe(`https://js.hsforms.net/forms/embed/${HUBSPOT_PORTAL_ID}.js`)
  })

  it("stamps the frame HubSpot’s embed script looks for", () => {
    expect(hubSpotFrameAttributes("instance-1")).toEqual({
      class: "hs-form-frame",
      "data-region": HUBSPOT_REGION,
      "data-form-id": HUBSPOT_FORM_ID,
      "data-portal-id": HUBSPOT_PORTAL_ID,
      "data-instance-id": "instance-1",
    })
  })
})

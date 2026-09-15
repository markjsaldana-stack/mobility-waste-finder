import { describe, expect, it } from "vitest"
import { hubspotPayload } from "./hubspot"

describe("hubspotPayload", () => {
  it("sends email and omits blank optional fields", () => {
    const body = hubspotPayload(
      { email: " ada@brightfin.example ", firstname: "Ada", lastname: " ", company: "" },
      "https://example.test/",
      "Mobility Waste Finder",
    )
    expect(body.fields).toEqual([
      { name: "email", value: "ada@brightfin.example" },
      { name: "firstname", value: "Ada" },
    ])
    expect(body.context).toEqual({
      pageUri: "https://example.test/",
      pageName: "Mobility Waste Finder",
    })
  })

  it("includes the HubSpot tracking cookie when present", () => {
    const body = hubspotPayload(
      { email: "ada@brightfin.example" },
      "https://example.test/",
      "Mobility Waste Finder",
      "utk-1",
    )
    expect(body.context.hutk).toBe("utk-1")
  })
})

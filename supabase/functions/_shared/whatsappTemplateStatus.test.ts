import { describe, expect, it } from "vitest";
import {
  findMetaTemplateForLanguage,
  mapMetaTemplateStatus,
  mapMetaTemplateWebhookEvent,
} from "./whatsappTemplateStatus.ts";

describe("WhatsApp template status", () => {
  it("selects the exact language when Meta returns several variants", () => {
    const templates = [
      {
        name: "melosoft_order_confirmation_v1",
        language: "es_MX",
        status: "PENDING",
      },
      {
        name: "melosoft_order_confirmation_v1",
        language: "es_CO",
        status: "APPROVED",
      },
    ];

    expect(
      findMetaTemplateForLanguage(
        templates,
        "melosoft_order_confirmation_v1",
        "es_CO",
      )?.status,
    ).toBe("APPROVED");
  });

  it("accepts Meta locale separators in either format", () => {
    expect(
      findMetaTemplateForLanguage(
        [{ name: "test", language: "es-CO", status: "APPROVED" }],
        "test",
        "es_CO",
      )?.status,
    ).toBe("APPROVED");
  });

  it("maps lookup and webhook lifecycle states without downgrading unknown events", () => {
    expect(mapMetaTemplateStatus("APPROVED")).toBe("approved");
    expect(mapMetaTemplateStatus("REINSTATED")).toBe("approved");
    expect(mapMetaTemplateWebhookEvent("FLAGGED")).toBe("paused");
    expect(mapMetaTemplateWebhookEvent("DELETED")).toBe("disabled");
    expect(mapMetaTemplateWebhookEvent("A_NEW_META_EVENT")).toBeNull();
  });
});

export type WhatsappTemplateStatus =
  | "not_created"
  | "pending"
  | "approved"
  | "rejected"
  | "paused"
  | "disabled";

export interface MetaTemplateRecord {
  name?: string;
  language?: string;
  status?: string;
  rejected_reason?: string;
}

const KNOWN_META_TEMPLATE_EVENTS = new Set([
  "APPROVED",
  "REINSTATED",
  "PENDING",
  "IN_APPEAL",
  "REJECTED",
  "PAUSED",
  "FLAGGED",
  "DISABLED",
  "DELETED",
  "PENDING_DELETION",
]);

function normalizeTemplateLanguage(language: string | undefined): string {
  return (language ?? "").trim().toLowerCase().replaceAll("-", "_");
}

/**
 * Converts Meta's review state into the smaller set stored by Melosoft.
 * Unknown lookup values are treated as not_created, but webhook callers
 * should use mapMetaTemplateWebhookEvent so a new Meta event can never
 * accidentally downgrade an existing approved template.
 */
export function mapMetaTemplateStatus(
  metaStatus: string | undefined,
): WhatsappTemplateStatus {
  switch ((metaStatus ?? "").trim().toUpperCase()) {
    case "APPROVED":
    case "REINSTATED":
      return "approved";
    case "PENDING":
    case "IN_APPEAL":
      return "pending";
    case "REJECTED":
      return "rejected";
    case "PAUSED":
    case "FLAGGED":
      return "paused";
    case "DISABLED":
    case "DELETED":
    case "PENDING_DELETION":
      return "disabled";
    default:
      return "not_created";
  }
}

export function mapMetaTemplateWebhookEvent(
  event: string | undefined,
): Exclude<WhatsappTemplateStatus, "not_created"> | null {
  const normalized = (event ?? "").trim().toUpperCase();
  if (!KNOWN_META_TEMPLATE_EVENTS.has(normalized)) return null;

  const status = mapMetaTemplateStatus(normalized);
  return status === "not_created" ? null : status;
}

/**
 * A WABA can hold the same template name in several languages. Meta's
 * name filter can therefore return multiple rows; select the exact
 * language instead of trusting data[0]. Hyphen and underscore locale
 * separators are equivalent in Meta webhook/Graph API responses.
 */
export function findMetaTemplateForLanguage(
  records: MetaTemplateRecord[] | undefined,
  templateName: string,
  templateLanguage: string,
): MetaTemplateRecord | undefined {
  const expectedLanguage = normalizeTemplateLanguage(templateLanguage);
  return records?.find((record) =>
    record.name === templateName &&
    normalizeTemplateLanguage(record.language) === expectedLanguage
  );
}

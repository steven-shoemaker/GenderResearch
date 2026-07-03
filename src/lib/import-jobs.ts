import type { AnalysisResult, Entry, ImportJobListing } from "../types";
import { newId, todayIsoDate } from "./utils";

export function importJobKey(source: string, externalId: string): string {
  return `${source}:${externalId}`;
}

export function entryImportKey(entry: Entry): string | null {
  if (!entry.externalJobId || !entry.importSource) return null;
  return importJobKey(entry.importSource, entry.externalJobId);
}

export function listingToEntry(
  listing: ImportJobListing,
  analysis: AnalysisResult,
  categoryId: string | null = null,
): Entry {
  const now = new Date().toISOString();
  const captured =
    listing.postedAt && listing.postedAt.length >= 10
      ? listing.postedAt.slice(0, 10)
      : todayIsoDate();
  const notes = listing.location ? `Location: ${listing.location}` : "";

  return {
    id: newId(),
    saved: true,
    bodyText: listing.description,
    title: listing.title,
    company: listing.company,
    sourceUrl: listing.sourceUrl,
    capturedDate: captured,
    categoryId,
    industry: listing.industry,
    externalJobId: listing.externalId,
    importSource: listing.importSource,
    salaryGbp: listing.salaryGbp,
    notes,
    analysis,
    bodyDirty: false,
    attachments: [],
    archived: false,
    createdAt: now,
    updatedAt: now,
  };
}

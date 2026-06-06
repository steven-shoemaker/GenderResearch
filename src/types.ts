export type MatchCategory = "masculine" | "feminine";

export interface Match {
  matchedText: string;
  category: MatchCategory;
  start: number;
  end: number;
  pattern: string;
}

export interface AnalysisResult {
  totalWordCount: number;
  masculineCount: number;
  feminineCount: number;
  masculinePercent: number;
  femininePercent: number;
  matches: Match[];
  analyzedAt: string;
}

export interface AttachmentMeta {
  id: string;
  fileName: string;
  mimeType: string;
  uploadedAt: string;
  size: number;
  url: string;
  pathname?: string;
}

/** Normalized job row from Fantastic.jobs (via our API proxy). */
export interface ImportJobListing {
  externalId: string;
  title: string;
  company: string;
  industry: string;
  description: string;
  sourceUrl: string;
  salaryGbp: number | null;
  postedAt: string | null;
  location: string;
  /** ATS platform or job board (e.g. greenhouse, linkedin, workday). */
  sourceSite: string;
  importSource: "fantastic-jobs";
}

export interface Entry {
  id: string;
  saved: boolean;
  bodyText: string;
  title: string;
  company: string;
  sourceUrl: string;
  capturedDate: string;
  /** LinkedIn-style industry when imported from a job feed. */
  industry: string;
  /** External job id for dedup (e.g. Fantastic.jobs). */
  externalJobId: string | null;
  importSource: string | null;
  /** Annual salary in GBP, optional (for future analysis). */
  salaryGbp: number | null;
  notes: string;
  analysis: AnalysisResult | null;
  bodyDirty: boolean;
  attachments: AttachmentMeta[];
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Lexicon {
  masculine: string[];
  feminine: string[];
  updatedAt: string;
}

export type DraftEntry = Omit<Entry, "id" | "createdAt" | "updatedAt"> & {
  id?: string;
};

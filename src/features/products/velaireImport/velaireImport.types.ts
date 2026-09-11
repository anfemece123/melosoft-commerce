export interface VelaireCatalogRow {
  id: number;
  brand: string;
  name: string;
  gender: string;
  concentration: string | null;
  accords: string[];
  shortDescription: string;
  description: string;
  topNotes: string;
  heartNotes: string;
  baseNotes: string;
  needsReview: boolean;
  verificationStatus: string;
  reviewNote: string | null;
  sourceUrl: string | null;
  pdfPage: string | null;
  originalTitle: string | null;
}

export type ImportRowStatus = 'pending' | 'creating' | 'created' | 'skipped' | 'error';

export interface ImportRowResult {
  row: VelaireCatalogRow;
  status: ImportRowStatus;
  message?: string;
}

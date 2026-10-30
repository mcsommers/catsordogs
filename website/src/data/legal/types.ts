export type LegalSection = {
  title: string;
  /** Optional hash link target (for example `contact` → `#contact`). */
  id?: string;
  paragraphs: string[];
  bullets?: string[];
};

export type LegalDocument = {
  title: string;
  metaDescription: string;
  lastUpdated: string;
  intro?: string;
  sections: LegalSection[];
};

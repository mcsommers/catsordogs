export type LegalSection = {
  title: string;
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

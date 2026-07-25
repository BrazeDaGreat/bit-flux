import type { DatePrecision } from "../types";

/**
 * The shape the extraction model must return, one per separated thought.
 * Nothing produces this yet — Phase 2 fills in the provider behind it. Defined
 * now so the dump schema and the UI are already aimed at the right target.
 */
export interface ExtractedThought {
  title: string;
  /** Cleaned-up wording. Same meaning as the raw text, no added facts. */
  body: string;
  /** Names of existing tags the model matched. */
  tags: string[];
  /** New tags the model wants — never applied until the user approves. */
  suggested_tags: { name: string; description: string }[];
  people: string[];
  action_date: string | null;
  deadline: string | null;
  reminder_at: string | null;
  resurface_at: string | null;
  date_precision: DatePrecision | null;
  /** The phrase the date came from: "tomorrow", "tonight by 6". */
  date_source_text: string | null;
  /** 0–1. Anything low lands in the review queue instead of being applied. */
  confidence: number;
}

export interface ExtractionResult {
  thoughts: ExtractedThought[];
  model: string;
}

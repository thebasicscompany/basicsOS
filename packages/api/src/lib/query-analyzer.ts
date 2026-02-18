export type DataSource = "knowledge" | "crm" | "meetings";

export type QueryAnalysis = {
  sources: DataSource[];
  searchQuery: string;
};

// Simple keyword-based classifier (Phase 1 — no LLM needed for classification)
export const analyzeQuery = (query: string): QueryAnalysis => {
  const q = query.toLowerCase();
  const sources: DataSource[] = [];

  if (q.match(/\b(doc|document|wiki|knowledge|page|note|how to|guide|policy|procedure)\b/)) {
    sources.push("knowledge");
  }
  if (q.match(/\b(deal|contact|company|crm|lead|pipeline|sales|customer|client)\b/)) {
    sources.push("crm");
  }
  if (q.match(/\b(meeting|transcript|summary|decision|action item|discussed)\b/)) {
    sources.push("meetings");
  }
  // Default: search all sources
  if (sources.length === 0) sources.push("knowledge", "crm", "meetings");

  return { sources, searchQuery: query };
};

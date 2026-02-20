import type { SearchResult } from "./semantic-search.js";

export type AssembledContext = {
  chunks: Array<{ source: string; sourceId: string; text: string; score: number }>;
  tokensBudgeted: number;
};

const MAX_CONTEXT_TOKENS = 8000;
const TOKENS_PER_CHAR = 0.25; // rough estimate

const estimateTokens = (text: string): number => Math.ceil(text.length * TOKENS_PER_CHAR);

export const assembleContext = (
  results: SearchResult[],
  maxTokens = MAX_CONTEXT_TOKENS,
): AssembledContext => {
  const sorted = [...results].sort((a, b) => b.score - a.score);
  const chunks: AssembledContext["chunks"] = [];
  let tokensUsed = 0;

  for (const result of sorted) {
    const tokenCost = estimateTokens(result.chunkText);
    if (tokensUsed + tokenCost > maxTokens) break;
    chunks.push({
      source: result.sourceType,
      sourceId: result.sourceId,
      text: result.chunkText,
      score: result.score,
    });
    tokensUsed += tokenCost;
  }

  return { chunks, tokensBudgeted: tokensUsed };
};

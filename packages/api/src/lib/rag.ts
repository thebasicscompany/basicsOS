import { semanticSearch } from "./semantic-search.js";
import { analyzeQuery } from "./query-analyzer.js";
import { assembleContext } from "./context-assembler.js";
import { chatCompletion } from "./llm-client.js";

export type RagResult = {
  answer: string;
  sources: Array<{ sourceType: string; sourceId: string; snippet: string }>;
  finishReason: string;
};

export type ConversationMessage = { role: "user" | "assistant"; content: string };

const buildSystemPrompt = (context: string): string =>
  `You are Basics OS Company Assistant — an AI grounded in this company's data.
Answer questions based ONLY on the context provided below. If the context doesn't
contain enough information, say so clearly. Always cite sources by referencing
the [Source N] markers.

## Company Data Context
${context}`;

const buildMessages = (systemPrompt: string, history: ConversationMessage[], query: string) => [
  { role: "system" as const, content: systemPrompt },
  ...history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
  { role: "user" as const, content: query },
];

const buildContextText = (
  chunks: Array<{ source: string; sourceId: string; text: string }>,
): string => {
  if (chunks.length === 0) return "No relevant company data found.";
  return chunks
    .map((c, i) => `[Source ${i + 1} — ${c.source} ID: ${c.sourceId}]\n${c.text}`)
    .join("\n\n---\n\n");
};

export const ragChat = async (
  query: string,
  tenantId: string,
  history: ConversationMessage[] = [],
  userId?: string,
): Promise<RagResult> => {
  const { searchQuery } = analyzeQuery(query);

  // Retrieve context — fail gracefully if search is unavailable
  let chunks: ReturnType<typeof assembleContext>["chunks"] = [];
  try {
    const searchResults = await semanticSearch(searchQuery, tenantId, 20);
    chunks = assembleContext(searchResults).chunks;
  } catch {
    // Return empty context — assistant will answer "no data found"
  }

  const contextText = buildContextText(chunks);
  const systemPrompt = buildSystemPrompt(contextText);
  const messages = buildMessages(systemPrompt, history, query);

  // Call LLM — fail with a user-visible error message
  let response: { content: string; finishReason: string };
  try {
    response = await chatCompletion(
      { messages },
      { tenantId, ...(userId ? { userId } : {}), featureName: "assistant.chat" },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      answer: `AI service unavailable: ${message}`,
      sources: [],
      finishReason: "error",
    };
  }

  const sources = chunks.map((c) => ({
    sourceType: c.source,
    sourceId: c.sourceId,
    snippet: c.text.slice(0, 200),
  }));

  return { answer: response.content, sources, finishReason: response.finishReason };
};

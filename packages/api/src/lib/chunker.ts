export type Chunk = { text: string; index: number };

const MAX_TOKENS = 500;
const OVERLAP_TOKENS = 50;

const estimateTokens = (text: string): number => Math.ceil(text.length / 4);

export const chunkText = (text: string, mode: "document" | "transcript" = "document"): Chunk[] => {
  if (mode === "transcript") return chunkTranscript(text);
  return chunkDocument(text);
};

const chunkDocument = (text: string): Chunk[] => {
  const paragraphs = text.split(/\n{2,}/);
  const chunks: Chunk[] = [];
  let current = "";
  let index = 0;

  for (const para of paragraphs) {
    if (estimateTokens(current + "\n\n" + para) > MAX_TOKENS && current.length > 0) {
      chunks.push({ text: current.trim(), index: index++ });
      const words = current.split(" ");
      current = words.slice(-OVERLAP_TOKENS).join(" ") + "\n\n" + para;
    } else {
      current = current ? current + "\n\n" + para : para;
    }
  }

  if (current.trim()) chunks.push({ text: current.trim(), index: index });
  return chunks;
};

const chunkTranscript = (text: string): Chunk[] => {
  const turns = text.split(/\n(?=[A-Za-z][^:]+:)/);
  return turns
    .map((turn, index) => ({ text: turn.trim(), index }))
    .filter((c) => c.text.length > 0);
};

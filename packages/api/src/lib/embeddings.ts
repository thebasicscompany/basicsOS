export type EmbeddingResult = { embedding: number[]; text: string };

const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMENSIONS = 1536;

const buildStubEmbeddings = (texts: string[]): EmbeddingResult[] =>
  texts.map((text) => ({
    text,
    embedding: Array.from({ length: EMBEDDING_DIMENSIONS }, () => Math.random() - 0.5),
  }));

const fetchEmbeddings = async (
  texts: string[],
  apiKey: string,
  apiUrl: string,
): Promise<EmbeddingResult[]> => {
  const response = await fetch(`${apiUrl}/v1/embeddings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: texts }),
  });

  if (!response.ok) {
    throw new Error(`Embedding API error: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as {
    data: Array<{ embedding: number[]; index: number }>;
  };

  return data.data.map((item) => ({
    text: texts[item.index] ?? "",
    embedding: item.embedding,
  }));
};

export const embedTexts = async (texts: string[]): Promise<EmbeddingResult[]> => {
  const apiKey = process.env["AI_API_KEY"] ?? process.env["OPENAI_API_KEY"];
  const apiUrl = process.env["AI_API_URL"] ?? "https://api.openai.com";

  if (!apiKey) {
    return buildStubEmbeddings(texts);
  }

  return fetchEmbeddings(texts, apiKey, apiUrl);
};

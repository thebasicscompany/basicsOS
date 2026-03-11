export async function aiExtractStructured(
  rawData: Record<string, unknown>,
  entityType: "contact" | "company",
  gatewayUrl: string,
  gatewayHeaders: Record<string, string>,
): Promise<Record<string, unknown> | null> {
  const fields =
    entityType === "contact"
      ? "title (job title), phone, linkedinUrl, companyName, industry, location"
      : "industry, employeeCount, founded, headquarters, description, techStack";

  const prompt = `Extract structured information from this raw data about a ${entityType}. Return ONLY valid JSON with these fields (use null if not found): ${fields}\n\nRaw data:\n${JSON.stringify(rawData, null, 2)}`;

  try {
    const response = await fetch(`${gatewayUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { ...gatewayHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0,
        max_tokens: 500,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) return null;

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;

    const cleaned = content
      .replace(/```json\n?/g, "")
      .replace(/\n?```/g, "")
      .trim();
    return JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function extractFromWebSearch(
  query: string,
  gatewayUrl: string,
  gatewayHeaders: Record<string, string>,
  env: Record<string, string>,
): Promise<Record<string, unknown> | null> {
  try {
    const { executeWebSearch } = await import(
      "../automation-actions/web-search.js"
    );
    const apiKey =
      gatewayHeaders["authorization"]?.replace("Bearer ", "") ?? "";
    const results = await executeWebSearch(
      { query, numResults: 3 },
      {},
      {
        BASICSOS_API_URL: env.BASICSOS_API_URL ?? gatewayUrl,
      } as { BASICSOS_API_URL: string },
      apiKey,
    );
    if (!results?.length) return null;

    const combinedText = results
      .map(
        (r: { title: string; url: string; text?: string }) =>
          `${r.title}: ${r.text || ""}`,
      )
      .join("\n");
    return { _webSearchResults: combinedText };
  } catch {
    return null;
  }
}

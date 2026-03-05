export async function executeAI(
  config: Record<string, unknown>,
  _context: Record<string, unknown>,
  apiKey: string,
  env: { BASICSOS_API_URL: string },
): Promise<string> {
  const { prompt, model = "claude-sonnet-4-5-20251001" } = config as {
    prompt: string;
    model?: string;
  };

  const response = await fetch(`${env.BASICSOS_API_URL}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      stream: false,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`AI request failed (${response.status}): ${text}`);
  }

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
  };

  return data.choices[0]?.message?.content ?? "";
}

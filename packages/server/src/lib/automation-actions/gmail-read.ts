export async function executeGmailRead(
  config: Record<string, unknown>,
  _context: Record<string, unknown>,
  apiKey: string,
  env: { BASICSOS_API_URL: string },
  userId: string,
): Promise<Record<string, unknown>> {
  const { query = "is:unread", maxResults = 5 } = config as {
    query?: string;
    maxResults?: number;
  };

  const response = await fetch(
    `${env.BASICSOS_API_URL}/v1/execute/gmail/read`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "X-User-Id": userId,
      },
      body: JSON.stringify({ query, maxResults, userId }),
    },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gmail read failed (${response.status}): ${text}`);
  }

  const data = (await response.json()) as { messages: unknown[] };
  return { gmail_messages: data.messages };
}

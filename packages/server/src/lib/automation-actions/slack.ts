export async function executeSlack(
  config: Record<string, unknown>,
  _context: Record<string, unknown>,
  apiKey: string,
  env: { BASICSOS_API_URL: string },
  userId: string,
): Promise<Record<string, unknown>> {
  const { channel, message } = config as { channel: string; message: string };

  const response = await fetch(
    `${env.BASICSOS_API_URL}/v1/execute/slack/message`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "X-User-Id": userId,
      },
      body: JSON.stringify({ channel, text: message, userId }),
    },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Slack message failed (${response.status}): ${text}`);
  }

  const data = await response.json();
  return { slack_result: data };
}

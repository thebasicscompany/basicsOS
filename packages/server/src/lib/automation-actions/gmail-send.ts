export async function executeGmailSend(
  config: Record<string, unknown>,
  _context: Record<string, unknown>,
  apiKey: string,
  env: { BASICSOS_API_URL: string },
  userId: string,
): Promise<void> {
  const { to, subject, body } = config as {
    to: string;
    subject: string;
    body: string;
  };

  const response = await fetch(
    `${env.BASICSOS_API_URL}/v1/execute/gmail/send`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "X-User-Id": userId,
      },
      body: JSON.stringify({ to, subject, body, userId }),
    },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gmail send failed (${response.status}): ${text}`);
  }
}

export type EmailResult = { emailsSent: number };

export async function executeEmail(
  config: Record<string, unknown>,
  _context: Record<string, unknown>,
  apiKey: string,
  env: { BASICSOS_API_URL: string },
): Promise<EmailResult> {
  const { to, subject, body } = config as {
    to: string;
    subject: string;
    body: string;
  };

  const response = await fetch(`${env.BASICSOS_API_URL}/v1/email/send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ to, subject, content: body }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Email send failed (${response.status}): ${text}`);
  }

  return { emailsSent: 1 };
}

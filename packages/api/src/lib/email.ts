import { Resend } from "resend";

const resend = process.env["RESEND_API_KEY"] ? new Resend(process.env["RESEND_API_KEY"]) : null;

export type InviteEmailOptions = {
  to: string;
  inviterName: string;
  companyName: string;
  role: string;
  inviteUrl: string;
};

export const sendInviteEmail = async (opts: InviteEmailOptions): Promise<void> => {
  if (!resend) {
    // Development: log to console instead of sending
    console.warn(`[email] INVITE (no RESEND_API_KEY set)`);
    console.warn(`  To: ${opts.to}`);
    console.warn(`  Link: ${opts.inviteUrl}`);
    return;
  }

  const { error } = await resend.emails.send({
    from: `${opts.companyName} <${process.env["EMAIL_FROM"] ?? "noreply@basicsos.app"}>`,
    to: opts.to,
    subject: `You've been invited to ${opts.companyName} on Basics OS`,
    html: buildInviteHtml(opts),
  });

  if (error) {
    console.error("[email] Failed to send invite:", error);
    throw new Error(`Email delivery failed: ${error.message}`);
  }
};

const escapeHtml = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const buildInviteHtml = (opts: InviteEmailOptions): string => `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>You're invited</title></head>
<body style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 40px auto; padding: 0 20px; color: #111;">
  <div style="background: #6366f1; color: white; border-radius: 12px; padding: 32px; text-align: center; margin-bottom: 32px;">
    <h1 style="margin: 0; font-size: 28px;">Basics OS</h1>
    <p style="margin: 8px 0 0; opacity: 0.9;">Company Operating System</p>
  </div>
  <h2 style="margin-bottom: 8px;">You've been invited</h2>
  <p style="color: #555; line-height: 1.6;">
    <strong>${escapeHtml(opts.inviterName)}</strong> has invited you to join <strong>${escapeHtml(opts.companyName)}</strong>
    on Basics OS as a <strong>${escapeHtml(opts.role)}</strong>.
  </p>
  <div style="text-align: center; margin: 32px 0;">
    <a href="${escapeHtml(opts.inviteUrl)}"
       style="background: #6366f1; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
      Accept Invitation
    </a>
  </div>
  <p style="color: #888; font-size: 14px;">
    This invitation expires in 7 days. If you didn't expect this email, you can safely ignore it.
  </p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
  <p style="color: #aaa; font-size: 12px; text-align: center;">
    Sent by Basics OS · <a href="${escapeHtml(opts.inviteUrl)}" style="color: #6366f1;">View in browser</a>
  </p>
</body>
</html>
`;

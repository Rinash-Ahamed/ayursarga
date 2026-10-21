type AuthEmailKind = "hospital-invitation" | "password-reset";
export type AuthEmailData = {
  kind: AuthEmailKind;
  name: string;
  actionUrl: string;
};

const escapeHtml = (value: string) => value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] || character);

/** One responsive emerald/cream/gold design for all authentication emails. */
export function authEmail(data: AuthEmailData) {
  const url = new URL(data.actionUrl);
  if (url.protocol !== "https:") throw new Error("A secure password action link is required.");
  const invitation = data.kind === "hospital-invitation";
  const subject = invitation ? "Your Ayursarga Hospital Portal invitation" : "Reset your Ayursarga password";
  const title = invitation ? "Welcome to Ayursarga." : "A secure fresh start.";
  const greeting = data.name.trim() ? `Hello ${data.name.trim()},` : "Hello,";
  const introduction = invitation
    ? "Your hospital partner account is ready. Set your password to access the Ayursarga Hospital Portal. If you already have a password, this link lets you choose a new one."
    : "We received a request to reset the password for your Ayursarga account. Use the secure link below to choose a new password.";
  const button = invitation ? "Set your password" : "Reset your password";
  const safety = invitation
    ? "This invitation is for your hospital's official account. Do not forward this email. If you were not expecting it, contact Ayursarga before continuing."
    : "If you did not request a password reset, you can ignore this email. Your password will not change unless you complete the reset.";
  const actionUrl = escapeHtml(url.href);
  const text = `Ayursarga\n\n${title}\n\n${greeting}\n\n${introduction}\n\n${button}: ${url.href}\n\nThis personal link is time-limited. If it has expired, request a new link. Never share your password or this link.\n\n${safety}\n\nNeed help? info@ayursarga.com\nAyursarga | Trusted care, connected.`;
  const html = `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f9f5ea;color:#243b2d;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden">${escapeHtml(subject)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f9f5ea"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;border:1px solid #e2e5dc;border-radius:20px;overflow:hidden;background:#fff">
<tr><td style="padding:28px 24px;background:#1f3d2b;border-bottom:3px solid #c9a66b"><div style="color:#fff;font-family:Georgia,serif;font-size:30px;line-height:1.3">Ayursarga</div><p style="margin:8px 0 0;color:#e3d1af;font-size:11px;line-height:1.6;letter-spacing:1.5px">${invitation ? "HOSPITAL PARTNERS" : "ACCOUNT SECURITY"}</p></td></tr>
<tr><td style="padding:28px 24px"><h1 style="margin:0 0 22px;font-family:Georgia,serif;font-size:28px;font-weight:400;line-height:1.3;color:#1f3d2b">${title}</h1>
<p style="margin:0 0 12px;font-size:15px;line-height:1.7">${escapeHtml(greeting)}</p><p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#526253">${introduction}</p>
<table role="presentation" cellspacing="0" cellpadding="0"><tr><td bgcolor="#1f3d2b" style="border-radius:999px"><a href="${actionUrl}" style="display:inline-block;padding:15px 24px;color:#fff;background:#1f3d2b;border-radius:999px;text-decoration:none;font-size:15px;font-weight:700;line-height:1.5">${button}</a></td></tr></table>
<p style="margin:22px 0 0;font-size:12px;line-height:1.7;color:#526253">This personal link is time-limited. If it has expired, request a new link. Never share your password or this link.</p>
<div style="margin-top:22px;padding:16px;background:#f4f7f3;border:1px solid #e2e5dc;border-radius:12px;font-size:13px;line-height:1.7;color:#344d3c">${safety}</div>
<p style="margin:22px 0 8px;font-size:12px;line-height:1.7;color:#526253">If the button does not work, copy this link into your browser:</p><p style="margin:0;font-size:11px;line-height:1.7;overflow-wrap:anywhere;word-break:break-all"><a href="${actionUrl}" style="color:#1f3d2b">${actionUrl}</a></p></td></tr>
<tr><td style="padding:20px 24px;background:#f1ede2;border-top:1px solid #e2e5dc"><p style="margin:0;font-size:12px;line-height:1.7;color:#526253">Need help? <a href="mailto:info@ayursarga.com" style="color:#1f3d2b">info@ayursarga.com</a></p><p style="margin:5px 0 0;color:#697361;font-size:11px;line-height:1.7">Ayursarga · Trusted care, connected.</p></td></tr>
</table></td></tr></table></body></html>`;
  return { subject, html, text };
}

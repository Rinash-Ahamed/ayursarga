export type ContactEmailData = {
  name: string;
  email: string;
  phone: string;
  interest: string;
  message: string;
};

const escapeHtml = (value: string) => value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] || character);

export function contactEmailHtml(data: ContactEmailData) {
  const safe = Object.fromEntries(Object.entries(data).map(([key, value]) => [key, escapeHtml(value)])) as ContactEmailData;
  return `<!doctype html>
  <html><body style="margin:0;background:#f9f5ea;font-family:Arial,sans-serif;color:#2a281f">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f9f5ea;padding:32px 16px"><tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 16px 44px rgba(58,61,46,.12)">
        <tr><td style="background:#3a3d2e;padding:34px 40px;color:#f9f5ea"><div style="font-family:Georgia,serif;font-size:28px">Ayursarga</div><div style="margin-top:8px;color:#c9a66b;font-size:11px;letter-spacing:2px;text-transform:uppercase">New retreat enquiry</div></td></tr>
        <tr><td style="padding:38px 40px"><h1 style="font-family:Georgia,serif;font-size:28px;font-weight:400;margin:0 0 8px;color:#3a3d2e">A new journey begins.</h1><p style="color:#6c6d5d;line-height:1.7;margin:0 0 30px">A visitor submitted a consultation request through ayursarga.com.</p>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse">
            ${emailRow("Name", safe.name)}${emailRow("Email", safe.email)}${emailRow("Phone", safe.phone)}${emailRow("Interested in", safe.interest)}${emailRow("Message", safe.message || "No message provided")}
          </table>
          <a href="mailto:${encodeURIComponent(data.email)}" style="display:inline-block;margin-top:30px;background:#3a3d2e;color:#f9f5ea;text-decoration:none;padding:14px 24px;border-radius:999px;font-size:12px;letter-spacing:1px;text-transform:uppercase">Reply to ${safe.name}</a>
        </td></tr>
        <tr><td style="padding:20px 40px;background:#f1eada;color:#6c6d5d;font-size:11px;line-height:1.6">Sent securely from the Ayursarga website contact form.</td></tr>
      </table>
    </td></tr></table>
  </body></html>`;
}

const emailRow = (label: string, value: string) => `<tr><td style="width:120px;padding:13px 0;border-bottom:1px solid #eee7da;color:#8c7259;font-size:11px;letter-spacing:1px;text-transform:uppercase;vertical-align:top">${label}</td><td style="padding:13px 0;border-bottom:1px solid #eee7da;color:#2a281f;font-size:14px;line-height:1.6;white-space:pre-wrap">${value}</td></tr>`;

export function contactEmailText(data: ContactEmailData) {
  return `New Ayursarga website enquiry\n\nName: ${data.name}\nEmail: ${data.email}\nPhone: ${data.phone}\nInterested in: ${data.interest}\n\nMessage:\n${data.message || "No message provided"}`;
}

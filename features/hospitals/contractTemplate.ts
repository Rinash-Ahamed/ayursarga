import type { DocumentRecord } from "@/services/firestore/firestoreService";
import type { HospitalDocument } from "@/features/firestore/models";

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function hospitalContractReference(hospitalId: string, date = new Date()) {
  const day = date.toISOString().slice(0, 10).replaceAll("-", "");
  return `AYU-${day}-${hospitalId.slice(0, 8).toUpperCase()}`;
}

/** Replace this function body with the approved contract HTML when supplied. */
export function buildHospitalContractHtml(hospital: DocumentRecord<HospitalDocument>, generatedAt = new Date()) {
  const reference = hospitalContractReference(hospital.id, generatedAt);
  const generatedDate = new Intl.DateTimeFormat("en-IN", { dateStyle: "long" }).format(generatedAt);
  const commission = Number(hospital.commissionPercentage).toFixed(2);

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Ayursarga Hospital Partnership Contract - ${escapeHtml(reference)}</title>
<style>
  @page{size:A4;margin:18mm}*{box-sizing:border-box}body{margin:0;color:#2A281F;font:14px/1.65 Arial,sans-serif;background:#fff}
  header{display:flex;justify-content:space-between;gap:24px;padding-bottom:20px;border-bottom:2px solid #3A3D2E}h1{margin:0;color:#3A3D2E;font:30px/1.15 Georgia,serif}
  .brand{color:#8C7259;font-weight:700;letter-spacing:.12em;text-transform:uppercase}.meta{text-align:right;font-size:12px;color:#6C6D5D}
  section{margin-top:24px}h2{margin:0 0 10px;color:#3A3D2E;font:20px Georgia,serif}.details{display:grid;grid-template-columns:1fr 1fr;gap:10px 24px;padding:18px;background:#F9F5EA;border:1px solid #F1EADA}
  .details span{display:block;color:#6C6D5D;font-size:11px;text-transform:uppercase;letter-spacing:.06em}.details strong{display:block;margin-top:2px}.clause{margin:12px 0}.signatures{display:grid;grid-template-columns:1fr 1fr;gap:50px;margin-top:64px}.line{padding-top:8px;border-top:1px solid #2A281F}
  .actions{position:fixed;right:18px;bottom:18px}@media print{.actions{display:none}}button{padding:11px 18px;border:0;border-radius:999px;background:#3A3D2E;color:#F9F5EA;cursor:pointer}
</style></head><body>
<header><div><div class="brand">Ayursarga</div><h1>Hospital Partnership Contract</h1></div><div class="meta">Reference: ${escapeHtml(reference)}<br>Generated: ${escapeHtml(generatedDate)}</div></header>
<section><h2>Hospital details</h2><div class="details">
  <div><span>Hospital</span><strong>${escapeHtml(hospital.name)}</strong></div><div><span>Official email</span><strong>${escapeHtml(hospital.email)}</strong></div>
  <div><span>Phone</span><strong>${escapeHtml(hospital.phone)}</strong></div><div><span>Location</span><strong>${escapeHtml(`${hospital.city}, ${hospital.state}`)}</strong></div>
  <div style="grid-column:1/-1"><span>Registered address</span><strong>${escapeHtml(hospital.address)}</strong></div>
  <div><span>Agreed commission</span><strong>${escapeHtml(commission)}%</strong></div><div><span>Current status</span><strong>${escapeHtml(hospital.status)}</strong></div>
</div></section>
<section><h2>Dummy agreement terms</h2>
  <p class="clause"><strong>1. Partnership.</strong> The Hospital requests participation in the Ayursarga discovery and appointment-request platform, subject to approval and the final agreed commercial terms.</p>
  <p class="clause"><strong>2. Information.</strong> The Hospital confirms that its profile, services, pricing, licences and contact information supplied to Ayursarga are accurate and may be verified before publication.</p>
  <p class="clause"><strong>3. Consumer care.</strong> The Hospital remains solely responsible for clinical assessment, treatment, patient consent, regulatory compliance and care delivered to consumers.</p>
  <p class="clause"><strong>4. Commercial terms.</strong> The current platform commission is ${escapeHtml(commission)}% unless replaced by a later written agreement signed by both parties.</p>
  <p class="clause"><strong>5. Activation.</strong> The hospital profile remains pending and private until this contract is confirmed as signed and an Ayursarga administrator activates the profile.</p>
  <p><em>This is a temporary development template and must be replaced with the approved legal contract before production use.</em></p>
</section>
<section class="signatures"><div class="line">For ${escapeHtml(hospital.name)}<br>Name / Signature / Date</div><div class="line">For Ayursarga<br>Name / Signature / Date</div></section>
<div class="actions"><button type="button" onclick="window.print()">Print / Save as PDF</button></div>
</body></html>`;
}

import type { HospitalDocument } from "@/features/firestore/models";
import type { DocumentRecord } from "@/services/firestore/firestoreService";
import { AYURSARGA_GSTIN, AYURSARGA_REGISTERED_OFFICE_PIN } from "@/features/hospitals/ayursargaCompanyDetails";

const CONTRACT_BODY = `
      <h2>1. Parties and term</h2>
      <table class="party-details"><tbody>
        <tr><th>Ayursarga</th><th>Partner Centre</th></tr>
        <tr><td><strong>Legal Entity</strong><br />AYURSARGA PVT LTD, as Ayursarga<br />CIN U86900KL2026PTC106500</td><td><strong>Legal Entity</strong><br />{{PARTNER_NAME}}, as {{PARTNER_NAME}}<br />{{PARTNER_ENTITY_TYPE}} · Registration {{PARTNER_REGISTRATION}}<br />CIN {{PARTNER_CIN}}</td></tr>
        <tr><td><strong>Registered office</strong><br />5/1957 KUZHALMANNAM ROAD, KODUVAYUR, PALAKKAD, KERALA, {{AYURSARGA_PIN_CODE}}, INDIA</td><td><strong>Registered address</strong><br />{{PARTNER_REGISTERED_ADDRESS}}</td></tr>
        <tr><td><strong>Tax information</strong><br />PAN ABGCA7749G<br />GSTIN {{AYURSARGA_GSTIN}}</td><td><strong>Service address</strong><br />{{PARTNER_SERVICE_ADDRESS}}<div class="party-subdetail"><strong>Tax information</strong><br />PAN {{PARTNER_PAN}}<br />GSTIN {{PARTNER_GSTIN}}</div></td></tr>
      </tbody></table>
      <p class="term-summary">Effective date {{EFFECTIVE_DATE}}; Expiry date {{EXPIRY_DATE}}. Renewal requires written agreement. The relationship is non-exclusive; neither party may bind the other except for the collection authority below. No partnership, employment or joint venture is created. Each party bears its own onboarding costs unless agreed otherwise; no booking, revenue or outcome guarantee is given.</p>
      <p>Legal notice emails: Ayursarga: support@ayursarga.com; Partner {{PARTNER_EMAIL}}.<br />Operational contacts and phones: Ayursarga +91 97455 66687; Partner {{PARTNER_PHONES}}.<br />Partner emergency contact/phone {{PARTNER_EMERGENCY_CONTACT}}; Emergency transfer arrangement and nearby hospital {{EMERGENCY_REFERRAL}}.</p>
      <h2>2. Agreed commercial terms</h2>
      <table><tbody>
        <tr><th>Item</th><th>Agreed term</th></tr>
        <tr><td>Commission</td><td> {{COMMISSION_PERCENTAGE}} of the Commission for all approved services booked through Ayursarga.</td></tr>
        <tr><td>Calculation base</td><td>Booked service value after Partner-funded discounts, excluding separately stated GST/statutory taxes and including approved additions. Ayursarga-funded promotions do not reduce the base or Partner entitlement unless agreed in writing.</td></tr>
        <tr><td>Advance and balance</td><td>10% of the Total Price as an advance to Ayursarga, included in the booking price and credited against commission. The remaining 90% is payable through Ayursarga or directly to the Partner, as disclosed, by check-in/service commencement. No advance variation.</td></tr>
        <tr><td>Fee tax and gateway costs</td><td>Applicable GST is additional to commission against a valid tax invoice. Each party bears charges on payments it collects, without duplicate recovery. Refund and service-failure costs follow clause 5.</td></tr>
        <tr><td>Settlement</td><td>Reconciliation covers Monday to Sunday. Statements are issued within 3 working days and undisputed payments by either party are due within 7 working days after the weekly period closes. Completed services and finalised cancellations/reversals enter settlement; future-service advances remain tracked.</td></tr>
        <tr><td>Policy and bank references</td><td>CP01: postnatal care. CP02: approved short-duration services. Applies to mutually approved active Portal services, with policy recorded per booking. Bank records are linked to onboarding and independently verified before payment activation</td></tr>
        <tr><td>Optional agreed variations</td><td>None. Future changes require the affected clause, effective date and both parties’ written approval. Fixed-fee allocation: not applicable. Net amounts lawfully retained on cancellation are shared 50% to Ayursarga and 50% to the Partner under clause 5.3, separately from commission on completed services.</td></tr>
      </tbody></table>
      <p>2.1 Total Price means the confirmed customer price including disclosed service taxes and approved extras. The advance forms part of that price, is not automatically non-refundable and is credited rupee-for-rupee against commission. Any excess advance is settled or refunded; any remaining commission is payable by the Partner when it collects the balance. No double collection is permitted.</p>
      <p>Where Ayursarga collects customer payments, it shall remit the Partner’s net entitlement after commission, applicable GST on commission and permitted adjustments within the settlement period. Where the Partner collects the balance, it shall pay Ayursarga’s remaining entitlement, including applicable commission GST, after crediting the advance and lawful adjustments, within the same period.</p>
      <p>2.2 The Partner authorises lawful collection for approved bookings through agreed payment arrangements and expressly permitted deductions. Payment through the approved route discharges the customer for that amount. This agreement does not authorise unlicensed payment activity. Each party invoices its own supplies and meets applicable tax and payment-provider obligations.</p>
      <h2>3. Listings, bookings and responsibilities</h2>
      <p>3.1 The Partner must keep Portal details accurate, including services, permitted durations, rooms, mother/baby support, food, staffing, inclusions, exclusions, admission conditions, prices, taxes, extras and availability. Publish only mutually approved terms. Ayursarga may format, verify, withhold or remove listings for accuracy, safety, legal or quality concerns. Material changes require recorded Partner approval.</p>
      <p>3.2 Marked availability allows direct booking without further Partner acceptance. Bookings are confirmed once disclosed conditions, including payment, are met and confirmation is issued. Ayursarga must notify the Partner promptly; unread notifications do not cancel bookings. Appointment enquiries require confirmation. Clinical assessment and treatment consent remain separate.</p>
      <p>3.3 Before payment, disclose the total price, extras, payment schedule, admission conditions, cancellation policy and start date and time. Postnatal bookings require a reference date and time despite delivery uncertainty. Keep approved service versions and booking records. Customers must accept custom quotations and changes reducing confirmed benefits. Urgent legal or safety changes require prompt notice and suitable alternatives or refunds.</p>
      <p>3.4 The Partner must promptly update availability, block unavailable services, protect login details and remove former staff access. Report account breaches immediately. During outages, use an approved recorded channel and update the Portal afterwards. Retain dated approvals; Portal edits cannot change legal or commission terms.</p>
      <p>3.5 The Partner must maintain required licences, registrations, professional qualifications and legally required insurance and any additional cover reasonably appropriate to its services. Provide evidence and promptly report expiry, suspension, restrictions or material business changes. Stop affected services without valid authorisation. Ayursarga may conduct reasonable reviews, urgently where necessary, while limiting patient-data access.</p>
      <p>3.6 The Partner is responsible for safe, lawful care, qualified staff, medicines, consent, records, hygiene, food, accommodation and approved subcontractors. Material outsourcing requires prior disclosure and approval. Emergency care and referral must not wait for platform or payment approval. Honour booked services, issue receipts and avoid hidden charges or pressure selling.</p>
      <p>3.7 Ayursarga must accurately display approved services, coordinate bookings and support, securely share necessary information, and meet payment and refund obligations. It does not direct treatment and remains responsible for its own actions. Verification claims must reflect actual checks and must not guarantee clinical outcomes.</p>
      <p>3.8 Report serious safety incidents or service failures immediately where practicable, followed by a written summary within 24 hours. Do not delay safety action or required reporting. Acknowledge ordinary complaints within 48 hours and address them within one month, or sooner if required. The Partner must provide an initial response and lawfully shareable evidence within two working days. Record corrective action and closure.</p>
      <h2>4. Reconciliation and payment safeguards</h2>
      <p>4.1 Advances for future services must be tracked and count as earned commission only when due under the settlement terms. Statements must show booking details, payments, commission calculations, advance adjustments, taxes, refunds, deductions and net amounts due. Report differences within seven calendar days of receiving the statement and resolve them within seven working days of notification. Silence does not waive concealed errors or legal rights. Undisputed amounts remain payable.</p>
      <p>4.2 Any payment hold or adjustment must be supported by records, explained in writing, limited to the relevant amount and reviewed each settlement cycle. No indefinite blanket holds are permitted. Allocate chargebacks based on evidence and responsibility, without duplicate recovery. Confirm bank changes through an existing verified contact. Each party must issue its own invoices and credit notes and meet applicable tax obligations.</p>
      <h2>5. Cancellation, date changes and refunds</h2>
      <table><tbody>
        <tr><th>Cancellation timing before scheduled start (in days)</th><th>Refund percentage</th></tr>
        <tr><td>CP01 postnatal - 45 days or more</td><td>100% less only lawful disclosed unrecoverable gateway charges</td></tr>
        <tr><td>CP01 - 30 days or more, but fewer than 45 days</td><td>50% subject to the same permitted charge treatment</td></tr>
        <tr><td>CP01 - fewer than 30 days</td><td>No routine refund, subject to law and approved exceptions</td></tr>
        <tr><td>CP02 short-duration - 2 days or more</td><td>100%, less only lawful disclosed unrecoverable gateway charges</td></tr>
        <tr><td>CP02 - fewer than 2 days</td><td>No routine refund, subject to law and approved exceptions</td></tr>
      </tbody></table>
      <h3>5.1 Applicable policy and cancellation requests</h3>
      <p>CP02 applies to rejuvenation, stress management and other approved short-duration services. Each listing and booking confirmation must state its policy. Alternative policies require both parties’ written approval and disclosure before booking. Cancellation requests must be emailed to info@ayursarga.com. Either party receiving a request must forward it promptly, preserving the original receipt time.</p>
      <p>For cancellation calculations, one day means a continuous 24-hour period before the scheduled start or reference time stated in the booking confirmation, using the service location’s local time. Calculate from the earliest reliable receipt of the cancellation request. Exactly two days falls within the CP02 refundable category.</p>
      <p>5.2 Refund calculation<br />Refunds equal the applicable percentage of the amount paid, including the advance, less lawful, previously disclosed and unrecoverable gateway charges. Refunds cannot be below zero. No commission, additional administration fee or duplicate charge may be deducted. Cancellation does not make the unpaid balance due. Mandatory refunds and tax adjustments apply.</p>
      <p>5.3 Sharing cancellation amounts<br />Commission on the full package is not payable for cancelled, undelivered services. After lawful taxes and unrecovered charges, the net cancellation amount retained is shared 50% to Ayursarga and 50% to the Partner. Adjust the advance already held and settle any excess without duplicate deductions.</p>
      <p>5.4 Date changes<br />Delivery changes, hospitalisation or medical advice should first be considered for rescheduling. The Partner must offer reasonable available options within two working days. The Customer must accept any revised date, price and policy in writing. Requesting a change carries no penalty. The original cancellation reference date remains unless otherwise expressly agreed without reducing existing Customer rights.</p>
      <p>5.5 Medical exceptions and early departure<br />Review medical exceptions using only necessary evidence shared securely. Record the decision and cost allocation within five working days of receiving sufficient information. If suitable dates are unavailable, assess medical exceptions and legal refund rights before deductions. Voluntary concessions are funded as agreed or by the party offering them. No-shows follow late-cancellation rules, subject to exceptions; early departures require an itemised assessment.</p>
      <p>5.6 Service failure and refund processing<br />Report any inability to honour a booking immediately. Material alternatives require Customer consent. The party responsible for failure must fund refunds for affected unprovided services without deductions, reverse related commission and bear documented unavoidable transaction and reasonable direct remedial costs, subject to clause 7. Statutory rights remain protected. Initiate approved refunds through the original payment route within seven working days, or sooner if required. Each party must provide its share promptly; settlement disputes must not delay refunds. Provide the Customer with the refund reference.</p>
      <h2>6. Personal data and confidentiality</h2>
      <p>6.1 Each party complies with applicable privacy law as in force; these safeguards apply from signature. Collect only necessary booking/care/support data with required notices and lawful authority. Distinguish clinical, booking and marketing consent; obtain required parental/guardian authority for newborn data. No sale, unrelated marketing, patient-image use or unauthorised disclosure. Apply restricted access, secure storage/transmission, authentication, logs, staff confidentiality and vetted vendors.</p>
      <p>6.2 Each party is accountable for purposes it independently determines. Processing solely on the other’s instructions requires a prior written arrangement covering scope, instructions, security, vendors and deletion. Report shared-data breaches without undue delay and, where practicable, within 24 hours; shorter legal deadlines prevail. Assist rights requests, retain data only for necessary/legal periods and securely return/delete it afterwards. Partner retains clinical-record responsibility.</p>
      <p>6.3 Protect confidential information and restrict disclosure. Exclude public, independently developed and lawfully held/received unrestricted information. Protection survives three years, longer for trade secrets/data as required. Retain legally required records; no unrestricted patient-database access is granted.</p>
      <h2>7. Content liability and insurance</h2>
      <p>7.1 Each party owns its intellectual property. The Partner permits Ayursarga to use approved content for listings and promotion during the agreement, on a non-exclusive basis, and confirms it has the necessary rights. Patient photos or testimonials require separate lawful permission. Neither party may publish misleading or unapproved medical claims or announce an active partnership before activation. The Partner must not hide or divert Ayursarga-generated bookings to avoid commission. Independent customers and future care remain unrestricted unless expressly agreed otherwise.</p>
      <p>7.2 Each party must cover proven direct losses and third-party claims, including reasonable defence costs, caused by its breach, negligence, deliberate misconduct or unlawful actions. Responsibility must reflect each party’s contribution, reasonable efforts to reduce losses and no duplicate recovery. Notify claims promptly and allow reasonable participation in the defence; delays that harm the defence may reduce recovery. Settlements binding the other party require its consent, which must not be unreasonably withheld. Urgent protective action remains permitted.</p>
      <p>7.3 Neither party is responsible for remote or indirect losses where legally permitted. This does not exclude customer refunds, fees owed, third-party claims covered under clause 7.2 or reasonable direct costs of correcting a failure. No financial liability cap applies unless agreed in writing and signed. Limits cannot cover fraud, deliberate misconduct, death or injury caused by negligence, clinical malpractice, confidentiality or data breaches, or liability that cannot legally be limited. Insurance does not replace either party’s responsibilities. Outstanding payments, refunds and customers’ legal rights remain protected.</p>
      <h2>8. Activation suspension and exit</h2>
      <p>8.1 Activation requires verification clearance, this complete signed agreement, approved listings and policy mapping, verified payment arrangements and Ayursarga’s written activation identifying services. No live bookings or customer payments are permitted before written activation.</p>
      <p>8.2 Either party may terminate on 30 days’ written notice, or for a material remediable breach not cured within 15 days of notice. Fraud, incurable material breach, serious safety risk or essential licence loss may justify immediate termination, subject to law. Ayursarga may proportionately suspend affected listings for credible safety, security, legal or quality concerns; give prompt reasons and reinstate after correction. Unrelated payments continue.</p>
      <p>8.3 On exit, stop new bookings; safely fulfil existing bookings or arrange accepted alternatives/refunds. Revoke unnecessary access, remove obsolete promotion within seven days and return/delete data subject to protected lawful retention. Reconcile within 30 days without extending ordinary payment deadlines; reconcile later evidenced chargebacks separately. Accrued rights, refund/payment, data, confidentiality, liability and dispute duties survive.</p>
      <p>8.4 Force majeure excuses affected performance only as law permits, with prompt notice and mitigation. Staffing shortages, overbooking or lack of funds do not automatically qualify. Payments/refunds survive. Offer an accepted reschedule or refund unprovided services; either party may end the affected arrangement after 30 days.</p>
      <h2>9. Law changes and execution</h2>
      <p>9.1 Indian law applies. Notices go to the legal notice emails in clause 1 with delivery evidence or trackable courier to stated addresses; failed delivery requires another documented method. Notify contact changes. Management seeks resolution for 15 days, then competent courts determine disputes. Urgent interim relief, limitation periods and consumer/regulatory remedies are preserved.</p>
      <p>9.2 Mandatory law/customer rights prevail. Clause 2 governs commercial selections; clause 5 governs refunds; booking-time approved records govern services and more favourable customer promises. This instrument and expressly identified signed variations form the entire agreement. Changes need authorised written approval; no unilateral policy changes. Material assignment needs consent; delay is not waiver; invalid terms are severed where possible. Lawful counterparts/e-signatures are permitted, with authority, audit trails and complete copies retained; applicable stamp/execution requirements remain.</p>
      <p>9.3 Definitions: Working days means Monday to Friday, excluding public holidays in Kerala. Other references to days mean calendar days. Written approval includes an attributable email or authenticated Portal approval by an authorised representative that can be retained and reproduced.</p>
      <h2>10. One signing section for the complete package</h2>
      <p>Both authorised signatories accept this entire Agreement and any expressly identified attachments. Required fields are complete and optional variations are marked “None” where unused.</p>
      <table class="signature-boxes"><tbody>
        <tr><th>For Ayursarga</th><th>For the Partner Centre</th></tr>
        <tr><td><div class="signature-mark"><strong>Signature</strong><span class="signature-line"></span></div></td><td><div class="signature-mark"><strong>Signature</strong><span class="signature-line"></span></div></td></tr>
      </tbody></table>
`;

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function partnerPhones(hospital: DocumentRecord<HospitalDocument>) {
  return [hospital.phone, hospital.hospitalPhone1, hospital.hospitalPhone2]
    .filter((value): value is string => Boolean(value?.trim()))
    .join("; ");
}

function partnerAddress(hospital: DocumentRecord<HospitalDocument>, rawAddress: string | undefined) {
  return (rawAddress || hospital.address).trim();
}

function displayContractDate(value: string | undefined) {
  if (!value) return "";
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "long", timeZone: "Asia/Kolkata" }).format(new Date(Date.UTC(year, month - 1, day)));
}

export function buildHospitalContractHtml(hospital: DocumentRecord<HospitalDocument>) {
  const commission = `${Number(hospital.commissionPercentage).toFixed(2)}%`;
  const populatedBody = CONTRACT_BODY
    .replaceAll("{{AYURSARGA_PIN_CODE}}", escapeHtml(AYURSARGA_REGISTERED_OFFICE_PIN))
    .replaceAll("{{AYURSARGA_GSTIN}}", escapeHtml(AYURSARGA_GSTIN))
    .replaceAll("{{PARTNER_NAME}}", escapeHtml(hospital.name))
    .replaceAll("{{PARTNER_REGISTERED_ADDRESS}}", escapeHtml(partnerAddress(hospital, hospital.registeredAddress)))
    .replaceAll("{{PARTNER_SERVICE_ADDRESS}}", escapeHtml(partnerAddress(hospital, hospital.address)))
    .replaceAll("{{PARTNER_EMAIL}}", escapeHtml(hospital.email))
    .replaceAll("{{PARTNER_PHONES}}", escapeHtml(partnerPhones(hospital)))
    .replaceAll("{{PARTNER_ENTITY_TYPE}}", escapeHtml(hospital.legalEntityType))
    .replaceAll("{{PARTNER_REGISTRATION}}", escapeHtml(hospital.registrationNumber))
    .replaceAll("{{PARTNER_CIN}}", escapeHtml(hospital.cinNumber))
    .replaceAll("{{PARTNER_PAN}}", escapeHtml(hospital.panNumber))
    .replaceAll("{{PARTNER_GSTIN}}", escapeHtml(hospital.gstin))
    .replaceAll("{{EFFECTIVE_DATE}}", escapeHtml(displayContractDate(hospital.contractEffectiveDate)))
    .replaceAll("{{EXPIRY_DATE}}", escapeHtml(displayContractDate(hospital.contractExpiryDate)))
    .replaceAll("{{PARTNER_EMERGENCY_CONTACT}}", escapeHtml(hospital.emergencyContact))
    .replaceAll("{{EMERGENCY_REFERRAL}}", escapeHtml(hospital.emergencyReferralHospital))
    .replaceAll("{{COMMISSION_PERCENTAGE}}", escapeHtml(commission));

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Partner Centre Agreement</title>
  <style>
    :root{--forest:#173e2b;--forest-deep:#0b2d1e;--emerald:#0f5739;--gold:#b8872f;--gold-soft:#e8c66d;--ink:#252921;--muted:#657363;--line:#d8dfd9;--paper:#fff}
    *{box-sizing:border-box}
    body{margin:0;background:#e8eee9;color:var(--ink);font-family:Arial,Helvetica,sans-serif;font-size:10.25pt;line-height:1.64}
    .contract-document{position:relative;width:min(100%,210mm);margin:0 auto 24px;padding:19mm 17mm 18mm;background:var(--paper);box-shadow:0 24px 70px rgba(11,45,30,.18);overflow:hidden}
    .contract-document::before{content:"";position:absolute;top:43mm;right:-33mm;width:86mm;height:86mm;border:1px solid rgba(184,135,47,.09);border-radius:50%;box-shadow:0 0 0 12mm rgba(23,62,43,.025),0 0 0 24mm rgba(184,135,47,.018);pointer-events:none}
    .contract-brand{position:relative;display:flex;align-items:center;justify-content:space-between;gap:12mm;margin:-19mm -17mm 7mm;padding:11mm 17mm 9mm;border-bottom:4px solid var(--gold);background:linear-gradient(130deg,var(--forest-deep),var(--forest) 58%,var(--emerald));color:#fff;overflow:hidden}
    .contract-brand::after{content:"";position:absolute;right:-15mm;top:-30mm;width:75mm;height:75mm;border:1px solid rgba(232,198,109,.22);border-radius:50%;box-shadow:0 0 0 9mm rgba(232,198,109,.05)}
    .contract-brand-lockup{position:relative;z-index:1;display:flex;align-items:center;gap:4mm}
    .contract-brand img{width:18mm;height:18mm;object-fit:contain;border-radius:50%;background:#fff;padding:1.5mm}
    .contract-brand strong{display:block;color:#fff;font-family:Georgia,serif;font-size:18pt;font-weight:500;letter-spacing:.02em}
    .contract-brand small{display:block;margin-top:1mm;color:var(--gold-soft);font-size:7.5pt;font-weight:700;letter-spacing:.18em;text-transform:uppercase}
    .contract-classification{position:relative;z-index:1;padding:2.5mm 4mm;border:1px solid rgba(232,198,109,.5);border-radius:100px;color:var(--gold-soft);font-size:7pt;font-weight:700;letter-spacing:.13em;text-transform:uppercase}
    .confidential-ribbon{display:flex;align-items:center;gap:3mm;margin:0 0 8mm;color:var(--forest);font-size:7.5pt;font-weight:700;letter-spacing:.13em;text-transform:uppercase}
    .confidential-ribbon::before,.confidential-ribbon::after{content:"";height:1px;flex:1;background:linear-gradient(90deg,transparent,var(--gold))}
    .confidential-ribbon::after{background:linear-gradient(90deg,var(--gold),transparent)}
    h1{max-width:145mm;margin:0 0 10mm;color:var(--forest);font-family:Georgia,serif;font-size:27pt;font-weight:500;line-height:1.08;letter-spacing:-.02em}
    h2{position:relative;margin:10mm 0 4mm;padding:3.5mm 4mm 3.5mm 13mm;border:1px solid rgba(23,62,43,.12);border-left:3px solid var(--gold);border-radius:2mm;background:linear-gradient(90deg,#f3f7f3,#fff);color:var(--forest);font-family:Georgia,serif;font-size:15.5pt;font-weight:600;line-height:1.25;break-after:avoid}
    h3{margin:6mm 0 2mm;color:var(--forest);font-size:11.5pt;break-after:avoid}
    p{margin:0 0 4mm;orphans:3;widows:3}
    .term-summary{position:relative;padding:5mm 5mm 5mm 7mm;border:1px solid var(--line);border-left:3px solid var(--forest);border-radius:2.5mm;background:#fff}
    table{width:100%;margin:5mm 0 7mm;border-collapse:separate;border-spacing:0;overflow:hidden;border:1px solid #cbd6cd;border-radius:3mm;font-size:9.1pt;break-inside:avoid;box-shadow:0 2mm 7mm rgba(23,62,43,.045)}
    th{padding:3.2mm 3.5mm;background:linear-gradient(120deg,var(--forest-deep),var(--forest));color:#fff;text-align:left;font-size:8.3pt;letter-spacing:.06em;text-transform:uppercase}
    td{padding:3mm 3.5mm;vertical-align:top;border-top:1px solid var(--line)}
    td+td,th+th{border-left:1px solid var(--line)}
    tr:nth-child(even) td{background:#f5f8f5}
    .party-details{margin-top:3mm;font-size:9.3pt}
    .party-details th{width:50%;padding:4mm 5mm;border-bottom:1mm solid var(--gold);font-size:9pt}
    .party-details td{padding:4.5mm 5mm;line-height:1.55}
    .party-details td strong{display:inline-block;margin-bottom:1mm;color:var(--forest);font-size:7.4pt;letter-spacing:.09em;text-transform:uppercase}
    .party-subdetail{margin-top:4mm;padding-top:3.5mm;border-top:1px solid var(--line)}
    .signature-boxes{border-color:rgba(23,62,43,.42);box-shadow:0 3mm 10mm rgba(23,62,43,.09)}
    .signature-boxes th{padding:4mm 5mm;border-bottom:1mm solid var(--gold);font-size:8.7pt;letter-spacing:.08em}
    .signature-boxes td{height:43mm;padding:5mm;background:#fff!important}
    .signature-boxes td+td{border-left:1px solid rgba(23,62,43,.28)}
    .signature-boxes td strong{display:block;color:var(--forest);font-size:7.4pt;letter-spacing:.08em;text-transform:uppercase}
    .signature-mark{height:32mm;padding:4mm;border:1px solid rgba(23,62,43,.16);border-radius:2mm;background:linear-gradient(145deg,#f7faf7,#fff)}
    .signature-mark .signature-line{height:18mm;margin:0}
    .signature-line{display:block;height:7mm;border-bottom:1px solid #849689}
    .contract-footer{display:flex;align-items:center;justify-content:space-between;gap:8mm;margin:12mm -17mm -18mm;padding:6mm 17mm;border-top:3px solid var(--gold);background:var(--forest-deep);color:#fff}
    .contract-footer-brand{display:flex;align-items:center;gap:3mm}
    .contract-footer img{width:11mm;height:11mm;object-fit:contain;border-radius:50%;background:#fff;padding:1mm}
    .contract-footer strong{font-family:Georgia,serif;font-size:12pt;font-weight:500}
    .contract-footer span{color:var(--gold-soft);font-size:7pt;font-weight:700;letter-spacing:.12em;text-transform:uppercase;text-align:right}
    @page{size:A4;margin:15mm 14mm 17mm}
    @media(max-width:640px){.contract-document{padding:12mm 8mm}.contract-brand{margin:-12mm -8mm 7mm;padding:8mm}.contract-brand img{width:14mm;height:14mm}.contract-classification{display:none}.contract-footer{margin:10mm -8mm -12mm;padding:5mm 8mm}}
    @media print{body{background:#fff}.contract-document{width:auto;margin:0;padding:0;box-shadow:none;overflow:visible}.contract-document::before{display:none}.contract-brand{margin:0 0 8mm;padding:9mm 10mm}.contract-footer{margin:10mm 0 0;padding:5mm 8mm}}
  </style>
</head>
<body>
  <main class="contract-document">
    <header class="contract-brand"><div class="contract-brand-lockup"><img src="/mainlogo.png" alt="" /><div><strong>Ayursarga</strong><small>Partner Network</small></div></div><span class="contract-classification">Private &amp; Confidential</span></header>
    <div class="confidential-ribbon">Partner Centre Agreement</div>
${populatedBody}
    <footer class="contract-footer"><div class="contract-footer-brand"><img src="/mainlogo.png" alt="" /><strong>Ayursarga</strong></div><span>Private &amp; Confidential<br />Ayursarga Partner Network</span></footer>
  </main>
</body>
</html>`;
}

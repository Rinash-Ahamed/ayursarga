import { buildHospitalContractPdf, buildBrandedDocumentPdf } from "@/features/hospitals/contractPdf";

const hospital = {
  id: "contract-layout-fixture", name: "Ayursarga Partner Wellness Centre",
  legalName: "Partner Wellness Private Limited", email: "partner@example.test",
  phone: "9876543210", hospitalPhone1: "9876543211", hospitalPhone2: "9876543212",
  address: "Service Building, Wellness Road, Palakkad, Kerala 678501",
  registeredAddress: "Registered Office, Main Road, Palakkad, Kerala 678501",
  registrationNumber: "REG001", cinNumber: "U12345KL2026PTC000001",
  panNumber: "ABCDE1234F", gstin: "32ABCDE1234F1Z5", commissionPercentage: 12,
  contractEffectiveDate: "2026-11-01", contractExpiryDate: "2029-11-01",
  emergencyContact: "9876543213", emergencyReferralHospital: "Nearby Emergency Hospital",
} as Parameters<typeof buildHospitalContractPdf>[0];

Object.assign(window, {
  async contractPdfFixture(long = false) {
    const record = long ? { ...hospital,
      name: "Ayursarga Partner Centre for Traditional Ayurveda and Comprehensive Postnatal Wellness",
      legalName: "Partner Traditional Ayurveda and Comprehensive Wellness Services Private Limited",
      address: "Service Centre, Building Number 123/456, First and Second Floors, Near Central Junction, Extended Wellness Avenue, Residential Layout, Palakkad, Kerala, India 678501",
      registeredAddress: "Registered Office, Building Number 789/123, Business Park, Opposite Community Centre, Main Road, Extended Locality, Coimbatore, Tamil Nadu, India 641001",
    } : hospital;
    const result = buildHospitalContractPdf(record);
    return { pdf: await result.blob.text(), html: result.html, filename: result.filename };
  },
  async invoicePdfFixture() {
    return await buildBrandedDocumentPdf('<main class="invoice"><h1>Invoice</h1><p>Invoice layout regression fixture.</p><table><tr><th>Item</th><th>Amount</th></tr><tr><td>Commission</td><td>1200</td></tr></table></main>', ".invoice", "INVOICE", "Ayursarga Finance").text();
  },
});

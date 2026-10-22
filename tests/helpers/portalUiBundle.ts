import { bundleDialogHarness } from "./bundleDialogHarness";
const modules = [
  "next/link", "next/image", "next/navigation", "firebase/firestore", "@/hooks/useAuth",
  "@/services/firestore/firestoreService", "@/services/firestore/auditService", "@/services/hospitals/hospitalService",
  "@/services/hospitals/capacityService", "@/services/hospitals/serviceService", "@/services/bookings/bookingService",
  "@/services/hospitals/availabilityService", "@/services/consultants/consultantService", "@/services/users/userService",
  "@/services/audit/adminAuditService", "@/services/auth/hospitalAccountService", "@/services/api/client",
  "@/services/notifications/notificationService", "@/features/hospitals/contractPdf",
  "@/services/hospitals/publicHospitalService",
  "@/services/consultations/consultationService",
];
export const portalUiBundle = bundleDialogHarness("tests/fixtures/portalUiHarness.tsx", Object.fromEntries(modules.map((name) => [name, "tests/fixtures/portalUiMocks.tsx"])));

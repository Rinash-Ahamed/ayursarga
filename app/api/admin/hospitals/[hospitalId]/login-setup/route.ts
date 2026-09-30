import { FieldValue } from "firebase-admin/firestore";
import { AdminAuthorizationError, requireActiveAdmin } from "@/services/firebase/adminAuthorization";
import { apiHealth, apiJson } from "@/services/api/server";
import { isFirebaseAdminReady } from "@/services/firebase/admin";

export const runtime = "nodejs";

export function GET() {
  return apiHealth("/api/admin/hospitals/[hospitalId]/login-setup", [{ name: "firebaseAdmin", ready: isFirebaseAdminReady() }]);
}

export async function POST(request: Request, context: { params: Promise<{ hospitalId: string }> }) {
  try {
    const { uid: adminUid, auth, firestore } = await requireActiveAdmin(request);

    const { hospitalId } = await context.params;
    if (!hospitalId || hospitalId.length > 160 || hospitalId.includes("/")) return apiJson({ error: "The hospital could not be found." }, 404);
    const hospitalReference = firestore.collection("hospitals").doc(hospitalId);
    const hospitalSnapshot = await hospitalReference.get();
    const hospital = hospitalSnapshot.data();
    if (!hospitalSnapshot.exists || hospital?.status !== "active") {
      return apiJson({ error: "Activate the hospital before preparing its login." }, 409);
    }

    const email = String(hospital.email ?? "").trim().toLowerCase();
    const name = String(hospital.name ?? "").trim();
    if (!email || !name) return apiJson({ error: "The hospital name and official email are required." }, 409);

    let authUser;
    let createdAuthUser = false;
    try {
      authUser = await auth.getUserByEmail(email);
    } catch (error) {
      if ((error as { code?: string }).code !== "auth/user-not-found") throw error;
      authUser = await auth.createUser({ email, displayName: name, emailVerified: false, disabled: false });
      createdAuthUser = true;
    }

    const userReference = firestore.collection("users").doc(authUser.uid);
    const userSnapshot = await userReference.get();
    const previous = userSnapshot.data() ?? null;
    if (!createdAuthUser && !previous) {
      return apiJson({
        error: "This email already has an unrecognized Firebase account. Review it in Firebase Authentication before linking this Hospital login.",
      }, 409);
    }
    if (previous && (previous.role !== "hospital" || previous.hospitalId !== hospitalId)) {
      return apiJson({ error: "This email already belongs to a different Ayursarga account." }, 409);
    }

    const linkedUsers = await firestore.collection("users").where("hospitalId", "==", hospitalId).get();
    const replacedUsers = linkedUsers.docs.filter((document) => document.id !== authUser.uid && document.data().role === "hospital" && document.data().status === "active");

    const auditReference = firestore.collection("auditLogs").doc();
    const now = FieldValue.serverTimestamp();
    const userData = previous ? {
      name,
      email,
      role: "hospital",
      status: "active",
      hospitalId,
      updatedAt: now,
      updatedBy: adminUid,
      archivedAt: null,
      archivedBy: null,
      lastAuditId: auditReference.id,
    } : {
      uid: authUser.uid,
      name,
      email,
      phone: null,
      address: null,
      role: "hospital",
      status: "active",
      hospitalId,
      createdAt: now,
      createdBy: adminUid,
      updatedAt: now,
      updatedBy: adminUid,
      archivedAt: null,
      archivedBy: null,
      lastAuditId: auditReference.id,
    };
    const action = previous ? (previous.status === "archived" ? "restore" : "update") : "create";
    const batch = firestore.batch();
    batch.set(userReference, userData, { merge: Boolean(previous) });
    batch.set(auditReference, {
      action,
      module: "users",
      recordId: authUser.uid,
      actorId: adminUid,
      actorRole: "admin",
      previousValues: previous,
      updatedValues: previous ? { ...previous, ...userData } : userData,
      timestamp: now,
      source: "server",
      device: {
        userAgent: request.headers.get("user-agent")?.slice(0, 500) || null,
        platform: null,
        ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
      },
    });
    for (const replacedUser of replacedUsers) {
      const replacedAudit = firestore.collection("auditLogs").doc();
      const replacedData = replacedUser.data();
      const replacedChanges = {
        status: "inactive",
        updatedAt: now,
        updatedBy: adminUid,
        lastAuditId: replacedAudit.id,
      };
      batch.update(replacedUser.ref, replacedChanges);
      batch.set(replacedAudit, {
        action: "status_change",
        module: "users",
        recordId: replacedUser.id,
        actorId: adminUid,
        actorRole: "admin",
        previousValues: replacedData,
        updatedValues: { ...replacedData, ...replacedChanges },
        timestamp: now,
        source: "server",
        device: {
          userAgent: request.headers.get("user-agent")?.slice(0, 500) || null,
          platform: null,
          ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
        },
      });
    }
    try {
      await batch.commit();
    } catch (error) {
      if (createdAuthUser) await auth.deleteUser(authUser.uid).catch(() => undefined);
      throw error;
    }

    await Promise.all([
      auth.updateUser(authUser.uid, { disabled: false, displayName: name }),
      auth.revokeRefreshTokens(authUser.uid),
      ...replacedUsers.flatMap((user) => [
        auth.updateUser(user.id, { disabled: true }),
        auth.revokeRefreshTokens(user.id),
      ]),
    ]);

    return apiJson({ ok: true, email });
  } catch (error) {
    if (error instanceof AdminAuthorizationError) return apiJson({ error: error.message }, error.status);
    console.error("Hospital login setup failed", error instanceof Error ? error.message : error);
    return apiJson({ error: "Hospital login setup is unavailable. Check the server Firebase Admin configuration and try again." }, 503);
  }
}

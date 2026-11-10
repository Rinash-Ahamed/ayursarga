import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { FieldValue, type Firestore, type DocumentReference } from "firebase-admin/firestore";
import type { Auth } from "firebase-admin/auth";

export class ProvisioningError extends Error {
  constructor(message: string, public readonly status: 409 | 503 = 409) { super(message); }
}

type Identity = { role: "admin" | "hospital"; email: string; hospitalId: string | null; actorId: string; device: Record<string, unknown> };

/** Admin-only preflight before changing an official login identity. Never merge
 * a Consumer/Admin/foreign Hospital account into this Hospital. */
export async function assertHospitalLoginEmailAvailable(auth: Auth, firestore: Firestore, hospitalId: string, email: string) {
  let existing;
  try { existing = await auth.getUserByEmail(email); }
  catch (error) { if ((error as { code?: string }).code !== "auth/user-not-found") throw error; }
  const claim = (await firestore.collection("portalAccountClaims").doc(createHash("sha256").update(email).digest("hex")).get()).data();
  if (claim && (claim.role !== "hospital" || claim.hospitalId !== hospitalId || claim.email !== email)) {
    throw new ProvisioningError("This email is reserved for a different account. Ask the project owner to review it.");
  }
  if (!existing) return;
  const profile = (await firestore.collection("users").doc(existing.uid).get()).data();
  if (profile?.role === "hospital" && profile.hospitalId === hospitalId) return;
  if (!profile && claim?.role === "hospital" && claim.hospitalId === hospitalId && claim.authUid === existing.uid && claim.email === email) return;
  throw new ProvisioningError("This email cannot be linked to this hospital's login. Choose a different official email or ask the project owner to review the account.");
}

/** Finish every independent Auth operation before reporting the saved outcome.
 * A provider failure must never turn into an ordinary success or delete data. */
export async function syncPortalAccountAccess(auth: Auth, accounts: Array<{ uid: string; disabled: boolean; displayName?: string }>) {
  const outcomes = await Promise.allSettled(accounts.flatMap(({ uid, ...changes }) => {
    const absentIsClosed = (error: unknown) => {
      if (changes.disabled && (error as { code?: string }).code === "auth/user-not-found") return;
      throw error;
    };
    return [auth.updateUser(uid, changes).catch(absentIsClosed), auth.revokeRefreshTokens(uid).catch(absentIsClosed)];
  }));
  return outcomes.every(outcome => outcome.status === "fulfilled");
}

/** Reserve an identity before Auth creation. Never delete an account or allocate
 * another UID after an uncertain result. Claims contain no passwords or links. */
export async function preparePortalAccount(auth: Auth, firestore: Firestore, input: Identity) {
  const email = input.email.trim().toLowerCase();
  const claimRef = firestore.collection("portalAccountClaims").doc(createHash("sha256").update(email).digest("hex"));
  let authUser;
  try { authUser = await auth.getUserByEmail(email); }
  catch (error) { if ((error as { code?: string }).code !== "auth/user-not-found") throw error; }
  let claim = (await claimRef.get()).data();
  const matches = (data: FirebaseFirestore.DocumentData) => data.email === email && data.role === input.role && data.hospitalId === input.hospitalId;
  if (claim && !matches(claim)) throw new ProvisioningError("This email is reserved for a different account. Ask the project owner to review it.");
  if (!authUser) {
    const candidateUid = `portal-${randomUUID()}`;
    claim = await firestore.runTransaction(async transaction => {
      const previous = (await transaction.get(claimRef)).data();
      if (previous) {
        if (!matches(previous)) throw new ProvisioningError("This email is reserved for a different account.");
        return previous;
      }
      const audit = firestore.collection("auditLogs").doc();
      const now = FieldValue.serverTimestamp();
      const data = { email, role: input.role, hospitalId: input.hospitalId, authUid: candidateUid, state: "reserved",
        createdAt: now, createdBy: input.actorId, updatedAt: now, updatedBy: input.actorId,
        archivedAt: null, archivedBy: null, lastAuditId: audit.id };
      transaction.create(claimRef, data);
      transaction.create(audit, { action: "create", module: "portalAccountClaims", recordId: claimRef.id,
        actorId: input.actorId, actorRole: "admin", previousValues: null, updatedValues: data, timestamp: now, source: "server", device: input.device });
      return data;
    });
    try { authUser = await auth.createUser({ uid: String(claim.authUid), email, disabled: true, emailVerified: false }); }
    catch { throw new ProvisioningError("Account setup could not be confirmed. The reserved account has been kept. Retry setup to check its saved state; do not create a different account.", 503); }
  }
  return { authUser, claimRef, claim, canRecoverMissingProfile: Boolean(claim && matches(claim) && claim.authUid === authUser.uid) };
}

/** Commit the outcome alongside the user profile and its audit. */
type ProvisioningWriter = {
  update(reference: DocumentReference, data: Record<string, unknown>): unknown;
  create(reference: DocumentReference, data: Record<string, unknown>): unknown;
};

export function recordProvisioningReady(batch: ProvisioningWriter, firestore: Firestore, prepared: Awaited<ReturnType<typeof preparePortalAccount>>, actorId: string, device: Record<string, unknown>) {
  if (!prepared.canRecoverMissingProfile || !prepared.claim || prepared.claim.state === "profile_ready") return;
  const audit = firestore.collection("auditLogs").doc();
  const now = FieldValue.serverTimestamp();
  const changes = { state: "profile_ready", updatedAt: now, updatedBy: actorId, lastAuditId: audit.id };
  batch.update(prepared.claimRef, changes);
  batch.create(audit, { action: "update", module: "portalAccountClaims", recordId: prepared.claimRef.id,
    actorId, actorRole: "admin", previousValues: prepared.claim, updatedValues: { ...prepared.claim, ...changes }, timestamp: now, source: "server", device });
}

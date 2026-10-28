import { useSyncExternalStore, type ComponentProps } from "react";
import { AuthenticationError } from "@/features/auth/errors";

const listeners = new Set<() => void>();
export const state = { enrolled: true, busy: false, error: null as AuthenticationError | null, authorized: false,
  calls: { login: 0, verify: 0, prepare: 0, enroll: 0, email: 0, cancel: 0 }, rejectSetup: false };
let revision = 0;
const emit = () => { revision++; listeners.forEach((listener) => listener()); };
async function operation(action: () => unknown) {
  state.busy = true; state.error = null; emit();
  try { await new Promise((resolve) => setTimeout(resolve, 80)); return action(); }
  catch (error) { state.error = error as AuthenticationError; throw error; }
  finally { state.busy = false; emit(); }
}
export function useAuth() {
  useSyncExternalStore((listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; }, () => revision, () => revision);
  return { isLoading: state.busy, error: state.error,
    clearError: () => { state.error = null; emit(); },
    login: async () => { state.calls.login++; return operation(() => { throw new AuthenticationError(state.enrolled ? "mfa-required" : "mfa-enrollment-required"); }); },
    completeAdminMfa: async (code: string) => { state.calls.verify++; return operation(() => { if (code !== "123456") throw new AuthenticationError("mfa-invalid-code"); state.authorized = true; }); },
    completeAdminMfaEnrollment: async (code: string) => { state.calls.enroll++; return operation(() => { if (code !== "123456") throw new AuthenticationError("mfa-invalid-code"); state.authorized = true; }); },
    logout: async () => { state.calls.cancel++; state.authorized = false; state.error = null; emit(); },
  };
}
export async function prepareAdminMfaEnrollment() {
  state.calls.prepare++;
  await new Promise((resolve) => setTimeout(resolve, 80));
  if (state.rejectSetup) throw new AuthenticationError("mfa-unavailable");
  return { key: "SYNTHETICKEYFORLOCALTESTONLY", email: "admin@example.test" };
}
export async function requestAdminEmailVerification() { state.calls.email++; }
export default function LinkOrImage(props: ComponentProps<"a"> & ComponentProps<"img"> & { priority?: boolean; unoptimized?: boolean }) {
  const { priority, unoptimized, ...rest } = props;
  void priority; void unoptimized;
  return props.src ? <img {...rest} alt={props.alt ?? ""} /> : <a {...rest} />;
}
Object.assign(window, { adminMfaFixture: state });

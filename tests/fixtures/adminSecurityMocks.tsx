import type { ReactNode } from "react";

const state = { calls: 0 };
Object.assign(window, { adminSecurityFixture: state });
export function PortalShell({ children }: { children: ReactNode }) { return <main className="portal-root" style={{ padding: 16 }}>{children}</main>; }
export async function replaceAdminAuthenticator() {
  state.calls++;
  await new Promise(resolve => setTimeout(resolve, 200));
  throw new Error("Synthetic replacement failure");
}

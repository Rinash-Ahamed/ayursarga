"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useSessionIdleTimeout } from "@/hooks/useSessionIdleTimeout";

const PORTAL_PREFIXES = ["/admin", "/hospital", "/app"] as const;

function isPortalPath(pathname: string) {
  return PORTAL_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function PublicSessionTimeout() {
  const pathname = usePathname();
  const [hasSession, setHasSession] = useState(false);
  const inPortal = isPortalPath(pathname || "");

  useEffect(() => {
    if (inPortal) {
      return;
    }

    let active = true;
    let unsubscribe: (() => void) | undefined;

    void Promise.all([
      import("firebase/auth"),
      import("@/services/auth/client"),
    ]).then(([firebaseAuth, authClient]) => {
      if (!active) return;
      unsubscribe = firebaseAuth.onIdTokenChanged(
        authClient.getClientAuth(),
        (user) => {
          if (active) setHasSession(Boolean(user));
        },
        () => {
          if (active) setHasSession(false);
        },
      );
    }).catch(() => {
      if (active) setHasSession(false);
    });

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [inPortal]);

  const expirePublicSession = useCallback(async () => {
    const [{ signOut }, { getClientAuth }] = await Promise.all([
      import("firebase/auth"),
      import("@/services/auth/client"),
    ]);
    await signOut(getClientAuth()).catch(() => undefined);
    setHasSession(false);
  }, []);

  useSessionIdleTimeout(!inPortal && hasSession, expirePublicSession);

  return null;
}

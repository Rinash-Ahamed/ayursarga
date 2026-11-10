"use client";

import { PortalDialog } from "@/components/portal/PortalDialog";

export function AdminSessionWarning({ open, busy = false, onContinue, onSignOut }: {
  open: boolean; busy?: boolean; onContinue: () => boolean; onSignOut: () => void;
}) {
  return <PortalDialog open={open} title="Stay signed in?"
    message="Your session will end soon due to inactivity. Choose Stay signed in to continue, or sign out now."
    confirmLabel="Stay signed in" cancelLabel="Sign out" initialFocus="confirm"
    busy={busy} onConfirm={() => { onContinue(); }} onCancel={onSignOut}
    onDismiss={() => {}} />;
}

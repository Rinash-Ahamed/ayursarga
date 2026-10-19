import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { PortalDialog } from "@/components/portal/PortalDialog";
import { ContractPreviewDialog } from "@/components/admin/ContractPreviewDialog";

export type DialogFixtureKind = "image" | "package" | "booking" | "activation" | "audit" | "treatment" | "tall" | "busy" | "preview";
const titles: Record<DialogFixtureKind, string> = {
  image: "Remove this image?", package: "Delete this package?", booking: "Update booking details",
  activation: "Activate this hospital?", audit: "Clear all audit history?", treatment: "Complete this treatment?",
  tall: "Review the details", busy: "Delete this package?", preview: "Preview partner contract",
};

function DialogHarness({ kind }: { kind: DialogFixtureKind }) {
  const [open, setOpen] = useState(false);
  const [nested, setNested] = useState(false);
  const [confirmed, setConfirmed] = useState(0);
  const [value, setValue] = useState("");
  return <main className="portal-root" data-fixture-role={kind === "package" || kind === "booking" || kind === "treatment" ? "hospital" : "admin"}>
    <div style={{ position: "fixed", zIndex: 60, top: 8, left: 8 }}>
      <button id="open-confirm" onClick={() => setOpen(true)}>Open confirmation</button>
      <button id="background-control">Background action</button>
      <output data-testid="confirmed">{confirmed}</output>
    </div>
    <div className="portal-page-enter" style={{ minHeight: 6000, overflow: "hidden", transform: "translateZ(0)" }}>
      <div style={{ height: 100, background: "#eef4f0" }}>Top of long page</div>
      <PortalDialog open={open && kind !== "preview"} title={titles[kind]} message="Confirm this action before continuing." busy={kind === "busy"} confirmLabel="Confirm action" onCancel={() => setOpen(false)} onConfirm={() => { setConfirmed((count) => count + 1); setOpen(false); }}>
        {(["booking", "activation", "audit"].includes(kind)) && <label>Details<input aria-label="Details" value={value} onChange={(event) => setValue(event.target.value)} /></label>}
        {kind === "tall" && <div style={{ minHeight: 1200 }}>Long confirmation information</div>}
      </PortalDialog>
      <ContractPreviewDialog open={open && kind === "preview"} html="<h1>Contract preview fixture</h1>" filename="contract.pdf" busy={false} onClose={() => setOpen(false)} onDownload={() => setNested(true)} />
      <PortalDialog open={nested} title="Download confirmation" message="Nested modal fixture" onCancel={() => setNested(false)} onConfirm={() => setNested(false)} />
    </div>
  </main>;
}

declare global {
  interface Window { mountDialogFixture: (kind: DialogFixtureKind) => void }
}
window.mountDialogFixture = (kind) => {
  createRoot(document.getElementById("fixture-root")!).render(<StrictMode><DialogHarness kind={kind} /></StrictMode>);
};

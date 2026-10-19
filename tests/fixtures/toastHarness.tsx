import { StrictMode, useCallback, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { PortalToast, PortalToastViewport } from "@/components/portal/PortalToast";
import { PortalFeedback } from "@/components/portal/PortalFeedback";
import { useRepeatableMessage } from "@/hooks/useRepeatableMessage";
import { usePaginatedList } from "@/hooks/usePaginatedList";
import type { QueryPage } from "@/services/firestore/firestoreService";
import type { ToastTone } from "@/utils/toastNotifications";

type Result = { label: string };
function DataRequests() {
  const [filter, setFilter] = useState(0);
  const pending = useRef<Array<{ resolve: (page: QueryPage<Result>) => void; reject: (error: Error) => void }>>([]);
  const [requests, setRequests] = useState(0);
  const loader = useCallback(() => {
    void filter;
    return new Promise<QueryPage<Result>>((resolve, reject) => {
      pending.current.push({ resolve, reject });
      setRequests(pending.current.length);
    });
  }, [filter]);
  const { error, errorNotification, reload } = usePaginatedList(loader, "The request failed.");
  return <section>
    <button onClick={() => setFilter((current) => current + 1)}>Change query</button>
    <button onClick={() => pending.current[0]?.reject(new Error("Old failure"))}>Reject oldest</button>
    <button onClick={() => pending.current.at(-1)?.reject(new Error("Current failure"))}>Reject latest</button>
    <button onClick={() => pending.current.at(-1)?.resolve({ documents: [], cursor: null, hasMore: false })}>Resolve latest</button>
    <button onClick={() => void reload()}>Retry request</button>
    <output data-testid="requests">{requests}</output>
    <PortalFeedback error={error} notification={errorNotification} />
    {/* Two observers of the same failed request must produce just one toast. */}
    <PortalToast message={error} notification={errorNotification} tone="error" />
  </section>;
}

function DelayedAction() {
  const [message, setMessage, notification] = useRepeatableMessage();
  return <>
    <button onClick={() => { window.setTimeout(() => setMessage("Delayed action completed."), 1000); }}>Start delayed action</button>
    <PortalToast message={message} notification={notification} />
  </>;
}

function ToastHarness() {
  const [message, setMessage, notification] = useRepeatableMessage();
  const [tone, setTone] = useState<ToastTone>("success");
  const [tick, setTick] = useState(0);
  const [show, setShow] = useState(true);
  const [data, setData] = useState(false);
  const [delayed, setDelayed] = useState(true);
  const [authError, setAuthError] = useState<{ message: string; occurredAt: number } | null>(null);
  return <>
    <button onClick={() => { setTone("success"); setMessage("Saved successfully."); }}>Save</button>
    <button onClick={() => { setTone("error"); setMessage("Unable to save."); }}>Fail action</button>
    <button onClick={() => { setTone("warning"); setMessage("Please review the details."); }}>Warn</button>
    <button onClick={() => { setTone("info"); setMessage("Information updated."); }}>Inform</button>
    <button onClick={() => setMessage(null)}>Clear message</button>
    <button onClick={() => setTick((current) => current + 1)}>Background update</button>
    <button onClick={() => setShow((current) => !current)}>Toggle page</button>
    <button onClick={() => setData(true)}>Open data</button>
    <button onClick={() => setDelayed(false)}>Leave delayed page</button>
    <button onClick={() => setAuthError({ message: "Authentication failed.", occurredAt: Date.now() })}>Auth failure</button>
    <output data-testid="tick">{tick}</output>
    {show && <>
      <PortalToast message={message} notification={notification} tone={tone} />
      <PortalToast message={authError?.message} source={authError} tone="error" />
    </>}
    {data && <DataRequests />}
    {delayed && <DelayedAction />}
    <PortalToastViewport />
  </>;
}

declare global { interface Window { mountToastFixture: () => void } }
window.mountToastFixture = () => createRoot(document.getElementById("fixture-root")!).render(<StrictMode><ToastHarness /></StrictMode>);

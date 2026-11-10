import { createRoot } from "react-dom/client";
import { useEffect, useRef, useState } from "react";
import { useSessionIdleTimeout } from "@/hooks/useSessionIdleTimeout";
import { AdminSessionWarning } from "@/components/portal/AdminSessionWarning";

function Fixture() {
  const role=(window as unknown as {sessionRole:string}).sessionRole;
  const [signedIn,setSignedIn]=useState(true),[warning,setWarning]=useState(false);
  const root=useRef<HTMLElement>(null);
  const resume=useSessionIdleTimeout(signedIn&&role!=="consumer",()=>setSignedIn(false),setWarning,role==="admin");
  useEffect(()=>{Object.assign(window,{resumeFixtureSession:resume});if(root.current)root.current.dataset.ready="true";},[resume]);
  return <main ref={root}><p>{signedIn?"Signed in":"Signed out"}</p><button>Background action</button>
    <AdminSessionWarning open={signedIn&&role==="admin"&&warning} onContinue={resume} onSignOut={()=>setSignedIn(false)}/>
  </main>;
}
createRoot(document.getElementById("fixture-root")!).render(<Fixture/>);

// Read-only Firestore probe. Logs timings/counts only, never IDs or record data.
import nextEnv from "@next/env";
import { cert, initializeApp, deleteApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import assert from "node:assert/strict";
import { loadTypeScript } from "../tests/helpers/loadTypeScript.mjs";

nextEnv.loadEnvConfig(process.cwd());
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const app = initializeApp({ credential: cert({ projectId,
  clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL?.trim(),
  privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n").trim(),
}), projectId }, "package-summary-profile");
const firestore = getFirestore(app);
try {
  const hospitals = await firestore.collection("hospitals").limit(20).select().get();
  const ids = hospitals.docs.map(doc => doc.id);
  if (!ids.length) throw new Error("No hospitals available for a read-only measurement.");
  const { POST } = loadTypeScript("app/api/admin/hospitals/package-summary/route.ts", {
    "@/services/firebase/adminAuthorization": { requireActiveAdmin: async () => ({firestore, uid:"read-only-probe"}), AdminAuthorizationError: class extends Error {} },
    "@/services/api/server": {apiJson: (body, status=200) => Response.json(body, {status})},
  });
  const baseline = () => firestore.runTransaction(async transaction => {
    const summaries = {};
    for (let offset=0; offset<ids.length; offset+=4) await Promise.all(ids.slice(offset,offset+4).map(async id => {
      const query=firestore.collection("services").where("hospitalId","==",id).where("archivedAt","==",null).where("status","in",["active","inactive"]);
      const counts=await Promise.all([query, ...["pending","draft","changes_requested"].map(status=>query.where("reviewStatus","==",status))].map(query=>transaction.get(query.count())));
      const [total,pending,draft,changesRequested]=counts.map(count=>count.data().count);
      summaries[id]={total,pending,draft,changesRequested,approved:Math.max(0,total-pending-draft-changesRequested)};
    }));
    return summaries;
  },{readOnly:true});
  const optimized = async () => {
    const response=await POST(new Request("https://local.test/api/admin/hospitals/package-summary",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({hospitalIds:ids})}));
    assert.equal(response.status,200,"Optimized read failed; inspect server diagnostic, not record contents.");
    return (await response.json()).summaries;
  };
  const samples={baseline:[],optimized:[]};
  for(let round=0;round<4;round++) {
    const results={};
    for(const mode of round%2 ? ["optimized","baseline"] : ["baseline","optimized"]) {
      const started=performance.now();
      results[mode]=await (mode==="baseline"?baseline():optimized());
      if(round) samples[mode].push(Math.round(performance.now()-started));
    }
    assert.deepEqual(results.optimized,results.baseline,"Counts changed between snapshots or differ; no values logged.");
  }
  console.log(JSON.stringify({hospitals:ids.length,warmMilliseconds:samples,matchingCounts:true,note:"Read-only direct Firestore lab probe; excludes real user authentication, browser and hosted cold starts."}));
} catch(error) {
  console.error(JSON.stringify({probe:"package-summary",failed:true,errorName:error?.name,code:error?.code}));
  process.exitCode=1;
} finally { await firestore.terminate(); await deleteApp(app); }

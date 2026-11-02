// Read-only production lab probe: local pages only, no sign-in, payments or writes.
import { chromium } from "@playwright/test";
import { gzipSync } from "node:zlib";
const origin = new URL(process.argv[2] ?? "http://127.0.0.1:3198");
if (!["127.0.0.1", "localhost"].includes(origin.hostname)) throw Error("Only a local production server may be profiled.");
const browser = await chromium.launch({headless:true});
const median = values => [...values].sort((a,b)=>a-b)[Math.floor(values.length/2)];
try {
  for (const width of [390,1440]) for (const path of ["/discover/online-consultation", "/app/bookings/consultation?service=prenatal-doctor"]) {
    const samples = [];
    for (let sample=0;sample<3;sample++) {
      const context = await browser.newContext({viewport:{width,height:900},reducedMotion:"reduce"});
      await context.route("**/*", route => new URL(route.request().url()).origin === origin.origin ? route.continue() : route.abort());
      const page = await context.newPage();
      const scripts = new Map(), pending = [];
      page.on("response", response => {
        if (response.request().resourceType() !== "script" || response.status() !== 200) return;
        pending.push(response.body().then(body=>scripts.set(response.url(), {raw:body.length,gzip:gzipSync(body).length})).catch(()=>{}));
      });
      await page.addInitScript(() => {
        window.auditMetrics = {lcp:0,cls:0,longTasks:0,longTaskMs:0};
        new PerformanceObserver(list=>{for(const entry of list.getEntries()) window.auditMetrics.lcp=entry.startTime;}).observe({type:"largest-contentful-paint",buffered:true});
        new PerformanceObserver(list=>{for(const entry of list.getEntries()) if(!entry.hadRecentInput)window.auditMetrics.cls+=entry.value;}).observe({type:"layout-shift",buffered:true});
        new PerformanceObserver(list=>{for(const entry of list.getEntries()){window.auditMetrics.longTasks++;window.auditMetrics.longTaskMs+=entry.duration;}}).observe({type:"longtask",buffered:true});
      });
      const response = await page.goto(new URL(path,origin).href,{waitUntil:"domcontentloaded"});
      await page.waitForTimeout(1500);
      await Promise.all(pending);
      const metrics = await page.evaluate(()=>({ ...window.auditMetrics, domReadyMs:performance.getEntriesByType("navigation")[0]?.domContentLoadedEventEnd ?? 0,overflow:document.documentElement.scrollWidth>innerWidth+1 }));
      samples.push({...metrics,httpStatus:response.status(),scripts:scripts.size,jsGzipBytes:[...scripts.values()].reduce((sum,v)=>sum+v.gzip,0)});
      await context.close();
    }
    console.log(JSON.stringify({phase:process.argv[3]??"baseline",width,path,conditions:"Local production, unthrottled software-rendered Chromium; third parties blocked; protected route measures anonymous auth-gated shell, not signed-in flow",samples,median:{domReadyMs:Math.round(median(samples.map(v=>v.domReadyMs))),lcpMs:Math.round(median(samples.map(v=>v.lcp))),cls:median(samples.map(v=>v.cls)),jsGzipBytes:median(samples.map(v=>v.jsGzipBytes)),longTaskMs:Math.round(median(samples.map(v=>v.longTaskMs)))}}));
  }
} finally { await browser.close(); }

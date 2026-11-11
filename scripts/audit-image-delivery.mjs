import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

// Local production build only. Blocks external requests and never signs in or submits.
const label = process.argv[2] ?? 'after';
if (!['before', 'after', 'after-warm', 'verification'].includes(label)) throw new Error('Use before, after, after-warm or verification.');
const port = 3121;
const origin = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-H', '127.0.0.1', '-p', String(port)], { windowsHide: true, stdio: 'ignore' });
let browser;
try {
  for (let retry = 0; retry < 80; retry++) {
    if (server.exitCode !== null) throw new Error('Temporary server did not start; port may be occupied.');
    try { if ((await fetch(`${origin}/api/health`)).ok) break; } catch { /* bounded startup */ }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  await mkdir('tmp/image-delivery', { recursive: true });
  browser = await chromium.launch({ headless: true });
  const results = [];
  for (const [name, viewport, dpr] of [['mobile', {width:390,height:844}, 2], ['tablet',{width:820,height:1180},2],['desktop',{width:1440,height:900},1]]) {
    const context = await browser.newContext({ viewport, deviceScaleFactor:dpr, reducedMotion:'reduce' });
    await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    const page = await context.newPage();
    const imageRequests = new Set();
    page.on('request', request => { if(request.resourceType()==='image') imageRequests.add(request.url().replace(origin,'')); });
    await page.addInitScript(() => {
      window.__imageAuditLcp = 0;
      new PerformanceObserver(list => { window.__imageAuditLcp = list.getEntries().at(-1)?.startTime ?? 0; }).observe({type:'largest-contentful-paint',buffered:true});
    });
    await page.goto(origin, {waitUntil:'networkidle',timeout:60000});
    await page.screenshot({path:`tmp/image-delivery/${label}-${name}-hero.png`});
    const initial = await page.evaluate(() => ({ lcpMs: Math.round(window.__imageAuditLcp), domContentLoadedMs: Math.round(performance.getEntriesByType('navigation')[0].domContentLoadedEventEnd), imageBytes: performance.getEntriesByType('resource').filter(row=>row.initiatorType==='img'||row.name.includes('/_next/image')).reduce((sum,row)=>sum+row.encodedBodySize,0) }));
    for (const selector of ['#wellness','#why-ayursarga','.partner-image','footer']) {
      const section = page.locator(selector).first();
      if(await section.count()) { await section.scrollIntoViewIfNeeded(); await page.waitForTimeout(400); }
    }
    await page.waitForTimeout(1000);
    const wellness=page.locator('#wellness');
    if(await wellness.count()) { await wellness.scrollIntoViewIfNeeded();await page.screenshot({path:`tmp/image-delivery/${label}-${name}-wellness.png`}); }
    const images = await page.locator('img').evaluateAll(elements => elements.map(image=>({src:image.currentSrc.replace(location.origin,''),width:image.clientWidth,height:image.clientHeight,naturalWidth:image.naturalWidth,loaded:image.complete && image.naturalWidth>0,loading:image.loading})));
    const resources = await page.evaluate(()=>performance.getEntriesByType('resource').filter(row=>row.initiatorType==='img'||row.name.includes('/_next/image')).map(row=>({url:row.name.replace(location.origin,''),bytes:row.encodedBodySize,durationMs:Math.round(row.duration)})));
    const overflow = await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
    results.push({name,dpr,initial,imageRequests:[...imageRequests],optimizerRequests:[...imageRequests].filter(url=>url.startsWith('/_next/image')),images,resources,totalImageBytes:resources.reduce((sum,row)=>sum+row.bytes,0),overflow});
    await context.close();
  }
  await writeFile(`tmp/image-delivery/${label}.json`,JSON.stringify(results,null,2));
  console.log(JSON.stringify(results.map(({name,initial,totalImageBytes,optimizerRequests,overflow,images})=>({name,initial,totalImageBytes,optimizerRequests:optimizerRequests.length,overflow,broken:images.filter(image=>!image.loaded).length})),null,2));
} finally { await browser?.close(); server.kill(); }

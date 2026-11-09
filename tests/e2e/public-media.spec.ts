import { expect, test, type Page } from "@playwright/test";
import { readFileSync, existsSync } from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { bundleDialogHarness } from "../helpers/bundleDialogHarness";

// Animation and Next's image adapter are mocked; real video DOM, observers,
// playback lifecycle, responsive picture selection and local media are exercised.
const bundle = bundleDialogHarness("tests/fixtures/publicMediaHarness.tsx", {
  "framer-motion":"tests/fixtures/publicMediaMocks.tsx", "next/image":"tests/fixtures/publicMediaImageMock.tsx", "./MagneticButton":"tests/fixtures/publicMediaMocks.tsx",
});
const heroBundle=bundleDialogHarness("tests/fixtures/publicHeroMediaHarness.tsx", {
  "framer-motion":"tests/fixtures/publicMediaMocks.tsx", "next/image":"tests/fixtures/publicMediaImageMock.tsx", "./MagneticButton":"tests/fixtures/publicMediaMocks.tsx",
});
async function mount(page:Page, fail=false, posterGate?:Promise<void>) {
  const requests:string[]=[];
  // A real loopback server also serves WebKit's native media pipeline, which
  // may bypass page.route interception. No external services or app APIs run.
  const server=createServer(async(request,response)=>{
    const url=new URL(request.url??'/', 'http://127.0.0.1');
    if(url.pathname==="/"){response.writeHead(200,{"Content-Type":"text/html"});response.end('<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="fixture-root"></div></body></html>');return;}
    const path=`public${url.pathname==='/_next/image'?url.searchParams.get('url'):url.pathname}`;
    if(!/^public\/(?:video\/)?[\w.-]+\.(?:webp|mp4)$/.test(path)||!existsSync(path)){response.writeHead(404);response.end('not found');return;}
    if(posterGate&&path.includes('hero-video-poster'))await posterGate;
    const video=path.endsWith('.mp4');
    if(video){requests.push(url.pathname);if(fail){response.destroy();return;}await new Promise(resolve=>setTimeout(resolve,250));}
    const bytes=readFileSync(path),range=request.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
    const start=range?Number(range[1]):0,end=range&&range[2]?Math.min(Number(range[2]),bytes.length-1):bytes.length-1;
    response.writeHead(range?206:200,{"Content-Type":video?"video/mp4":"image/webp","Content-Length":end-start+1,"Accept-Ranges":"bytes",...(range?{"Content-Range":`bytes ${start}-${end}/${bytes.length}`}:{})});
    response.end(bytes.subarray(start,end+1));
  });
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  page.on('close',()=>{server.closeAllConnections();server.close();});
  await page.goto(`http://127.0.0.1:${(server.address() as AddressInfo).port}/`);
  for(const path of ['node_modules/tailwindcss/lib/css/preflight.css','app/globals.css'])await page.addStyleTag({content:readFileSync(path,'utf8')});
  await page.addScriptTag({content:posterGate?heroBundle:bundle});
  await expect(page.locator(posterGate?'#hero':'.treatment-film')).toHaveCount(1);
  return requests;
}

test('public media loads one lead video near view, stages following clips after playback and retains layout',async({page})=>{
  await page.emulateMedia({reducedMotion:'no-preference'});
  const requests=await mount(page);
  const film=page.locator('.treatment-film'),videos=film.locator('video');
  await expect(videos.nth(0)).not.toHaveAttribute('src');
  await expect(videos.nth(1)).not.toHaveAttribute('src');
  expect(requests).toEqual([]);
  await film.evaluate(element=>scrollTo(0,scrollY+element.getBoundingClientRect().top-innerHeight-250));
  await expect(videos.nth(0)).toHaveAttribute('src','/video/ayurvedic-treatment-web.mp4');
  await expect(videos.nth(1)).not.toHaveAttribute('src');
  // iOS may ignore preload until visible: no competing following-film request
  // is the invariant, not forcing a browser to fetch before its media policy.
  expect(requests.every(path=>path==='/video/ayurvedic-treatment-web.mp4')).toBe(true);
  await film.scrollIntoViewIfNeeded();
  const bounds=await film.boundingBox();
  await expect(videos.nth(0)).toHaveClass(/active/);
  await expect.poll(()=>videos.nth(0).evaluate((video:HTMLVideoElement)=>video.videoWidth>0&&video.currentTime>0&&!video.paused)).toBe(true);
  await expect(videos.nth(1)).toHaveAttribute('src','/video/ayur2-web.mp4');
  expect(await film.boundingBox()).toEqual(bounds);
  await videos.nth(0).dispatchEvent('ended');
  await expect(videos.nth(1)).toHaveClass(/active/);
  await expect(videos.nth(0)).toHaveAttribute('src','/video/babycare-web.mp4');
  await page.evaluate(()=>scrollTo(0,0));
  await expect.poll(()=>videos.evaluateAll(elements=>elements.every(element=>(element as HTMLVideoElement).paused))).toBe(true);
  await page.locator('.partner-image').scrollIntoViewIfNeeded();
  await expect.poll(()=>page.locator('.partner-image img').evaluate((image:HTMLImageElement)=>image.complete&&image.naturalWidth>0)).toBe(true);
  expect(await page.locator('.partner-image img').evaluate((image:HTMLImageElement)=>image.currentSrc)).toMatch(/ayurvedic-hospital-partner-web(?:-640)?\.webp$/);
  await expect(page.locator('.partner-image img')).toHaveAttribute('loading','eager');
  await expect(page.locator('.partner-image source')).toHaveAttribute('srcset', '/ayurvedic-hospital-partner-web-640.webp 640w, /ayurvedic-hospital-partner-web.webp 1280w');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('hero waits for its critical poster before any eligible desktop background video',async({page})=>{
  await page.emulateMedia({reducedMotion:'no-preference'});
  let complete!:()=>void;
  const gate=new Promise<void>(resolve=>{complete=resolve;});
  const requests=await mount(page,false,gate);
  await expect(page.locator('#hero video source')).toHaveCount(0);
  expect(requests).toEqual([]);
  complete();
  await expect.poll(()=>page.locator('.hero-background-poster').evaluate((image:HTMLImageElement)=>image.complete&&image.naturalWidth>0)).toBe(true);
  const eligible=await page.evaluate(()=>matchMedia('(min-width: 1100px) and (hover: hover) and (pointer: fine)').matches);
  if(eligible){
    await expect(page.locator('#hero video source')).toHaveAttribute('src','/hero-video-web.mp4');
    await expect(page.locator('#hero video')).toHaveClass(/ready/);
    expect(requests.some(path=>path==='/hero-video-web.mp4')).toBe(true);
  }else{
    await expect(page.locator('#hero video source')).toHaveCount(0);
    expect(requests).toEqual([]);
  }
});

test('reduced motion shows the treatment poster without downloading videos',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  const requests=await mount(page);
  await page.locator('.treatment-film').scrollIntoViewIfNeeded();
  await expect.poll(()=>page.locator('.treatment-film-poster').evaluate((image:HTMLImageElement)=>image.complete&&image.naturalWidth>0)).toBe(true);
  expect(await page.locator('.treatment-film video').evaluateAll(elements=>elements.every(element=>!element.hasAttribute('src')))).toBe(true);
  expect(requests).toEqual([]);
});

test('video loading failure retains a visible poster and readable section',async({page})=>{
  await page.emulateMedia({reducedMotion:'no-preference'});
  await mount(page,true);
  await page.locator('.treatment-film').scrollIntoViewIfNeeded();
  await expect.poll(()=>page.locator('.treatment-film video').first().evaluate((video:HTMLVideoElement)=>Boolean(video.error))).toBe(true);
  await expect(page.locator('.treatment-film-video.active')).toHaveCount(0);
  await expect(page.locator('.treatment-film-copy h3')).toBeVisible();
  await expect.poll(()=>page.locator('.treatment-film-poster').evaluate((image:HTMLImageElement)=>image.complete&&image.naturalWidth>0)).toBe(true);
});

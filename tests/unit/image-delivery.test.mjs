import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import nextConfig from '../../next.config.mjs';
import { loadTypeScript } from '../helpers/loadTypeScript.mjs';

const assets=JSON.parse(readFileSync('config/image-assets.json','utf8'));
test('content-addressed derivatives are small, correctly sized and metadata-free, with originals preserved', async()=>{
  for(const [key,asset] of Object.entries(assets)) {
    const bytes=readFileSync(`public${asset.src}`),metadata=await sharp(bytes).metadata();
    assert.equal(metadata.format,'webp');assert.equal(metadata.width,asset.width);assert.equal(metadata.height,asset.height);
    assert.equal(metadata.exif,undefined);assert.equal(metadata.icc,undefined);
    assert(asset.src.includes(createHash('sha256').update(bytes).digest('hex').slice(0,12)));
    assert(key==='hero-video-poster' ? bytes.length===asset.originalBytes : bytes.length<asset.originalBytes,key);
    if(key.endsWith('-thumb')) {assert(metadata.width<=128);assert(bytes.length<10_000);}
  }
  assert.equal(assets.logo.width,192);assert(assets.logo.bytes<13_000);assert(assets.whatsapp.bytes<5000);
  assert(statSync('public/mainlogo.png').size>0);assert(statSync('public/why.png').size>0);
});
test('optimizer remains enabled with bounded widths/qualities and immutable derived URLs', async()=>{
  assert.notEqual(nextConfig.images.unoptimized,true);
  assert.deepEqual(nextConfig.images.qualities,[75,82]);
  assert.equal(nextConfig.images.minimumCacheTTL,31*86400);
  assert.equal(new Set([...nextConfig.images.deviceSizes,...nextConfig.images.imageSizes]).size,9);
  const header=(await nextConfig.headers()).find(row=>row.source==='/optimized/:asset');
  assert(header.headers.some(row=>row.value.includes('immutable')));
  for(const file of ['components/Nav.tsx','components/Footer.tsx','components/ScrollLogo.tsx','components/PublicOpening.tsx','components/auth/AuthFormShell.tsx','components/portal/PortalShell.tsx','app/health/page.tsx']){
    const source=readFileSync(file,'utf8');assert(!source.includes('src="/mainlogo.png"'));assert(source.includes('images.logo.src'));assert(source.includes('unoptimized'));
  }
});
test('Firebase variants retain exact tokens and immutable source versions; arbitrary external photos are not guessed',()=>{
  const {hospitalImageSrcSet}=loadTypeScript('features/hospitals/images.ts');
  const source='https://firebasestorage.googleapis.com/v0/b/example/o/hospitals%2Fcentre%2Fimages%2F00000000-0000-4000-8000-000000000001-1200.webp?alt=media&token=sample';
  const set=hospitalImageSrcSet(source);
  for(const width of [480,800,1200]) {assert(set.includes(`-${width}.webp?alt=media&token=sample ${width}w`));}
  assert.equal(hospitalImageSrcSet('https://example.com/photo.jpg'),undefined);
  assert.equal(hospitalImageSrcSet(source.replace('-1200.webp','.webp')),undefined);
  for(const file of ['components/hospital/HospitalImageManager.tsx','components/hospital/HospitalImageGallery.tsx']) assert(readFileSync(file,'utf8').includes('hospitalImageSrcSet(url)'));
  const hospital=readFileSync('app/api/hospitals/[hospitalId]/images/route.ts','utf8');
  const consultant=readFileSync('app/api/admin/consultants/[consultantId]/image/route.ts','utf8');
  assert(hospital.includes('31536000,immutable'));assert(consultant.includes('readImageUpload(request, 384, 384'));
  assert(readFileSync('storage.rules','utf8').includes('allow read, write: if false'));
});

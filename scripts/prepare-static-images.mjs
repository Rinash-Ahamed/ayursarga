import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

// Reproducible derived assets. Never overwrite or remove source artwork.
const inputs = [
  ['logo','mainlogo.png',192,90], ['whatsapp','whatsapp.png',128,90],
  ['why','why.png',1402,86],
  ['hero-video-poster','hero-video-poster-web.webp',1600,null],
  ...['prenatal-care.jpg','postnatal-care.jpeg','lactation-support.jpg','panchakarma.jpeg','womens-wellness.jpeg','stress-management.jpeg'].map(file=>[file.split('.')[0],`wellness/${file}`,960,86]),
  ...['prenatal-care.jpg','postnatal-care.jpeg','lactation-support.jpg','panchakarma.jpeg','womens-wellness.jpeg','stress-management.jpeg'].map(file=>[`${file.split('.')[0]}-thumb`,`wellness/${file}`,128,84]),
];
await mkdir('public/optimized',{recursive:true});
const manifest = {};
for(const [name,source,width,quality] of inputs) {
  const original = await readFile(`public/${source}`);
  const buffer = quality === null ? original : await sharp(original).rotate().resize({width,withoutEnlargement:true}).webp({quality,effort:6}).toBuffer();
  const hash = createHash('sha256').update(buffer).digest('hex').slice(0,12);
  const src = `/optimized/${name}-${hash}.webp`;
  await writeFile(`public${src}`,buffer);
  const metadata=await sharp(buffer).metadata();
  manifest[name]={src,width:metadata.width,height:metadata.height,bytes:buffer.length,originalBytes:original.length};
}
await writeFile('config/image-assets.json',JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify(manifest,null,2));

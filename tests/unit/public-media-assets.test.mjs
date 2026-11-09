import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import sharp from 'sharp';
import { loadTypeScript } from '../helpers/loadTypeScript.mjs';
import { createRequire } from 'node:module';

const pairs=[
  ['public/hero-video.mp4','public/hero-video-web.mp4'],
  ['public/video/ayurvedic-treatment.mp4','public/video/ayurvedic-treatment-web.mp4'],
  ['public/video/ayur2.mp4','public/video/ayur2-web.mp4'],
  ['public/video/babycare.mp4','public/video/babycare-web.mp4'],
  ['public/ayurvedic-hospital-partner.webp','public/ayurvedic-hospital-partner-web.webp'],
  ['public/hero-video-poster.webp','public/hero-video-poster-web.webp'],
];
test('public web encodings are smaller than preserved source media',()=>{
  for(const [source,output] of pairs)assert.ok(statSync(output).size<statSync(source).size*.75,output);
});
test('optimized MP4 videos retain fast-start H.264 and remove unused sound tracks',()=>{
  for(const [,output] of pairs.filter(([,path])=>path.endsWith('.mp4'))){
    const bytes=readFileSync(output),atoms=[];
    for(let offset=0;offset+8<=bytes.length;){const length=bytes.readUInt32BE(offset);assert.ok(length>=8);atoms.push(bytes.toString('ascii',offset+4,offset+8));offset+=length;}
    assert.ok(atoms.indexOf('moov')>=0&&atoms.indexOf('moov')<atoms.indexOf('mdat'),output);
    assert.ok(bytes.includes(Buffer.from('avc1')),output);
    assert.equal(bytes.includes(Buffer.from('soun')),false,output);
  }
});
test('partner variants preserve aspect ratio and the treatment poster is lightweight',async()=>{
  for(const width of [640,1280]){
    const image=await sharp(`public/ayurvedic-hospital-partner-web${width===640?'-640':''}.webp`).metadata();
    assert.equal(image.width,width);assert.ok(Math.abs(image.width/image.height-1.5)<.003);assert.equal(image.format,'webp');
  }
  assert.ok(statSync('public/video/treatment-poster.webp').size<100_000);
});
test('partner photo uses eager native responsive variants without a custom loader or on-demand encoding',()=>{
  const Image=()=>null;
  const {default:Voices}=loadTypeScript('components/Voices.tsx',{'next/image':Image,'framer-motion':{motion:{span:'span'},useReducedMotion:()=>true},'./MagneticButton':()=>null});
  const find=node=>{if(!node||typeof node!=='object')return null;if(node.type===Image)return node;for(const child of [node.props?.children].flat(Infinity)){const result=find(child);if(result)return result;}return null;};
  const tree=Voices(),image=find(tree);assert.ok(image);
  assert.equal(image.props.loading,'eager');
  assert.equal(image.props.unoptimized,true);
  assert.equal(image.props.loader,undefined);
  const findPicture=node=>{if(!node||typeof node!=='object')return null;if(node.type==='picture')return node;for(const child of [node.props?.children].flat(Infinity)){const result=findPicture(child);if(result)return result;}return null;};
  const picture=findPicture(tree);assert.equal(picture.props.className,'partner-image');
  const source=picture.props.children.find(child=>child.type==='source');
  assert.equal(source.props.srcSet,'/ayurvedic-hospital-partner-web-640.webp 640w, /ayurvedic-hospital-partner-web.webp 1280w');
  assert.equal(source.props.sizes,image.props.sizes);
  const {getImageProps}=createRequire(import.meta.url)('next/image');
  const {props}=getImageProps(image.props);
  assert.equal(props.src,'/ayurvedic-hospital-partner-web.webp');
  assert.equal(props.loading,'eager');
  assert.equal(props.srcSet,undefined);
  assert.equal(props.width,1280);assert.equal(props.height,853);
});

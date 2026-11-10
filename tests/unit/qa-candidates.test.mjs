import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as React from 'react';
import { loadTypeScript } from '../helpers/loadTypeScript.mjs';
import { bookingFlowFixture } from '../helpers/bookingFlowFixture.mjs';

test('AUT-002: consumer phone lengths and optional address use real validation', () => {
  const { validateConsumerContact: validate } = loadTypeScript('features/consumers/profileValidation.ts');
  for (const phone of ['', '987654321', '98765432101', 'abcdefghij']) {
    const result = validate({ name: 'Synthetic Consumer', phone, address: '', privacyConsent: true }, true);
    assert.equal(result.isValid, false); assert.ok(result.errors.phone);
  }
  const result = validate({ name: 'Synthetic Consumer', phone: '9876543210', address: '', privacyConsent: true }, true);
  assert.equal(result.isValid, true); assert.equal(result.data.address, null);
});

test('AUT-008: every wrong-role pair renders fallback, never protected children, and redirects to matching login', () => {
  for (const role of ['admin', 'hospital', 'consumer']) for (const actual of ['admin', 'hospital', 'consumer', null]) {
    if (role === actual) continue;
    const redirects = [], effects = [];
    const { RequireRole } = loadTypeScript('components/auth/RequireRole.tsx', {
      react: { ...React, useEffect: fn => effects.push(fn) },
      'next/navigation': { useRouter: () => ({ replace: path => redirects.push(path) }), usePathname: () => `/${role === 'consumer' ? 'app' : role}/bookings` },
      '@/hooks/useAuth': { useAuth: () => ({ userProfile: actual ? { role: actual, status: 'active' } : null, isLoading: false, status: actual ? 'authenticated' : 'unauthenticated' }) },
    });
    const rendered = RequireRole({ role, children: 'PRIVATE RECORD', fallback: 'LOADING' });
    assert.equal(rendered, 'LOADING'); effects.forEach(fn => fn());
    assert.equal(redirects.length, 1);
    assert.ok(redirects[0].startsWith(`/${role === 'consumer' ? 'app' : role}/login`));
  }
});

const hospital = { legalName: 'Synthetic Centre LLP', name: 'Synthetic Centre', email: 'centre@example.test', phone: '9876543210', hospitalPhone1: '9876543210', hospitalPhone2: '', registeredAddress: 'Registered street address', address: 'Service street address', city: 'Palakkad', district: 'Palakkad', state: 'Kerala', commissionPercentage: 10 };
test('HOS-002 HPT-011: hospital required fields and optional secondary phone validate without writes', () => {
  const { validateHospitalFields: validate } = loadTypeScript('features/hospitals/validation.ts');
  assert.equal(validate(hospital).isValid, true);
  assert.equal(validate(hospital).data.hospitalPhone2, null);
  for (const [key, value] of [['name',''], ['email','not-mail'], ['phone','123'], ['hospitalPhone1',''], ['hospitalPhone2','bad'], ['address','short'], ['state','Unknown'], ['district','Mumbai'], ['commissionPercentage',101]]) {
    const result=validate({ ...hospital, [key]:value }); assert.equal(result.isValid,false,key); assert.ok(result.errors[key],key);
  }
});

test('HOS-014: supported iframe src is extracted, untrusted maps never become an embed', () => {
  const { validateHospitalLocationUrl: validate, getHospitalMapEmbedUrl: embed } = loadTypeScript('features/hospitals/location.ts');
  const result=validate('<iframe src="https://www.google.com/maps/embed?pb=synthetic&amp;lang=en" width="600" onload="untrusted()"></iframe>');
  assert.equal(result.error,null); assert.equal(result.locationUrl,'https://www.google.com/maps/embed?pb=synthetic&lang=en');
  assert.equal(embed(result.locationUrl,'Centre Road'),result.locationUrl);
  for(const url of ['javascript:alert(1)','http://www.google.com/maps/embed','https://evil.test/maps/embed','https://www.google.com/search?q=map','<iframe src="https://evil.test"/>']) {
    assert.ok(validate(url).error,url);
    assert.equal(embed(url,'Centre Road'),null,url);
  }
  assert.match(embed('https://maps.app.goo.gl/synthetic','Palakkad Centre Road'),/q=Palakkad%20Centre%20Road/);
});

test('CON-008: partner contract retains CP01 but omits removed CP02 and online consultation policy', () => {
  const { buildHospitalContractHtml } = loadTypeScript('features/hospitals/partnerContractTemplate.ts');
  const html=buildHospitalContractHtml({...hospital,id:'centre',registrationNumber:'REG01',cinNumber:'NOT APPLICABLE',panNumber:'ABCDE1234F',gstin:'NOT APPLICABLE',contractEffectiveDate:'2026-11-09',contractExpiryDate:'2029-11-09',emergencyContact:'9876543210',emergencyReferralHospital:'Nearby hospital'});
  assert.match(html,/CP01 postnatal - 45 days or more/);
  assert.match(html,/CP01 - 30 days or more, but fewer than 45 days/);
  assert.match(html,/CP01 - fewer than 30 days/);
  assert.doesNotMatch(html,/CP[O0]2|Exactly two days falls|CP02 applies/i);
  assert.doesNotMatch(html,/online consultation|consultation-published-24h|free cancellation date/i);
});

test('WEL-012 CST-013: all seven explicit service assignments project only currently assigned eligible providers', () => {
  const { CONSULTATION_SERVICES }=loadTypeScript('features/consultations/catalog.ts');
  const { publicConsultantProjection: project }=loadTypeScript('features/consultations/publicProjection.ts');
  assert.equal(CONSULTATION_SERVICES.length,7);
  const provider={name:'Synthetic Doctor',status:'active',consultantCharge:1000,ayursargaCommissionPercentage:10,preferredTimeSlots:['morning'],preferredSlotTimings:{morning:{startTime:'09:00',endTime:'12:00'}}};
  for(const {id}of CONSULTATION_SERVICES) {
    const data={...provider,consultationServices:[id]};
    const value=project('AS001',data,id);assert.equal(value.id,'AS001');assert.equal(value.consultantCharge,1100);
    for(const other of CONSULTATION_SERVICES.filter(s=>s.id!==id)) assert.equal(project('AS001',data,other.id),null);
    assert.equal(project('AS001',{...data,consultationServices:[]},id),null);
  }
  const old={...provider,consultationServices:['prenatal-doctor']};
  assert.ok(project('AS001',old,'prenatal-doctor'));
  old.consultationServices=['psychologist'];
  assert.equal(project('AS001',old,'prenatal-doctor'),null);assert.ok(project('AS001',old,'psychologist'));
});

test('CST-013: refreshing public API after a service edit reads current assignments rather than a completed response cache',async()=>{
  const provider={name:'Synthetic Doctor',employeeSequence:1,status:'active',consultantCharge:1000,ayursargaCommissionPercentage:10,preferredTimeSlots:['morning'],consultationServices:['prenatal-doctor']};
  let db;
  const f=bookingFlowFixture({records:{'consultants/AS001':provider},overrides:{
    '@/services/firebase/admin':{getFirebaseAdminFirestore:()=>db},
    '@/services/api/rateLimit':{allowRequest:()=>true,requestFingerprint:()=> 'synthetic'},
  }});db=f.firestore;
  const {GET}=f.load('app/api/public/consultants/route.ts');
  const query=async service=>{const r=await GET(new Request(`https://test.local/api/public/consultants?service=${service}`));assert.equal(r.status,200);return r.json();};
  assert.equal((await query('prenatal-doctor')).documents.length,1);
  f.records.set('consultants/AS001',{...provider,consultationServices:['psychologist']});
  assert.equal((await query('prenatal-doctor')).documents.length,0);
  assert.equal((await query('psychologist')).documents.length,1);
});

test('PKG-002: package duration, price and procedure validation rejects invalid payloads and accepts corrected values', () => {
  const { validatePackagePayload: validate }=loadTypeScript('features/hospitals/packages.ts');
  const valid={packageDurationDays:7,price:20000,description:'Care notes',procedures:{headMassage:2},otherProcedures:[]};
  for(const changes of [{packageDurationDays:''},{packageDurationDays:8},{price:0},{price:-1},{price:'bad'},{procedures:{}},{procedures:{unknown:2}},{procedures:{headMassage:0}},{procedures:{headMassage:1.5}},{otherProcedures:[{name:'Custom care',days:0}]}]) assert.throws(()=>validate({...valid,...changes}));
  assert.equal(validate(valid).price,20000);
});

test('USR-012: invalid capacity never calls an API; corrected totals use the existing own-Hospital endpoint', async () => {
  const calls=[];
  const { saveHospitalCapacity: save }=loadTypeScript('services/hospitals/capacityService.ts',{
    '@/services/firestore/firestoreService':{}, '@/services/firestore/auditService':{},
    '@/services/api/client':{authorizedMutationRequest:async(...args)=>{calls.push(args);return{totalRooms:10,occupiedRooms:4};}},
  });
  for(const input of [{totalRooms:-1,occupiedRooms:0},{totalRooms:1.5,occupiedRooms:0},{totalRooms:10001,occupiedRooms:0},{totalRooms:1,occupiedRooms:-1},{totalRooms:1,occupiedRooms:0.5},{totalRooms:1,occupiedRooms:2}]) await assert.rejects(save('centre',input));
  assert.equal(calls.length,0);
  await save('centre',{totalRooms:10,occupiedRooms:4});
  assert.equal(calls.length,1);assert.equal(calls[0][0],'/api/hospital/capacity');
  assert.deepEqual(JSON.parse(calls[0][1].body),{totalRooms:10,occupiedRooms:4});
});

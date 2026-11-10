import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { loadTypeScript } from '../helpers/loadTypeScript.mjs';
import { bookingFlowFixture, BookingTestAuthorizationError } from '../helpers/bookingFlowFixture.mjs';

const centre = { name:'Centre',legalName:'Centre LLP',email:'old@example.test',phone:'9876543210',hospitalPhone1:'9876543210',hospitalPhone2:null,
  address:'A complete centre address',registeredAddress:'A complete registered address',city:'Palakkad',district:'Palakkad',state:'Kerala',
  description:'Preserved',commissionPercentage:10,status:'active',archivedAt:null,lastAuditId:'original',
  centreGuidelines:{},additionalCentreRules:'',facilities:'',legalPolicies:'',additionalBystandersAllowed:false };
const context={params:Promise.resolve({hospitalId:'centre'})};
const request=(body,method='PATCH')=>new Request('https://test.local/api/test',{method,headers:{'content-type':'application/json'},body:JSON.stringify(body)});

function fixture(options={}) {
  let f,created=0,enabled=0,emails=0,lostAuth=false,lostProfile=false,failedProfile=false;
  const authUsers=new Map(options.fresh?[]:[['old@example.test',{uid:'partner',email:'old@example.test',disabled:false}]]);
  const auth={
    getUserByEmail:async email=>{if(!authUsers.has(email))throw {code:'auth/user-not-found'};return authUsers.get(email);},
    createUser:async input=>{if([...authUsers.values()].some(user=>user.uid===input.uid)||authUsers.has(input.email))throw {code:'auth/email-already-exists'};
      assert.equal(input.disabled,true);created++;authUsers.set(input.email,{...input});
      if(options.loseAuthAck&&!lostAuth){lostAuth=true;throw Error('Lost Auth acknowledgement');}return authUsers.get(input.email);},
    updateUser:async(uid,changes)=>{const user=[...authUsers.values()].find(user=>user.uid===uid);assert.ok(user,'Known Auth account');
      if(changes.disabled===false){assert.equal(f.records.get(`users/${uid}`)?.status,'active');enabled++;}Object.assign(user,changes);},
    revokeRefreshTokens:async()=>{}, deleteUser:async()=>{throw Error('Auth deletion must never occur');},
  };
  const authorize=async(_request,roles)=>{if(roles&&!roles.includes(f.actor.role))throw new BookingTestAuthorizationError('Denied',403);
    return {uid:f.actor.uid,role:f.actor.role,profile:{hospitalId:'centre'},auth,firestore:f.firestore};};
  f=bookingFlowFixture({actor:{uid:'admin',role:'admin'},throwAfterCommit:options.loseReservationAck,records:{'hospitals/centre':centre,
    ...(!options.fresh?{'users/partner':{uid:'partner',email:centre.email,role:'hospital',hospitalId:'centre',status:'active',lastAuditId:'user-original'}}:{}),...options.records},overrides:{
      '@/services/firebase/adminAuthorization':{AdminAuthorizationError:BookingTestAuthorizationError,requireActiveAdmin:request=>authorize(request,['admin']),requireActiveUser:authorize},
      '@/services/firebase/admin':{isFirebaseAdminReady:()=>true},
      '@/services/email/emailService':{isEmailReady:()=>true},
      '@/services/auth/authEmailService':{authEmailSiteUrl:()=> 'https://example.test',sendAuthEmail:async()=>{emails++;}},
    }});
  if(options.fresh) f.records.delete('users/partner'); // Isolated fixture only: genuinely new hospital login.
  const runTransaction=f.firestore.runTransaction;
  f.firestore.runTransaction=async callback=>{
    let profile=false;
    const result=await runTransaction(async transaction=>{
      const wrapped={...transaction};
      for(const method of ['set','update','create'])wrapped[method]=(...args)=>{if(args[0].path.startsWith('users/'))profile=true;return transaction[method](...args);};
      const value=await callback(wrapped);
      if(profile&&options.failProfileOnce&&!failedProfile){failedProfile=true;throw Error('Definitive profile failure');}
      return value;
    });
    if(profile&&options.loseProfileAck&&!lostProfile){lostProfile=true;throw Error('Lost profile acknowledgement');}
    return result;
  };
  f.firestore.batch=()=>{const pending=[];const writer={};for(const method of ['set','update','create'])writer[method]=(...args)=>{pending.push([method,args]);return writer;};
    writer.commit=()=>f.firestore.runTransaction(async transaction=>{for(const [method,args] of pending)transaction[method](...args);});return writer;};
  const setup=()=>f.load('app/api/admin/hospitals/[hospitalId]/login-setup/route.ts').POST(new Request('https://test.local/api/setup',{method:'POST'}),context);
  const admin=(action,data)=>f.load('app/api/admin/hospitals/[hospitalId]/route.ts').PATCH(request({action,data}),context);
  const profile=data=>f.load('app/api/hospital/profile/route.ts').PATCH(request({...centre,...data,description:undefined,legalName:undefined,commissionPercentage:undefined,status:undefined,archivedAt:undefined,lastAuditId:undefined}));
  const activate=()=>f.load('app/api/admin/hospitals/[hospitalId]/activate/route.ts').POST(new Request('https://test.local/api/activate',{method:'POST'}),context);
  return {...f,authUsers,auth,setup,admin,profile,activate,stats:()=>({created,enabled,emails}),current:()=>f.records.get('hospitals/centre')};
}

test('uncertain Auth or database results preserve one disabled identity and safely recover on explicit retry',async()=>{
  for(const failure of ['loseAuthAck','loseProfileAck','failProfileOnce']){
    const f=fixture({fresh:true,[failure]:true});
    const first=await f.setup();assert.equal(first.status,503,failure);
    assert.equal(f.authUsers.size,1);assert.equal(f.stats().created,1);assert.equal(f.stats().emails,0);
    assert.equal([...f.authUsers.values()][0].disabled,true);
    const uid=[...f.authUsers.values()][0].uid;
    const retry=await f.setup();assert.equal(retry.status,200,`${failure}: ${JSON.stringify(await retry.json())}`);
    assert.equal(f.authUsers.size,1);assert.equal(f.stats().created,1);assert.equal(f.stats().emails,1);
    assert.equal([...f.authUsers.values()][0].uid,uid);assert.equal(f.records.get(`users/${uid}`).hospitalId,'centre');
    assert.equal(f.values('portalAccountClaims')[0].state,'profile_ready');
  }
});

test('a reservation never claims an unrelated pre-existing Auth account or different role',async()=>{
  const f=fixture({fresh:true});f.authUsers.set(centre.email,{uid:'unknown',email:centre.email});
  assert.equal((await f.setup()).status,409);assert.equal(f.records.has('users/unknown'),false);assert.equal(f.stats().emails,0);
  const denied=fixture();denied.actor.role='consumer';assert.equal((await denied.setup()).status,403);
});

test('a lost reservation acknowledgement creates no Auth account until explicit recovery, and concurrent setup cannot allocate a second UID',async()=>{
  const lost=fixture({fresh:true,loseReservationAck:true});assert.equal((await lost.setup()).status,503);assert.equal(lost.authUsers.size,0);
  const reservedUid=lost.values('portalAccountClaims')[0].authUid;
  assert.equal((await lost.setup()).status,200);assert.equal([...lost.authUsers.values()][0].uid,reservedUid);
  const concurrent=fixture({fresh:true});const results=await Promise.all([concurrent.setup(),concurrent.setup()]);
  assert.ok(results.some(response=>response.status===200));assert.equal(concurrent.stats().created,1);assert.equal(concurrent.authUsers.size,1);
});

test('Hospital email requests preserve current official email and login until Admin approval; rejection is reversible',async()=>{
  const f=fixture();f.actor.role='hospital';f.actor.uid='partner';
  const response=await f.profile({email:' NEW@EXAMPLE.TEST '});assert.equal(response.status,200);
  assert.equal(f.current().email,centre.email);assert.equal(f.current().pendingOfficialEmail,'new@example.test');
  assert.equal(f.records.get('users/partner').status,'active');assert.equal(f.authUsers.get(centre.email).disabled,false);
  const body=await response.json();assert.equal(body.changes.email,centre.email);assert.equal(body.changes.pendingOfficialEmail,'new@example.test');
  f.actor.role='admin';f.actor.uid='admin';
  assert.equal((await f.admin('reject_email',{expectedEmail:'new@example.test',expectedAuditId:f.current().lastAuditId})).status,200);
  assert.equal(f.current().pendingOfficialEmail,null);assert.equal(f.current().email,centre.email);assert.equal(f.records.get('users/partner').status,'active');
});

test('approved email changes are revision checked, audited and disable only the previous Hospital login',async()=>{
  const f=fixture();f.actor.role='hospital';f.actor.uid='partner';assert.equal((await f.profile({email:'new@example.test'})).status,200);
  f.actor.role='admin';f.actor.uid='admin';
  assert.equal((await f.admin('approve_email',{expectedEmail:'new@example.test',expectedAuditId:'stale'})).status,409);
  assert.equal(f.current().email,centre.email);
  assert.equal((await f.admin('approve_email',{expectedEmail:'new@example.test',expectedAuditId:f.current().lastAuditId})).status,200);
  assert.equal(f.current().email,'new@example.test');assert.equal(f.current().pendingOfficialEmail,null);
  assert.equal(f.records.get('users/partner').status,'inactive');assert.equal(f.authUsers.get(centre.email).disabled,true);
  const audit=f.records.get(`auditLogs/${f.current().lastAuditId}`);assert.equal(audit.previousValues.email,centre.email);assert.equal(audit.updatedValues.email,'new@example.test');
  assert.equal((await f.setup()).status,200);assert.equal(f.stats().emails,1);assert.equal(f.authUsers.size,2);
});

test('duplicate email edits and requests reject active, inactive and archived matches; competing changes cannot both win',async()=>{
  for(const status of ['active','inactive','archived']){
    const f=fixture({records:{'hospitals/existing':{email:'used@example.test',status}}});
    assert.equal((await f.admin('update',{email:'USED@EXAMPLE.TEST'})).status,409);assert.equal(f.current().email,centre.email);
    f.actor.role='hospital';assert.equal((await f.profile({email:'used@example.test'})).status,409);assert.equal(f.current().pendingOfficialEmail,undefined);
  }
  const f=fixture({records:{'hospitals/second':{...centre,email:'second@example.test'}}});
  const first=f.admin('update',{email:'free@example.test'});
  const second=f.load('app/api/admin/hospitals/[hospitalId]/route.ts').PATCH(request({action:'update',data:{email:'free@example.test'}}),{params:Promise.resolve({hospitalId:'second'})});
  assert.deepEqual((await Promise.all([first,second])).map(response=>response.status).sort(),[200,409]);
  assert.equal(f.values('hospitals').filter(hospital=>hospital.email==='free@example.test').length,1);
});

test('approval rejects an email belonging to a Consumer without disabling the current hospital login',async()=>{
  const f=fixture({records:{'users/consumer':{uid:'consumer',role:'consumer',status:'active'}}});
  f.authUsers.set('consumer@example.test',{uid:'consumer',email:'consumer@example.test'});
  f.actor.role='hospital';assert.equal((await f.profile({email:'consumer@example.test'})).status,200);
  f.actor.role='admin';assert.equal((await f.admin('approve_email',{expectedEmail:'consumer@example.test',expectedAuditId:f.current().lastAuditId})).status,409);
  assert.equal(f.current().email,centre.email);assert.equal(f.records.get('users/partner').status,'active');
});

test('direct email mutations and private claims cannot bypass the server, and the operator script never prints action links or deletes Auth',()=>{
  const rules=readFileSync('firestore.rules','utf8');
  const admin=rules.split('function validAdminHospitalUpdate() {')[1].split('function ')[0];assert.doesNotMatch(admin,/'email'/);
  const hospital=rules.split('match /hospitals/{hospitalId} {')[1].split('match /consultants/')[0];assert.doesNotMatch(hospital,/'email'/);
  assert.match(rules,/match \/portalAccountClaims\/\{claimId\} \{ allow read, write: if false; \}/);
  const script=readFileSync('scripts/provision-portal-user.mjs','utf8');assert.doesNotMatch(script,/deleteUser|console\.(?:log|error).*passwordSetupLink|generatePasswordResetLink/);
  assert.match(script,/sendAuthEmail/);assert.match(script,/preparePortalAccount/);assert.match(script,/closeEmailTransport/);
});

test('blank and nonnumeric commission cannot become zero, while explicitly entered zero stays valid',async()=>{
  const {validateHospitalFields}=loadTypeScript('features/hospitals/validation.ts');
  for(const commissionPercentage of ['', '  ', null, undefined, false, true, [], {}, 'abc', Infinity]){
    assert.ok(validateHospitalFields({...centre,commissionPercentage}).errors.commissionPercentage);
    const f=fixture();assert.equal((await f.admin('update',{commissionPercentage})).status,400);
    assert.equal(f.current().commissionPercentage,10);assert.equal(f.values('auditLogs').length,0);
  }
  for(const commissionPercentage of [0,'0','0.00',12.5,'12.50',100]){
    assert.equal(validateHospitalFields({...centre,commissionPercentage}).isValid,true);
  }
  const f=fixture();
  const response=await f.load('app/api/admin/hospitals/route.ts').POST(request({...centre,commissionPercentage:''},'POST'));
  assert.equal(response.status,400);assert.equal(f.values('systemSettings').length,0);
});

const readyHospital={...centre,status:'pending',isPublic:false,contractStatus:'signed',contractSignedAt:{},contractUrl:'https://example.test/signed.pdf',imageUrls:Array.from({length:5},(_,i)=>`https://images.test/${i}.webp`)};
test('activation checks conflicting Auth identities and reserved emails before publication or any audit/write',async()=>{
  for(const collision of ['consumer','admin','foreign-hospital','unknown','reserved']){
    const f=fixture({fresh:true,records:{'hospitals/centre':readyHospital}});
    if(collision==='reserved'){
      const id=createHash('sha256').update(centre.email).digest('hex');
      f.records.set(`portalAccountClaims/${id}`,{email:centre.email,role:'hospital',hospitalId:'different-centre',authUid:'reserved'});
    }else{
      f.authUsers.set(centre.email,{uid:'collision',email:centre.email});
      if(collision!=='unknown') f.records.set('users/collision',{role:collision==='foreign-hospital'?'hospital':collision,hospitalId:'different-centre'});
    }
    assert.equal((await f.activate()).status,409,collision);assert.equal(f.current().isPublic,false);
    assert.equal(f.current().status,'pending');assert.equal(f.values('auditLogs').length,0);assert.equal(f.stats().created,0);
  }
  const f=fixture({fresh:true,records:{'hospitals/centre':readyHospital}});
  assert.equal((await f.activate()).status,200);assert.equal(f.current().isPublic,true);assert.equal(f.stats().created,0);
});

test('setup transaction rejects a hospital or account changed after the initial read without sending email or restoring access',async()=>{
  for(const change of ['inactive','archived','email','revision','user-role','user-hospital']){
    const f=fixture();const lookup=f.auth.getUserByEmail;
    f.auth.getUserByEmail=async email=>{
      const user=await lookup(email);
      if(change==='user-role'||change==='user-hospital') f.records.set('users/partner',{...f.records.get('users/partner'),...(change==='user-role'?{role:'consumer'}:{hospitalId:'different-centre'})});
      else f.records.set('hospitals/centre',{...f.current(),...(change==='inactive'?{status:'inactive'}:change==='archived'?{archivedAt:{}}:change==='email'?{email:'changed@example.test'}:{lastAuditId:'newer-audit'})});
      return user;
    };
    const response=await f.setup();assert.equal(response.status,409,change);
    assert.equal(f.stats().emails,0);assert.equal(f.stats().enabled,0);assert.equal(f.values('auditLogs').length,0);
  }
});

test('post-commit Auth failures report saved partial outcomes instead of success, preserving audited state and allowing explicit setup recovery',async()=>{
  for(const step of ['updateUser','revokeRefreshTokens']){
    const f=fixture();const original=f.auth[step];f.auth[step]=async()=>{throw Error('Provider failure containing private context');};
    const response=await f.admin('deactivate');assert.equal(response.status,503);
    const body=await response.json();assert.equal(body.saved,true);assert.match(body.error,/changes were saved/);assert.doesNotMatch(body.error,/private context/);
    assert.equal(f.current().status,'inactive');assert.equal(f.records.get('users/partner').status,'inactive');
    assert.ok(f.records.get(`auditLogs/${f.current().lastAuditId}`));
    f.auth[step]=original;
  }
  const f=fixture({records:{'hospitals/centre':{...readyHospital,status:'inactive'},'users/partner':{uid:'partner',role:'hospital',hospitalId:'centre',email:centre.email,status:'inactive'}}});
  const update=f.auth.updateUser;f.auth.updateUser=async()=>{throw Error('Auth unavailable');};
  const activated=await f.activate();assert.equal(activated.status,503);assert.equal((await activated.json()).saved,true);assert.equal(f.current().status,'active');
  assert.equal(f.stats().emails,0);assert.equal((await f.setup()).status,503);assert.equal(f.stats().emails,0);
  f.auth.updateUser=update;assert.equal((await f.setup()).status,200);assert.equal(f.stats().emails,1);
});

test('explicit setup recovery also closes inactive historical Auth access without changing its saved profile history',async()=>{
  const f=fixture({records:{'users/old-login':{role:'hospital',hospitalId:'centre',status:'inactive',email:'previous@example.test',lastAuditId:'preserved-old-audit'}}});
  f.authUsers.set('previous@example.test',{uid:'old-login',email:'previous@example.test',disabled:false});
  const previous={...f.records.get('users/old-login')};
  assert.equal((await f.setup()).status,200);
  assert.equal(f.authUsers.get('previous@example.test').disabled,true);
  assert.deepEqual(f.records.get('users/old-login'),previous);
  const {syncPortalAccountAccess}=loadTypeScript('services/auth/provisioning.ts');
  const missing={updateUser:async()=>{throw {code:'auth/user-not-found'};},revokeRefreshTokens:async()=>{throw {code:'auth/user-not-found'};}};
  assert.equal(await syncPortalAccountAccess(missing,[{uid:'absent',disabled:true}]),true);
  assert.equal(await syncPortalAccountAccess(missing,[{uid:'absent',disabled:false}]),false);
});

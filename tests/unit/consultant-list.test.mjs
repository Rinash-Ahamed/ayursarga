import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadTypeScript } from '../helpers/loadTypeScript.mjs';

const records=[1000,10,3,1,11,2].map(sequence=>({id:`AS${String(sequence).padStart(3,'0')}`,employeeId:`AS${String(sequence).padStart(3,'0')}`,employeeSequence:sequence,
  name:`Consultant ${sequence}`,status:[2,11].includes(sequence)?'inactive':'active',consultationServices:[sequence===3||sequence===11?'psychologist':'prenatal-doctor']}));
function fixture(denied=false){
  const calls=[];
  const service=loadTypeScript('services/consultants/consultantService.ts',{
    '@/services/firestore/firestoreService':{runFilteredQuery:async options=>{
      calls.push(options);if(denied)throw Error('Permission denied');
      let rows=records.filter(record=>(options.filters??[]).every(filter=>filter.operator==='array-contains'?record[filter.field].includes(filter.value):filter.operator==='in'?filter.value.includes(record[filter.field]):record[filter.field]===filter.value));
      const field=options.sort.field;rows.sort((a,b)=>typeof a[field]==='number'?a[field]-b[field]:a[field].localeCompare(b[field]));
      if(options.startAtValues)rows=rows.filter(record=>record[field]>=options.startAtValues[0]);
      if(options.endAtValues)rows=rows.filter(record=>record[field]<=options.endAtValues[0]);
      const offset=options.cursor?.offset??0,documents=rows.slice(offset,offset+options.pageSize);
      return {documents,cursor:documents.length?{offset:offset+documents.length}:null,hasMore:offset+documents.length<rows.length};
    }},
  });
  return {...service,calls};
}

test('consultants page by numeric employee sequence, exhausting active records before inactive ones',async()=>{
  for(const service of [undefined,'prenatal-doctor','psychologist']){
    const f=fixture(),items=[];let cursor=null;
    for(let page=0;page<10;page++){
      const result=await f.listConsultants({pageSize:2,cursor},'',service);items.push(...result.documents);cursor=result.cursor;
      if(!result.hasMore)break;assert.ok(page<9);
    }
    const expected=[...records].filter(row=>!service||row.consultationServices.includes(service)).sort((a,b)=>Number(a.status==='inactive')-Number(b.status==='inactive')||a.employeeSequence-b.employeeSequence);
    assert.deepEqual(items.map(row=>row.id),expected.map(row=>row.id));
    assert.equal(new Set(items.map(row=>row.id)).size,items.length);
    assert.ok(f.calls.every(call=>call.pageSize<=2&&call.sort.field==='employeeSequence'&&call.sort.direction==='asc'));
  }
});

test('single-status consultant filters use one bounded query per page and never enter the other phase',async()=>{
  for(const status of ['active','inactive'])for(const service of [undefined,'prenatal-doctor','psychologist']){
    const f=fixture(),items=[];let cursor=null;
    for(let page=0;page<10;page++){
      const before=f.calls.length,result=await f.listConsultants({pageSize:1,cursor,status},'',service);
      assert.equal(f.calls.length,before+1);items.push(...result.documents);cursor=result.cursor;if(!result.hasMore)break;assert.ok(page<9);
    }
    assert.deepEqual(items.map(row=>row.id),[...records].filter(row=>row.status===status&&(!service||row.consultationServices.includes(service))).sort((a,b)=>a.employeeSequence-b.employeeSequence).map(row=>row.id));
    for(const call of f.calls){const statusFilters=call.filters.filter(filter=>filter.field==='status');assert.deepEqual(statusFilters,[{field:'status',operator:'==',value:status}]);}
  }
});

test('existing name and ID prefix searches combine with status and assigned-service filters',async()=>{
  for(const [search,field,prefix] of [['Consultant 1','name','Consultant 1'],['as010','employeeId','AS010']]){
    const f=fixture();await f.listConsultants({pageSize:20,status:'active'},search,'prenatal-doctor');
    assert.equal(f.calls.length,1);const call=f.calls[0];assert.equal(call.sort.field,field);
    assert.deepEqual(call.startAtValues,[prefix]);assert.deepEqual(call.endAtValues,[`${prefix}\uf8ff`]);
    assert.ok(call.filters.some(filter=>filter.field==='consultationServices'&&filter.operator==='array-contains'&&filter.value==='prenatal-doctor'));
  }
});

test('local create/update ordering is non-mutating, numeric beyond AS999 and keeps inactive last',()=>{
  const {orderConsultants}=loadTypeScript('features/consultants/listOrder.ts');
  const original=records.map(row=>row.id);assert.deepEqual(orderConsultants(records).map(row=>row.id),['AS001','AS003','AS010','AS1000','AS002','AS011']);
  assert.deepEqual(records.map(row=>row.id),original);
  assert.deepEqual(orderConsultants([{id:'AS1000'},{id:'AS999'},{id:'AS002',status:'inactive'},{id:'AS001'}]).map(row=>row.id),['AS001','AS999','AS1000','AS002']);
});

test('every consultant filter/search query has its corresponding declared composite index',()=>{
  const indexes=JSON.parse(readFileSync('firestore.indexes.json','utf8')).indexes;
  for(const service of [false,true])for(const field of ['employeeSequence','name','employeeId']){
    const expected=['status:ASCENDING',...(service?['consultationServices:CONTAINS']:[]),`${field}:ASCENDING`];
    assert.ok(indexes.some(index=>index.collectionGroup==='consultants'&&JSON.stringify(index.fields.map(item=>`${item.fieldPath}:${item.order??item.arrayConfig}`))===JSON.stringify(expected)),expected.join(','));
  }
});

test('denied consultant queries propagate failure without unfiltered fallback reads',async()=>{
  const f=fixture(true);await assert.rejects(f.listConsultants({status:'active'},'','psychologist'),/Permission denied/);assert.equal(f.calls.length,1);
  const rules=readFileSync('firestore.rules','utf8').split('match /consultants/{consultantId}')[1].split('match /hospitalContractRevisions/')[0];
  assert.ok(rules.includes('allow read: if isAdmin()'));assert.ok(rules.includes('allow create, update, delete: if false'));
});

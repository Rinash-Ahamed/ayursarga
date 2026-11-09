import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const coverage=JSON.parse(readFileSync('tests/qa/candidate-coverage.json','utf8'));
const files=[...new Set(Object.values(coverage).flatMap(item=>(item.unit??[]).map(name=>`tests/unit/${name}.test.mjs`)))];
if(Object.keys(coverage).length!==38) throw Error('Review candidate coverage: expected 38 stable Case IDs.');
for(const file of files) readFileSync(file,'utf8');
const output=path.resolve('test-results/qa-candidate-run');mkdirSync(output,{recursive:true});
const runId=new Date().toISOString().replaceAll(':','-');
const unit=spawnSync(process.execPath,['--test','--test-isolation=none',...files],{encoding:'utf8',maxBuffer:20*1024*1024});
writeFileSync(path.join(output,'unit.txt'),(unit.stdout??'')+(unit.stderr??''));
console.log(unit.stdout??'');
if(unit.status!==0){console.error(unit.stderr??unit.error??'Unit checks failed');process.exit(1);}
const browser=spawnSync(process.execPath,['node_modules/@playwright/test/cli.js','test','--config=tests/config/playwright.qa-candidates.config.ts','--reporter=json'],{encoding:'utf8',maxBuffer:30*1024*1024});
writeFileSync(path.join(output,'browser.json'),browser.stdout??'');
if(browser.status!==0){console.error(browser.stderr??browser.error??'Browser checks failed');console.error((browser.stdout??'').slice(-10000));process.exit(1);}
const report=JSON.parse(browser.stdout);
if(report.stats.unexpected||report.stats.skipped||report.stats.flaky) throw Error('All linked cases must pass without skips or flaky retries.');
const specs=[];
function collect(suites){for(const suite of suites??[]){for(const spec of suite.specs??[])specs.push(spec);collect(suite.suites);}}
collect(report.suites);
for(const [id,item]of Object.entries(coverage)) if(item.browser&&!specs.some(spec=>spec.title.includes(item.browser)&&spec.ok)) throw Error(`Missing passing browser evidence for ${id}`);
const result={runId,createdAt:new Date().toISOString(),appVersion:JSON.parse(readFileSync('package.json','utf8')).version,candidateCount:38,unitPassed:true,browserStats:report.stats,cases:Object.fromEntries(Object.entries(coverage).map(([id,item])=>[id,{status:'Passed',unit:(item.unit??[]).map(name=>`tests/unit/${name}.test.mjs`),browser:item.browser??null}]))};
writeFileSync(path.join(output,'verified.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify({candidateCount:38,browser:report.stats,evidence:path.join(output,'verified.json')}));

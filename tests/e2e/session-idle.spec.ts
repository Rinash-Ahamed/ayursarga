import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {bundleDialogHarness} from '../helpers/bundleDialogHarness';
const bundle=bundleDialogHarness('tests/fixtures/sessionIdleHarness.tsx');
async function mount(page:import('@playwright/test').Page,role='admin'){
  await page.clock.install({time:new Date('2026-11-11T08:00:00Z')});
  await page.clock.pauseAt(new Date('2026-11-11T08:00:01Z'));
  await page.setContent('<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="fixture-root"></div></body></html>');
  for(const path of ['node_modules/tailwindcss/lib/css/preflight.css','app/globals.css','app/portal.css'])await page.addStyleTag({content:readFileSync(path,'utf8')});
  await page.evaluate(role=>Object.assign(window,{sessionRole:role}),role);await page.addScriptTag({content:bundle});
  await expect(page.getByText('Signed in',{exact:true})).toBeVisible();
  await expect(page.locator('main')).toHaveAttribute('data-ready','true');
}
test('Admin warning offers explicit continuation before expiry, then expires without bypassing login',async({page})=>{
  await mount(page);await page.clock.runFor(12*60*1000);await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.clock.runFor(60*1000+50);const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();
  const stay=dialog.getByRole('button',{name:'Stay signed in',exact:true});await expect(stay).toBeFocused();
  expect(await page.evaluate(()=>document.body.style.position)).toBe('fixed');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:`tmp/session-warning-${test.info().project.name}.png`});
  await stay.click();await expect(dialog).toHaveCount(0);
  expect(await page.evaluate(()=>document.body.style.position)).not.toBe('fixed');
  await page.clock.runFor(13*60*1000);await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');await expect(dialog).toBeVisible();
  await page.clock.runFor(2*60*1000);await expect(page.getByText('Signed out',{exact:true})).toBeVisible();
  await expect(dialog).toHaveCount(0);
  expect(await page.evaluate(()=>(window as unknown as {resumeFixtureSession:()=>boolean}).resumeFixtureSession())).toBe(false);
});
test('Admin can sign out from the warning',async({page})=>{
  await mount(page);await page.clock.runFor(13*60*1000);
  await page.getByRole('dialog').getByRole('button',{name:'Sign out',exact:true}).click();
  await expect(page.getByText('Signed out',{exact:true})).toBeVisible();
});
for(const role of ['hospital','consumer']){
  test(`${role} retains the existing idle policy without an Admin warning`,async({page})=>{
    await mount(page,role);await page.clock.runFor(15*60*1000);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByText(role==='consumer'?'Signed in':'Signed out',{exact:true})).toBeVisible();
  });
}

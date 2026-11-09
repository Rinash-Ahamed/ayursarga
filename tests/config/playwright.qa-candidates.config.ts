import { defineConfig } from '@playwright/test';
import { readFileSync } from 'node:fs';
import base from './playwright.portal-ui.config';
import { testOutputDir } from './paths';

const coverage = JSON.parse(readFileSync('tests/qa/candidate-coverage.json', 'utf8')) as Record<string, {browser?: string}>;
const names = [...new Set(Object.values(coverage).flatMap(value => value.browser ? [value.browser] : []))];
const escape = (value: string) => [...value].map(char => '\\^$.*+?()[]{}|'.includes(char) ? `\\${char}` : char).join('');
export default defineConfig({
  ...base,
  testMatch: ['portal-ui.spec.ts','centre-details.spec.ts','centre-search-ui.spec.ts','contract-layout.spec.ts'],
  grep: new RegExp(names.map(escape).join('|')),
  outputDir: testOutputDir('qa-candidates'),
  projects: base.projects?.filter(project => ['desktop','webkit-phone'].includes(project.name ?? '')),
  // All surfaces are page.setContent fixtures. There is no production webServer.
});

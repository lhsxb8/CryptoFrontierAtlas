import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {expect, test, type Page} from '@playwright/test';
import publication from '../../data/cryptanalysis-public/publication.json' with {type:'json'};
import manifest from '../../data/cryptanalysis-public/manifest.json' with {type:'json'};
import type {AnalysisResult} from '../../src/features/cryptanalysis/types';

const {assertPublicText} = createRequire(import.meta.url)('../../lib/node/publication-safety.cjs');
const familyId = 'aes-6r-triple-boomerang-ytxq2025-family';
const pointId = 'aes-6r-triple-boomerang-n6-ytxq2025';
const otherPointId = 'aes-6r-triple-boomerang-n16-ytxq2025';
const instancePath = '/#/cryptanalysis/ciphers/aes/aes-128';
test.use({locale:'en-US'});

async function expand(page: Page) {
  const button = page.getByRole('button', {name:'Expand all', exact:true});
  await expect(button).toBeVisible();
  if (await button.isEnabled()) await button.click();
}
async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await expect(page.locator('.katex-error')).toHaveCount(0);
}

test('public receipt binds the complete analysis asset and excludes internal workflow metadata', async ({request}) => {
  const receipt = await (await request.get('/atlas-build-profile.json')).json();
  expect(receipt.schema_version).toBe(2);
  expect(receipt.profile).toBe('public');
  expect(receipt.analysis_included).toBe(true);
  const response = await request.get('/' + receipt.analysis_asset);
  expect(response.ok()).toBe(true);
  const bytes = await response.body();
  expect(createHash('sha256').update(bytes).digest('hex')).toBe(receipt.analysis_sha256);
  expect(receipt.analysis_asset).toBe(`analysis-${receipt.analysis_sha256}.json`);
  const data = JSON.parse(bytes.toString('utf8'));
  expect(data.results).toHaveLength(publication.counts.records);
  expect(data.compactResults).toHaveLength(publication.counts.compact_only);
  expect(data.sources).toHaveLength(publication.counts.sources);
  expect(receipt.analysis_entry_count).toBe(publication.counts.records + publication.counts.compact_only);
  expect(receipt.analysis_family_count).toBe(publication.counts.parameterized_families);
  expect(data.manifest.local_only).toBe(false);
  expect(data.coverage.ingestion_batches).toEqual([]);
  expect(data.results.some((record: AnalysisResult) => record.assessment.claim_status === 'source_conflict')).toBe(true);
  expect(data.results.some((record: AnalysisResult) => record.assessment.reproduction === 'collision_witness_only')).toBe(true);
  expect(data.compactResults.every((record: {compact_review: object}) => !('next_action' in record.compact_review))).toBe(true);
  assertPublicText(bytes.toString('utf8'), 'Browser analysis asset');
});

test('published formula families retain assignments, compact details and primary-source navigation', async ({page}) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(instancePath + '?q=' + familyId);
  await expand(page);
  await expect(page.locator('.a-attack-row')).toHaveCount(1);
  await expect(page.locator('.a-attack-row [data-label="Time"] .katex').first()).toBeVisible();
  await page.locator('.a-attack-detail-toggle').click();
  await expect(page.locator('.a-attack-point-details')).toHaveCount(16);
  const point = page.locator('.a-attack-point-details').filter({has:page.locator('a[href*="/results/' + pointId + '?"]')});
  await point.locator('.a-text-link').click();
  await expect(page.locator('.a-current-parameters [data-native-expression]')).toHaveAttribute('data-native-expression', 'n = 6; w = 3');
  await expect(page.getByRole('heading', {name:'Source evidence', exact:true})).toBeVisible();
  await page.locator('.a-evidence-entry h3 a').first().click();
  await expect(page.getByRole('heading', {level:1})).toHaveText('Source details');
  await expect(page.locator('.atlas-source-card')).toContainText('SHA-256');
  await noOverflow(page);
  expect(errors).toEqual([]);
});

test('comparison works for distinct published compact parameter choices', async ({page}) => {
  await page.goto(instancePath + '?q=' + pointId);
  await expand(page);
  await page.locator('.a-attack-row input[type=checkbox]').check();
  await page.getByRole('searchbox', {name:'Search analysis results', exact:true}).fill(otherPointId);
  await expand(page);
  await page.locator('.a-attack-row input[type=checkbox]').check();
  await expect(page.locator('.a-selection-bar')).toContainText('2/4 selected');
  await page.locator('.a-selection-bar').getByRole('link', {name:'Compare', exact:true}).click();
  expect(new URLSearchParams(new URL(page.url()).hash.split('?')[1]).get('ids')?.split(',')).toEqual([pointId, otherPointId]);
  await expect(page.locator('.a-comparison-table .katex').first()).toBeVisible();
  await noOverflow(page);
});

test('public coverage and conflict details retain qualifications without ingestion logs', async ({page}) => {
  const conflict = manifest.records.map(id => JSON.parse(readFileSync(new URL('../../data/cryptanalysis-public/results/' + id + '.json', import.meta.url), 'utf8')) as AnalysisResult)
    .find(record => record.assessment.claim_status === 'source_conflict' && record.target.variant_ids.includes('aes-128'))!;
  expect(conflict).toBeTruthy();
  await page.goto('/#/cryptanalysis/results/' + conflict.id + '?variant=aes-128');
  await expect(page.getByRole('heading', {level:1})).toHaveText(conflict.title);
  await expect(page.locator('main')).toContainText('Source conflict');
  await expect(page.locator('.a-evidence-entry')).not.toHaveCount(0);
  await noOverflow(page);
  await page.goto('/#/cryptanalysis/coverage?variant=aes-128');
  await expect(page.getByRole('heading', {level:1})).toHaveText('Coverage & audit');
  await expect(page.locator('.atlas-coverage-matrix a').first()).toBeVisible();
  await expect(page.getByRole('heading', {name:'Coverage gaps · AES', exact:true})).toBeVisible();
  await expect(page.locator('.atlas-source-list .atlas-source-card').first()).toBeVisible();
  await expect(page.locator('summary').filter({hasText:'Ingestion batch'})).toHaveCount(0);
  await page.getByText('Review scope', {exact:true}).click();
  await expect(page.locator('.atlas-methods .atlas-metadata')).toBeVisible();
  await noOverflow(page);
});

test('a project subpath loads the content-addressed asset and supports direct result links', async ({page}) => {
  const prefix = '/CryptoFrontierAtlas';
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  // Serve the existing artifact under a project path, without a second server.
  await page.route('**' + prefix + '/**', async route => {
    const url = new URL(route.request().url());
    const response = await page.request.get(url.origin + url.pathname.slice(prefix.length) + url.search);
    await route.fulfill({response});
  });
  const fetched = page.waitForResponse(response => new RegExp(prefix + '/analysis-[a-f0-9]{64}\\.json$').test(response.url()));
  await page.goto(prefix + '/#/cryptanalysis/results/' + pointId + '?variant=aes-128');
  expect((await fetched).ok()).toBe(true);
  await expect(page.getByRole('heading', {name:'Triple boomerang', exact:true})).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', {name:'Triple boomerang', exact:true})).toBeVisible();
  await noOverflow(page);
  expect(errors).toEqual([]);
});

test('an unavailable analysis asset shows a recoverable error instead of an empty site', async ({page}) => {
  await page.route(/\/analysis-[a-f0-9]{64}\.json$/, route => route.fulfill({status:503, body:'Unavailable'}));
  await page.goto('/#/cryptanalysis');
  await expect(page.getByRole('alert')).toContainText('The atlas could not be loaded');
  await expect(page.getByRole('button', {name:'Reload', exact:true})).toBeVisible();
  await noOverflow(page);
  await page.unroute(/\/analysis-[a-f0-9]{64}\.json$/);
  await page.getByRole('button', {name:'Reload', exact:true}).click();
  await expect(page.getByRole('heading', {level:1})).toHaveText('Primitive & construction directory');
});

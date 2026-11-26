import {readFileSync} from 'node:fs';
import {expect, test, type Page} from '@playwright/test';
import type {ProblemAnalysis, ProblemResult} from '../../src/features/cryptanalysis/problem-types';

test.use({locale: 'en-US'});
const catalog = JSON.parse(readFileSync(new URL('../../data/cryptanalysis-public/problem-analyses/integer-factorization.json', import.meta.url), 'utf8')) as ProblemAnalysis;
const records = catalog.records.map(id => JSON.parse(readFileSync(new URL(`../../data/cryptanalysis-public/problem-results/${id}.json`, import.meta.url), 'utf8')) as ProblemResult);
const base = '/#/asymmetric-cryptanalysis/problems/integer-factorization';
const detail = (id: string) => `${base}/results/${id}`;

async function noOverflow(page: Page) {
  await expect(page.locator('.katex-error')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual((page.viewportSize()?.width ?? 0) + 1);
}

test('factorization displays disjoint classical, quantum and computation sections without tabs', async ({page}) => {
  await page.goto(base);
  await expect(page.getByRole('heading', {level: 1})).toHaveText('Integer Factorization');
  await expect(page.locator('.hp-section > h3')).toHaveText([
    `Classical Algorithms ${records.filter(r => r.setting.computation === 'classical' && r.result_kind !== 'computation_record').length}`,
    `Quantum Algorithms ${records.filter(r => r.setting.computation === 'quantum' && r.result_kind !== 'computation_record').length}`,
    `Factorization Records ${records.filter(r => r.result_kind === 'computation_record').length}`,
  ]);
  await expect(page.getByRole('tab')).toHaveCount(0);
  const ids = await page.locator('.hp-table [data-result-id]').evaluateAll(rows => rows.map(r => r.getAttribute('data-result-id')));
  expect(ids.sort()).toEqual([...catalog.records].sort());
  expect(new Set(ids).size).toBe(ids.length);
  for (const record of records) {
    const section = record.result_kind === 'computation_record' ? 'records' : record.setting.computation;
    await expect(page.locator(`[data-problem-section="${section}"] [data-result-id="${record.id}"]`)).toHaveCount(1);
  }
  await expect(page.locator('.hp-tag').filter({hasText: /^(Q1|Q2)$/})).toHaveCount(0);
  await expect(page.locator('.hp-table thead th').filter({hasText: /^(Rounds|Key Model)$/})).toHaveCount(0);
  const jacobi = page.locator('[data-result-id="if-jacobi-special-integers-v4"]');
  await expect(jacobi).toContainText('Distinct Prime Exponents');
  await expect(page.locator('[data-result-id="if-harvey-hittmeir-large-order-v2"]')).toContainText('Supporting Result');
  await expect(page.locator('[data-result-id="if-dps-oracle-almost-all-v4"]')).toContainText('Oracle-Assisted');
  await expect(page.locator('[data-result-id="if-regev-short-vector-v3"]')).toContainText('Source Conflict');
  await expect(page.locator('[data-result-id="if-regev-short-vector-v3"] .hp-success')).toHaveText('Unresolved');
  await noOverflow(page);
});

test('factorization search and goal filtering preserve the declared target', async ({page}) => {
  await page.goto(base);
  const search = page.getByRole('searchbox', {name: 'Search Factorization Results', exact: true});
  await search.fill('Stanica');
  await expect(page.locator('.hp-table [data-result-id]')).toHaveCount(1);
  await expect(page.locator('.hp-result-title')).toHaveText('Deterministic Quadratic-Image Sieving');
  await search.fill('if-regev-short-vector-v3');
  await expect(page.locator('.hp-table [data-result-id]')).toHaveAttribute('data-result-id', 'if-regev-short-vector-v3');
  await page.getByRole('button', {name: 'Clear Filters', exact: true}).click();
  await page.getByRole('combobox', {name: 'Goal', exact: true}).selectOption('large_order_or_factor');
  await expect(page.locator('.hp-table [data-result-id]')).toHaveAttribute('data-result-id', 'if-harvey-hittmeir-large-order-v2');
  await expect(page.locator('.hp-goal')).toHaveText('Large-Order Element or Factor');
  await search.fill('no-such-factorization-result');
  await expect(page.getByText('No Matching Results', {exact: true})).toBeVisible();
  await page.getByRole('button', {name: 'Clear Filters', exact: true}).click();
  await expect(page.locator('.hp-table [data-result-id]')).toHaveCount(records.length);
  await noOverflow(page);
});

test('each published configuration has a reloadable detail route with math, evidence and limitations', async ({page}) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const record of records) {
    await page.goto(detail(record.id));
    await expect(page.getByRole('heading', {level: 1})).toHaveText(record.title);
    await expect(page.getByRole('heading', {level: 1})).toBeFocused();
    await expect(page).toHaveTitle(record.title + ' · CryptoFrontierAtlas');
    await expect(page.getByRole('heading', {name: 'Evidence', exact: true})).toBeVisible();
    await expect(page.getByRole('heading', {name: 'Review & Limitations', exact: true})).toBeVisible();
    await expect(page.getByText('Reproduction Not Attempted · Frontier Not Assessed', {exact: true})).toBeVisible();
    await expect(page.locator('.hp-detail .atlas-text-link').first()).toHaveAttribute('href', base.slice(1));
    await noOverflow(page);
    await page.reload();
    await expect(page.getByRole('heading', {level: 1})).toHaveText(record.title);
  }
  expect(errors).toEqual([]);
});

test('special-input, oracle, per-call and computation boundaries remain visible in details', async ({page}) => {
  await page.goto(detail('if-jacobi-special-integers-v4'));
  await expect(page.locator('main')).toContainText('does not contain ordinary RSA moduli');
  await expect(page.locator('main')).toContainText('each using up to T base calls');
  await page.goto(detail('if-dps-oracle-almost-all-v4'));
  await expect(page.getByRole('heading', {name: 'Auxiliary Information / Oracle', exact: true})).toBeVisible();
  await expect(page.locator('main')).toContainText('not a randomized success probability');
  await expect(page.locator('main')).toContainText('Not unassisted polynomial-time classical factoring');
  await page.goto(detail('if-regev-short-vector-v3'));
  await expect(page.getByRole('heading', {name: 'Gates per Call', exact: true})).toBeVisible();
  await expect(page.locator('.hp-conflict')).toContainText('Corollary 4.5');
  await expect(page.locator('.hp-success')).toContainText('Unresolved');
  await page.goto(detail('if-cuda-mpqs-rsa155-2026'));
  await expect(page.getByRole('heading', {name: 'Reported Computation', exact: true})).toBeVisible();
  await expect(page.locator('main')).toContainText('700.64');
  await expect(page.locator('main')).toContainText('2026-07-14');
  await expect(page.locator('main')).toContainText('Factor bytes were not extracted or independently checked by the Atlas');
  await noOverflow(page);
});

test('factorization citations link to shared sources and back without polluting AES scope', async ({page}) => {
  const record = records.find(r => r.id === 'if-pilatte-unconditional-v3')!;
  await page.goto(detail(record.id));
  await page.locator('.hp-detail .atlas-source-card h3 a').first().click();
  await expect(page.getByRole('heading', {level: 1})).toHaveText('Source Details');
  await expect(page.locator('main')).toContainText('All Analysis Targets');
  await page.getByRole('link', {name: record.title, exact: true}).click();
  await expect(page.getByRole('heading', {level: 1})).toHaveText(record.title);
  await page.goto('/#/cryptanalysis/sources/' + record.evidence[0].source_id + '?variant=aes-128');
  await expect(page.getByRole('heading', {level: 1})).toHaveText('Source in This Scope Not Found');
  await page.goto('/#/asymmetric-cryptanalysis/problems/lwe/results/' + record.id);
  await expect(page.getByRole('heading', {level: 1})).toHaveText('Record Not Found');
  await page.goto(detail('does-not-exist'));
  await expect(page.getByRole('heading', {level: 1})).toHaveText('Record Not Found');
  await page.goto('/#/asymmetric-cryptanalysis/problems/lwe');
  await expect(page.locator('.hp-analyses')).toHaveCount(0);
});

test('factorization remains readable at 320px and its details survive a Pages project subpath', async ({page}) => {
  await page.setViewportSize({width: 320, height: 740});
  await page.goto(base);
  for (const region of await page.locator('.hp-table-scroll').all()) {
    expect(await region.evaluate(e => e.scrollWidth > e.clientWidth)).toBe(true);
  }
  await noOverflow(page);
  const prefix = '/CryptoFrontierAtlas';
  await page.route('**' + prefix + '/**', async route => {
    const url = new URL(route.request().url());
    const response = await page.request.get(url.origin + url.pathname.slice(prefix.length) + url.search);
    await route.fulfill({response});
  });
  await page.goto(prefix + detail('if-stanica-quadratic-image-v1'));
  await page.reload();
  await expect(page.getByRole('heading', {level: 1})).toHaveText('Deterministic Quadratic-Image Sieving');
  await noOverflow(page);
});

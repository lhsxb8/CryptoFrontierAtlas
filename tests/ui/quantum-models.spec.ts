import {expect, test, type Page} from '@playwright/test';
import {surfaceResult, quantumResult} from '../helpers/attack-surface-fixtures.mjs';

const base = '/#/cryptanalysis/ciphers/aes/aes-128';
const q1 = quantumResult({memoryModel: 'qram'});
const q2 = quantumResult({queryModel: 'coherent_secret_oracle', memoryModel: 'qraqm'});
const noQram = quantumResult({id: 'synthetic-no-qram-point', memoryModel: 'no_qram'});
const offline = quantumResult({queryModel: 'offline_public_cipher_evaluation', memoryModel: 'qram'});
const points = [surfaceResult(), q1, q2, noQram, offline];
test.use({locale: 'en-US'});

async function syntheticData(page: Page, records = points) {
  await page.route(/\/analysis-[a-f0-9]{64}\.json$/, async route => {
    const data = await (await route.fetch()).json();
    data.results = records; data.compactResults = []; data.familyCatalogs = []; data.coverage = null;
    data.sources = [{...data.sources[0], id: 'synthetic-model-source', title: 'Synthetic quantum-model fixture', citation_label: 'Syn26'}];
    data.manifest = {...data.manifest, records: records.map(record => record.id), record_count: records.length, source_count: 1};
    await route.fulfill({json: data});
  });
}
async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await expect(page.locator('.katex-error')).toHaveCount(0);
}

test('one quantum collection contains every model with source-specific tags and no tabs', async ({page}) => {
  await syntheticData(page); await page.goto(base);
  await expect(page.locator('.a-surface-heading')).toHaveText(['Classical cryptanalysis', 'Quantum cryptanalysis']);
  await expect(page.locator('.a-result-sections').getByRole('tab')).toHaveCount(0);
  await expect(page.getByRole('heading', {name: /^(Q1|Q2)$/})).toHaveCount(0);
  await page.getByRole('button', {name: 'Expand all', exact: true}).click();
  const quantum = page.locator('[data-result-collection="quantum"]');
  await expect(quantum.locator('table')).toHaveCount(1);
  await expect(quantum.locator('tr[data-record-id]')).toHaveCount(4);
  await expect(page.locator('[data-result-collection="algorithmic"] tr[data-record-id]')).toHaveCount(1);
  for (const [record, labels] of [[q1, ['Q1', 'qRAM']], [q2, ['Q2', 'QRAQM']], [noQram, ['Q1', 'No qRAM']], [offline, ['Public function', 'qRAM']]] as const) {
    const row = quantum.locator(`tr[data-record-id="${record.id}"]`);
    await expect(row.locator('.a-model-tag')).toHaveText([...labels]);
    for (const tag of await row.locator('.a-model-tag').all()) await expect(tag).toHaveAttribute('title', /.+/);
  }
  await expect(quantum.locator(`[data-record-id="${noQram.id}"] [data-model-tag="qram"]`)).toHaveCount(0);
  const ids = await page.locator('[id]').evaluateAll(elements => elements.map(element => element.id));
  expect(new Set(ids).size).toBe(ids.length);
  await noOverflow(page);
});

test('tags survive direct result links, model search and cross-model comparisons', async ({page}) => {
  await syntheticData(page); await page.goto(base + '?q=Q2');
  await expect(page.locator('.a-surface-heading')).toHaveText(['Quantum cryptanalysis']);
  await page.getByRole('button', {name: 'Expand all', exact: true}).click();
  await expect(page.locator('tr[data-record-id]')).toHaveCount(1);
  await page.locator(`[data-record-id="${q2.id}"] .a-result-title`).click();
  await expect(page.locator('.a-detail-heading .a-model-tag')).toHaveText(['Q2', 'QRAQM']);
  await expect(page.locator('.a-detail-topbar .a-back-link')).toHaveAttribute('href', base.slice(1) + '?q=Q2');
  await page.goto('/#/cryptanalysis/compare/aes-128?ids=' + q1.id + ',' + q2.id);
  await expect(page.locator('.a-comparison-table .a-model-tag')).toHaveText(['Q1', 'qRAM', 'Q2', 'QRAQM']);
  await expect(page.locator('.a-pair summary')).toContainText('Incomparable costs');
  await noOverflow(page);
});

test('classical and quantum tables paginate and collapse independently', async ({page}) => {
  await syntheticData(page, Array.from({length: 25}, (_, i) => [surfaceResult({id: `synthetic-classical-${i}`}), quantumResult({id: `synthetic-quantum-${i}`})]).flat());
  await page.goto(base); await page.getByRole('button', {name: 'Expand all', exact: true}).click();
  const classical = page.locator('[data-section-id="algorithmic-differential"]');
  const quantum = page.locator('[data-section-id="quantum-differential"]');
  await quantum.getByRole('button', {name: /^Next Quantum/}).click();
  await expect(quantum.locator('.a-attack-row')).toHaveCount(1);
  await expect(classical.locator('.a-attack-row')).toHaveCount(24);
  await quantum.locator('.a-result-section-toggle').click();
  await expect(quantum.locator('.a-result-section-body')).toBeHidden();
  await expect(classical.locator('.a-result-section-body')).toBeVisible();
  await noOverflow(page);
});

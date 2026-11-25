import {expect, test, type Page} from '@playwright/test';
import {surfaceResult} from '../helpers/attack-surface-fixtures.mjs';

const base = '/#/cryptanalysis/ciphers/aes/aes-128';
const side = surfaceResult({surface: 'side_channel'});
side.display.name = side.id;
side.techniques.push('see-in-the-middle');
side.goal = 'partial_key_recovery';
side.target.rounds = 10; side.target.full_round = true;
side.success = {status: 'not_reported', value: null, metric: 'partial16-bit-master-key-recovery-probability', description: 'Synthetic partial-recovery event; no success probability asserted.'};
const records = [surfaceResult(), surfaceResult({method: 'mitm'}), surfaceResult({structural: true}), side,
  surfaceResult({surface: 'side_channel', method: 'collision'}), surfaceResult({surface: 'side_channel', method: 'collision', structural: true}),
  surfaceResult({surface: 'fault_injection', method: 'fault'}), surfaceResult({surface: 'fault_injection', method: 'fault', structural: true})];
test.use({locale: 'en-US'});

test.beforeEach(async ({page}) => {
  // Exercise the real built application with synthetic data, never a private corpus.
  await page.route(/\/analysis-[a-f0-9]{64}\.json$/, async route => {
    const data = await (await route.fetch()).json();
    data.results = records; data.compactResults = []; data.familyCatalogs = [];
    data.sources = [{...data.sources[0], id: 'synthetic-model-source', title: 'Synthetic attack-surface fixture', citation_label: 'Syn26'}];
    data.manifest = {...data.manifest, records: records.map(record => record.id), record_count: records.length, source_count: 1};
    data.coverage = null;
    await route.fulfill({json: data});
  });
});

async function expand(page: Page) {
  const button = page.getByRole('button', {name: 'Expand all', exact: true});
  await expect(button).toBeVisible();
  if (await button.isEnabled()) await button.click();
}
async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await expect(page.locator('.katex-error')).toHaveCount(0);
}

test('default browsing shows every surface without tabs and keeps methods and properties separate', async ({page}) => {
  await page.goto(base);
  await expect(page.locator('.a-surface-heading')).toHaveText(['Classical cryptanalysis', 'Side-channel analysis', 'Fault-injection analysis']);
  await expect(page.getByRole('navigation', {name: 'Attack surface', exact: true})).toHaveCount(0);
  await expect(page.getByRole('combobox', {name: 'Attack surface', exact: true})).toHaveCount(0);
  await expect(page.getByRole('tab', {name: /^(Algorithmic|Side-channel|Fault injection|All)$/})).toHaveCount(0);
  await expect(page.locator('main').getByRole('link', {name: 'All', exact: true})).toHaveCount(0);
  await expect(page.locator('a[href*="attack_surface="]')).toHaveCount(0);
  await expand(page);
  for (const surface of ['algorithmic', 'side_channel', 'fault_injection']) {
    const group = page.locator('.a-surface-results[data-attack-surface="' + surface + '"]');
    const expected = records.filter(record => record.setting.attack_surface === surface).map(record => record.id).sort();
    expect(await group.locator('tr[data-record-id]').evaluateAll(rows => rows.map(row => row.getAttribute('data-record-id')).sort())).toEqual(expected);
    await expect(group.locator('[data-method-category="structural"]')).toHaveCount(1);
  }
  const ids = await page.locator('[id]').evaluateAll(elements => elements.map(element => element.id));
  expect(new Set(ids).size).toBe(ids.length);
  await noOverflow(page);
});

test('filters span surfaces while expansion and comparison selections stay independent', async ({page}) => {
  await page.goto(base + '?method=differential&ids=' + records[0].id);
  const methods = page.getByRole('combobox', {name: 'Attack method', exact: true});
  await expect(methods).toHaveValue('differential');
  await expect(page.locator('.a-surface-heading')).toHaveText(['Classical cryptanalysis', 'Side-channel analysis']);
  for (const method of ['mitm', 'collision', 'fault']) await expect(methods.locator(`option[value="${method}"]`)).toHaveCount(1);
  const algorithmic = page.locator('[data-section-id="algorithmic-differential"] .a-result-section-toggle');
  const leakage = page.locator('[data-section-id="side_channel-differential"] .a-result-section-toggle');
  await algorithmic.focus(); await page.keyboard.press('Enter');
  await expect(algorithmic).toHaveAttribute('aria-expanded', 'true');
  await expect(leakage).toHaveAttribute('aria-expanded', 'false');
  await leakage.click();
  await expect(algorithmic).toHaveAttribute('aria-expanded', 'true');
  await expect(leakage).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('[data-section-id="algorithmic-differential"] [data-record-id="' + side.id + '"]')).toHaveCount(0);
  await page.getByRole('combobox', {name: 'Rounds', exact: true}).selectOption('10');
  await expect(page.locator('.a-surface-heading')).toHaveText(['Side-channel analysis']);
  await expect(page.locator('[data-record-id="' + side.id + '"]')).toBeVisible();
  await expect(page.locator('.a-selection-bar')).toContainText('1/4 selected');
  await page.getByRole('button', {name: 'Clear filters', exact: true}).click();
  await expect(methods).toHaveValue('');
  await expect(page.locator('.a-surface-heading')).toHaveText(['Classical cryptanalysis', 'Side-channel analysis', 'Fault-injection analysis']);
  await expect(page.locator('.a-selection-bar')).toContainText('1/4 selected');
  const query = new URLSearchParams(new URL(page.url()).hash.split('?')[1]);
  expect(query.has('attack_surface')).toBe(false);
  expect(query.get('ids')).toBe(records[0].id);
  await noOverflow(page);
});

test('exact-ID and citation searches immediately find side-channel records and retain clean return context', async ({page}) => {
  await page.goto(base + '?q=' + side.id);
  await expect(page.locator('.a-surface-heading')).toHaveText(['Side-channel analysis']);
  await expect(page.getByRole('navigation', {name: 'Matching results on other attack surfaces'})).toHaveCount(0);
  await expand(page);
  const row = page.locator('[data-record-id="' + side.id + '"]');
  await expect(row.locator('.a-attack-name')).toHaveText('See-in-the-Middle (SITM)');
  await expect(row.locator('[data-label="Goal"]')).toContainText('16 master-key bits');
  await expect(row.locator('[data-label="Rounds"] [data-native-expression]')).toHaveAttribute('data-native-expression', '10');
  await expect(row.locator('[data-label="Setting"]')).toContainText('Power leakage');
  await row.locator('.a-result-title').click();
  await expect(page.locator('.a-detail-topbar .a-back-link')).toHaveAttribute('href', '#/cryptanalysis/ciphers/aes/aes-128?q=' + side.id);
  await page.locator('.a-detail-topbar .a-back-link').click();
  await expect(page.getByRole('searchbox', {name: 'Search analysis results', exact: true})).toHaveValue(side.id);
  await expect(page.locator('.a-surface-heading')).toHaveText(['Side-channel analysis']);
  await page.goto(base + '?q=Syn26');
  await expect(page.locator('.a-surface-heading')).toHaveText(['Classical cryptanalysis', 'Side-channel analysis', 'Fault-injection analysis']);
  await expand(page);
  await expect(page.locator('tr[data-record-id]')).toHaveCount(records.length);
  await noOverflow(page);
});

test('legacy direct links and cross-surface comparisons retain context and reject cost ranking', async ({page}) => {
  for (const surface of ['algorithmic', 'side_channel', 'fault_injection', 'all', 'unknown']) {
    await page.goto(base + '?attack_surface=' + surface);
    await expect(page.locator('.a-surface-heading')).toHaveText(['Classical cryptanalysis', 'Side-channel analysis', 'Fault-injection analysis']);
    await expect(page.locator('a[href*="attack_surface="]')).toHaveCount(0);
    await expect(page.locator('.a-list-toolbar')).not.toContainText('active filter');
  }
  await page.goto(base + '?method=fault');
  await expect(page.locator('.a-surface-heading')).toHaveText(['Fault-injection analysis']);
  await expect(page.locator('[data-section-id="fault_injection-fault"]')).toHaveCount(1);
  await expect(page.getByRole('combobox', {name: 'Attack method', exact: true})).toHaveValue('fault');
  await page.goto('/#/cryptanalysis/results/' + side.id + '?variant=aes-128&attack_surface=side_channel');
  await expect(page.locator('.a-detail-topbar .a-back-link')).toHaveAttribute('href', '#/cryptanalysis/ciphers/aes/aes-128');
  await page.goto('/#/cryptanalysis/compare/aes-128?attack_surface=all&ids=' + records[0].id + ',' + side.id);
  await expect(page.locator('.a-back-link')).not.toHaveAttribute('href', /attack_surface=/);
  await expect(page.locator('.a-pair summary')).toContainText('Incomparable costs');
  const surfaceRow = page.locator('.a-comparison-table tr').filter({has: page.getByRole('rowheader', {name: /^Attack surface/})});
  await expect(surfaceRow.locator('td')).toHaveText(['Algorithmic', 'Side-channel']);
  await expect(page.locator('.a-comparison-picker optgroup[label="Side-channel"]')).toHaveCount(1);
  const backQuery = new URLSearchParams((await page.locator('.a-back-link').getAttribute('href'))!.split('?')[1]);
  expect(backQuery.get('ids')).toBe(records[0].id + ',' + side.id);
  await noOverflow(page);
});

test('pagination is independent for equal methods on distinct surfaces', async ({page}) => {
  // Replace this test's data handler with enough independent synthetic points to page each surface.
  await page.unroute(/\/analysis-[a-f0-9]{64}\.json$/);
  await page.route(/\/analysis-[a-f0-9]{64}\.json$/, async route => {
    const data = await (await route.fetch()).json();
    data.results = ['algorithmic', 'side_channel'].flatMap(surface => Array.from({length: 25}, (_, i) =>
      surfaceResult({surface, id: `synthetic-${surface.replaceAll('_', '-')}-point-${String(i).padStart(2, '0')}`})));
    data.compactResults = []; data.familyCatalogs = [];
    await route.fulfill({json: data});
  });
  await page.goto(base);
  await expand(page);
  const algorithmic = page.locator('[data-section-id="algorithmic-differential"]');
  const leakage = page.locator('[data-section-id="side_channel-differential"]');
  await expect(algorithmic.locator('.a-attack-row')).toHaveCount(24);
  await expect(leakage.locator('.a-attack-row')).toHaveCount(24);
  await algorithmic.getByRole('button', {name: /^Next Classical/}).click();
  await expect(algorithmic.locator('.a-attack-row')).toHaveCount(1);
  await expect(leakage.locator('.a-attack-row')).toHaveCount(24);
  await leakage.getByRole('button', {name: /^Next Side-channel/}).click();
  await expect(leakage.locator('.a-attack-row')).toHaveCount(1);
  await expect(algorithmic.locator('.a-attack-row')).toHaveCount(1);
  await page.getByRole('combobox', {name: 'Sort', exact: true}).selectOption('title');
  await expect(algorithmic.locator('.a-attack-row')).toHaveCount(24);
  await expect(leakage.locator('.a-attack-row')).toHaveCount(24);
  await noOverflow(page);
});

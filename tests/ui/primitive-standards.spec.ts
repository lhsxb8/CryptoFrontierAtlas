import {test, expect} from '@playwright/test';
import catalog from '../../data/primitives/catalog.json' with {type: 'json'};

test.use({locale: 'en-US'});
const standards = catalog.standardization.standards;
const rankFor = (id: string) => {
  const ids = new Set(catalog.instances.filter(instance => instance.family_id === id).map(instance => instance.id));
  const matches = standards.filter(standard => standard.bindings.some(binding => binding.instance_ids.some(instance => ids.has(instance))));
  const statuses = matches.map(standard => catalog.specifications.find(spec => spec.id === standard.specification_id)?.status);
  return statuses.includes('withdrawn') ? 2 : statuses.includes('published') ? 0 : 1;
};

test('standards precede unverified families and withdrawn targets come last across pagination', async ({page}) => {
  await page.goto('/#/cryptanalysis?primitive=block_cipher');
  await expect(page.locator('.atlas-family-card').first()).toBeVisible();
  const totalPages = Math.ceil(catalog.primitives.filter(primitive => primitive.category === 'block_cipher').length / 24);
  const ranks: number[] = [];
  const familyIds: string[] = [];
  let currentPage = 1;
  while (true) {
    const hrefs = await page.locator('.atlas-family-card').evaluateAll(cards => cards.map(card => card.getAttribute('href')!));
    const ids = hrefs.map(href => href.split('/').at(-1)!);
    familyIds.push(...ids);
    ranks.push(...ids.map(rankFor));
    const next = page.getByRole('button', {name: 'Next', exact: true});
    if (await next.isDisabled()) break;
    await next.click();
    await expect(page.getByRole('navigation', {name: 'Directory Pagination'}).getByRole('status')).toHaveText(`${++currentPage} / ${totalPages}`);
  }
  expect(ranks.length).toBe(catalog.primitives.filter(primitive => primitive.category === 'block_cipher').length);
  expect(ranks).toEqual([...ranks].sort());
  expect(ranks).toContain(1); expect(ranks).toContain(2);
  expect(new Set(familyIds.slice(-2))).toEqual(new Set(['des', 'tdea']));
  const tdea = page.locator('.atlas-family-card[href$="/tdea"]');
  await expect(tdea.getByRole('img', {name: /^International Standard:/})).toBeVisible();
  await expect(tdea.getByRole('img', {name: /^Withdrawn Standard:/})).toBeVisible();
  await expect(tdea).not.toContainText('Withdrawn');
  await page.goto('/#/asymmetric-cryptanalysis');
  await expect(page.locator('.atlas-family-group').first()).toHaveAttribute('data-category', 'hard_problem');
  await expect(page.locator('[data-category="hard_problem"] .atlas-standard-badge')).toHaveCount(0);
});

test('AES shows verifiable badges but its compression constructions and special research variants do not inherit them', async ({page}) => {
  await page.goto('/#/cryptanalysis/ciphers/aes/aes-128');
  const panel = page.locator('.atlas-standard-panel');
  await expect(panel.locator('[data-standard-kind="international"]')).toBeVisible();
  await expect(panel.locator('[data-standard-kind="national"]')).toBeVisible();
  await expect(panel.getByRole('img', {name: /^International Standard:/})).toHaveText('');
  await expect(panel.locator('[data-standard-kind="international"] svg')).toHaveClass(/lucide-globe/);
  await expect(panel.locator('[data-standard-kind="national"] svg')).toHaveClass(/lucide-landmark/);
  await panel.locator('summary').click();
  await expect(panel.locator('.atlas-standard-evidence')).toContainText('International Standard');
  await expect(panel.locator('.atlas-standard-evidence')).toContainText('National Standard');
  await expect(panel.getByRole('link', {name: 'FIPS 197', exact: true})).toHaveAttribute('href', 'https://csrc.nist.gov/pubs/fips/197/final');
  await expect(page.getByRole('heading', {name: 'Analysis Results', exact: true})).toBeVisible();
  expect(await page.locator('.a-attack-table').count()).toBeGreaterThan(0);
  for (const [family, instance] of [['aes-dm','aes-dm-128'],['aes-mmo','aes-mmo-128'],['aes-mp','aes-mp-128'],['aes','aes-128-secret-sbox']]) {
    await page.goto(`/#/cryptanalysis/ciphers/${family}/${instance}`);
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('.atlas-standard-panel')).toHaveCount(0);
  }
});

test('partial-family badges bind the ISO RFID variants exactly, including 96/96 but not 128/192', async ({page}) => {
  for (const family of ['simon', 'speck']) {
    await page.goto('/#/cryptanalysis?q=' + family);
    const badge = page.locator('.atlas-family-card .atlas-standard-badge');
    await expect(badge).toHaveText('');
    await expect(badge).toHaveAccessibleName(/^International Standard:.*covers 5\/10 instances$/);
    await expect(badge).toHaveAttribute('title', /covers 5\/10 instances/);
    await page.goto(`/#/cryptanalysis/ciphers/${family}/${family}-96-96`);
    await expect(page.locator('.atlas-standard-panel [data-standard-kind="international"]')).toBeVisible();
    await page.goto(`/#/cryptanalysis/ciphers/${family}/${family}-128-192`);
    await expect(page.locator('.atlas-standard-panel')).toHaveCount(0);
    await page.goto(`/#/cryptanalysis/ciphers/${family}`);
    const options = await page.getByRole('combobox', {name: 'All Instances'}).locator('option').evaluateAll(nodes => nodes.map(node => (node as HTMLOptionElement).value).filter(Boolean));
    const verified = new Set(standards.flatMap(standard => standard.bindings.flatMap(binding => binding.instance_ids)));
    expect(options.map(id => Number(!verified.has(id)))).toEqual([0,0,0,0,0,1,1,1,1,1]);
  }
});

test('standards search and national, recommendation and withdrawn icons remain distinct', async ({page}) => {
  await page.goto('/#/cryptanalysis?primitive=block_cipher&q=ISO%2FIEC%2029192-2');
  await expect(page.locator('.atlas-family-card h3')).toHaveText(['CLEFIA', 'LEA', 'PRESENT']);
  await page.goto('/#/cryptanalysis/ciphers/aria/aria-128');
  await expect(page.locator('.atlas-standard-panel [data-standard-kind="national"]')).toBeVisible();
  await expect(page.locator('.atlas-standard-panel [data-standard-kind="international"]')).toHaveCount(0);
  await page.goto('/#/cryptanalysis/ciphers/cshake/cshake-128');
  await expect(page.locator('.atlas-standard-panel [data-standard-kind="recommendation"]')).toBeVisible();
  await expect(page.locator('.atlas-standard-panel [data-standard-kind="recommendation"] svg')).toHaveClass(/lucide-file-check2/);
  await expect(page.locator('.atlas-standard-panel [data-standard-kind="national"]')).toHaveCount(0);
  await page.goto('/#/cryptanalysis/ciphers/des/des-56');
  await expect(page.locator('.atlas-standard-panel [data-standard-kind="historical"]')).toBeVisible();
  await expect(page.locator('.atlas-standard-panel [data-standard-kind="historical"] svg')).toHaveClass(/lucide-archive-x/);
  await page.locator('.atlas-standard-panel summary').click();
  await expect(page.locator('.atlas-standard-panel')).toContainText('Withdrawn 2005-05-19');
});

test('standard evidence is keyboard-accessible and stays inside a narrow viewport', async ({page}) => {
  await page.setViewportSize({width: 320, height: 800});
  await page.goto('/#/cryptanalysis/ciphers/sm3/sm3-256');
  const summary = page.locator('.atlas-standard-panel > summary');
  await summary.focus(); await page.keyboard.press('Enter');
  await expect(page.locator('.atlas-standard-panel')).toHaveAttribute('open', '');
  await expect(page.locator('.atlas-standard-evidence')).toContainText('GB/T 32905-2016');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(321);
  await page.goto('/#/cryptanalysis/ciphers/photon-permutation/photon-p256');
  await page.locator('.atlas-standard-panel summary').click();
  await expect(page.locator('.atlas-standard-panel')).toContainText('Standardized Component');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(321);
});

test('published catalog retains complete review coverage with explicit bindings and no implicit family awards', async ({request}) => {
  const response = await request.get('/atlas-catalog.json');
  expect(response.ok()).toBe(true);
  const data = await response.json();
  expect([...data.standardization.reviewed_instance_ids].sort()).toEqual(data.instances.map((instance: {id: string}) => instance.id).sort());
  const targets = new Set(data.standardization.standards.flatMap((standard: {bindings: {instance_ids: string[]}[]}) => standard.bindings.flatMap(binding => binding.instance_ids)));
  for (const id of ['aes-dm-128','aes-mmo-128','aes-mp-128','cast128-80','ripemd-256','ripemd-320','aradi-128-256']) expect(targets.has(id)).toBe(false);
  for (const id of ['aes-128','sm3-256','sm4-128','cast128-128','ripemd-128','ripemd-160','ml-kem-768']) expect(targets.has(id)).toBe(true);
});

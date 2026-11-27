import {test, expect, type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import catalog from '../../data/primitives/catalog.json' with {type: 'json'};
import variants from '../../data/cryptanalysis-public/variants.json' with {type: 'json'};
import manifest from '../../data/cryptanalysis-public/manifest.json' with {type: 'json'};
import type {AnalysisResult} from '../../src/features/cryptanalysis/types';

test.use({locale: 'en-US'});
const targets = variants.filter(v => 'compression' in v);
const records = manifest.records.map(id => JSON.parse(readFileSync(new URL('../../data/cryptanalysis-public/results/' + id + '.json', import.meta.url), 'utf8')) as AnalysisResult);
const moved = records.filter(r => r.experiment?.construction.type === 'compression_function');
async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
  await expect(page.locator('.katex-error')).toHaveCount(0);
}

test('Hash exposes three compression constructions with exact instance diagrams and separate results', async ({page}) => {
  await page.goto('/#/cryptanalysis?primitive=hash_function&q=AES');
  await expect(page.locator('.atlas-family-card h3')).toHaveText(['AES-DM', 'AES-MMO', 'AES-MP']);
  await expect(page.locator('.atlas-family-card .atlas-construction-kind')).toHaveCount(3);
  expect(targets).toHaveLength(5); expect(moved).toHaveLength(16);
  const seen: string[] = [];
  for (const target of targets) {
    const instance = catalog.instances.find(i => i.id === target.id)!;
    await page.goto(`/#/cryptanalysis/ciphers/${target.family}/${target.id}`);
    await expect(page.getByRole('heading', {level: 1})).toHaveText(instance.name);
    await expect(page.locator('.atlas-construction-kind')).toHaveText('Compression Function');
    const panel = page.locator('.atlas-structure');
    await expect(panel).toHaveAttribute('data-structure-target', target.id);
    await expect(panel.getByRole('tab')).toHaveCount(0);
    const image = panel.locator('img');
    await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
    await expect(page.locator('.atlas-primitive-relations a')).toHaveAttribute('href', '#/cryptanalysis/ciphers/aes/' + target.compression!.cipher_variant_id);
    await expect(panel.locator('.atlas-structure-parameters')).not.toContainText('Key Material');
    const expand = page.getByRole('button', {name: 'Expand all', exact: true});
    if (await expand.isEnabled()) await expand.click();
    const expected = moved.filter(r => r.target.variant_ids.includes(target.id)).map(r => r.id).sort();
    const actual = await page.locator('tr[data-record-id]').evaluateAll(rows => rows.map(r => r.getAttribute('data-record-id')!).sort());
    expect(actual).toEqual(expected); seen.push(...actual);
    await noOverflow(page);
  }
  expect(seen.sort()).toEqual(moved.map(r => r.id).sort());
  expect(new Set(seen).size).toBe(16);
});

test('legacy details normalize to compression targets while ordinary AES and invalid contexts stay distinct', async ({page}) => {
  for (const target of targets) {
    const record = moved.find(r => r.target.variant_ids.includes(target.id))!;
    await page.goto(`/#/cryptanalysis/results/${record.id}?variant=${target.compression!.cipher_variant_id}&sort=source-year-desc`);
    await expect(page).toHaveURL(new RegExp('variant=' + target.id));
    await expect(page.locator('.a-detail-topbar .a-back-link')).toHaveAttribute('href', new RegExp(`/ciphers/${target.family}/${target.id}`));
    await expect(page.locator('.a-notice-warning')).toHaveCount(0);
    await expect(page.locator('.a-evidence-entry a').first()).toHaveAttribute('href', new RegExp('variant=' + target.id));
    await page.reload(); await noOverflow(page);
  }
  const record = moved[0];
  await page.goto(`/#/cryptanalysis/ciphers/aes/aes-128?q=${record.id}`);
  await expect(page.getByRole('heading', {level: 1})).toHaveText('AES-128');
  await expect(page.getByRole('heading', {name: 'No Matching Results', exact: true})).toBeVisible();
  await expect(page.locator('.atlas-primitive-relations a')).toHaveCount(3);
  await page.goto(`/#/cryptanalysis/results/${record.id}?variant=unrelated-instance`);
  await expect(page.locator('.a-notice-warning')).toContainText('does not apply');
  await noOverflow(page);
});

test('compression drawings and dependency navigation fit 320px screens', async ({page}) => {
  await page.setViewportSize({width: 320, height: 740});
  await page.goto('/#/cryptanalysis/ciphers/aes-mp/aes-mp-128');
  await expect(page.locator('.atlas-structure-image img')).toBeVisible();
  await noOverflow(page);
  await page.locator('.atlas-primitive-relations a').click();
  await expect(page.getByRole('heading', {level: 1})).toHaveText('AES-128');
  await noOverflow(page);
});

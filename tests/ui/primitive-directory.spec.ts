import {test, expect} from '@playwright/test';
import catalog from '../../data/primitives/catalog.json' with {type: 'json'};
import pkg from '../../package.json' with {type: 'json'};

test.use({locale: 'en-US'});

test('home has four usable entrances and planned collections have accessible TBD pages', async ({page}) => {
  await page.goto('/#/');
  const cards = page.locator('.atlas-portal-card');
  await expect(cards).toHaveCount(4);
  await expect(cards.locator('h2')).toHaveText(['Open questions', 'Symmetric cryptanalysis', 'Asymmetric cryptanalysis', 'Implementation']);
  await expect(cards.locator('.atlas-tbd')).toHaveCount(2);
  await expect(page.locator('.atlas-footer')).toContainText(`v${pkg.version}`);
  for (const [name, route] of [['Asymmetric cryptanalysis', 'asymmetric-cryptanalysis'], ['Implementation', 'implementation']]) {
    await page.goto('/#/');
    const card = page.locator(`.atlas-portal-card[href="#/${route}"]`);
    await card.focus(); await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', {level: 1})).toHaveText(name);
    await expect(page.getByRole('heading', {level: 1})).toBeFocused();
    await expect(page.locator('main')).toContainText('TBD');
    await expect(page.locator('main table, main input')).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole('heading', {level: 1})).toHaveText(name);
    await page.getByRole('link', {name: 'Back to home', exact: true}).click();
    await expect(page.locator('.atlas-portal-card')).toHaveCount(4);
  }
});

test('public directory exposes all categories and empty results without misleading comparisons', async ({page}) => {
  await page.goto('/#/cryptanalysis');
  await expect(page.getByRole('heading', {level: 1})).toHaveText('Primitive & construction directory');
  await expect(page.locator('.atlas-family-card')).toHaveCount(catalog.primitives.length);
  for (const category of catalog.categories) await expect(page.getByRole('heading', {name: category.en, exact: true})).toBeVisible();
  await page.getByRole('combobox', {name: 'Primitive type', exact: true}).selectOption('stream_cipher');
  await expect(page.locator('.atlas-family-card')).toHaveCount(catalog.primitives.filter(p => p.category === 'stream_cipher').length);
  await expect(page.locator('.atlas-family-card h3')).toContainText(['ChaCha20', 'Salsa20']);
  await page.getByRole('searchbox', {name: 'Search primitives and instances'}).fill('nonexistent fixture');
  await expect(page.getByRole('heading', {name: 'No matching primitives'})).toBeVisible();
  await page.getByRole('button', {name: 'Reset filters'}).click();
  await expect(page.locator('.atlas-family-card')).toHaveCount(catalog.primitives.length);
  await page.getByRole('searchbox', {name: 'Search primitives and instances'}).fill('Triple DES');
  await expect(page.locator('.atlas-family-card')).toHaveCount(1);
  await expect(page.locator('.atlas-family-card')).toContainText('Withdrawn');
  await page.locator('.atlas-family-card').click();
  await expect(page.getByRole('heading', {level: 1})).toHaveText('3DES / TDEA');
  await expect(page.locator('main')).toContainText('2024-01-01');
  await expect(page.locator('main')).toContainText('No catalogued results');
  await expect(page.locator('.a-selection-bar')).toHaveCount(0);
});

test('every public instance deep link resolves, including hash, XOF and permutation parameters', async ({page}) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const instance of catalog.instances) {
    await page.goto(`/#/cryptanalysis/ciphers/${instance.family_id}/${instance.id}`);
    await expect(page.getByRole('heading', {level: 1})).toHaveText(instance.name);
    if (instance.family_id === 'aes') {
      await expect(page.getByRole('searchbox', {name: 'Search analysis results', exact:true})).toBeVisible();
      await expect(page.locator('.atlas-structure')).toHaveAttribute('data-structure-target',instance.id);
    } else {
      await expect(page.locator('main')).toContainText(instance.locator);
      await expect(page.locator('.a-selection-bar, main table')).toHaveCount(0);
    }
    if (['hash_function', 'xof', 'permutation'].includes(instance.parameters.type)) {
      await expect(page.locator('main')).not.toContainText('Key material');
      await expect(page.locator('main')).not.toContainText('full rounds');
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
  }
  expect(errors).toEqual([]);
});

test('legacy instance links preserve the selected target and reject mismatched families', async ({page}) => {
  await page.goto('/#/objects/aes?variant=aes-192');
  await expect(page).toHaveURL(/#\/cryptanalysis\/ciphers\/aes\/aes-192$/);
  await expect(page.getByRole('heading', {level: 1})).toHaveText('AES-192');
  await page.reload();
  await expect(page.getByRole('heading', {level: 1})).toHaveText('AES-192');
  await page.goto('/#/cryptanalysis/ciphers/sha3/aes-192');
  await expect(page.getByRole('heading', {level: 1})).toHaveText('Record not found');
  await page.goto('/#/cryptanalysis/ciphers/unknown-fixture');
  await expect(page.getByRole('heading', {level: 1})).toHaveText('Record not found');
});

test('Chinese directory and narrow navigation remain usable with all four collections', async ({page}) => {
  await page.setViewportSize({width: 320, height: 640});
  await page.goto('/#/cryptanalysis?primitive=xof');
  await page.getByRole('button', {name: 'Language', exact: true}).click();
  await page.getByRole('button', {name: '简体中文', exact: true}).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', {level: 1})).toHaveText('原语与构造目录');
  await expect(page.getByRole('heading', {name: '可扩展输出函数', exact: true})).toBeVisible();
  await expect(page.locator('.atlas-family-card')).toContainText('尚未收录结果');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
  const nav = page.getByRole('navigation', {name: '主导航'});
  await page.getByRole('button', {name: '主导航', exact: true}).click();
  await expect(nav.getByRole('link')).toHaveCount(5);
  await nav.getByRole('link', {name: /非对称密码分析/}).click();
  await expect(page.getByRole('heading', {level: 1})).toHaveText('非对称密码分析');
  await expect(page.locator('main')).toContainText('TBD');
});

test('public metadata agrees with the displayed application and source directory', async ({request}) => {
  const release = await (await request.get('/atlas-release.json')).json();
  const publishedCatalog = await (await request.get('/atlas-catalog.json')).json();
  expect(release.application_version).toBe(pkg.version);
  expect(release.data_revision).toMatch(/^[a-f0-9]{64}$/);
  expect(release.primitive_count).toBe(catalog.primitives.length);
  expect(publishedCatalog).toEqual(catalog);
});

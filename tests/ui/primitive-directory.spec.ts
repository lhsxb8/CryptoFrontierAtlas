import {test, expect} from '@playwright/test';
import catalog from '../../data/primitives/catalog.json' with {type: 'json'};
import pkg from '../../package.json' with {type: 'json'};

test.use({locale: 'en-US'});
const symmetricCategories = catalog.categories.filter(c => c.domain === 'symmetric');
const symmetricFamilies = catalog.primitives.filter(p => symmetricCategories.some(c => c.id === p.category));
const asymmetricFamilies = catalog.primitives.filter(p => !symmetricFamilies.includes(p));
const symmetricOverviewCount = symmetricCategories.reduce((sum,c) => sum + Math.min(6, symmetricFamilies.filter(p=>p.category===c.id).length),0);
const asymmetricOverviewCount = catalog.categories.filter(c=>c.domain==='asymmetric').reduce((sum,c)=>sum+Math.min(6,
  c.id==='hard_problem'?catalog.hard_problems.length:asymmetricFamilies.filter(p=>p.category===c.id).length),0);
const instancePath = (instance: typeof catalog.instances[number]) => asymmetricFamilies.some(p => p.id === instance.family_id)
  ? `/asymmetric-cryptanalysis/algorithms/${instance.family_id}/${instance.id}`
  : `/cryptanalysis/ciphers/${instance.family_id}/${instance.id}`;

test('home has four usable entrances and planned collections have accessible TBD pages', async ({page}) => {
  await page.goto('/#/');
  const cards = page.locator('.atlas-portal-card');
  await expect(cards).toHaveCount(4);
  await expect(cards.locator('h2')).toHaveText(['Open Questions', 'Symmetric Cryptanalysis', 'Asymmetric Cryptanalysis', 'Implementation']);
  await expect(cards.locator('.atlas-tbd')).toHaveCount(1);
  await expect(page.locator('.atlas-footer')).toContainText(`v${pkg.version}`);
  for (const [name, route] of [['Implementation', 'implementation']]) {
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
  await expect(page.getByRole('heading', {level: 1})).toHaveText('Primitive & Construction Directory');
  await expect(page.locator('.atlas-family-card')).toHaveCount(symmetricOverviewCount);
  for (const category of symmetricCategories) await expect(page.getByRole('heading', {name: category.en, exact: true})).toBeVisible();
  await page.getByRole('combobox', {name: 'Primitive Type', exact: true}).selectOption('stream_cipher');
  await expect(page.locator('.atlas-family-card')).toHaveCount(catalog.primitives.filter(p => p.category === 'stream_cipher').length);
  await expect(page.locator('.atlas-family-card h3')).toContainText(['ChaCha20', 'Salsa20']);
  await page.getByRole('searchbox', {name: 'Search primitives and instances'}).fill('nonexistent fixture');
  await expect(page.getByRole('heading', {name: 'No Matching Primitives'})).toBeVisible();
  await page.getByRole('button', {name: 'Reset filters'}).click();
  await expect(page.locator('.atlas-family-card')).toHaveCount(symmetricOverviewCount);
  await page.getByRole('searchbox', {name: 'Search primitives and instances'}).fill('Triple DES');
  await expect(page.locator('.atlas-family-card')).toHaveCount(1);
  await expect(page.locator('.atlas-family-card').getByRole('img', {name: /^Withdrawn Standard:/})).toBeVisible();
  await page.locator('.atlas-family-card').click();
  await expect(page.getByRole('heading', {level: 1})).toHaveText('3DES / TDEA');
  await expect(page.locator('main')).toContainText('2024-01-01');
  await expect(page.locator('main')).toContainText('No Catalogued Results');
  await expect(page.locator('.a-selection-bar')).toHaveCount(0);
});

test('every public instance deep link resolves, including hash, XOF and permutation parameters', async ({page}) => {
  test.setTimeout(Math.max(90_000, catalog.instances.length * 700));
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const instance of catalog.instances) {
    await page.goto('/#' + instancePath(instance));
    await expect(page.getByRole('heading', {level: 1})).toHaveText(instance.name);
    if (['aes', 'aes-dm', 'aes-mmo', 'aes-mp'].includes(instance.family_id)) {
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
  await expect(page.getByRole('heading', {level: 1})).toHaveText('Record Not Found');
  await page.goto('/#/cryptanalysis/ciphers/unknown-fixture');
  await expect(page.getByRole('heading', {level: 1})).toHaveText('Record Not Found');
});

test('Chinese directory and narrow navigation remain usable with all four collections', async ({page}) => {
  await page.setViewportSize({width: 320, height: 640});
  await page.goto('/#/cryptanalysis?primitive=xof');
  await page.getByRole('button', {name: 'Language', exact: true}).click();
  await page.getByRole('button', {name: '简体中文', exact: true}).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', {level: 1})).toHaveText('原语与构造目录');
  await expect(page.getByRole('heading', {name: '可扩展输出函数', exact: true})).toBeVisible();
  await expect(page.locator('.atlas-family-card').first()).toContainText('个实例');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
  const nav = page.getByRole('navigation', {name: '主导航'});
  await page.getByRole('button', {name: '主导航', exact: true}).click();
  await expect(nav.getByRole('link')).toHaveCount(5);
  await nav.getByRole('link', {name: /非对称密码分析/}).click();
  await expect(page.getByRole('heading', {level: 1})).toHaveText('非对称密码分析');
  await expect(page.locator('main')).not.toContainText('TBD');
  await expect(page.locator('.atlas-family-card')).toHaveCount(asymmetricOverviewCount);
});

test('asymmetric directory exposes scoped categories, search and family overviews without analysis controls', async ({page}) => {
  await page.goto('/#/');
  await page.locator('.atlas-portal-card.is-asymmetric').click();
  await expect(page.getByRole('heading', {level: 1})).toHaveText('Asymmetric Cryptanalysis');
  await expect(page.locator('.atlas-family-card')).toHaveCount(asymmetricOverviewCount);
  await expect(page.locator('main')).not.toContainText('Block Ciphers');
  await expect(page.getByRole('tab')).toHaveCount(0);
  await page.getByRole('combobox', {name: 'Category', exact: true}).selectOption('kem');
  await expect(page.locator('.atlas-family-card')).toHaveCount(catalog.primitives.filter(p=>p.category==='kem').length);
  await page.getByRole('searchbox').fill('ML-KEM-768');
  await expect(page.locator('.atlas-family-card h3')).toHaveText(['ML-KEM']);
  await page.locator('.atlas-family-card').click();
  await expect(page.getByRole('heading', {level: 1})).toHaveText('ML-KEM');
  await expect(page.locator('.atlas-instance-table tbody tr')).toHaveCount(3);
  await expect(page.getByRole('tab')).toHaveCount(0);
  await page.locator('.atlas-primitive-navigation').getByRole('link', {name: 'ML-KEM-768', exact: true}).click();
  await page.reload();
  await expect(page.getByRole('heading', {level: 1})).toHaveText('ML-KEM-768');
  await expect(page.locator('.atlas-structure-parameters')).toContainText('1184 bytes');
  await expect(page.locator('.atlas-structure-parameters')).not.toContainText('Rounds');
  await expect(page.locator('.a-selection-bar, .a-results-intro')).toHaveCount(0);
  await page.getByRole('link', {name: 'Asymmetric Cryptanalysis', exact: true}).filter({has: page.locator('svg')}).click();
  await page.getByRole('searchbox', {name: 'Search problems, schemes and instances'}).fill('国密SM2');
  await expect(page.locator('.atlas-family-card')).toHaveCount(3);
});

test('cross-domain and mismatched-instance routes do not leak definitions or analyses', async ({page}) => {
  for (const path of [
    '/cryptanalysis/ciphers/ml-kem/ml-kem-512',
    '/asymmetric-cryptanalysis/algorithms/aes/aes-128',
    '/asymmetric-cryptanalysis/algorithms/ml-kem/ml-dsa-44',
  ]) {
    await page.goto('/#' + path);
    await expect(page.getByRole('heading', {level: 1})).toHaveText('Record Not Found');
    await expect(page.locator('.atlas-structure, .a-selection-bar')).toHaveCount(0);
  }
  await page.goto('/#/asymmetric-cryptanalysis/algorithms/sm2-encryption/sm2-encryption-sm3');
  await page.getByRole('link', {name: 'SM3', exact: true}).click();
  await expect(page).toHaveURL(/#\/cryptanalysis\/ciphers\/sm3$/);
  await expect(page.getByRole('heading', {level: 1})).toHaveText('SM3');
});

test('public metadata agrees with the displayed application and source directory', async ({request}) => {
  const release = await (await request.get('/atlas-release.json')).json();
  const publishedCatalog = await (await request.get('/atlas-catalog.json')).json();
  expect(release.application_version).toBe(pkg.version);
  expect(release.data_revision).toMatch(/^[a-f0-9]{64}$/);
  expect(release.primitive_count).toBe(catalog.primitives.length);
  expect(publishedCatalog).toEqual(catalog);
});

test('hard problems appear first, filter by category and remain absent from the symmetric directory', async ({page}) => {
  await page.goto('/#/asymmetric-cryptanalysis');
  await expect(page.locator('.atlas-family-group h2')).toHaveText(['Hard Problems', 'Public-Key Encryption', 'Key Agreement', 'Digital Signatures', 'Key Encapsulation Mechanisms']);
  await page.getByRole('combobox', {name: 'Category', exact: true}).selectOption('hard_problem');
  await expect(page.locator('.atlas-family-card h3')).toHaveText(catalog.hard_problems.map(p => p.name));
  await expect(page.locator('.atlas-family-stats')).not.toContainText(['0 instances']);
  await page.getByRole('searchbox').fill('RLWE');
  await expect(page.locator('.atlas-family-card h3')).toHaveText(['Ring-LWE']);
  await page.reload();
  await expect(page.locator('.atlas-family-card h3')).toHaveText(['Ring-LWE']);
  await page.goto('/#/cryptanalysis?q=RLWE');
  await expect(page.getByRole('heading', {name: 'No Matching Primitives'})).toBeVisible();
});

test('all hard-problem pages render math, primary references and meaningful related links on narrow screens', async ({page}) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({width: 320, height: 740});
  for (const problem of catalog.hard_problems) {
    await page.goto('/#/asymmetric-cryptanalysis/problems/' + problem.id);
    await expect(page.getByRole('heading', {level: 1})).toHaveText(problem.name);
    await expect(page).toHaveTitle(problem.name + ' · CryptoFrontierAtlas');
    await expect(page.getByRole('heading', {level: 1})).toBeFocused();
    expect(await page.locator('main .katex').count()).toBeGreaterThan(0);
    await expect(page.locator('.katex-error, .atlas-structure, .atlas-instance-table, .atlas-catalog-empty, .a-selection-bar')).toHaveCount(0);
    await expect(page.getByRole('heading', {name: 'References', exact: true})).toBeVisible();
    for (const reference of problem.references) {
      const source = catalog.problem_sources.find(s => s.id === reference.source_id)!;
      await expect(page.locator('.atlas-primitive-specs').getByRole('link', {name: source.title, exact: true})).toHaveAttribute('href', source.url);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(321);
  }
  await page.goto('/#/asymmetric-cryptanalysis/problems/integer-factorization');
  await page.getByRole('link', {name: 'RSA Problem', exact: true}).click();
  await page.getByRole('link', {name: 'RSAES-OAEP', exact: true}).click();
  await expect(page.getByRole('heading', {level: 1})).toHaveText('RSAES-OAEP');
  await page.getByRole('link', {name: 'RSA Problem', exact: true}).click();
  await page.reload();
  await expect(page.getByRole('heading', {level: 1})).toHaveText('RSA Problem');
  await page.goBack();
  await expect(page.getByRole('heading', {level: 1})).toHaveText('RSAES-OAEP');
  expect(errors).toEqual([]);
});

test('problem routes reject nonexistent records and keep Chinese interface labels separate from source text', async ({page}) => {
  for (const path of ['problems/missing', 'problems/ml-kem', 'algorithms/lwe']) {
    await page.goto('/#/asymmetric-cryptanalysis/' + path);
    await expect(page.getByRole('heading', {level: 1})).toHaveText('Record Not Found');
  }
  await page.goto('/#/asymmetric-cryptanalysis/problems/lwe/extra');
  await expect(page.getByRole('heading', {level: 1})).toHaveText('Page Not Found');
  await page.goto('/#/asymmetric-cryptanalysis/problems/lwe');
  await page.getByRole('button', {name: 'Language', exact: true}).click();
  await page.getByRole('button', {name: '简体中文', exact: true}).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', {name: '问题形式', exact: true})).toBeVisible();
  await expect(page.locator('.atlas-problem-formulations dt')).toHaveText(['搜索', '判定']);
  await expect(page.locator('.atlas-primitive-specs h3')).toContainText('On Lattices, Learning with Errors, Random Linear Codes, and Cryptography');
});

test('an asymmetric instance and its figure downloads survive a Pages project subpath and refresh', async ({page}) => {
  const prefix = '/CryptoFrontierAtlas';
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**' + prefix + '/**', async route => {
    const url = new URL(route.request().url());
    const response = await page.request.get(url.origin + url.pathname.slice(prefix.length) + url.search);
    await route.fulfill({response});
  });
  await page.goto(prefix + '/#/asymmetric-cryptanalysis/algorithms/ml-kem/ml-kem-768');
  await expect(page.getByRole('heading', {level: 1})).toHaveText('ML-KEM-768');
  const image = page.locator('.atlas-structure-image img');
  await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0)).toBe(true);
  expect(new URL(await image.evaluate((element: HTMLImageElement) => element.currentSrc)).pathname)
    .toBe(prefix + '/figures/primitives/ml-kem-768--overview.svg');
  await page.locator('.atlas-structure-sources summary').click();
  for (const [label, extension] of [['Download SVG', 'svg'], ['Download LaTeX', 'tex']]) {
    const href = await page.getByRole('link', {name: label, exact: true}).evaluate((element: HTMLAnchorElement) => element.href);
    expect(new URL(href).pathname).toBe(prefix + '/figures/primitives/ml-kem-768--overview.' + extension);
    const response = await page.request.get(new URL(href).pathname.slice(prefix.length));
    expect(response.ok()).toBe(true);
    expect(await response.text()).toContain(extension === 'svg' ? '<svg' : '\u005cbegin{tikzpicture}');
  }
  await page.reload();
  await expect(page.getByRole('heading', {level: 1})).toHaveText('ML-KEM-768');
  await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0)).toBe(true);
  expect(errors).toEqual([]);
});

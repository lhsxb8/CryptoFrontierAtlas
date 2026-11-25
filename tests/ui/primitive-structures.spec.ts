import {test, expect} from '@playwright/test';
import catalog from '../../data/primitives/catalog.json' with {type: 'json'};
import diagrams from '../../data/primitives/diagrams.json' with {type: 'json'};

test.use({locale: 'en-US'});

test('all family and instance diagrams load both views with source and download metadata', async ({page, request}) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const definition of diagrams.diagrams) {
    for (const target of [definition.family_id, ...definition.instance_ids]) {
      const suffix = target === definition.family_id ? '' : '/' + target;
      await page.goto(`/#/cryptanalysis/ciphers/${definition.family_id}${suffix}`);
      const panel = page.locator('.atlas-structure');
      // Families with analyses keep their existing default-instance route.
      const renderedTarget = target === 'aes' ? 'aes-128' : target;
      await expect(panel).toHaveAttribute('data-structure-target', renderedTarget);
      for (const view of definition.views) {
        await panel.getByRole('tab', {name: view.label.en, exact: true}).click();
        const image = panel.locator('.atlas-structure-image img');
        await expect(image).toHaveAttribute('src', new RegExp(`${renderedTarget}--${view.id}\.svg$`));
        await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0)).toBe(true);
        await expect(panel.locator('figcaption')).toContainText(view.caption.en);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
    }
  }
  const response = await request.get('/atlas-diagrams.json');
  const metadata = await response.json();
  expect(metadata.manifest.assets).toHaveLength(3 * (catalog.instances.length + catalog.primitives.length));
  expect(errors).toEqual([]);
});

test('structure tabs, collapse, modal, keyboard focus and downloads are usable', async ({page, request}) => {
  await page.goto('/#/cryptanalysis/ciphers/aes/aes-256');
  const panel = page.locator('.atlas-structure');
  await panel.getByRole('tab', {name: 'Encryption', exact: true}).focus();
  await page.keyboard.press('ArrowRight');
  await expect(panel.getByRole('tab', {name: 'Round & key schedule'})).toBeFocused();
  await expect(panel.getByRole('tab', {name: 'Round & key schedule'})).toHaveAttribute('aria-selected', 'true');
  await panel.getByRole('button', {name: 'Enlarge diagram'}).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('img')).toHaveAttribute('src', /aes-256--detail\.svg$/);
  await dialog.getByRole('button', {name: 'Zoom in', exact: true}).click();
  await expect(dialog.locator('.atlas-structure-zoom')).toHaveClass(/is-zoomed/);
  const download = await dialog.getByRole('link', {name: 'Download LaTeX'}).getAttribute('href');
  const source = await (await request.get(download!)).text();
  expect(source).toContain('\u005cnewcommand{\u005cAtlasKeyBits}{256}');
  expect(source).toContain('\u005cnewcommand{\u005cAtlasKeyWords}{8}');
  expect(source).toContain('\u005cbegin{tikzpicture}');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(panel.getByRole('button', {name: 'Enlarge diagram'})).toBeFocused();
  await panel.getByRole('button', {name: 'Collapse structure'}).click();
  await expect(panel.getByRole('tab')).toHaveCount(0);
  await panel.getByRole('button', {name: 'Show structure'}).click();
  await expect(panel.getByRole('tab', {name: 'Round & key schedule'})).toHaveAttribute('aria-selected', 'true');
  await panel.locator('summary').click();
  await expect(panel).toContainText(definitionLocator('aes'));
  await expect(panel.getByRole('link', {name: 'Daemen and Rijmen', exact: false})).toBeVisible();
});

function definitionLocator(id: string) { return diagrams.diagrams.find(d => d.family_id === id)!.locator; }

test('instance selection changes exact bindings and family views use one shared diagram', async ({page}) => {
  await page.goto('/#/cryptanalysis/ciphers/sha3');
  await expect(page.locator('.atlas-structure')).toHaveCount(1);
  await expect(page.locator('.atlas-instance-table tbody tr')).toHaveCount(4);
  await page.locator('.atlas-primitive-navigation').getByRole('link', {name: 'SHA3-256', exact: true}).click();
  await expect(page.locator('.atlas-structure')).toHaveAttribute('data-structure-target', 'sha3-256');
  await expect(page.locator('.atlas-structure-parameters')).toContainText('1088 bits');
  await page.locator('.atlas-primitive-navigation').getByRole('link', {name: 'SHA3-512', exact: true}).click();
  await expect(page.locator('.atlas-structure')).toHaveAttribute('data-structure-target', 'sha3-512');
  await expect(page.locator('.atlas-structure-parameters')).toContainText('576 bits');
  await expect(page.locator('.atlas-structure-image img')).toHaveAttribute('src', /sha3-512--overview/);
});

test('narrow Chinese pages preserve layout and expose figure controls', async ({page}) => {
  await page.setViewportSize({width: 320, height: 700});
  await page.goto('/#/cryptanalysis/ciphers/ascon-aead/ascon-aead128');
  await page.getByRole('button', {name: 'Language', exact: true}).click();
  await page.getByRole('button', {name: '简体中文', exact: true}).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', {name: '结构', exact: true})).toBeVisible();
  await expect.poll(() => page.locator('.atlas-structure-image img').evaluate((image: HTMLImageElement) => image.currentSrc)).toMatch(/overview-compact\.svg$/);
  await page.getByRole('tab', {name: '置换轮函数', exact: true}).click();
  await expect(page.locator('.atlas-structure figcaption')).toContainText('五个 64 比特状态字');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(321);
  await page.getByRole('button', {name: '放大结构图'}).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', {name: '放大结构图'})).toBeFocused();
});

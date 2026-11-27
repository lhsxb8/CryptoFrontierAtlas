import {test, expect} from '@playwright/test';
import catalog from '../../data/primitives/catalog.json' with {type: 'json'};
import diagrams from '../../data/primitives/diagrams.json' with {type: 'json'};
import {titleCaseLabel} from '../../src/app/interface-labels';

test.use({locale: 'en-US'});

test('all family and instance diagrams load their registered views and metadata', async ({page, request}) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const definition of diagrams.diagrams.filter(d => d.review.status === 'source_checked')) {
    for (const target of [definition.family_id, ...definition.instance_ids]) {
      const suffix = target === definition.family_id ? '' : '/' + target;
      const family = catalog.primitives.find(p => p.id === definition.family_id)!;
      const domain = catalog.categories.find(c => c.id === family.category)!.domain;
      const prefix = domain === 'asymmetric' ? '/asymmetric-cryptanalysis/algorithms' : '/cryptanalysis/ciphers';
      await page.goto(`/#${prefix}/${definition.family_id}${suffix}`);
      const panel = page.locator('.atlas-structure');
      // Families with analyses keep their existing default-instance route.
      const analysisFamilies = ['aes', 'aes-dm', 'aes-mmo', 'aes-mp'];
      const renderedTarget = analysisFamilies.includes(target) ? definition.instance_ids[0] : target;
      await expect(panel).toHaveAttribute('data-structure-target', renderedTarget);
      for (const view of definition.views) {
        if (definition.views.length > 1) await panel.getByRole('tab', {name: titleCaseLabel(view.label.en), exact: true}).click({timeout: 10_000});
        else await expect(panel.getByRole('tab')).toHaveCount(0);
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
  expect(metadata.manifest.assets).toHaveLength(diagrams.diagrams.reduce((sum, d) =>
    sum + (d.instance_ids.length + 1) * (d.views.length + ('compact_template' in d ? 1 : 0)), 0));
  expect(errors).toEqual([]);
});

test('structure tabs, collapse, modal, keyboard focus and downloads are usable', async ({page, request}) => {
  await page.goto('/#/cryptanalysis/ciphers/aes/aes-256');
  const panel = page.locator('.atlas-structure');
  await panel.getByRole('tab', {name: 'Encryption', exact: true}).focus();
  await page.keyboard.press('ArrowRight');
  await expect(panel.getByRole('tab', {name: 'Round & Key Schedule'})).toBeFocused();
  await expect(panel.getByRole('tab', {name: 'Round & Key Schedule'})).toHaveAttribute('aria-selected', 'true');
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
  await expect(panel.getByRole('tab', {name: 'Round & Key Schedule'})).toHaveAttribute('aria-selected', 'true');
  await panel.locator('summary').click();
  await expect(panel).toContainText(definitionLocator('aes'));
  await expect(panel.getByRole('link', {name: 'Daemen and Rijmen', exact: false})).toBeVisible();
});

function definitionLocator(id: string) { return diagrams.diagrams.find(d => d.family_id === id)!.locator; }

test('single-view structures keep accessible enlargement in the heading without an empty toolbar', async ({page}) => {
  await page.goto('/#/asymmetric-cryptanalysis/algorithms/xdh/x25519');
  const panel = page.locator('.atlas-structure');
  await expect(panel).toHaveClass(/is-single-view/);
  await expect(panel.locator('.atlas-structure-toolbar, [role=tablist]')).toHaveCount(0);
  const enlarge = panel.getByRole('button', {name: 'Enlarge diagram', exact: true});
  await expect(panel.locator('.atlas-structure-heading').getByRole('button', {name: 'Enlarge diagram'})).toBeVisible();
  await enlarge.click();
  await expect(page.getByRole('dialog').locator('img')).toHaveAttribute('src', /x25519--overview\.svg$/);
  await page.keyboard.press('Escape');
  await expect(enlarge).toBeFocused();
  await panel.getByRole('button', {name: 'Collapse structure', exact: true}).click();
  await expect(enlarge).toHaveCount(0);
  await panel.getByRole('button', {name: 'Show structure', exact: true}).click();
  await expect(enlarge).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
});

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

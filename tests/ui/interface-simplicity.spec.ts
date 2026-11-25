import {test, expect} from '@playwright/test';

test.use({locale: 'en-US'});

test('home presents a visible masthead and four concise entrances with primary and planned hierarchy', async ({page}) => {
  for (const width of [1440, 768, 375, 320]) {
    await page.setViewportSize({width, height: 900});
    await page.goto('/#/');
    const cards = page.locator('.atlas-portal-card');
    await expect(cards).toHaveCount(4);
    await expect(cards.locator('h2')).toHaveText(['Open questions', 'Symmetric cryptanalysis', 'Asymmetric cryptanalysis', 'Implementation']);
    await expect(page.locator('main p, .atlas-portal-count, .atlas-portal-action, main .atlas-kicker')).toHaveCount(0);
    await expect(page.locator('main h1')).toHaveText('CryptoFrontierAtlas');
    await expect(page.locator('main h1')).toBeVisible();
    await expect(page.locator('.atlas-portal-heading')).toHaveText('CryptoFrontierAtlas');
    await expect(page.locator('.atlas-portal-heading > :not(h1)')).toHaveCount(0);
    await expect(cards.locator('.atlas-tbd')).toHaveCount(2);
    const geometry = await cards.evaluateAll(elements => elements.map(element => ({height: element.getBoundingClientRect().height, overflow: element.scrollWidth > element.clientWidth + 1})));
    expect(geometry.every(card => !card.overflow)).toBe(true);
    expect(Math.min(...geometry.slice(0, 2).map(card => card.height))).toBeGreaterThan(Math.max(...geometry.slice(2).map(card => card.height)) + 50);
    const illustrations = cards.locator('img.atlas-collection-art[aria-hidden="true"]');
    await expect(illustrations).toHaveCount(4);
    expect(new Set(await illustrations.evaluateAll(images => images.map(image => image.getAttribute('src')))).size).toBe(4);
    await expect(cards.locator('.atlas-portal-icon')).toHaveCount(0);
    for (const card of await cards.all()) {
      const illustration = card.locator('img.atlas-collection-art');
      await expect(illustration).toHaveAttribute('alt', '');
      await expect(illustration).toHaveJSProperty('naturalWidth', 1200);
      await expect(illustration).toHaveJSProperty('naturalHeight', 800);
      await expect(illustration).toHaveCSS('pointer-events', 'none');
      const separation = await card.evaluate(element => {
        const image = element.querySelector('img')!;
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const context = canvas.getContext('2d')!;
        context.drawImage(image, 0, 0);
        const rgba = context.getImageData(0, 0, canvas.width, canvas.height).data;
        let lastVisiblePixel = rgba.length / 4 - 1;
        while (lastVisiblePixel >= 0 && rgba[lastVisiblePixel * 4 + 3] <= 8) lastVisiblePixel--;
        const inkBottom = Math.floor(lastVisiblePixel / canvas.width) + 1;
        const imageBox = image.getBoundingClientRect();
        const scale = Math.min(imageBox.width / canvas.width, imageBox.height / canvas.height);
        const verticalOffset = (imageBox.height - canvas.height * scale) / 2;
        return element.querySelector('h2')!.getBoundingClientRect().top - (imageBox.top + verticalOffset + inkBottom * scale);
      });
      expect(separation).toBeGreaterThan(8);
    }
    const implementation = cards.locator('h2').filter({hasText: /^Implementation$/});
    expect(await implementation.evaluate(element => element.getBoundingClientRect().height <= parseFloat(getComputedStyle(element).lineHeight) + 1)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
  }
});

test('global dialogs omit redundant descriptions and expose version provenance on demand', async ({page, request}) => {
  const metadata = await (await request.get('/atlas-release.json')).json();
  await page.goto('/#/');
  await expect(page.locator('.atlas-footer')).not.toContainText('Data revision');
  for (const name of ['Language', 'Help', 'Report']) {
    await page.getByRole('button', {name, exact: true}).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.locator('.atlas-dialog-heading p')).toHaveCount(0);
    expect(await dialog.getAttribute('aria-describedby')).toBeNull();
    await expect(dialog.getByRole('heading', {level: 2})).toBeVisible();
    if (name === 'Help') {
      const version = dialog.locator('.atlas-version-details');
      await expect(version).not.toHaveAttribute('open', '');
      await version.locator('summary').click();
      await expect(version.locator('code')).toHaveText(metadata.data_revision);
      await expect(version.locator('code')).toBeVisible();
      await expect(dialog).toContainText('success events');
      await expect(dialog).toContainText('CPA: chosen plaintext');
    }
    if (name === 'Report') {
      await expect(dialog.getByRole('radio')).toHaveCount(5);
      await expect(dialog.locator('.atlas-submission-materials')).toContainText('success');
      await expect(dialog).toContainText('GitHub reports are public');
    }
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', {name, exact: true})).toBeFocused();
  }
});

test('directory and definitions retain standards and parameters without repeated introductions', async ({page}) => {
  await page.goto('/#/cryptanalysis');
  await expect(page.locator('.atlas-page-heading p, .atlas-family-card p, .atlas-section-bar > span')).toHaveCount(0);
  await page.getByRole('searchbox', {name: 'Search primitives and instances'}).fill('Triple DES');
  await expect(page.locator('.atlas-family-card')).toContainText('Withdrawn');
  await page.locator('.atlas-family-card').click();
  await expect(page.locator('.atlas-primitive-specs .atlas-status-warning')).toBeVisible();
  await expect(page.locator('.atlas-primitive-specs .atlas-status-warning')).toContainText('2024-01-01');
  await expect(page.locator('.atlas-structure-parameters')).toHaveCount(0);
  await page.goto('/#/cryptanalysis/ciphers/sha3/sha3-256');
  await expect(page.locator('.atlas-page-heading p, .atlas-structure-heading p, .atlas-structure-edition')).toHaveCount(0);
  await expect(page.locator('.atlas-structure-parameters')).toContainText('1088 bits');
  await expect(page.locator('.atlas-structure-parameters')).toContainText('512 bits');
  const definition = page.locator('.atlas-instance-details');
  await expect(definition).not.toHaveAttribute('open', '');
  await expect(definition.locator('summary')).toHaveText('Definition');
  await definition.locator('summary').click();
  await expect(definition).toContainText('domain separation');
  await expect(definition.locator('.atlas-metadata')).toBeVisible();
  await page.locator('.atlas-structure-sources > summary').click();
  await expect(page.locator('.atlas-structure-sources a').first()).toBeVisible();
});

test('diagram scroll guidance follows actual overflow while scientific captions remain available', async ({page}) => {
  await page.setViewportSize({width: 320, height: 700});
  await page.goto('/#/cryptanalysis/ciphers/aes/aes-256');
  const panel = page.locator('.atlas-structure');
  await expect(panel.locator('.atlas-structure-scroll-hint')).toHaveCount(0);
  await expect(panel.locator('figcaption')).toContainText('final round omits MixColumns');
  await panel.getByRole('tab', {name: 'Round & key schedule', exact: true}).click();
  await expect(panel.locator('.atlas-structure-scroll-hint')).toBeVisible();
  expect(await panel.locator('.atlas-structure-image').evaluate(element => element.scrollWidth > element.clientWidth)).toBe(true);
  await expect(panel.locator('figcaption')).toContainText('extra SubWord');
  await page.setViewportSize({width: 1440, height: 1000});
  await expect(panel.locator('.atlas-structure-scroll-hint')).toHaveCount(0);
  await panel.getByRole('button', {name: 'Enlarge diagram'}).click();
  const dialog = page.getByRole('dialog');
  const description = await dialog.getAttribute('aria-describedby');
  expect(description).toBeTruthy();
  await expect(dialog.locator('[id="' + description + '"]')).toContainText('extra SubWord');
  await page.keyboard.press('Escape');
  await expect(panel.getByRole('button', {name: 'Enlarge diagram'})).toBeFocused();
});

import {test, expect} from '@playwright/test';
import catalog from '../../data/primitives/catalog.json' with {type: 'json'};

test.use({locale: 'en-US'});

test('chapter headings and primitive names have distinct type roles in a responsive directory', async ({page}) => {
  const directories = [
    {domain: 'symmetric', path: '/cryptanalysis', heading: 'Block Ciphers'},
    {domain: 'asymmetric', path: '/asymmetric-cryptanalysis', heading: 'Hard Problems'},
  ];
  for (const directory of directories) {
    const categories = catalog.categories.filter(category => category.domain === directory.domain);
    const families = catalog.primitives.filter(family => categories.some(category => category.id === family.category));
    const entryCount = families.length + (directory.domain === 'asymmetric' ? catalog.hard_problems.length : 0);
    for (const width of [1440, 768, 375, 320]) {
      await page.setViewportSize({width, height: 900});
      await page.goto('/#' + directory.path);
      await page.getByRole('heading', {name: directory.heading, exact: true}).waitFor();
      await expect(page.locator('.atlas-family-group h2').first()).toHaveText(directory.heading);
      await page.evaluate(() => document.fonts.ready);
      const typography = await page.locator('.atlas-family-group').first().evaluate(section => {
        const chapter = getComputedStyle(section.querySelector('h2')!);
        const entry = getComputedStyle(section.querySelector('h3')!);
        return {chapterFont: chapter.fontFamily, entryFont: entry.fontFamily, chapterSize: parseFloat(chapter.fontSize), entrySize: parseFloat(entry.fontSize)};
      });
      expect(typography.chapterFont).toContain('Atlas Source Serif');
      expect(typography.entryFont).not.toContain('Atlas Source Serif');
      expect(typography.chapterSize).toBeGreaterThan(typography.entrySize);
      expect(await page.evaluate(() => [...document.fonts].some(font => font.family.includes('Atlas Source Serif') && font.status === 'loaded'))).toBe(true);
      await expect(page.locator('.atlas-directory-toolbar [role=status] strong')).toHaveText(String(entryCount));
      await expect(page.locator('.atlas-family-card')).toHaveCount(entryCount);
      const single = page.locator('.atlas-family-grid.is-single').first();
      expect(await single.evaluate(element => getComputedStyle(element).gridTemplateColumns.split(' ').length)).toBe(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
    }
  }
});

test('mobile navigation is a labelled disclosure with keyboard, route and breakpoint recovery', async ({page}) => {
  await page.setViewportSize({width: 375, height: 850});
  await page.goto('/#/');
  const toggle = page.getByRole('button', {name: 'Primary Navigation', exact: true});
  const nav = page.getByRole('navigation', {name: 'Primary Navigation', exact: true});
  await expect(toggle).toContainText('Home');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(nav).toBeHidden();
  expect((await page.locator('.atlas-header').boundingBox())!.height).toBeLessThan(140);
  await toggle.focus(); await page.keyboard.press('Enter');
  await expect(nav.getByRole('link')).toHaveCount(5);
  await page.keyboard.press('Tab');
  await expect(nav.getByRole('link', {name: 'Home', exact: true})).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(nav).toBeHidden(); await expect(toggle).toBeFocused();
  await toggle.click();
  await nav.getByRole('link', {name: 'Symmetric Cryptanalysis', exact: true}).click();
  await expect(page).toHaveURL(/#\/cryptanalysis$/);
  await expect(page.locator('main h1')).toBeFocused();
  await expect(toggle).toContainText('Symmetric Cryptanalysis');
  await expect(nav).toBeHidden();
  await toggle.click();
  await page.locator('main h1').click();
  await expect(nav).toBeHidden();
  await toggle.click();
  await page.setViewportSize({width: 1440, height: 900});
  await expect(nav).toBeVisible(); await expect(toggle).toBeHidden();
  await expect(nav.getByRole('link', {name: 'Symmetric Cryptanalysis', exact: true})).toBeFocused();
  await page.setViewportSize({width: 375, height: 850});
  await expect(nav).toBeHidden(); await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(toggle).toBeFocused();
  await page.locator('main h1').focus();
  await page.setViewportSize({width: 1440, height: 900});
  await expect(nav).toBeVisible();
  await expect(page.locator('main h1')).toBeFocused();
  await page.setViewportSize({width: 375, height: 850});
  await expect(nav).toBeHidden();
  await expect(page.locator('main h1')).toBeFocused();
});

test('Chinese narrow headings, status badges and long primitive names retain readable hierarchy', async ({page}) => {
  await page.setViewportSize({width: 320, height: 850});
  await page.goto('/#/cryptanalysis');
  await page.getByRole('button', {name: 'Language', exact: true}).click();
  await page.getByRole('button', {name: '简体中文', exact: true}).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', {name: '分组密码', exact: true})).toBeVisible();
  const sizes = await page.locator('.atlas-family-group').first().evaluate(element => ['h2','h3'].map(tag => parseFloat(getComputedStyle(element.querySelector(tag)!).fontSize)));
  expect(sizes[0]).toBeGreaterThan(sizes[1]);
  await expect(page.locator('.atlas-family-card .atlas-status-warning')).toHaveText('已撤回');
  const longName = page.getByRole('heading', {name: 'ChaCha20-Poly1305', exact: true});
  await expect(longName).toBeVisible();
  expect(await longName.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(321);
});

test('the title font and its license are served locally without external font requests', async ({page, request}) => {
  const remoteFonts: string[] = [];
  page.on('request', request => {
    if (request.resourceType() === 'font' && new URL(request.url()).origin !== new URL(page.url()).origin) remoteFonts.push(request.url());
  });
  await page.goto('/#/');
  await page.evaluate(() => document.fonts.ready);
  const font = await request.get('/fonts/source-serif/SourceSerif4-Semibold.otf.woff2');
  expect(font.ok()).toBe(true);
  expect((await font.body()).subarray(0, 4).toString()).toBe('wOF2');
  const license = await request.get('/fonts/source-serif/LICENSE.md');
  expect(await license.text()).toContain('SIL OPEN FONT LICENSE Version 1.1');
  expect(remoteFonts).toEqual([]);
});

test('font fallback and reduced motion retain usable narrow entrances', async ({page}) => {
  await page.setViewportSize({width: 320, height: 850});
  await page.emulateMedia({reducedMotion: 'reduce'});
  await page.route('**/fonts/source-serif/**', route => route.abort());
  await page.goto('/#/');
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('main h1')).toBeVisible();
  await expect(page.locator('.atlas-portal-card')).toHaveCount(4);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(321);
  await expect(page.locator('.atlas-portal-card').first()).toHaveCSS('transition-duration', '0s');
  await page.locator('.atlas-portal-card').first().hover();
  await expect(page.locator('.atlas-portal-card').first().locator('img')).toHaveCSS('transform', 'none');
  await page.locator('.atlas-portal-card[href="#/cryptanalysis"]').click();
  await expect(page.getByRole('heading', {name: 'Block Ciphers', exact: true})).toBeVisible();
});

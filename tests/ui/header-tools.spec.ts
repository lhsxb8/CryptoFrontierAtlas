import { test, expect } from '@playwright/test';
import project from '../../project.config.json' with {type:'json'};

test.use({ locale: 'en-US' });
const publicBase = process.env.ATLAS_UI_BASE_URL || 'http://127.0.0.1:4173';

test('three global tools are available, with one modal and restored focus', async ({ page }) => {
  await page.goto('/#/');
  const tools = page.locator('.atlas-header-tools');
  await expect(tools.getByRole('button')).toHaveCount(3);
  for (const name of ['Language', 'Help', 'Report']) {
    const trigger = tools.getByRole('button', { name, exact: true });
    await expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
    await trigger.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toHaveCount(1);
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
  const navigationToggle = page.getByRole('button', {name: 'Primary navigation', exact: true});
  if (await navigationToggle.isVisible()) await navigationToggle.click();
  for (const link of await page.locator('.atlas-primary-nav a').all()) {
    const box = await link.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
  }
});

test('language changes preserve the route and persist through reload', async ({ page }) => {
  await page.goto('/#/?q=keep-this');
  const originalUrl = page.url();
  await page.getByRole('button', { name: 'Language', exact: true }).click();
  await page.getByRole('button', { name: '简体中文', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
  await expect(page.getByRole('button', { name: '简体中文', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '关闭弹窗', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('CryptoFrontierAtlas');
  const navigationToggle = page.getByRole('button', {name: '主导航', exact: true});
  if (await navigationToggle.isVisible()) await navigationToggle.click();
  await expect(page.getByRole('navigation', { name: '主导航' }).getByRole('link')).toHaveText(['主页', '开放问题', '对称密码分析', '非对称密码分析TBD', '实现TBD']);
  expect(page.url()).toBe(originalUrl);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('CryptoFrontierAtlas');
  await page.getByRole('button', { name: 'Report', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '贡献与反馈', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '语言', exact: true }).click();
  await page.getByRole('button', { name: 'English', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('CryptoFrontierAtlas');
});

test('report routes use the configured repository or show the pending state', async ({ page }) => {
  await page.goto('/#/questions?private-filter=local-only');
  await page.getByRole('button', { name: 'Report', exact: true }).click();
  const dialog = page.getByRole('dialog');
  for (const [name, template] of [
    ['Accepted / published paper', 'accepted-paper.yml'],
    ['Lean formalization', 'lean-formalization.yml'],
    ['Preprint', 'preprint.yml'],
    ['Data correction / missing result', 'data-correction.yml'],
    ['Website bug / feature suggestion', 'website-feedback.yml'],
  ]) {
    await dialog.getByRole('radio', { name: new RegExp('^' + name.replaceAll('/', '\\/')) }).check();
    if (!project.repository) {
      await expect(dialog.getByRole('status')).toContainText('public repository is configured');
      await expect(dialog.getByRole('link', { name: 'Continue on GitHub', exact: true })).toHaveCount(0);
      continue;
    }
    const link = dialog.getByRole('link', { name: 'Continue on GitHub', exact: true });
    const url = new URL((await link.getAttribute('href'))!);
    expect(url.origin).toBe('https://github.com');
    expect([...url.searchParams]).toEqual([['template', template]]);
    expect(url.toString()).not.toContain('local-only');
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', 'noreferrer');
    await expect(link).toBeInViewport();
  }
  await expect(dialog).toContainText('GitHub reports are public');
  await expect(dialog.locator('.atlas-submission-materials')).toContainText('Page and reproduction steps');
  const box = await dialog.boundingBox();
  expect(box!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  expect(box!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  expect(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth)).toBeTruthy();
});

test('modal keyboard focus is contained and Help can open Report', async ({ page }) => {
  await page.goto('/#/');
  await page.getByRole('button', { name: 'Help', exact: true }).click();
  let dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Time, data, memory and preprocessing');
  for (let index = 0; index < 6; index++) {
    await page.keyboard.press('Tab');
    expect(await dialog.evaluate(node => node.contains(document.activeElement))).toBeTruthy();
  }
  await dialog.locator('.atlas-dialog-body').evaluate(node => { node.scrollTop = node.scrollHeight; });
  await expect(dialog.getByRole('button', { name: 'Close dialog', exact: true })).toBeInViewport();
  await dialog.getByRole('button', { name: 'Report', exact: true }).click();
  dialog = page.getByRole('dialog', { name: 'Contribute & report', exact: true });
  await expect(dialog).toBeVisible();
  await expect(page.locator('dialog[open]')).toHaveCount(1);
  await dialog.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Help', exact: true })).toBeFocused();
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('');
});

test('public home offers reporting routes without exposing result tables on the portal', async ({ page }) => {
  await page.goto(publicBase + '/#/');
  await expect(page.locator('.atlas-build-badge')).toHaveCount(0);
  await expect(page.locator('.atlas-primary-nav svg')).toHaveCount(0);
  await expect(page.locator('.atlas-portal-card')).toHaveCount(4);
  await expect(page.locator('main p')).toHaveCount(0);
  await page.getByRole('button', { name: 'Report', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('radio')).toHaveCount(5);
  await expect(page.locator('a[href^="#/cryptanalysis/results/"]')).toHaveCount(0);
});

test('published analysis evidence routes expose sources and preserve scientific text when navigation changes language', async ({page}) => {
  await page.goto('/#/cryptanalysis/sources');
  await expect(page.getByRole('heading', {level:1})).toHaveText('Analysis sources');
  await expect(page.locator('.atlas-source-card').first()).toBeVisible();
  await page.getByRole('button', {name:'Language', exact:true}).click();
  await page.getByRole('button', {name:'简体中文', exact:true}).click();
  await page.keyboard.press('Escape');
  await expect(page.locator('.atlas-source-card').first()).toBeVisible();
  expect(await page.locator('main').getAttribute('lang')).toBe('en');
  await page.getByRole('button', {name:'Report', exact:true}).click();
  await expect(page.getByRole('dialog').getByRole('radio')).toHaveCount(5);
});

test('language switching works without browser storage', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(Storage.prototype, 'getItem', { value() { throw new DOMException('Unavailable', 'SecurityError'); } });
    Object.defineProperty(Storage.prototype, 'setItem', { value() { throw new DOMException('Unavailable', 'SecurityError'); } });
  });
  await page.goto('/#/');
  await page.getByRole('button', { name: 'Language', exact: true }).click();
  await page.getByRole('button', { name: '简体中文', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('CryptoFrontierAtlas');
});

test('compact layouts keep all three tools and both languages inside the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('/#/');
  await expect(page.locator('.atlas-header-tools > button')).toHaveCount(3);
  for (const button of await page.locator('.atlas-header-tools > button').all()) await expect(button).toBeInViewport();
  await page.getByRole('button', { name: 'Language', exact: true }).click();
  await page.getByRole('button', { name: '简体中文', exact: true }).click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Report', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('radio')).toHaveCount(5);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
  for (const name of ['数据纠错／遗漏', '网站问题／功能建议']) {
    await page.getByRole('dialog').getByRole('radio', {name, exact: true}).check();
    await expect(page.getByRole('dialog').getByRole('radio', {name, exact: true})).toBeChecked();
  }
  await expect(page.getByRole('button', { name: '关闭弹窗', exact: true })).toBeInViewport();
  if (project.repository) await expect(page.getByRole('link', { name: '前往 GitHub 填写', exact: true })).toBeInViewport();
  else await expect(page.getByRole('status')).toContainText('配置公开仓库地址');
});

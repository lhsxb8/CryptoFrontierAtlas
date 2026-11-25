import {test, expect} from '@playwright/test';

test.use({locale:'en-US'});

test('public questions render mathematical statements and preserve detail routes', async ({page}) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/#/questions/carlet-13-3-14-affine-derivatives');
  await expect(page.getByRole('heading', {level:1})).toBeVisible();
  await expect(page.locator('.katex').first()).toBeVisible();
  await expect(page.locator('.katex-error')).toHaveCount(0);
  const route = page.url();
  await page.reload();
  expect(page.url()).toBe(route);
  await expect(page.getByRole('heading', {level:1})).toBeVisible();
  await expect(page.locator('.katex').first()).toBeVisible();
  expect(errors).toEqual([]);
});

test('the public reporting guide and license assets are served by the build', async ({request}) => {
  for (const file of ['LICENSE','LICENSE-DATA.md','LICENSE-CC-BY-4.0.txt','THIRD_PARTY_NOTICES.txt','docs/result-submissions.md','data/cryptanalysis-public/README.md']) {
    const response = await request.get('/' + file);
    expect(response.ok()).toBeTruthy();
    expect(await response.text()).not.toContain('<div id="root">');
  }
});

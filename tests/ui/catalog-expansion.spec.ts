import {test, expect} from '@playwright/test';

test.use({locale: 'en-US'});

test('new block, stream and hash instances retain their exact parameters and empty analysis state', async ({page}) => {
  test.setTimeout(90_000);
  const blocks = [
    ['sm4', 'sm4-128', 128, 128, 32],
    ['camellia', 'camellia-128', 128, 128, 18], ['camellia', 'camellia-192', 192, 128, 24], ['camellia', 'camellia-256', 256, 128, 24],
    ['aria', 'aria-128', 128, 128, 12], ['aria', 'aria-192', 192, 128, 14], ['aria', 'aria-256', 256, 128, 16],
    ['seed', 'seed-128', 128, 128, 16], ['present', 'present-80', 80, 64, 31], ['present', 'present-128', 128, 64, 31],
  ] as const;
  for (const [family, id, key, block, rounds] of blocks) {
    await page.goto(`/#/cryptanalysis/ciphers/${family}/${id}`);
    await expect(page.locator('.atlas-structure')).toHaveAttribute('data-structure-target', id);
    const parameters = page.locator('.atlas-structure-parameters dl');
    await expect(parameters).toHaveText(`Key material${key} bitsBlock size${block} bitsRounds${rounds}`);
    await expect(page.locator('.atlas-catalog-empty')).toContainText('No catalogued results');
    await expect(page.locator('.a-selection-bar, .a-attack-table')).toHaveCount(0);
  }
  for (const [family, id, output, steps] of [['sm3', 'sm3-256', 256, 64], ['sha1', 'sha-1', 160, 80], ['md5', 'md5-128', 128, 64]] as const) {
    await page.goto(`/#/cryptanalysis/ciphers/${family}/${id}`);
    await expect(page.locator('.atlas-structure-parameters dl')).toHaveText(`Output${output} bitsState size${output} bitsBlock size512 bitsCompression steps${steps}`);
    await expect(page.locator('.atlas-structure-parameters')).not.toContainText('Key material');
    await expect(page.locator('.atlas-catalog-empty')).toContainText('No catalogued results');
  }
  for (const key of [128, 256]) {
    await page.goto(`/#/cryptanalysis/ciphers/salsa20/salsa20-${key}`);
    await expect(page.locator('.atlas-structure-parameters dl')).toHaveText(`Key material${key} bitsNonce64 bitsCounter64 bitsState size512 bitsRounds20Keystream block512 bits`);
    await expect(page.locator('.atlas-structure figcaption')).toContainText('column/row');
    await expect(page.locator('.atlas-catalog-empty')).toContainText('No catalogued results');
  }
});

test('Chinese aliases find SM3 and SM4 and open their source-bound diagrams', async ({page}) => {
  await page.goto('/#/cryptanalysis');
  const search = page.getByRole('searchbox', {name: 'Search primitives and instances'});
  await search.fill('国密');
  await expect(page.locator('.atlas-family-card h3')).toHaveText(['SM4', 'SM3']);
  await search.fill('SMS4');
  await page.locator('.atlas-family-card').click();
  await page.locator('.atlas-primitive-navigation').getByRole('link', {name: 'SM4', exact: true}).click();
  await expect(page.locator('.atlas-structure')).toHaveAttribute('data-structure-target', 'sm4-128');
  await expect(page.locator('.atlas-structure figcaption')).toContainText('reverses word order');
  await page.getByRole('tab', {name: 'Round & key schedule', exact: true}).click();
  await expect(page.locator('.atlas-structure figcaption')).toContainText('different linear maps');
  await page.goto('/#/cryptanalysis?q=国密SM3');
  await page.locator('.atlas-family-card').click();
  await page.locator('.atlas-primitive-navigation').getByRole('link', {name: 'SM3', exact: true}).click();
  await expect(page.locator('.atlas-structure figcaption')).toContainText('Feed-forward uses XOR');
  await page.locator('.atlas-structure-sources summary').click();
  await expect(page.locator('.atlas-structure-sources')).toContainText('GB/T 32905-2016');
});

test('new family comparisons preserve key-dependent rounds and instance-specific drawings', async ({page, request}) => {
  for (const [family, count] of [['camellia', 3], ['aria', 3], ['present', 2], ['salsa20', 2]] as const) {
    await page.goto(`/#/cryptanalysis/ciphers/${family}`);
    await expect(page.locator('.atlas-instance-table tbody tr')).toHaveCount(count);
    await expect(page.locator('.atlas-structure')).toHaveAttribute('data-structure-target', family);
  }
  for (const [id, rounds, groups] of [['camellia-128', 18, 2], ['camellia-256', 24, 3]] as const) {
    await page.goto(`/#/cryptanalysis/ciphers/camellia/${id}`);
    await expect(page.locator('.atlas-structure-parameters dl')).toContainText(`Rounds${rounds}`);
    const source = await (await request.get(`/figures/primitives/${id}--overview.tex`)).text();
    expect(source).toContain(`\u005cnewcommand{\u005cAtlasFLGroups}{${groups}}`);
  }
});

test('historical hashes keep visible security context without being labelled withdrawn standards', async ({page}) => {
  for (const family of ['sha1', 'md5']) {
    await page.goto(`/#/cryptanalysis/ciphers/${family}`);
    await expect(page.locator('.atlas-structure figcaption')).toContainText(/collision resistance.*broken|broken collision resistance/);
    await expect(page.locator('.atlas-status-warning')).toHaveCount(0);
    await expect(page.locator('.atlas-catalog-empty')).toContainText('No catalogued results');
  }
});

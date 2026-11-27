import {test,expect} from '@playwright/test';
import catalog from '../../data/primitives/catalog.json' with {type:'json'};

test.use({locale:'en-US'});

test('expanded asymmetric overview stays bounded and global search paginates without omissions',async({page})=>{
  await page.goto('/#/asymmetric-cryptanalysis');
  await expect(page.getByRole('tab')).toHaveCount(0);
  const categories=catalog.categories.filter(c=>c.domain==='asymmetric');
  for(const c of categories){
    const count=c.id==='hard_problem'?catalog.hard_problems.length:catalog.primitives.filter(p=>p.category===c.id).length;
    await expect(page.locator(`[data-category="${c.id}"] .atlas-family-card`)).toHaveCount(Math.min(6,count));
  }
  await page.getByRole('link',{name:'View All Digital Signatures',exact:true}).click();
  await expect(page).toHaveURL(/primitive=digital_signature/);
  await expect(page.locator('.atlas-family-card h3').last()).toHaveText('DSA');
  await expect(page.locator('.atlas-family-card').last().getByRole('img',{name:/^Withdrawn Standard:/})).toBeVisible();
  await page.goto('/#/asymmetric-cryptanalysis?q=a');
  const total=Number(await page.locator('.atlas-directory-count strong').innerText());
  expect(total).toBeGreaterThan(24);
  const links:string[]=[];
  while(true){
    expect(await page.locator('.atlas-family-card').count()).toBeLessThanOrEqual(24);
    for(const group of await page.locator('.atlas-family-group').all())expect(await group.locator('.atlas-family-card').count()).toBeGreaterThan(0);
    links.push(...await page.locator('.atlas-family-card').evaluateAll(items=>items.map(a=>a.getAttribute('href')!)));
    const next=page.getByRole('button',{name:'Next',exact:true});if(await next.isDisabled())break;
    await next.click();await expect(page.getByRole('heading',{level:1})).toBeFocused();
  }
  expect(links.length).toBe(total);expect(new Set(links).size).toBe(total);
  await page.reload();await expect(page.getByRole('button',{name:'Next',exact:true})).toBeDisabled();
  await page.getByRole('searchbox').fill('sntrup761');
  await expect(page).not.toHaveURL(/[?&]page=/);
  await expect(page.locator('.atlas-family-card h3')).toHaveText(['NTRU Prime']);
});

test('only LOL2.0 is registered and its stream and AEAD profiles stay distinct',async({page})=>{
  expect(catalog.primitives.filter(p=>/^lol/i.test(p.id)).map(p=>p.id)).toEqual(['lol2','lol2-scmac']);
  await page.goto('/#/cryptanalysis?q=LOL');
  await expect(page.locator('.atlas-family-card')).toHaveCount(2);
  await page.goto('/#/cryptanalysis/ciphers/lol2/lol2-double-lfsr2');
  const stream=page.locator('.atlas-parameter-fallback');
  await expect(stream).toContainText('1280 bits');await expect(stream).toContainText('256 bits');
  await expect(stream).not.toContainText('Counter');
  await page.goto('/#/cryptanalysis/ciphers/lol2-scmac/lol2-double-scmac-128');
  const aead=page.locator('.atlas-parameter-fallback');
  for(const text of ['2048 bits','1280 bits','768 bits','128 bits','Authentication State'])await expect(aead).toContainText(text);
  await page.locator('.atlas-primitive-relations').getByRole('link',{name:'LOL2.0-Double (LFSR2)',exact:true}).click();
  await expect(page.getByRole('heading',{level:1})).toHaveText('LOL2.0-Double (LFSR2)');
  await page.goto('/#/cryptanalysis?q=Ublock');
  await expect(page.locator('.atlas-family-card h3')).toHaveText(['uBlock']);
  await page.locator('.atlas-family-card').click();await expect(page.locator('.atlas-instance-table tbody tr')).toHaveCount(3);
});

test('new profiles retain encoding distinctions and fit a narrow screen',async({page})=>{
  await page.setViewportSize({width:320,height:800});
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  for(const [family,id,values]of [
    ['hqc','hqc-1',['Seed','32 bytes','4433 bytes','17669']],
    ['frodo-kem','frodokem-640-aes',['9752 bytes','AES-128']],
    ['classic-mceliece','mceliece348864',['261120 bytes','96 bytes']],
    ['ntru-prime','sntrup761',['1158 bytes','1039 bytes']],
    ['bike','bike-l1-r4',['12323','1573 bytes']],
    ['falcon','falcon-512-padded',['Padded to Fixed Length','666 bytes']],
    ['xmssmt','xmssmt-sha2-40-4-256',['Stateful','Winternitz Base','40']],
    ['hss','hss-l2-sha256-h10-w8',['Stateful','Winternitz Digit Width']],
  ]){
    await page.goto(`/#/asymmetric-cryptanalysis/algorithms/${family}/${id}`);
    for(const value of values)await expect(page.locator('.atlas-parameter-fallback')).toContainText(value);
    await expect(page.locator('.a-attack-table,.a-selection-bar')).toHaveCount(0);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(321);
  }
  await page.goto('/#/asymmetric-cryptanalysis/algorithms/slh-dsa');
  await expect(page.locator('.atlas-instance-table tbody tr')).toHaveCount(12);
  await page.getByRole('combobox',{name:'All Instances'}).selectOption('slh-dsa-shake-256f');
  await expect(page.getByRole('heading',{level:1})).toHaveText('SLH-DSA-SHAKE-256f');
  await expect(page.locator('.atlas-structure-parameters')).toContainText('49856 bytes');
  expect(errors).toEqual([]);
});

test('parameterized classical and SM9 schemes have definitions and sources without invented instances',async({page})=>{
  for(const id of ['elgamal','rabin','paillier','cramer-shoup','ecies','mqv','hmqv','schnorr','bls','gost-3410','sm9-encryption','sm9-signature','sm9-key-exchange']){
    await page.goto('/#/asymmetric-cryptanalysis/algorithms/'+id);
    await expect(page.getByRole('heading',{name:'Parameterized Family',exact:true})).toBeVisible();
    await expect(page.locator('.atlas-parameter-fallback')).not.toHaveText('');
    await expect(page.locator('.atlas-instance-table,.atlas-structure,.atlas-structure-pending')).toHaveCount(0);
    expect(await page.locator('.atlas-primitive-specs a').count()).toBeGreaterThan(0);
  }
  await page.goto('/#/asymmetric-cryptanalysis?q=国密SM9');
  await expect(page.locator('.atlas-family-card')).toHaveCount(3);
});

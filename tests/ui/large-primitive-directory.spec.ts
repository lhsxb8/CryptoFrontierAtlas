import {test, expect} from '@playwright/test';
import catalog from '../../data/primitives/catalog.json' with {type:'json'};
import registry from '../../data/primitives/diagrams.json' with {type:'json'};

test.use({locale:'en-US'});

test('large directory previews categories, paginates completely and searches hidden instances',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/#/cryptanalysis');
  const categories=catalog.categories.filter(c=>c.domain==='symmetric');
  await expect(page.getByRole('navigation',{name:'Browse Categories'}).getByRole('link')).toHaveCount(categories.length);
  await expect(page.getByRole('tab')).toHaveCount(0);
  for(const category of categories){
    const group=page.locator(`[data-category="${category.id}"]`);
    const count=catalog.primitives.filter(p=>p.category===category.id).length;
    await expect(group.locator('.atlas-family-card')).toHaveCount(Math.min(count,6));
    await expect(group.locator('.atlas-group-count')).toHaveText(`${Math.min(count,6)} / ${count}`);
  }
  await page.getByRole('link',{name:'View All Block Ciphers',exact:true}).click();
  await expect(page).toHaveURL(/primitive=block_cipher/);
  const ids:string[]=[];
  while(true){
    ids.push(...await page.locator('.atlas-family-card').evaluateAll(links=>links.map(a=>a.getAttribute('href')!)));
    const next=page.getByRole('button',{name:'Next',exact:true});
    if(await next.isDisabled())break;
    await next.click();
    await expect(page.getByRole('heading',{level:1})).toBeFocused();
  }
  const blocks=catalog.primitives.filter(p=>p.category==='block_cipher');
  expect(new Set(ids).size).toBe(blocks.length);expect(ids.length).toBe(blocks.length);
  for(const family of blocks)expect(ids).toContain(`#/cryptanalysis/ciphers/${family.id}`);
  await page.reload();await expect(page.getByRole('button',{name:'Next',exact:true})).toBeDisabled();
  await page.getByRole('searchbox').fill('SIMON-128-256');
  await expect(page).not.toHaveURL(/[?&]page=/);
  await expect(page.locator('.atlas-family-card h3')).toHaveText(['SIMON']);
  await page.locator('.atlas-family-card').click();
  await page.getByRole('combobox',{name:'All Instances'}).selectOption('simon-128-256');
  await expect(page.getByRole('heading',{level:1})).toHaveText('SIMON-128-256');
  await expect(page.locator('.atlas-parameter-fallback')).toContainText('72');
  expect(errors).toEqual([]);
});

test('search reaches new and parameterized families without tabs or analysis controls',async({page})=>{
  for(const [query,name]of [['ARADI','ARADI'],['Groestl','Grøstl'],['MiMC','MiMC'],['KT256','KangarooTwelve']]){
    await page.goto('/#/cryptanalysis?q='+encodeURIComponent(query));
    await expect(page.locator('.atlas-family-card h3')).toHaveText([name]);
    await page.locator('.atlas-family-card').click();
    await expect(page.getByRole('heading',{level:1})).toHaveText(name);
    await expect(page.locator('.a-attack-table,.a-selection-bar')).toHaveCount(0);
  }
  await page.goto('/#/cryptanalysis?primitive=block_cipher&page=999999');
  await expect(page.getByRole('button',{name:'Next',exact:true})).toBeDisabled();
  await page.getByRole('combobox',{name:'Primitive Type',exact:true}).selectOption('stream_cipher');
  await expect(page).not.toHaveURL(/[?&]page=/);
  await page.getByRole('searchbox').fill('does-not-exist-123');
  await expect(page.getByRole('heading',{name:'No Matching Primitives'})).toBeVisible();
  await page.getByRole('button',{name:'Reset filters'}).click();
  await expect(page.getByRole('navigation',{name:'Browse Categories'})).toBeVisible();
  await page.goto('/#/cryptanalysis/ciphers/mimc');
  await expect(page.getByRole('heading',{name:'Parameterized Family'})).toBeVisible();
  await expect(page.locator('.atlas-structure-pending')).toHaveCount(0);
  await expect(page.locator('.atlas-parameter-fallback')).toContainText('field');
});

test('extended parameter displays preserve units and primary references at 320 pixels',async({page})=>{
  await page.setViewportSize({width:320,height:800});
  const profiles=[
    ['aradi','aradi-128-256',['256 bits','128 bits','16']],
    ['trivium','trivium-80',['288 bits','1152']],
    ['hmac','hmac-sha-256',['Variable','512 bits','256 bits']],
    ['poly1305','poly1305-one-time',['One-Time Key','256 bits']],
    ['skinny','skinny-128-256',['Public Tweak','0 bits','256 bits']],
    ['sparkle','sparkle-384-11',['Permutation Steps','11']],
    ['aes-siv','aes-siv-256',['Deterministic (No Nonce)','256 bits']],
  ]as const;
  for(const [family,id,values]of profiles){
    await page.goto(`/#/cryptanalysis/ciphers/${family}/${id}`);
    const params=page.locator('.atlas-parameter-fallback');
    await expect(params).toBeVisible();for(const value of values)await expect(params).toContainText(value);
    await expect(page.locator('.atlas-structure')).toHaveCount(0);
    await expect(page.locator('.atlas-structure-pending')).toContainText('Diagram pending');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(321);
  }
});

test('pending diagrams are explicitly registered without fake downloadable figures',async({request})=>{
  const data=await(await request.get('/atlas-diagrams.json')).json();
  for(const entry of registry.diagrams.filter(d=>d.review.status==='pending')){
    expect(entry.views).toHaveLength(0);
    expect(data.manifest.assets.some((a:{family_id:string})=>a.family_id===entry.family_id)).toBe(false);
    for(const id of entry.instance_ids)expect(catalog.instances.some(i=>i.id===id&&i.family_id===entry.family_id)).toBe(true);
  }
});

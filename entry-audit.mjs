import {chromium} from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const root = process.env.TEST_URL || 'https://quick-tempest-s19cymj.tmp.now/';
const data = JSON.parse(await fs.readFile(new URL('../knowledge.json',import.meta.url),'utf8'));
const output = new URL('../artifacts/ui-reacceptance/',import.meta.url);
await fs.mkdir(output,{recursive:true});
const browser = await chromium.launch();
const context = await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
const page = await context.newPage();
const results = [];
const errors = [];
page.on('pageerror',error=>errors.push(error.message));
async function check(name,run) {
  try {await run();results.push({name,status:'passed'});console.log('PASS',name)}
  catch(error) {results.push({name,status:'failed',error:error.message});console.log('FAIL',name,error.message)}
  finally {await page.locator('dialog').evaluate(dialog=>dialog.close()).catch(()=>{})}
}
async function ready(id='apple-m6-macbook') {
  await page.goto(root+'#event='+id);
  await page.waitForFunction(()=>document.querySelector('#stat-events').textContent==='30');
}
async function choose(id) {
  await page.locator('#clear-filters').click();
  await page.evaluate(id=>location.hash='event='+id,id);
  await page.waitForFunction(title=>document.querySelector('#event-title').textContent===title,data.events.find(item=>item.id===id).title);
}
await ready();
const inventory = await page.locator('button,a,select,input').evaluateAll(elements=>elements.map(element=>({tag:element.tagName,id:element.id,text:(element.getAttribute('aria-label')||element.textContent||element.getAttribute('placeholder')||'').trim().slice(0,100),href:element.getAttribute('href'),disabled:element.disabled||false,hidden:!element.getClientRects().length,action:{...element.dataset}})));
await fs.writeFile(new URL('initial-entry-inventory.json',output),JSON.stringify(inventory,null,2));
await check('品牌首页、探索锚点、搜索图标与快捷搜索全部生效',async()=>{
  await page.locator('.brand').click();
  assert.equal(new URL(page.url()).hash,'');
  assert.ok(await page.locator('.hero-stage').isVisible());
  await page.locator('.main-nav a').click();assert.equal(new URL(page.url()).hash,'#library');
  await page.locator('#shortcut-btn').click();assert.equal(await page.locator('#event-search').evaluate(element=>element===document.activeElement),true);
  for (const query of ['NVIDIA','宏观','AI','Apple']) {
    await page.locator('.suggestions [data-query="'+query+'"]').click();
    assert.equal(await page.locator('#event-search').inputValue(),query);
    assert.ok(Number(await page.locator('#event-count').innerText())>0);
  }
  await page.locator('#reset-search').click();assert.equal(await page.locator('#event-count').innerText(),'30');
});
await check('领域/排序每个选项、四种状态筛选逐个操作',async()=>{
  const categories=await page.locator('#category-filter option').evaluateAll(options=>options.map(option=>option.value));
  for (const category of categories) {
    await page.locator('#category-filter').selectOption(category);
    assert.equal(Number(await page.locator('#event-count').innerText()),category==='all'?30:data.events.filter(event=>event.category===category).length);
  }
  await page.locator('#clear-filters').click();
  for (const sort of ['recent','versions','oldest']) {await page.locator('#sort-select').selectOption(sort);assert.equal(await page.locator('#sort-select').inputValue(),sort)}
  for (const filter of ['confirmed','terminated','watch','all']) {await page.locator('[data-filter="'+filter+'"]').click();assert.equal(await page.locator('[data-filter="'+filter+'"]').getAttribute('aria-pressed'),'true')}
});
let tagChecks=0;
await check('全部30事件的所有显示标签都能触发有效搜索',async()=>{
  for (const event of data.events) {
    for (const tag of event.tags.slice(0,5)) {
      await choose(event.id);
      await page.locator('#detail-tags [data-query]').filter({hasText:tag}).first().click();
      assert.equal(await page.locator('#event-search').inputValue(),tag);
      assert.ok(Number(await page.locator('#event-count').innerText())>0,event.id+' / '+tag);
      tagChecks++;
    }
  }
});
let relatedChecks=0;
await check('全部30事件的所有关联卡均能打开对应事件',async()=>{
  for (const event of data.events) {
    await choose(event.id);
    const targets=await page.locator('.related-card').evaluateAll(elements=>elements.map(element=>element.dataset.eventId));
    for (const target of targets) {
      await choose(event.id);
      await page.locator('.related-card[data-event-id="'+target+'"]').click();
      assert.equal(await page.locator('#event-title').innerText(),data.events.find(item=>item.id===target).title);
      relatedChecks++;
    }
  }
});
await check('管理关注、弹窗取消关注、完成和关闭入口生效',async()=>{
  await choose('nvidia-arm');await page.locator('#watch-btn').click();
  await page.locator('#manage-watch').click();assert.match(await page.locator('#dialog-title').innerText(),/1/);
  await page.locator('#dialog-confirm').click();assert.equal(await page.locator('dialog').isVisible(),false);
  await page.locator('#watch-nav').click();await page.locator('[data-unwatch="nvidia-arm"]').click();
  assert.equal(await page.locator('#nav-watch-count').innerText(),'0');
  await page.locator('#dialog-close').click();assert.equal(await page.locator('dialog').isVisible(),false);
  await page.locator('#score-help').click();assert.match(await page.locator('#dialog-title').innerText(),/证据链/);
});
await check('多版本证据展开/收起与全部类型、两种排序生效',async()=>{
  await choose('fed-cycle');
  assert.equal(await page.locator('#load-more').isVisible(),false);
  const fixture=structuredClone(data);
  const event=fixture.events.find(item=>item.id==='fed-cycle');
  event.versions.push({...event.versions.at(-1),summary:'浏览器审计合成材料，不属于真实投资事实',fact:'浏览器审计合成材料，不属于真实投资事实'});
  await page.route('**/knowledge.json',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(fixture)}));
  try {
    await page.reload();
    await page.waitForFunction(()=>document.querySelector('#version-select').options.length===4);
    await page.locator('#load-more').click();assert.match(await page.locator('#load-more').innerText(),/收起/);
    await page.locator('#load-more').click();assert.match(await page.locator('#load-more').innerText(),/展开/);
    for (const type of ['fact','view','inference','rumor','all']) {await page.locator('#evidence-type').selectOption(type);assert.equal(await page.locator('#evidence-type').inputValue(),type)}
    for (const sort of ['occurred','published']) {await page.locator('#time-sort').selectOption(sort);assert.equal(await page.locator('#time-sort').inputValue(),sort)}
  } finally {
    await page.unroute('**/knowledge.json');
    await page.reload();
    await page.waitForFunction(()=>document.querySelector('#version-select').options.length===3);
  }
});
const audits=[];
for (const theme of ['dark','light']) {
  await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
  for (const [mode,selector] of [['method','#show-method'],['watch','#watch-nav'],['sources','#sources-nav'],['lab','#lab-nav']]) {
    await check(theme+'主题 '+mode+'弹窗交互与对比度',async()=>{
      await page.locator(selector).click();
      await page.locator('dialog[open]').waitFor();
      if(mode==='lab') {
        await page.locator('[data-lab="reset"]').click();
        for(let step=0;step<5;step++)await page.locator('[data-lab="next"]').click();
      }
      const audit=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
      audits.push({theme,mode,violations:audit.violations.map(item=>({id:item.id,impact:item.impact,nodes:item.nodes.map(node=>({target:node.target,summary:node.failureSummary}))}))});
      await page.screenshot({path:new URL(theme+'-'+mode+'.png',output).pathname});
      assert.equal(audit.violations.length,0,JSON.stringify(audits.at(-1).violations));
    });
  }
}
const geometry=[];
for (const width of [320,390,768,1024,1440,1920]) {
  await page.setViewportSize({width,height:width<500?844:1000});
  await ready('fed-cycle');
  const sample=await page.evaluate(()=>{
    const rect=selector=>{const element=document.querySelector(selector);const bounds=element.getBoundingClientRect();const style=getComputedStyle(element);return {width:bounds.width,height:bounds.height,padding:style.padding,gap:style.gap,rowGap:style.rowGap,borderRadius:style.borderRadius,background:style.backgroundColor}};
    const smallTargets=[...document.querySelectorAll('button,a,select')].filter(element=>{const bounds=element.getBoundingClientRect();return bounds.width>0&&bounds.height>0&&!element.closest('[hidden]')&&element.tagName!=='A'&&(bounds.height<43||bounds.width<23)}).map(element=>({id:element.id,class:element.className,width:element.getBoundingClientRect().width,height:element.getBoundingClientRect().height,text:element.innerText.slice(0,50)}));
    return {width:innerWidth,scrollWidth:document.documentElement.scrollWidth,library:rect('.library-layout'),detail:rect('.detail-grid'),summary:rect('.event-summary'),brief:rect('.brief-panel'),compare:rect('.compare-panel'),graph:rect('.graph-panel'),smallTargets};
  });
  geometry.push(sample);
  await page.evaluate(()=>scrollTo(0,0));
  await page.screenshot({path:new URL('layout-'+width+'.png',output).pathname,fullPage:true});
  if([390,1440].includes(width)) {
    await page.locator('#library').scrollIntoViewIfNeeded();
    await page.screenshot({path:new URL('workspace-'+width+'.png',output).pathname});
  }
}
const fakeAffordances=await page.locator('main *').evaluateAll(elements=>elements.filter(element=>getComputedStyle(element).cursor==='pointer'&&!element.closest('a,button,input,select,[role="button"]')&&element.getClientRects().length).map(element=>({tag:element.tagName,class:element.className,text:element.innerText.slice(0,80)})));
await fs.writeFile(new URL('entry-report.json',output),JSON.stringify({url:root,checkedAt:new Date().toISOString(),inventoryCount:inventory.length,tagChecks,relatedChecks,results,geometry,fakeAffordances,errors},null,2));
await fs.writeFile(new URL('additional-accessibility.json',output),JSON.stringify(audits,null,2));
await browser.close();
console.log(JSON.stringify({passed:results.filter(item=>item.status==='passed').length,total:results.length,tagChecks,relatedChecks,errors}));
if(results.some(item=>item.status==='failed'))process.exitCode=1;

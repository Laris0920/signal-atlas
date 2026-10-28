import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const root = process.env.TEST_URL || 'http://127.0.0.1:4387/';
const artifacts = new URL('../test-results/',import.meta.url);
await fs.mkdir(artifacts,{recursive:true});
const data = JSON.parse(await fs.readFile(new URL('../knowledge.json',import.meta.url),'utf8'));
const browser = await chromium.launch({headless:true});
const context = await browser.newContext({viewport:{width:1440,height:1000}});
const page = await context.newPage();
const errors = [];
page.on('pageerror',error=>errors.push(error.message));
const results = [];
async function check(name,run) {
  try {await run(); results.push({name,status:'passed'});console.log('PASS',name)}
  catch(error) {results.push({name,status:'failed',error:error.message});console.error('FAIL',name,error.message)}
  finally { await page.evaluate(()=>document.querySelector('dialog')?.close()).catch(()=>{}); }
}
async function ready() {await page.goto(root);await page.waitForFunction(()=>document.querySelector('#stat-events').textContent==='30')}
async function click(selector) {await page.locator(selector).click()}
async function noOverflow(label) {
  const issues = await page.evaluate(()=>{
    const width = innerWidth;
    const all = [...document.querySelectorAll('main *, header *, dialog[open] *')];
    return all.filter(element=>{
      const rect=element.getBoundingClientRect();
      const style=getComputedStyle(element);
      return rect.width>0 && rect.height>0 && style.display!=='none' &&
        !element.closest('[hidden]') && !element.closest('.hero-orbit') &&
        (rect.left< -2 || rect.right > width+2);
    }).slice(0,15).map(element=>({tag:element.tagName,class:element.className,id:element.id,text:element.textContent.slice(0,60),left:element.getBoundingClientRect().left,right:element.getBoundingClientRect().right}));
  });
  assert.deepEqual(issues,[],label+' horizontal overflow: '+JSON.stringify(issues));
  const overlaps = await page.evaluate(()=>{
    const selectors=['.topbar','.detail-header','.status-line','.version-controls','.evidence-toolbar','.filter-tabs','.panel-head','.saved-row','.lab-actions'];
    const found=[];
    for(const selector of selectors)for(const parent of document.querySelectorAll(selector)){
      if(parent.closest('[hidden]'))continue;
      const children=[...parent.children].filter(child=>{const rect=child.getBoundingClientRect();return rect.width>0&&rect.height>0});
      for(let first=0;first<children.length;first++)for(let second=first+1;second<children.length;second++){
        const left=children[first].getBoundingClientRect(),right=children[second].getBoundingClientRect();
        if(Math.min(left.right,right.right)-Math.max(left.left,right.left)>2 && Math.min(left.bottom,right.bottom)-Math.max(left.top,right.top)>2)found.push(selector+': '+children[first].tagName+'/'+children[second].tagName);
      }
    }
    return found;
  });
  assert.deepEqual(overlaps,[],label+' sibling overlap: '+overlaps.join(','));
}
await check('默认载入：统计真实、无初始遮挡提示',async()=>{
  await ready();
  assert.equal(await page.locator('#stat-evidence').textContent(),String(data.sources.length));
  assert.equal(await page.locator('#stat-versions').textContent(),String(data.events.reduce((total,event)=>total+event.versions.length,0)));
  assert.equal(await page.locator('#toast').getAttribute('class'),'toast');
  assert.equal(await page.locator('.event-card').count(),8);
});
await check('目录分页、所有 30 个事件和详情同步',async()=>{
  while(await page.locator('.event-card').count()<data.events.length)await click('#load-events');
  assert.equal(await page.locator('.event-card').count(),data.events.length);
  for(const event of data.events){
    await click('.event-card[data-event-id="'+event.id+'"]');
    assert.equal(await page.locator('#event-title').textContent(),event.title);
    assert.equal(await page.locator('#summary-text').textContent(),event.versions.at(-1).summary);
    assert.equal(await page.locator('#asset-list .stock-row').count(),event.assets.length);
    assert.equal(await page.locator('#version-select option').count(),event.versions.length);
  }
});
await check('搜索：多关键词、代码、无结果、清除恢复',async()=>{
  await page.locator('#event-search').fill('nvda 财报');await page.locator('#event-search').press('Enter');
  assert.equal(await page.locator('#event-count').textContent(),'2');
  await page.locator('#event-search').fill('找不到的标的');await page.locator('#event-search').press('Enter');
  assert.equal(await page.locator('#event-count').textContent(),'0');
  assert.equal(await page.locator('#event-view').isVisible(),false);
  await click('[data-action="reset"]');
  assert.equal(await page.locator('#event-count').textContent(),String(data.events.length));
});
await check('终止筛选与空收藏筛选',async()=>{
  await click('[data-filter="terminated"]');assert.equal(await page.locator('#event-count').textContent(),'1');
  await click('[data-filter="watch"]');assert.equal(await page.locator('#event-count').textContent(),'0');
  await click('#clear-filters');
});
await check('历史回放隐藏未来结论、时间详情和来源可用',async()=>{
  await page.goto(root+'#event=nvidia-arm');await page.waitForFunction(()=>document.querySelector('#event-title').textContent.includes('Arm'));
  await click('#prev-version');
  assert.equal(await page.locator('#status-chip').textContent(),'计划阶段');
  assert.equal(await page.locator('#timeline-list').textContent().then(text=>text.includes('arm-end')),false);
  assert.equal(await page.locator('#timeline-list a').count(),1);
  await click('[data-record="nvidia-arm-v1"]');
  assert.match(await page.locator('#dialog-body').textContent(),/未独立确定/);
  assert.match(await page.locator('#dialog-body').textContent(),/系统抓取/);
  await page.keyboard.press('Escape');
  await click('#next-version');
  assert.equal(await page.locator('#status-chip').textContent(),'已终止');
});
await check('关注持久化、取消、历史回放动态',async()=>{
  await click('#watch-btn');assert.equal(await page.locator('#nav-watch-count').textContent(),'1');
  await page.reload();await page.waitForFunction(()=>document.querySelector('#nav-watch-count').textContent==='1');
  await click('#prev-version');await click('#watch-nav');
  assert.match(await page.locator('#dialog-body').textContent(),/历史回放/);
  await click('[data-unwatch="nvidia-arm"]');assert.equal(await page.locator('#nav-watch-count').textContent(),'0');
  await page.keyboard.press('Escape');
});
await check('证据库检索、空态、来源 HTTPS',async()=>{
  await click('#sources-nav');await page.locator('#source-search').fill('NVIDIA');
  assert.equal(await page.locator('#source-results .source-card').count(),data.sources.filter(source=>source.publisher.includes('NVIDIA')).length);
  await page.locator('#source-search').fill('不可能存在的文档');assert.match(await page.locator('#source-results').textContent(),/没有匹配/);
  await page.keyboard.press('Escape');
});
await check('六步变化演练及过期规则',async()=>{
  await click('#lab-nav');
  for(let step=1;step<6;step++)await click('[data-lab="next"]');
  assert.match(await page.locator('#dialog-body').textContent(),/不能把已终止/);
  assert.equal(await page.locator('[data-lab="next"]').isDisabled(),true);
  await click('[data-lab="reset"]');
  assert.equal(await page.locator('.lab-log p').count(),1);
  await page.keyboard.press('Escape');
});
await check('导出研究卡片',async()=>{
  const downloadPromise=page.waitForEvent('download');await click('#export-btn');
  const download=await downloadPromise;assert.match(download.suggestedFilename(),/\.md$/);
});
await check('归档网络异常保留已载入资料',async()=>{
  await page.route('**/knowledge.json',route=>route.fulfill({status:503,body:'unavailable'}));
  await click('#refresh-btn');await page.locator('#load-error').waitFor({state:'visible'});
  assert.match(await page.locator('#load-error').textContent(),/503/);
  assert.match(await page.locator('#load-error').textContent(),/保留/);
  await page.unroute('**/knowledge.json');await click('[data-action="retry"]');await page.locator('#load-error').waitFor({state:'hidden'});
});
await check('首次网络失败可重试',async()=>{
  const failed=await context.newPage();
  await failed.route('**/knowledge.json',route=>route.fulfill({status:500,body:'error'}));
  await failed.goto(root);await failed.locator('#load-error').waitFor({state:'visible'});
  assert.equal(await failed.locator('#event-view').isVisible(),false);
  await failed.unroute('**/knowledge.json');await failed.locator('[data-action="retry"]').click();
  await failed.waitForFunction(()=>document.querySelector('#stat-events').textContent==='30');await failed.close();
});
await check('损坏的本地存储不会阻止启动',async()=>{
  const damaged=await browser.newContext();
  await damaged.addInitScript(()=>{localStorage.setItem('signal-atlas.watch.v2','{broken');localStorage.setItem('signal-atlas.activity.v2','false')});
  const tab=await damaged.newPage();await tab.goto(root);
  await tab.waitForFunction(()=>document.querySelector('#stat-events').textContent==='30');await damaged.close();
});
for(const width of [320,375,390,600,768,950,1024,1280,1440,1920]) {
  await check('响应式：'+width+'px 无横向溢出/组件相交',async()=>{
    await page.setViewportSize({width,height:900});await ready();await noOverflow(String(width));
    if([390,768,1440].includes(width))await page.screenshot({path:new URL('desktop-'+width+'.png',artifacts).pathname,fullPage:true,animations:'disabled'});
    await click('#show-method');await noOverflow('method '+width);await page.keyboard.press('Escape');
  });
}
await check('浅色主题与 200% 内容缩放',async()=>{
  await page.setViewportSize({width:1440,height:1000});await ready();await click('#theme-btn');await noOverflow('light');
  assert.equal(await page.locator('html').getAttribute('data-theme'),'light');
  await page.screenshot({path:new URL('light-desktop.png',artifacts).pathname,fullPage:true,animations:'disabled'});
  await page.setViewportSize({width:720,height:500});await noOverflow('200% equivalent layout viewport');
});
await check('领域筛选与时间排序可操作',async()=>{
  await ready();
  await page.locator('#category-filter').selectOption('宏观政策');
  assert.equal(await page.locator('#event-count').textContent(),String(data.events.filter(event=>event.category==='宏观政策').length));
  await click('#clear-filters');
  await page.locator('#sort-select').selectOption('oldest');
  assert.match(await page.locator('.event-card').first().textContent(),/Arm/);
  await page.locator('#sort-select').selectOption('recent');
});
await check('时间线类型与发生时间排序',async()=>{
  await page.goto(root+'#event=nv-split');
  await page.waitForFunction(()=>document.querySelector('#event-title').textContent.includes('10 拆'));
  await page.locator('#evidence-type').selectOption('view');
  assert.equal(await page.locator('.timeline-item').count(),1);
  await page.locator('#evidence-type').selectOption('rumor');
  assert.match(await page.locator('#timeline-list').textContent(),/没有此类材料/);
  await page.locator('#evidence-type').selectOption('all');
  await page.locator('#time-sort').selectOption('occurred');
  assert.match(await page.locator('.timeline-item').first().textContent(),/完成 10 拆 1/);
});
await check('分享链接与剪贴板被拒绝时的回退',async()=>{
  await ready();
  await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw new Error('clipboard denied')}}}));
  await click('#share-btn');
  assert.match(await page.locator('.share-input').inputValue(),/#event=/);
  await page.keyboard.press('Escape');
});
await check('搜索快捷键和关联事件跳转',async()=>{
  await ready();await page.locator('h1').click();await page.keyboard.press('/');
  assert.equal(await page.locator('#event-search').evaluate(element=>element===document.activeElement),true);
  const target=await page.locator('.related-card').first().getAttribute('data-event-id');
  await page.locator('.related-card').first().click();
  const event=data.events.find(item=>item.id===target);
  assert.equal(await page.locator('#event-title').textContent(),event.title);
});
await check('主题重载后保留',async()=>{
  await ready();await click('#theme-btn');
  const theme=await page.locator('html').getAttribute('data-theme');
  await page.reload();await page.waitForFunction(()=>document.querySelector('#stat-events').textContent==='30');
  assert.equal(await page.locator('html').getAttribute('data-theme'),theme);
  if(theme==='light')await click('#theme-btn');
});
await check('接口格式损坏保留最后成功资料',async()=>{
  await ready();
  await page.route('**/knowledge.json',route=>route.fulfill({status:200,contentType:'application/json',body:'{"schemaVersion":2,"events":[],"sources":[]}'}));
  await click('#refresh-btn');await page.locator('#load-error').waitFor({state:'visible'});
  assert.match(await page.locator('#load-error').textContent(),/格式/);
  assert.equal(await page.locator('#stat-events').textContent(),String(data.events.length));
  await page.unroute('**/knowledge.json');await click('[data-action="retry"]');await page.locator('#load-error').waitFor({state:'hidden'});
});
await check('存储被禁止仍可使用临时关注',async()=>{
  const blocked=await browser.newContext();
  await blocked.addInitScript(()=>Object.defineProperty(Storage.prototype,'setItem',{value:()=>{throw new Error('blocked')}}));
  const tab=await blocked.newPage();await tab.goto(root);await tab.waitForFunction(()=>document.querySelector('#stat-events').textContent==='30');
  await tab.locator('#watch-btn').click();assert.equal(await tab.locator('#nav-watch-count').textContent(),'1');
  await blocked.close();
});

await check('没有浏览器脚本异常',async()=>assert.deepEqual(errors,[]));
await fs.writeFile(new URL('browser-report.json',artifacts),JSON.stringify({url:root,runAt:new Date().toISOString(),results},null,2));
await browser.close();
if(results.some(result=>result.status==='failed'))process.exitCode=1;
console.log(results.filter(result=>result.status==='passed').length+'/'+results.length+' passed');

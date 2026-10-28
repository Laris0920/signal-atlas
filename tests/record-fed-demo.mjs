import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const publicUrl = process.env.DEMO_PUBLIC_URL || 'https://instant-onyx-p1wbm1g-lj4uidpg0-8hryvn2pzr-2601.vercel.app/#event=fed-cycle';
const publicOnly = process.env.DEMO_PUBLIC_ONLY === '1';
const local = publicOnly ? new URL('/',publicUrl).href : process.env.TEST_URL || 'http://127.0.0.1:4399/';
const output = new URL('../artifacts/final-demo/',import.meta.url);
await fs.mkdir(output,{recursive:true});
const data = JSON.parse(await fs.readFile(new URL('../knowledge.json',import.meta.url),'utf8'));
const source = data.sources.find(item=>item.id==='fed-dec');
const fixture = structuredClone(data);
fixture.events.find(event=>event.id==='fed-cycle').versions.pop();
fixture.sources = fixture.sources.filter(item=>item.id!=='fed-dec');
const browser = await chromium.launch();
const context = await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce',acceptDownloads:true,recordVideo:{dir:output.pathname,size:{width:1440,height:1000}}});
const page = await context.newPage();
const started = Date.now();
const scenes=[];
const errors=[];
let stage='公开站点实录';
page.on('pageerror',error=>errors.push(error.message));
async function caption(text) {
  await page.evaluate(({stage,text})=>{
    let box=document.querySelector('#demo-caption');
    if(!box){box=document.createElement('div');box.id='demo-caption';box.style.cssText='position:fixed;bottom:16px;left:50%;transform:translateX(-50%);width:calc(100% - 64px);padding:14px 20px;background:#0c1936f5;border:1px solid #c5a063;border-radius:14px;color:#fff8ea;z-index:2147483647;font:600 19px/1.55 -apple-system,BlinkMacSystemFont,sans-serif;text-align:center;pointer-events:none;box-shadow:0 4px 28px #0005;white-space:pre-line';(document.querySelector('dialog[open]')||document.body).append(box)}
    const parent=document.querySelector('dialog[open]')||document.body;
    if(box.parentElement!==parent)parent.append(box);
    box.textContent=stage+' ｜ '+text;
  },{stage,text});
}
async function scene(text,action,seconds=9) {
  const start=(Date.now()-started)/1000;
  await caption(text);
  if(action)await action();
  await caption(text);
  await page.waitForTimeout(seconds*1000);
  scenes.push({start,end:(Date.now()-started)/1000,stage,text});
}
try {
  await page.goto(publicUrl,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>document.querySelector('#stat-events').textContent==='30');
  await scene('信号图谱：沿着三份 FOMC 原文，回看 2024 三次降息。\n30 条事件 / 32 份原文 / 36 个版本；不是实时行情。',async()=>{await page.locator('#event-view').scrollIntoViewIfNeeded()});
  await scene('先读“事实 / 产品解读 / 未证实范围”。\n美元、国债与黄金是影响路径，不是收益预测。',async()=>{await page.locator('.brief-panel').scrollIntoViewIfNeeded()});
  await scene('回到 V1：2024-09-18 降息 50bp，区间 4.75%–5.00%。\n只展示当时已披露材料，不把后来的决议提前放进来。',async()=>{await page.locator('#version-select').selectOption('0');await page.locator('.version-panel').scrollIntoViewIfNeeded()});
  await scene('V2：11 月再降 25bp；V3：12 月再降 25bp 至 4.25%–4.50%。\n版本追加、旧证据保留；未来路径仍不确定。',async()=>{await page.locator('#version-select').selectOption('1');await page.waitForTimeout(1800);await page.locator('#version-select').selectOption('2');await page.locator('.compare-panel').scrollIntoViewIfNeeded()});
  await scene('对照 V1 与 V3，看到更新内容和新增官方出处。\n高亮只代表文字变化，不代表官方撤回。',async()=>{await page.locator('#compare-select').selectOption('0');await page.locator('.compare-panel').scrollIntoViewIfNeeded()});
  await scene('四种时间分开：发生 / 披露 / 核验 / 更新。\n未知发生时间保留为空；原文链接可继续核实。',async()=>{await page.locator('[data-record="fed-cycle-v3"]').click()});
  await scene('事实与观点分层；缺少传闻时显示空态，不编造反方。',async()=>{await page.keyboard.press('Escape');await page.locator('#evidence-type').selectOption('view');await page.locator('#evidence').scrollIntoViewIfNeeded();await page.waitForTimeout(1600);await page.locator('#evidence-type').selectOption('rumor');await page.waitForTimeout(1600);await page.locator('#evidence-type').selectOption('all')});
  await scene('信号护照实际生成 PNG，附版本轨迹、出处和风险提示。',async()=>{await page.locator('#passport-btn').click();await page.waitForFunction(()=>document.querySelector('.passport-preview')?.naturalWidth===1200);const download=page.waitForEvent('download');await page.locator('#passport-download').click();await (await download).saveAs(new URL('fed-v3-passport.png',output).pathname)});
  await page.keyboard.press('Escape');
  stage=publicOnly ? '公开网站 · 历史回放沙箱（隔离演示）' : '交付源码回放沙箱 · 非线上入口';
  await page.route('**/knowledge.json',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(fixture)}));
  await page.goto('about:blank');
  await page.goto(local+'#event=fed-cycle',{waitUntil:'networkidle'});
  await page.waitForFunction(()=>document.querySelector('#version-select').options.length===2);
  await scene(publicOnly ? '以下仍在同一公开网站，不切换本地页面。\n仅隔离此浏览器的 12 月版本，演示新材料接收；不改生产数据。' : '以下为交付源码，不是旧 URL 的已上线功能。\n仅在隔离浏览器移除 12 月版本，演示同一事件如何接收新材料。',async()=>{await page.locator('#watch-btn').click();await page.locator('#event-view').scrollIntoViewIfNeeded()});
  await scene('新材料：填入真实 2024-12-18 FOMC 决议及官方 URL。\n录入标题加 Fed 别名以命中规则；它不是语义 AI 识别。',async()=>{await page.locator('#intake-nav').click();for(const [field,value] of Object.entries({title:'Fed ' + source.title,publisher:source.publisher,date:source.publishedAt,url:source.url,body:source.summary}))await page.locator('#intake-'+field).fill(value)});
  await scene('归并 → 分类 → 冲突判断：命中 Fed 同一周期，识别事实候选。\n本次更新利率范围，状态保持“已披露”；不伪造冲突。',async()=>{await page.locator('#intake-form button[type="submit"]').click();await page.locator('#intake-result').scrollIntoViewIfNeeded();assert.match(await page.locator('#intake-result').innerText(),/美联储 2024/)});
  await scene('人工确认后追加 V3：旧版保留，结论范围随材料更新。\n新版本仅在当前页面会话存在，刷新恢复静态基线。',async()=>{await page.locator('[data-action="intake-apply"]').click();await page.keyboard.press('Escape');await page.locator('.event-summary').scrollIntoViewIfNeeded();assert.equal(await page.locator('#version-select option').count(),3)});
  await scene('关注者站内未读：旧/新状态、原因、发布方与时间可回看。\n这是本浏览器动态，不是邮件、云端或多用户推送。',async()=>{await page.locator('#watch-nav').click();assert.match(await page.locator('#dialog-body').innerText(),/未读材料更新/);await page.screenshot({path:new URL('fed-notification.png',output).pathname})});
  await scene(publicOnly ? '边界：无实时行情、运行期生成式 AI 或自动过期。\n新版公开站已上线；旧部署链接是固定快照，不随仓库自动更新。' : '边界：无实时行情、运行期生成式 AI 或自动过期。\n原指定线上快照仍需补传功能与 assets/，新部署不会改写旧 URL。',async()=>{await page.keyboard.press('Escape');await page.locator('#show-method').click()},8);
} finally {
  const video=page.video();
  await context.close();
  await fs.copyFile(await video.path(),new URL('fed-demo.webm',output));
  await browser.close();
}
function stamp(seconds) {
  const milliseconds=Math.round(seconds*1000);
  return [Math.floor(milliseconds/3600000),Math.floor(milliseconds/60000)%60,Math.floor(milliseconds/1000)%60].map(value=>String(value).padStart(2,'0')).join(':')+'.'+String(milliseconds%1000).padStart(3,'0');
}
await fs.writeFile(new URL('fed-demo.zh.vtt',output),'WEBVTT\n\n'+scenes.map((scene,index)=>(index+1)+'\n'+stamp(scene.start)+' --> '+stamp(scene.end)+'\n'+scene.stage+' | '+scene.text+'\n').join('\n'));
await fs.writeFile(new URL('recording-log.json',output),JSON.stringify({recordedAt:new Date().toISOString(),publicUrl,publicOnly,localUrl:publicOnly?null:local,materialDemoUrl:local+'#event=fed-cycle',elapsedSeconds:(Date.now()-started)/1000,scenes,errors,fixture:'仅浏览器请求中移除Fed V3及fed-dec；静态与线上数据未改'},null,2));
console.log('Fed demo recorded',scenes.length,'scenes');

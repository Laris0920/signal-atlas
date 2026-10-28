import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';

const root = 'https://instant-onyx-p1wbm1g-lj4uidpg0-8hryvn2pzr-2601.vercel.app/';
const repo = 'https://github.com/Laris0920/signal-atlas';
const output = new URL('../test-results/',import.meta.url);
await fs.mkdir(output,{recursive:true});
const report = {checkedAt:new Date().toISOString(),url:root+'#event=fed-cycle',repository:repo,resources:[],fedNumbers:[],notes:[]};
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const data = JSON.parse(await fs.readFile(new URL('../knowledge.json',import.meta.url),'utf8'));
for (const file of ['index.html','app.js','engine.js','dossier.js','passport.js','styles.css','polish.css','dossier.css','archive.css','knowledge.json','assets/archive-hero.webp']) {
  const response = await fetch(new URL(file==='index.html'?'':file,root),{signal:AbortSignal.timeout(30000)});
  const bytes = Buffer.from(await response.arrayBuffer());
  const local = await fs.readFile(new URL('../'+file,import.meta.url));
  report.resources.push({file,status:response.status,finalUrl:response.url,localSha256:digest(local),remoteSha256:digest(bytes),same:response.ok && digest(local)===digest(bytes)});
}
const treeResponse = await fetch('https://api.github.com/repos/Laris0920/signal-atlas/git/trees/main?recursive=1',{signal:AbortSignal.timeout(30000)});
const tree = await treeResponse.json();
report.repositorySnapshot = {status:treeResponse.status,commit:tree.sha,paths:tree.tree?.map(item=>item.path)};
for (const [id,expected] of [['fed-sep',['1/2 percentage point','4-3/4 to 5 percent']],['fed-nov',['1/4 percentage point','4-1/2 to 4-3/4 percent']],['fed-dec',['1/4 percentage point','4-1/4 to 4-1/2 percent']]]) {
  const source = data.sources.find(item=>item.id===id);
  const response = await fetch(source.url,{signal:AbortSignal.timeout(30000)});
  const html = await response.text();
  const text = html.replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/\s+/g,' ');
  const checks = expected.map(value=>({value,found:text.includes(value)}));
  const snippets = expected.map(value=>{const position=text.indexOf(value);return position<0?null:text.slice(Math.max(0,position-120),position+value.length+150)});
  report.fedNumbers.push({id,url:source.url,status:response.status,checks,snippets});
}
const browser = await chromium.launch();
try {
  const page = await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce',acceptDownloads:true});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(report.url,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>document.querySelector('#stat-events')?.textContent==='30');
  report.browser = {finalUrl:page.url(),title:await page.title(),eventTitle:await page.locator('#event-title').innerText(),events:await page.locator('#stat-events').innerText(),sources:await page.locator('#stat-evidence').innerText(),versions:await page.locator('#stat-versions').innerText(),intakeAvailable:await page.locator('#intake-nav').count()>0};
  await page.locator('#event-view').scrollIntoViewIfNeeded();
  await page.screenshot({path:new URL('final-live-fed.png',output).pathname});
  await page.locator('#version-select').selectOption('0');
  report.browser.firstVersion = await page.locator('#summary-text').innerText();
  report.browser.firstVersionSources = await page.locator('#brief-citations a').count();
  await page.locator('#version-select').selectOption('2');
  report.browser.lastVersion = await page.locator('#summary-text').innerText();
  await page.locator('#show-method').click();
  report.browser.methodDialog=await page.locator('dialog').isVisible();
  await page.keyboard.press('Escape');
  await page.setViewportSize({width:390,height:844});
  report.browser.mobileNoOverflow=await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);
  report.browser.errors=errors;
} finally {await browser.close()}
report.notes.push('匿名200不代表最新源码上线；检查时指定固定快照缺少材料入口，主题图片路径404。');
report.notes.push('Fed正文检查仅覆盖三组关键区间与降幅，不表示所有近期摘要已逐句重审。');
await fs.writeFile(new URL('final-live-audit.json',output),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));

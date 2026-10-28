import {chromium} from 'playwright';
import fs from 'node:fs/promises';
const output = new URL('../artifacts/',import.meta.url);
await fs.mkdir(output,{recursive:true});
const browser = await chromium.launch();
const context = await browser.newContext({viewport:{width:1280,height:820},recordVideo:{dir:output.pathname,size:{width:1280,height:820}},reducedMotion:'reduce'});
const page = await context.newPage();
await page.goto('http://127.0.0.1:4387/');
await page.waitForFunction(()=>document.querySelector('#stat-events').textContent==='30');
async function caption(text) {
  await page.evaluate(text=>{
    let box=document.querySelector('#demo-caption');
    if(!box){box=document.createElement('div');box.id='demo-caption';box.style.cssText='position:fixed;bottom:18px;left:50%;transform:translateX(-50%);width:calc(100% - 80px);padding:15px 24px;background:#06201ef2;border:1px solid #62e5b1;border-radius:8px;color:#d9ffeb;z-index:9999;font:600 17px/1.6 sans-serif;text-align:center;box-shadow:0 8px 40px #0008;pointer-events:none';document.body.append(box)}
    box.textContent=text;
  },text);
}
async function scene(text,action,seconds=8) {
  await caption(text);if(action)await action();await page.waitForTimeout(seconds*1000);
}
await scene('01 / Signal Atlas 信号图谱：用出处、时间和版本，还原投资事件。');
await scene('02 / 30 条近期与历史事件 · 32 份官方文档 · 36 个事实版本。数据非实时行情。',async()=>page.locator('#library').scrollIntoViewIfNeeded());
await scene('03 / 搜索 NVDA 财报：同一公司不同报告期分别归档。',async()=>{await page.locator('#event-search').fill('NVDA 财报');await page.locator('#event-search').press('Enter')});
await scene('04 / 回放 NVIDIA 收购 Arm：V1 只确认拟议交易，尚未交割。',async()=>{await page.locator('#clear-filters').click();await page.goto('http://127.0.0.1:4387/#event=nvidia-arm');await page.waitForFunction(()=>document.querySelector('#event-title').textContent.includes('Arm'));await page.locator('#prev-version').click();await caption('04 / 回放 NVIDIA 收购 Arm：V1 只确认拟议交易，尚未交割。')});
await scene('05 / V2 终止声明改变结论，原收购计划保留在历史中。',async()=>{await page.locator('#next-version').click()});
await scene('06 / 四种时间分别查看；未知发生时间不编造。每条事实可打开官方原文。',async()=>page.locator('[data-record="nvidia-arm-v2"]').click());
await scene('07 / 官方证据库可检索材料，观点不会冒充原文事实。',async()=>{await page.keyboard.press('Escape');await page.locator('#sources-nav').click();await page.locator('#source-search').fill('NVIDIA')});
await scene('08 / 关注保存在浏览器，历史回放变化可在关注列表中回看。',async()=>{await page.keyboard.press('Escape');await page.locator('#watch-btn').click();await page.locator('#prev-version').click();await page.locator('#watch-nav').click()});
await scene('09 / 虚构变化演练：传闻、意向、推测、更正、否认与过期。与真实档案分开。',async()=>{await page.keyboard.press('Escape');await page.locator('#lab-nav').click();for(let index=0;index<5;index++){await page.waitForTimeout(900);await page.locator('[data-lab="next"]').click()}},5);
await scene('10 / 深浅主题与响应式界面。当前未接实时行情、云端推送或运行时 AI。',async()=>{await page.keyboard.press('Escape');await page.locator('#theme-btn').click();await page.evaluate(()=>scrollTo(0,0))});
const video=page.video();
await context.close();
await fs.copyFile(await video.path(),new URL('Signal-Atlas-demo.webm',output));
await browser.close();
console.log('Demo saved to artifacts/Signal-Atlas-demo.webm');

import {chromium} from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs/promises';

const browser = await chromium.launch({headless:true});
const context = await browser.newContext({viewport:{width:1440,height:1000}});
const page = await context.newPage();
const results = [];
await page.goto((process.env.TEST_URL || 'http://127.0.0.1:4391/') + '#event=nvidia-arm');
await page.waitForFunction(()=>document.querySelector('#stat-events').textContent==='30');
for (const theme of ['dark','light']) {
  await page.evaluate(value=>document.documentElement.dataset.theme=value,theme);
  for (const mode of ['source','passport']) {
    if (mode==='source') await page.locator('.source-node').first().click();
    else {await page.locator('#passport-btn').click();await page.locator('#passport-download').waitFor();await page.waitForFunction(()=>document.querySelector('.passport-preview')?.naturalWidth===1200)}
    const audit=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
    results.push({theme,mode,violations:audit.violations.map(item=>({id:item.id,nodes:item.nodes.map(node=>({target:node.target,summary:node.failureSummary}))}))});
    await page.locator('#dialog-close').click();
  }
}
console.log(JSON.stringify(results,null,2));
await fs.writeFile(new URL('../test-results/dossier-accessibility.json',import.meta.url),JSON.stringify(results,null,2));
await browser.close();
if(results.some(result=>result.violations.length))process.exitCode=1;

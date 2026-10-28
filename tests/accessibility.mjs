import {chromium} from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs/promises';
const browser=await chromium.launch();
const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
const page=await context.newPage();
const results=[];
for(const theme of ['dark','light']) {
  await page.goto(process.env.TEST_URL || 'http://127.0.0.1:4387/');
  await page.waitForFunction(()=>document.querySelector('#stat-events').textContent==='30');
  await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
  const report=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
  results.push({theme,violations:report.violations.map(item=>({id:item.id,impact:item.impact,description:item.description,nodes:item.nodes.map(node=>({target:node.target,summary:node.failureSummary}))}))});
}
await fs.writeFile(new URL('../test-results/accessibility.json',import.meta.url),JSON.stringify(results,null,2));
console.log(JSON.stringify(results,null,2));
await browser.close();
if(results.some(result=>result.violations.length))process.exitCode=1;

import fs from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const execute = promisify(execFile);
const knowledge = JSON.parse(await fs.readFile(new URL('../knowledge.json',import.meta.url)));
const results = [];
for (const source of knowledge.sources) {
  try {
    const {stdout} = await execute('curl',['-fsSL','--max-time','30','--retry','1',source.url,'-w','\n%{http_code}'],{maxBuffer:6*1024*1024});
    const title = stdout.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim();
    const status = stdout.trim().slice(-3);
    const valid = status === '200' && Boolean(title) && !/News Archive|Page Not Found|Access Denied|404 Not Found/i.test(title);
    results.push({id:source.id,url:source.url,status,title,valid,checkedAt:new Date().toISOString()});
    console.log(valid ? 'PASS' : 'FAIL',source.id,title);
  } catch(error) {
    results.push({id:source.id,url:source.url,valid:false,error:error.message.split('\n')[0]});
    console.error('FAIL',source.id);
  }
}
await fs.mkdir(new URL('../test-results/',import.meta.url),{recursive:true});
await fs.writeFile(new URL('../test-results/source-report.json',import.meta.url),JSON.stringify(results,null,2));
console.log(results.filter(result=>result.valid).length+'/'+results.length+' sources reachable with non-archive title');
if(results.some(result=>!result.valid))process.exitCode=1;


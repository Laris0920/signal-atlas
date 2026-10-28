import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateKnowledge,matchesEvent,filteredEvents,factRecords,coverage,LAB_STEPS,processMaterial,applyMaterial} from '../engine.js';
const knowledge = JSON.parse(fs.readFileSync(new URL('../knowledge.json',import.meta.url)));

test('档案 ID、来源引用和版本时间顺序有效',() => {
  assert.equal(validateKnowledge(knowledge).events.length,30);
  assert.equal(knowledge.sources.length,32);
  assert.equal(knowledge.events.reduce((total,event) => total + event.versions.length,0),36);
  for (const source of knowledge.sources) assert.match(source.url,/^https:\/\//);
});
test('新增16条近期独立事件有官方原文，日期不超出核验日',() => {
  const batch = knowledge.recentBatch;
  assert.equal(batch.count,16);
  assert.equal(new Set(batch.eventIds).size,16);
  const urls = new Set();
  for (const id of batch.eventIds) {
    const event = knowledge.events.find(item=>item.id===id);
    assert.ok(event);
    const version = event.versions[0];
    assert.ok(version.date>=batch.from && version.date<=batch.to);
    assert.ok(version.date<=knowledge.checkedAt.slice(0,10));
    const source = knowledge.sources.find(item=>item.id===version.sourceIds[0]);
    assert.equal(source.publishedAt,version.date);
    assert.ok(['www.apple.com','nvidianews.nvidia.com','blogs.nvidia.com','www.ecb.europa.eu','www.federalreserve.gov'].includes(new URL(source.url).hostname));
    assert.ok(version.fact && version.unknown && version.watch && source.checkedAt);
    urls.add(source.url);
  }
  assert.equal(urls.size,16);
  assert.equal(filteredEvents(knowledge.events,{},new Set())[0].versions.at(-1).date,'2026-10-27');
});
test('近期的未来上市、部署和征求意见保留计划状态',() => {
  for (const id of ['apple-m6-macbook','apple-m6-imac','apple-ipad-mini-oled','nv-meta-muse','google-rubin-a5x','nv-supply-capacity','fed-stablecoin-proposal']) {
    assert.equal(knowledge.events.find(event=>event.id===id).versions.at(-1).state,'planned');
  }
});
test('批次扩充不将旧档案的收录时间改写为本次核验时间',() => {
  const event = knowledge.events.find(item=>item.id==='nvidia-arm');
  const records = factRecords(event,0,knowledge.sources,knowledge.checkedAt);
  assert.equal(records[0].capturedAt,'2026-10-27T11:51:44Z');
  const recent = knowledge.events.find(item=>item.id==='apple-m6-macbook');
  assert.equal(factRecords(recent,0,knowledge.sources,knowledge.checkedAt)[0].capturedAt,recent.versions[0].capturedAt);
});
test('检索支持多个词、代码和大小写，同时排除不匹配',() => {
  const event = knowledge.events.find(item=>item.id==='nv-q2-results');
  assert.equal(matchesEvent(event,'nvda 财报'),true);
  assert.equal(matchesEvent(event,'NVDA 机器人'),false);
  assert.equal(matchesEvent(event,'   '),true);
});
test('领域、状态、收藏和查询共同生效',() => {
  assert.equal(filteredEvents(knowledge.events,{filter:'terminated'},new Set()).length,1);
  assert.equal(filteredEvents(knowledge.events,{filter:'watch'},new Set(['nvidia-arm'])).length,1);
  assert.equal(filteredEvents(knowledge.events,{category:'宏观政策',query:'NVIDIA'},new Set()).length,0);
});
test('历史回放不泄漏后续终止公告',() => {
  const event = knowledge.events.find(item=>item.id==='nvidia-arm');
  const initial = factRecords(event,0,knowledge.sources,knowledge.checkedAt);
  assert.equal(initial.length,1);
  assert.equal(initial[0].sources[0].id,'arm-plan');
  assert.equal(JSON.stringify(initial).includes('arm-end'),false);
  assert.equal(factRecords(event,1,knowledge.sources,knowledge.checkedAt).length,2);
});
test('未知发生时间不伪造；拆股发生时间不同于回溯披露',() => {
  const event = knowledge.events.find(item=>item.id==='nv-split');
  const records = factRecords(event,1,knowledge.sources,knowledge.checkedAt);
  assert.equal(records[0].occurredAt,null);
  assert.equal(records[1].occurredAt,'2024-06-07');
  assert.equal(records[1].date,'2024-08-28');
  assert.equal(coverage(records).total,88);
});
test('不完整资料和悬空引用会被拒绝',() => {
  const bad = structuredClone(knowledge);
  bad.events[0].versions[0].sourceIds=['missing'];
  assert.throws(()=>validateKnowledge(bad));
  assert.throws(()=>validateKnowledge({}));
});
test('版本更正、否认、过期演练保留终止结论',() => {
  assert.equal(LAB_STEPS.length,6);
  assert.equal(LAB_STEPS[4].state,'已终止');
  assert.equal(LAB_STEPS[5].state,'已终止');
  assert.equal(LAB_STEPS[2].type,'inference');
});

test('新材料可归并、分类并识别状态冲突',() => {
  const material = {title:'NVIDIA 与 SoftBank 宣布终止 Arm 收购',publisher:'NVIDIA',disclosedAt:'2022-02-08',url:'https://example.com/arm-update',body:'双方宣布终止 Arm 收购，原计划不再推进。'};
  const result = processMaterial(material,knowledge);
  assert.equal(result.type,'fact');
  assert.equal(result.relation,'termination');
  assert.equal(result.candidate.eventId,'nvidia-arm');
  assert.equal(result.conflict.previousState,'terminated');
  assert.equal(result.nextState,'terminated');
});

test('确认材料追加新版本，重复来源不重复写入，未证实材料只进复核队列',() => {
  const material = {title:'NVIDIA 与 SoftBank 宣布终止 Arm 收购',publisher:'NVIDIA',disclosedAt:'2022-02-08',url:'https://example.com/arm-update-2',body:'双方宣布终止 Arm 收购，原计划不再推进。'};
  const processed = processMaterial(material,knowledge);
  const applied = applyMaterial(knowledge,processed,'2026-10-27T16:00:00Z');
  assert.equal(applied.changed,true);
  assert.equal(applied.event.versions.length,3);
  assert.equal(applied.event.versions.at(-1).sourceIds[0],processed.sourceId);
  const duplicate = applyMaterial(knowledge,processMaterial({...material,url:'https://nvidianews.nvidia.com/news/nvidia-and-softbank-group-announce-termination-of-nvidias-acquisition-of-arm-limited'},knowledge));
  assert.equal(duplicate.changed,false);
  const rumor = processMaterial({...material,title:'匿名消息称 NVIDIA 可能重新收购 Arm',url:'https://example.com/rumor',body:'匿名消息称 NVIDIA 可能重新收购 Arm。'},knowledge);
  const queued = applyMaterial(knowledge,rumor,'2026-10-27T16:00:00Z');
  assert.equal(queued.reviewOnly,true);
  assert.equal(queued.data.events.length,knowledge.events.length);
  assert.equal(queued.data.intakeQueue.length,1);
});

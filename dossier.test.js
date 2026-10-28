import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {visibleSources, briefFor, compareVersions, evidenceGraph, textChanges, titleAt} from '../dossier.js';

const data = JSON.parse(fs.readFileSync(new URL('../knowledge.json', import.meta.url)));
const arm = data.events.find(event => event.id === 'nvidia-arm');
const fed = data.events.find(event => event.id === 'fed-cycle');

test('头卡和星图不泄漏未来终止材料或解读', () => {
  const brief = briefFor(arm, 0, data.sources);
  assert.equal(brief.sources[0].id, 'arm-plan');
  assert.equal(brief.relevance.includes('终止'), false);
  assert.equal(titleAt(arm,0).includes('终止'),false);
  assert.equal(titleAt(arm,1),arm.title);
  assert.deepEqual(visibleSources(arm, 0, data.sources).map(source => source.id), ['arm-plan']);
  const graph = evidenceGraph(arm, 0, data.sources);
  assert.equal(graph.versions.length, 1);
  assert.deepEqual(graph.links, [{sourceId: 'arm-plan', version: 0, relation: '支持本版事实'}]);
});

test('单版本和首版不虚构比较，基准不能使用未来', () => {
  assert.equal(compareVersions(arm, 0), null);
  const comparison = compareVersions(arm, 1, 99);
  assert.equal(comparison.baseline, 0);
  assert.equal(comparison.stateChanged, true);
  assert.deepEqual(comparison.newIds, ['arm-end']);
  assert.equal(comparison.after.state, 'terminated');
});

test('跨版本比较统计区间新增文档，支持相同状态的事实更新', () => {
  const comparison = compareVersions(fed, 2, 0);
  assert.equal(comparison.stateChanged, false);
  assert.deepEqual(comparison.newIds, ['fed-nov', 'fed-dec']);
  assert.equal(compareVersions(fed, 1).newIds.includes('fed-dec'), false);
});

test('文字变化片段能重建前后原文，包括完全替换和空文本', () => {
  for (const [before, after] of [['计划收购。', '终止收购。'], ['abc', 'abc'], ['', '新增'], ['撤回', ''], ['甲乙丙', '甲丁丙'], ['😀abc', '😀xyz']]) {
    const parts = textChanges(before, after);
    assert.equal(parts.filter(part => part.kind !== 'added').map(part => part.text).join(''), before);
    assert.equal(parts.filter(part => part.kind !== 'removed').map(part => part.text).join(''), after);
  }
});

test('所有图关系与版本原文引用一致，既不增加也不遗漏', () => {
  for (const event of data.events) for (let index = 0; index < event.versions.length; index++) {
    const graph = evidenceGraph(event, index, data.sources);
    assert.equal(graph.links.length, event.versions.slice(0, index + 1).reduce((count, version) => count + version.sourceIds.length, 0));
    for (const link of graph.links) {
      assert.ok(graph.sources.some(source => source.id === link.sourceId));
      assert.ok(event.versions[link.version].sourceIds.includes(link.sourceId));
    }
  }
});

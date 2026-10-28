export function visibleSources(event, versionIndex, sources) {
  const ids = new Set(event.versions.slice(0, versionIndex + 1).flatMap(version => version.sourceIds));
  return sources.filter(source => ids.has(source.id));
}

export function titleAt(event, versionIndex) {
  return versionIndex === event.versions.length - 1 ? event.title : event.assets.map(asset => asset.name).join(' × ') + ' · ' + event.category + '档案';
}

export function briefFor(event, versionIndex, sources) {
  const version = event.versions[versionIndex];
  return {
    fact: version.fact,
    relevance: versionIndex === event.versions.length - 1 ? event.impact : '围绕' + event.assets.map(asset => asset.name).join('、') + '跟踪这项' + event.category + '事项。下一步关注：' + version.watch,
    unknown: version.unknown,
    sources: sources.filter(source => version.sourceIds.includes(source.id))
  };
}

export function compareVersions(event, versionIndex, baselineIndex = versionIndex - 1) {
  if (versionIndex === 0) return null;
  const baseline = Math.max(0, Math.min(baselineIndex, versionIndex - 1));
  const before = event.versions[baseline];
  const after = event.versions[versionIndex];
  const oldIds = new Set(event.versions.slice(0, baseline + 1).flatMap(version => version.sourceIds));
  const newIds = [...new Set(event.versions.slice(baseline + 1, versionIndex + 1).flatMap(version => version.sourceIds))].filter(id => !oldIds.has(id));
  return {
    baseline, before, after, newIds,
    stateChanged: before.state !== after.state,
    fields: [['结论摘要', 'summary'], ['已知事实', 'fact'], ['仍待确认', 'unknown'], ['下一步看', 'watch']].map(([label, key]) => ({label, before: before[key], after: after[key], changed: before[key] !== after[key]}))
  };
}

export function evidenceGraph(event, versionIndex, sources) {
  return {
    sources: visibleSources(event, versionIndex, sources),
    versions: event.versions.slice(0, versionIndex + 1),
    links: event.versions.slice(0, versionIndex + 1).flatMap((version, index) => version.sourceIds.map(sourceId => ({sourceId, version: index, relation: '支持本版事实'})))
  };
}

export function textChanges(before, after) {
  if (before === after) return [{kind: 'same', text: after}];
  const previous = Array.from(before);
  const current = Array.from(after);
  let prefix = 0;
  while (prefix < previous.length && prefix < current.length && previous[prefix] === current[prefix]) prefix++;
  let suffix = 0;
  while (suffix < previous.length - prefix && suffix < current.length - prefix && previous.at(-suffix - 1) === current.at(-suffix - 1)) suffix++;
  return [
    {kind: 'same', text: current.slice(0, prefix).join('')},
    {kind: 'removed', text: previous.slice(prefix, previous.length - suffix).join('')},
    {kind: 'added', text: current.slice(prefix, current.length - suffix).join('')},
    {kind: 'same', text: suffix ? current.slice(-suffix).join('') : ''}
  ].filter(part => part.text);
}

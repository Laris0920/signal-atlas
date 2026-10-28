export const STATES = {
  confirmed: { label: '已披露', tone: 'fact' },
  planned: { label: '计划阶段', tone: 'partial' },
  terminated: { label: '已终止', tone: 'rumor' }
};

export function validateKnowledge(data) {
  if (data?.schemaVersion !== 2 || !Array.isArray(data.events) || !Array.isArray(data.sources) || !data.events.length) throw new Error('归档格式不符合 v2 数据约定');
  const sourceIds = new Set();
  for (const source of data.sources) {
    if (!source.id || sourceIds.has(source.id) || !source.title || !source.publisher || !/^\d{4}-\d{2}-\d{2}$/.test(source.publishedAt) || new URL(source.url).protocol !== 'https:') throw new Error('原始文档缺少必需字段或包含重复 ID');
    sourceIds.add(source.id);
  }
  const eventIds = new Set();
  for (const event of data.events) {
    if (!event.id || eventIds.has(event.id) || !event.title || !Array.isArray(event.tags) || !Array.isArray(event.assets) || !event.versions?.length) throw new Error('事件档案字段不完整或 ID 重复');
    eventIds.add(event.id);
    let prior = '';
    for (const version of event.versions) {
      if (!STATES[version.state] || version.date < prior || !version.summary || !version.sourceIds?.length || !version.sourceIds.every(id => sourceIds.has(id))) throw new Error('事件版本顺序或证据引用无效');
      prior = version.date;
    }
  }
  return data;
}

export function matchesEvent(event, query) {
  const tokens = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  const text = [event.title, event.category, ...event.tags, ...event.assets.map(asset => asset.ticker)].join(' ').toLocaleLowerCase();
  return tokens.every(token => text.includes(token));
}

export function filteredEvents(events, {query = '', category = 'all', filter = 'all', sort = 'recent'}, watched) {
  return events.filter(event =>
    matchesEvent(event, query) &&
    (category === 'all' || event.category === category) &&
    (filter === 'all' || (filter === 'watch' ? watched.has(event.id) : event.versions.at(-1).state === filter))
  ).sort((first, second) => sort === 'versions' ? second.versions.length - first.versions.length :
    sort === 'oldest' ? first.versions[0].date.localeCompare(second.versions[0].date) :
      second.versions.at(-1).date.localeCompare(first.versions.at(-1).date));
}

export function factRecords(event, versionIndex, sources, checkedAt) {
  return event.versions.slice(0, versionIndex + 1).map((version, index) => ({
    id: event.id + '-v' + (index + 1),
    type: 'fact',
    title: version.summary,
    date: version.date,
    occurredAt: event.id === 'nv-split' && index === 1 ? '2024-06-07' : null,
    occurredNote: event.id === 'nv-q2-results' ? '报告期截至 2024-07-28；精确事件发生时刻未提供' : '未独立确定发生时刻；披露日期不等于发生日期',
    capturedAt: version.capturedAt || sources.find(source => source.id === version.sourceIds[0])?.checkedAt || checkedAt,
    updatedAt: version.capturedAt || sources.find(source => source.id === version.sourceIds[0])?.checkedAt || checkedAt,
    sources: version.sourceIds.map(id => sources.find(source => source.id === id))
  }));
}

export function coverage(records) {
  const fields = [
    ['官方出处', records.filter(record => record.sources.length > 0).length],
    ['披露日期', records.filter(record => record.date).length],
    ['收录记录', records.filter(record => record.capturedAt).length],
    ['独立发生日期', records.filter(record => record.occurredAt).length]
  ];
  const rows = fields.map(([label, count]) => ({label, count, total: records.length, percent: Math.round(count / records.length * 100)}));
  return {rows, total: Math.round(rows.reduce((total, row) => total + row.percent, 0) / rows.length)};
}

export function relatedEvents(events, current) {
  return events.filter(event => event.id !== current.id).map(event => ({
    event,
    score: event.tags.filter(tag => current.tags.includes(tag)).length + (event.category === current.category ? 2 : 0)
  })).filter(item => item.score > 0).sort((first, second) => second.score - first.score).slice(0, 3).map(item => item.event);
}

export const LAB_STEPS = [
  {type:'rumor', kind:'传闻', title:'匿名消息称星河科技将收购晨光机器人', state:'未证实', body:'虚构线索，没有原始文件；权重低，仅登记，不作为事实。', rule:'新增线索 → 保留原始来源，等待验证。'},
  {type:'fact', kind:'事实', title:'虚构公司公告：董事会批准签署意向书', state:'意向阶段', body:'官方层材料确认意向书，不能据此认定交割完成。', rule:'更新 → 提高“意向已签署”的证据权重，不确认交割。'},
  {type:'inference', kind:'推测', title:'据此猜测下月完成收购', state:'意向阶段', body:'这是对时间的推测，不能覆盖公告所确认的范围。', rule:'推测 → 单独分层，不改变事实状态。'},
  {type:'fact', kind:'更正', title:'虚构更正：交易为拟持股 20%，并非全资收购', state:'已更正', body:'保留旧版本，明确全资收购说法已失效。', rule:'更正 → 标记先前说法已被替代，触发站内提醒。'},
  {type:'fact', kind:'否认', title:'虚构公司回应：谈判终止，未完成收购', state:'已终止', body:'终止声明优先于过往意向和匿名线索。', rule:'否认 → 改变当前结论，同时保留历史证据链。'},
  {type:'rumor', kind:'过期', title:'早期匿名线索超过演练有效期', state:'已终止', body:'旧传闻降权并标记过期；不能把已终止的官方结论恢复为未证实。', rule:'过期 → 降低旧线索权重，不撤销后续官方终止声明。'}
];

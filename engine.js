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

const MATERIAL_CUES = {
  rumor: /传闻|据称|匿名|未经证实|网传|消息人士/,
  inference: /预计|预测|或将|推测|认为|预期|可能/,
  termination: /终止|取消|撤回|不再推进|失败|未完成/,
  correction: /更正|纠正|修订|澄清|误报/,
  denial: /否认|否定|不存在|辟谣/,
  update: /更新|最新|再次|补充|公布|宣布|披露/
};

function materialText(material) {
  return [material.title, material.body, material.publisher].filter(Boolean).join(' ');
}

function materialHash(value) {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function materialType(text) {
  if (MATERIAL_CUES.rumor.test(text)) return 'rumor';
  if (MATERIAL_CUES.inference.test(text)) return 'inference';
  return 'fact';
}

function materialRelation(text) {
  if (MATERIAL_CUES.termination.test(text)) return 'termination';
  if (MATERIAL_CUES.denial.test(text)) return 'denial';
  if (MATERIAL_CUES.correction.test(text)) return 'correction';
  if (MATERIAL_CUES.update.test(text)) return 'update';
  return 'new';
}

function materialTerms(text) {
  return [...new Set(String(text).toLocaleLowerCase().match(/[a-z0-9][a-z0-9.+-]*|[\u4e00-\u9fff]{2,}/gi) || [])];
}

function eventTerms(event) {
  return materialTerms([event.title, event.category, ...event.tags, ...event.assets.flatMap(asset => [asset.name, asset.ticker]), event.versions.at(-1).fact].join(' '));
}

function candidateForMaterial(material, events) {
  const terms = materialTerms(materialText(material));
  const ranked = events.map(event => {
    const matches = eventTerms(event).filter(term => terms.includes(term));
    return {event, matches, score: matches.length};
  }).filter(item => item.score > 0).sort((first, second) => second.score - first.score);
  if (!ranked.length) return null;
  const match = ranked[0];
  return {eventId: match.event.id, score: match.score, matches: match.matches.slice(0, 8), reason: '主体、动作或对象命中：' + match.matches.slice(0, 5).join('、')};
}

function normalizeMaterial(material) {
  const normalized = {
    title: String(material?.title || '').trim(),
    publisher: String(material?.publisher || '').trim(),
    disclosedAt: String(material?.disclosedAt || '').trim(),
    url: String(material?.url || '').trim(),
    body: String(material?.body || '').trim()
  };
  if (!normalized.title || !normalized.publisher || !normalized.body || !/^\d{4}-\d{2}-\d{2}$/.test(normalized.disclosedAt) || !/^https:\/\//.test(normalized.url)) throw new Error('材料标题、发布方、正文、披露日期和 HTTPS 原文链接均为必填');
  return normalized;
}

export function processMaterial(material, data) {
  const normalized = normalizeMaterial(material);
  const text = materialText(normalized);
  const type = materialType(text);
  const relation = materialRelation(text);
  const candidate = candidateForMaterial(normalized, data.events);
  const duplicate = data.sources.find(source => source.url === normalized.url);
  const event = candidate ? data.events.find(item => item.id === candidate.eventId) : null;
  const current = event?.versions.at(-1) || null;
  const nextState = relation === 'termination' || relation === 'denial' ? 'terminated' : current?.state === 'planned' && type === 'fact' ? 'confirmed' : current?.state || 'confirmed';
  const conflict = event && type === 'fact' && (relation === 'termination' || relation === 'denial' || relation === 'correction') ? {
    kind: relation,
    previousState: current.state,
    nextState,
    message: relation === 'correction' ? '材料包含更正/澄清，不能覆盖旧版本；需保留原文并标记替代关系。' : '材料与当前结论存在状态变化，需保留旧版本并追加新版本。'
  } : null;
  const status = duplicate ? 'duplicate' : !candidate ? 'new-event' : type === 'fact' ? 'update' : 'review';
  const sourceId = 'intake-' + materialHash(normalized.url + '|' + normalized.disclosedAt);
  return {
    material: normalized,
    sourceId,
    type,
    typeLabel: type === 'fact' ? '事实' : type === 'inference' ? '推测' : '传闻',
    relation,
    relationLabel: relation === 'termination' ? '终止/取消' : relation === 'denial' ? '否认' : relation === 'correction' ? '更正/澄清' : relation === 'update' ? '更新' : '新增',
    candidate,
    currentState: current?.state || null,
    nextState,
    conflict,
    duplicate: Boolean(duplicate),
    status,
    conclusion: duplicate ? '原文链接已存在，不重复计入证据。' : type !== 'fact' ? '材料进入人工复核队列，不改变事实状态。' : event ? '确认后保留旧版本，追加一条带出处的新版本。' : '确认后建立新事件档案，等待后续材料继续归并。'
  };
}

export function applyMaterial(data, processed, checkedAt = new Date().toISOString()) {
  if (!processed || processed.duplicate) return {data, changed: false, reason: 'duplicate'};
  const next = structuredClone(data);
  const material = processed.material;
  const source = {
    id: processed.sourceId,
    publisher: material.publisher,
    publishedAt: material.disclosedAt,
    url: material.url,
    title: material.title,
    summary: material.body.slice(0, 220),
    checkedAt,
    precision: 'day',
    verification: '材料处理台输入 · 待人工复核'
  };
  if (processed.type !== 'fact') {
    next.intakeQueue = [...(next.intakeQueue || []), {
      ...material,
      sourceId: processed.sourceId,
      type: processed.type,
      relation: processed.relation,
      candidate: processed.candidate?.eventId || null,
      queuedAt: checkedAt
    }];
    return {data: next, changed: true, reviewOnly: true, source, event: processed.candidate ? next.events.find(event => event.id === processed.candidate.eventId) : null};
  }
  next.sources.push(source);
  let event;
  if (processed.candidate) {
    event = next.events.find(item => item.id === processed.candidate.eventId);
    const previous = event.versions.at(-1);
    if (material.disclosedAt <= previous.date) return {data, changed: false, reason: 'date-before-current'};
    const state = processed.nextState;
    event.versions.push({
      date: material.disclosedAt,
      state,
      summary: material.body.slice(0, 220),
      sourceIds: [source.id],
      fact: state === 'terminated' ? '材料确认相关计划已终止、取消或不再推进。' : '材料确认主体、动作与对象的最新披露。',
      unknown: state === 'terminated' ? '不能据此推断主体未来所有合作或经营结果。' : '材料未覆盖后续执行、影响范围或最终结果。',
      watch: '继续核验后续官方更新、更正或执行结果。',
      capturedAt: checkedAt
    });
  } else {
    const id = 'intake-' + materialHash(material.title + '|' + material.disclosedAt);
    event = {
      id,
      title: material.title,
      category: '材料处理台 · 待分类',
      tags: materialTerms(material.title).slice(0, 8),
      assets: [],
      impact: '材料已进入档案，影响路径仍需人工补充与后续证据验证。',
      analysis: '这是由材料处理台建立的初始档案，不能替代投资判断。',
      versions: [{
        date: material.disclosedAt,
        state: processed.nextState,
        summary: material.body.slice(0, 220),
        sourceIds: [source.id],
        fact: '材料确认主体、动作与对象的最新披露。',
        unknown: '材料未覆盖后续执行、影响范围或最终结果。',
        watch: '继续核验后续官方更新、更正或执行结果。',
        capturedAt: checkedAt
      }]
    };
    next.events.push(event);
  }
  return {data: next, changed: true, reviewOnly: false, source, event, previousState: processed.currentState, nextState: processed.nextState};
}

export const LAB_STEPS = [
  {type:'rumor', kind:'传闻', title:'匿名消息称星河科技将收购晨光机器人', state:'未证实', body:'虚构线索，没有原始文件；权重低，仅登记，不作为事实。', rule:'新增线索 → 保留原始来源，等待验证。'},
  {type:'fact', kind:'事实', title:'虚构公司公告：董事会批准签署意向书', state:'意向阶段', body:'官方层材料确认意向书，不能据此认定交割完成。', rule:'更新 → 提高“意向已签署”的证据权重，不确认交割。'},
  {type:'inference', kind:'推测', title:'据此猜测下月完成收购', state:'意向阶段', body:'这是对时间的推测，不能覆盖公告所确认的范围。', rule:'推测 → 单独分层，不改变事实状态。'},
  {type:'fact', kind:'更正', title:'虚构更正：交易为拟持股 20%，并非全资收购', state:'已更正', body:'保留旧版本，明确全资收购说法已失效。', rule:'更正 → 标记先前说法已被替代，触发站内提醒。'},
  {type:'fact', kind:'否认', title:'虚构公司回应：谈判终止，未完成收购', state:'已终止', body:'终止声明优先于过往意向和匿名线索。', rule:'否认 → 改变当前结论，同时保留历史证据链。'},
  {type:'rumor', kind:'过期', title:'早期匿名线索超过演练有效期', state:'已终止', body:'旧传闻降权并标记过期；不能把已终止的官方结论恢复为未证实。', rule:'过期 → 降低旧线索权重，不撤销后续官方终止声明。'}
];

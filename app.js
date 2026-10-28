import {STATES, validateKnowledge, filteredEvents, factRecords, coverage, relatedEvents, LAB_STEPS} from './engine.js';
import {briefFor, compareVersions, evidenceGraph, textChanges, titleAt} from './dossier.js';
import {createPassport} from './passport.js';

const select = selector => document.querySelector(selector);
const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
const state = {data:null, current:null, version:0, baseline:null, graphMode:null, query:'', category:'all', filter:'all', sort:'recent', visible:8, expanded:false, lab:0};
let toastTimer;
let storageNotice = false;
let passportUrl;
let passportRequest = 0;

function readSaved(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
const savedIds = readSaved('signal-atlas.watch.v2', []);
const watched = new Set(Array.isArray(savedIds) ? savedIds.filter(id => typeof id === 'string') : []);
const savedActivity = readSaved('signal-atlas.activity.v2', []);
const activity = Array.isArray(savedActivity) ? savedActivity.filter(item => item && typeof item.text === 'string').slice(0, 20) : [];

function persist() {
  try {
    localStorage.setItem('signal-atlas.watch.v2', JSON.stringify([...watched]));
    localStorage.setItem('signal-atlas.activity.v2', JSON.stringify(activity.slice(0,20)));
  } catch {
    if (!storageNotice) toast('浏览器禁止存储，本次关注仅在当前页面保留');
    storageNotice = true;
  }
}

function toast(message) {
  const element = select('#toast');
  element.textContent = message;
  element.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => element.classList.remove('show'), 3200);
}

function openDialog(title, body, eyebrow = 'SIGNAL ATLAS') {
  select('#dialog-title').textContent = title;
  select('#dialog-eyebrow').textContent = eyebrow;
  select('#dialog-body').innerHTML = body;
  if (!select('#detail-dialog').open) select('#detail-dialog').showModal();
}

function goToDetail() {
  select('#event-view').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block:'start'});
}

function updateWatch() {
  select('#nav-watch-count').textContent = watched.size;
  select('#watch-btn').innerHTML = watched.has(state.current?.id) ? '✓ 已关注 · 点击取消' : '＋ 关注事件';
  select('#watch-btn').classList.toggle('watched', watched.has(state.current?.id));
}

function chooseEvent(id, scroll = false) {
  const event = state.data.events.find(item => item.id === id);
  if (!event) return;
  state.current = event;
  state.version = event.versions.length - 1;
  state.baseline = null;
  state.expanded = false;
  const selectedIndex = filteredEvents(state.data.events,state,watched).findIndex(item => item.id === id);
  if (selectedIndex >= state.visible) state.visible = selectedIndex + 1;
  select('#evidence-type').value = 'all';
  history.replaceState(null, '', '#event=' + event.id);
  renderDirectory();
  renderDetail();
  if (scroll) goToDetail();
}

function renderDirectory() {
  if (!state.data) return;
  const results = filteredEvents(state.data.events, state, watched);
  select('#event-count').textContent = results.length;
  document.querySelectorAll('.filter-tab').forEach(tab => {
    const filter = tab.dataset.filter;
    const count = filter === 'all' ? state.data.events.length : filter === 'watch' ? watched.size :
      state.data.events.filter(event => event.versions.at(-1).state === filter).length;
    tab.querySelector('span').textContent = count;
    tab.classList.toggle('active', filter === state.filter);
    tab.setAttribute('aria-pressed', String(filter === state.filter));
  });
  select('#event-list').innerHTML = results.length ? results.slice(0,state.visible).map(event => {
    const version = event.versions.at(-1);
    const meta = STATES[version.state];
    return '<button class="event-card ' + (state.current?.id === event.id ? 'selected' : '') + '" data-event-id="' + event.id + '" aria-pressed="' + (state.current?.id === event.id) + '"><span class="event-card-status ' + meta.tone + '"></span><span class="event-card-body"><b>' + escape(event.title) + '</b><small>' + escape(event.category) + ' · ' + version.date + '</small></span><span class="event-card-score">' + (watched.has(event.id) ? '★' : String(event.versions.length).padStart(2,'0')) + '</span></button>';
  }).join('') : '<div class="empty-state">没有匹配的事件<p>试试其他关键词，或清除筛选重新探索。</p><button class="outline-btn" data-action="reset">清除筛选</button></div>';
  select('#result-count').textContent = '显示 ' + Math.min(state.visible, results.length) + ' / ' + results.length + ' 条档案';
  select('#load-events').hidden = state.visible >= results.length;
  select('#event-view').hidden = !results.length;
  return results;
}

function applyFilters(scroll = false) {
  state.visible = 8;
  const results = renderDirectory();
  if (results?.length && !results.some(event => event.id === state.current?.id)) chooseEvent(results[0].id);
  else if (results?.length) {
    const selectedIndex = results.findIndex(event => event.id === state.current?.id);
    if (selectedIndex >= state.visible) {state.visible = selectedIndex + 1;renderDirectory();}
  }
  if (scroll) select('#library').scrollIntoView({behavior:'smooth'});
}

function resetFilters() {
  state.query = '';
  state.category = 'all';
  state.filter = 'all';
  select('#event-search').value = '';
  select('#category-filter').value = 'all';
  applyFilters();
}

function renderDetail() {
  const event = state.current;
  if (!event) return;
  const version = event.versions[state.version];
  const meta = STATES[version.state];
  select('#event-title').textContent = titleAt(event,state.version);
  select('#detail-category').textContent = event.category;
  select('#detail-tags').innerHTML = event.tags.slice(0,5).map(tag => '<button class="tag" data-query="' + escape(tag) + '">' + escape(tag) + '</button>').join('');
  select('#status-chip').textContent = meta.label;
  select('#status-chip').className = 'status-chip ' + meta.tone;
  select('#version-caption').textContent = 'V' + (state.version + 1) + ' / ' + event.versions.length + ' · 历史材料范围';
  select('#summary-text').textContent = version.summary;
  select('#first-seen').textContent = event.versions[0].date;
  select('#last-updated').textContent = version.date;
  select('#version-select').innerHTML = event.versions.map((item,index) => '<option value="' + index + '">' + 'V' + (index + 1) + ' · ' + item.date + '</option>').join('');
  select('#version-select').value = state.version;
  select('#version-note').textContent = state.version < event.versions.length - 1 ? '正在回到过去：后续版本已隐藏，结论只使用当前时点以前的材料。' : '当前为本库最后收录版本，可切换到过去查看结论如何变化。';
  select('#prev-version').disabled = state.version === 0;
  select('#next-version').disabled = state.version === event.versions.length - 1;
  const range = select('#version-range');
  range.max = Math.max(1,event.versions.length - 1);
  range.value = state.version;
  range.disabled = event.versions.length === 1;
  range.setAttribute('aria-valuetext','V' + (state.version + 1) + '，' + version.date);
  select('#range-caption').textContent = 'V' + (state.version + 1) + ' / ' + version.date;
  select('#rail-stops').innerHTML = event.versions.map((entry,index) => '<button data-replay="' + index + '" aria-label="回放 V' + (index+1) + '，' + entry.date + '" aria-pressed="' + (index === state.version) + '"><span>V' + (index+1) + '</span><small>' + entry.date + '</small></button>').join('');
  renderBrief();
  renderComparison();
  renderGraph();
  const records = factRecords(event,state.version,state.data.sources,state.data.checkedAt);
  const calculation = coverage(records);
  select('#ring-score').textContent = calculation.total;
  select('.score-ring').style.background = 'conic-gradient(var(--mint-bright) 0 ' + calculation.total + '%, var(--line) ' + calculation.total + '% 100%)';
  select('#score-rows').innerHTML = calculation.rows.map(row => '<div><span>' + row.label + '</span><b>' + row.count + ' / ' + row.total + '</b></div><div class="coverage-bar"><i style="width:' + row.percent + '%"></i></div>').join('');
  select('#verdict-title').textContent = state.version === event.versions.length - 1 ? '把事实、变化和边界放在一起' : '回到 V' + (state.version + 1) + '：当时能够知道什么';
  select('#verdict-text').textContent = state.version === event.versions.length - 1 ? event.analysis : '当时已披露：' + version.fact + ' 未确定：' + version.unknown + ' 后续材料不参与当前回放结论。';
  select('#verdict-list').innerHTML = [['已知事实',version.fact],['尚不支持',version.unknown],['下一步看',version.watch]].map(([label,text]) => '<div><b>' + label + '</b><span>' + escape(text) + '</span></div>').join('');
  select('#asset-list').innerHTML = event.assets.map(asset => '<div class="stock-row"><div class="stock-icon">' + escape(asset.name.slice(0,1)) + '</div><div class="stock-name"><b>' + escape(asset.name) + '</b><span>' + escape(asset.ticker) + ' · ' + escape(asset.relation) + '</span></div></div>').join('');
  select('#relation-note').textContent = briefFor(event,state.version,state.data.sources).relevance;
  const related = relatedEvents(state.data.events,event);
  select('#related-events').innerHTML = related.length ? related.map(item => '<button class="related-card" data-event-id="' + item.id + '"><span>' + escape(item.category) + '</span><b>' + escape(item.title) + '</b><i>↗</i></button>').join('') : '<p class="muted">当前样本中暂无其他关联事件。</p>';
  updateWatch();
  renderTimeline();
}

function renderBrief() {
  const brief = briefFor(state.current,state.version,state.data.sources);
  select('#brief-version').textContent = 'DOSSIER / V' + (state.version+1);
  select('#brief-grid').innerHTML = [['01','发生了什么','官方事实',brief.fact],['02','为什么值得关注','产品解读 · 非收益预测',brief.relevance],['03','还有什么未证实','证据边界',brief.unknown]].map(([number,title,label,text]) => '<article><span class="brief-number">' + number + '</span><h4>' + title + '</h4><small>' + label + '</small><p>' + escape(text) + '</p></article>').join('');
  select('#brief-citations').innerHTML = '<span>本版事实出处</span>' + brief.sources.map(source => '<a href="' + escape(source.url) + '" target="_blank" rel="noopener noreferrer">' + escape(source.publisher) + ' · ' + source.publishedAt + ' ↗</a>').join('');
}

function renderComparison() {
  const comparison = compareVersions(state.current,state.version,state.baseline ?? state.version-1);
  select('#compare-select').disabled = !comparison;
  select('#compare-select').innerHTML = comparison ? state.current.versions.slice(0,state.version).map((version,index) => '<option value="' + index + '">V' + (index+1) + ' · ' + version.date + '</option>').join('') : '<option>无更早版本</option>';
  if (!comparison) {
    select('#comparison-body').innerHTML = '<div class="empty-state">这是首个收录版本，暂无前版可比。<p>不虚构结论变化；可在时间机中选择后续版本查看。</p></div>';
    return;
  }
  select('#compare-select').value = comparison.baseline;
  const sources = comparison.newIds.map(id => state.data.sources.find(source => source.id === id));
  const status = STATES[comparison.before.state].label + ' → ' + STATES[comparison.after.state].label;
  select('#comparison-body').innerHTML = '<div class="comparison-banner"><strong>' + (comparison.stateChanged ? '状态变化：' : '状态保持，事实范围更新：') + status + '</strong><span>新增 ' + sources.length + ' 份原文 · V' + (comparison.baseline+1) + ' → V' + (state.version+1) + '</span></div><div class="comparison-columns"><span>之前 / ' + comparison.before.date + '</span><span>当时 / ' + comparison.after.date + '</span></div>' + comparison.fields.map(field => '<section class="comparison-row"><h4>' + field.label + '<small>' + (field.changed ? '内容更新' : '未变') + '</small></h4><div class="comparison-pair"><p>' + escape(field.before) + '</p><p>' + textChanges(field.before,field.after).filter(part => part.kind !== 'removed').map(part => part.kind === 'added' ? '<mark>' + escape(part.text) + '</mark>' : escape(part.text)).join('') + '</p></div></section>').join('') + '<div class="comparison-reason"><b>变化依据 / 官方披露</b>' + sources.map(source => '<a href="' + escape(source.url) + '" target="_blank" rel="noopener noreferrer">' + escape(source.title) + ' · ' + source.publishedAt + ' ↗</a>').join('') + '<p>高亮表示文字更新，不等于原文被撤回。历史材料保留；' + (comparison.after.state === 'terminated' && comparison.before.state !== 'terminated' ? '后续终止声明使原交易计划失效，而不是抹去当时的计划公告。' : '未收录明确撤回声明，不将旧证据标记为无效。') + '</p></div>';
}

function renderGraph() {
  const graph = evidenceGraph(state.current,state.version,state.data.sources);
  const mode = state.graphMode ?? (matchMedia('(max-width: 760px)').matches ? 'list' : 'map');
  select('#evidence-map').hidden = mode !== 'map';
  select('#graph-list').hidden = mode !== 'list';
  select('#graph-map-btn').setAttribute('aria-pressed',String(mode === 'map'));
  select('#graph-list-btn').setAttribute('aria-pressed',String(mode === 'list'));
  select('#map-sources').innerHTML = '<h4>原始文档 / SOURCE</h4>' + graph.sources.map((source,index) => '<button class="map-node source-node" data-source="' + escape(source.id) + '"><small>DOC / ' + String(index+1).padStart(2,'0') + ' · ' + source.publishedAt + '</small><b>' + escape(source.publisher) + '</b><span>' + escape(source.title) + '</span><em>查看原文 ↗</em></button>').join('');
  select('#map-versions').innerHTML = '<h4>事实版本 / VERSION</h4>' + graph.versions.map((version,index) => '<button class="map-node version-node" data-replay="' + index + '" data-graph-version="' + index + '" aria-pressed="' + (index === state.version) + '"><small>V' + (index+1) + ' / ' + version.date + '</small><b>' + STATES[version.state].label + '</b><span>' + escape(version.fact) + '</span><em>' + (index ? (version.state === 'terminated' ? '终止此前计划' : '更新前版披露') : '首次收录') + '</em></button>').join('');
  select('#graph-list').innerHTML = graph.versions.map((version,index) => '<article class="graph-list-entry"><button class="text-btn" data-replay="' + index + '">V' + (index+1) + ' · ' + version.date + ' / ' + STATES[version.state].label + '</button><p>' + escape(version.fact) + '</p><span class="support-label">支持本版事实</span>' + version.sourceIds.map(id => {
    const source = graph.sources.find(item => item.id === id);
    return '<a href="' + escape(source.url) + '" target="_blank" rel="noopener noreferrer">' + escape(source.title) + ' ↗</a>';
  }).join('') + '</article>').join('');
  requestAnimationFrame(drawGraph);
}

function drawGraph() {
  if (!state.current || select('#evidence-map').hidden) return;
  const map = select('#evidence-map');
  const bounds = map.getBoundingClientRect();
  if (!bounds.width) return;
  const graph = evidenceGraph(state.current,state.version,state.data.sources);
  const lines = select('#graph-lines');
  lines.setAttribute('viewBox','0 0 ' + bounds.width + ' ' + bounds.height);
  lines.innerHTML = graph.links.map(link => {
    const source = map.querySelector('[data-source="' + link.sourceId + '"]').getBoundingClientRect();
    const version = map.querySelector('[data-graph-version="' + link.version + '"]').getBoundingClientRect();
    const start = source.right - bounds.left;
    const end = version.left - bounds.left;
    const sourceY = source.top + source.height/2 - bounds.top;
    const versionY = version.top + version.height/2 - bounds.top;
    const middle = (start+end)/2;
    return '<path d="M ' + start + ' ' + sourceY + ' C ' + middle + ' ' + sourceY + ', ' + middle + ' ' + versionY + ', ' + end + ' ' + versionY + '"/><circle cx="' + start + '" cy="' + sourceY + '" r="4"/><circle cx="' + end + '" cy="' + versionY + '" r="4"/>';
  }).join('');
}

function showSource(id) {
  const graph = evidenceGraph(state.current,state.version,state.data.sources);
  const source = graph.sources.find(item => item.id === id);
  if (!source) return;
  const versions = graph.versions.flatMap((version,index) => version.sourceIds.includes(id) ? ['V' + (index+1)] : []);
  openDialog('线索原文 / ' + source.publisher,'<article class="source-card"><small>' + source.publishedAt + ' · 支持 ' + versions.join('、') + ' 的事实</small><h3>' + escape(source.title) + '</h3><p>' + escape(source.summary) + '</p><a href="' + escape(source.url) + '" target="_blank" rel="noopener noreferrer">打开官方原文 ↗</a></article>','EVIDENCE NODE');
}

async function showPassport() {
  if (!state.current) return;
  const request = ++passportRequest;
  const event = state.current;
  const version = state.version;
  openDialog('正在制作信号护照','<p>正在生成包含历史版本与官方出处的 PNG…</p>','SIGNAL PASSPORT');
  try {
    const href = new URL(location.href);
    href.hash = 'event=' + event.id;
    const image = await createPassport(event,version,state.data.sources,state.data.checkedAt,href.href);
    if (request !== passportRequest || !select('#detail-dialog').open) return;
    if (passportUrl) URL.revokeObjectURL(passportUrl);
    passportUrl = URL.createObjectURL(image.blob);
    openDialog('信号护照 · V' + (version+1),'<p class="muted">' + image.width + ' × ' + image.height + ' PNG · 仅包含选中版本及以前的证据。长图底部保留完整官方出处。</p><a id="passport-download" class="primary-btn passport-download" href="' + passportUrl + '" download="' + event.id + '-v' + (version+1) + '.png">下载 PNG 护照 ↓</a><img class="passport-preview" alt="' + escape(event.title) + '，V' + (version+1) + ' 信号护照预览" src="' + passportUrl + '"><p class="muted">文字版及可点击的完整出处可通过详情中的“导出研究卡片”另存为 Markdown。</p>','SIGNAL PASSPORT');
  } catch (error) {
    if (request === passportRequest && select('#detail-dialog').open) openDialog('护照暂未生成','<p>' + escape(error.message) + '</p><button class="outline-btn" data-action="export-markdown">改用 Markdown 导出</button>');
  }
}

function renderTimeline() {
  const records = factRecords(state.current,state.version,state.data.sources,state.data.checkedAt);
  const type = select('#evidence-type').value;
  const currentVersion = state.current.versions[state.version];
  const analysis = {id:'analysis',type:'view',title:state.version === state.current.versions.length-1 ? state.current.analysis : '本版本确认范围：' + currentVersion.fact + ' 仍未确认：' + currentVersion.unknown,date:currentVersion.date,sources:[]};
  let entries = [...records,analysis];
  if (type !== 'all') entries = entries.filter(record => record.type === type);
  const occurredSort = select('#time-sort').value === 'occurred';
  entries.sort((first,second) => (occurredSort ? second.occurredAt ?? '' : second.date).localeCompare(occurredSort ? first.occurredAt ?? '' : first.date));
  const displayed = state.expanded ? entries : entries.slice(0,4);
  select('#evidence-count').textContent = records.length + ' 个事实版本';
  select('#timeline-list').innerHTML = displayed.length ? displayed.map(record => '<article class="timeline-item ' + record.type + '"><div class="time"><b>' + escape(record.date.slice(5)) + '</b><span>' + escape(record.date.slice(0,4)) + '</span></div><div class="evidence-content"><div class="evidence-meta"><span class="type-label ' + record.type + '">' + (record.type === 'fact' ? '官方事实' : '产品观点') + '</span><span class="source">' + (record.type === 'fact' ? escape(record.sources.map(source => source.publisher).join(' / ')) : '本产品分析 · 非外部引述') + '</span></div><h4>' + escape(record.title) + '</h4>' + (record.type === 'fact' ? '<div class="evidence-foot"><button class="text-btn" data-record="' + record.id + '">四种时间 / 来源详情 ↗</button>' + record.sources.map(source => '<a href="' + escape(source.url) + '" target="_blank" rel="noopener noreferrer">原文 ↗</a>').join('') + '</div>' : '<p>观点不参与事实状态判定；参考上方已披露材料。</p>') + '</div></article>').join('') : '<div class="empty-state">当前档案没有此类材料。<p>不为凑齐分类而编造推测或传闻，可前往“变化演练”体验。</p></div>';
  select('#load-more').hidden = entries.length <= 4;
  select('#load-more').textContent = state.expanded ? '收起证据 ↑' : '展开全部 ' + entries.length + ' 条记录 ↓';
}

function changeVersion(index) {
  const prior = state.version;
  state.version = Math.max(0,Math.min(Number(index),state.current.versions.length - 1));
  if (prior === state.version) return;
  state.expanded = false;
  renderDetail();
  if (watched.has(state.current.id)) {
    activity.unshift({eventId:state.current.id,time:new Date().toISOString(),text:'历史回放：' + state.current.title + ' · V' + (prior + 1) + ' → V' + (state.version + 1)});
    activity.splice(20);
    persist();
    toast('已记录本次历史回放变化，可在“我的关注”查看');
  }
}

function showRecord(id) {
  const record = factRecords(state.current,state.version,state.data.sources,state.data.checkedAt).find(item => item.id === id);
  if (!record) return;
  openDialog('证据时间与来源','<p class="muted">' + escape(record.title) + '</p><dl class="time-details"><dt>事件发生时间</dt><dd>' + escape(record.occurredAt ?? '未独立确定') + '<small>' + escape(record.occurredNote) + '</small></dd><dt>原文披露时间</dt><dd>' + record.date + '（日期精度；不虚构时分）</dd><dt>系统抓取 / 核验时间</dt><dd>' + record.capturedAt + '</dd><dt>档案更新时间</dt><dd>' + record.updatedAt + '</dd></dl><p class="muted">抓取时间指此次建库核验，不是原文发布时刻。</p>' + record.sources.map(source => '<article class="source-card"><span class="section-label">' + escape(source.publisher) + '</span><h3>' + escape(source.title) + '</h3><p>' + escape(source.summary) + '</p><a href="' + escape(source.url) + '" target="_blank" rel="noopener noreferrer">打开官方原文 ↗</a></article>').join(''),'SOURCE & TIME');
}

function showMethod() {
  openDialog('每个结论，都有一条证据链','<div class="method-explainer"><h3>01 · 归并到同一件事</h3><p>以主体、动作、对象和报告期 / 地区区分事件。本库人工校验事件 ID；同一公告的财报与回购分别建档，通过主体关联。</p><h3>02 · 分清谁说了什么</h3><p>官方材料作为事实依据；产品分析标为观点。推测和传闻不升级为事实，同源文档不计为多个独立出处。</p><h3>03 · 版本只追加，历史可回看</h3><p>历史回放只读取该版本及以前的材料。官方终止会使先前计划失效，不删除原始计划。</p><h3>04 · 覆盖率有明确分母</h3><p>分别计算当前事实记录的官方出处、披露日期、收录记录、独立发生日期完整度，再取四项等权平均。未知时间如实保留为空。此分值不是发生概率。</p><h3>05 · 数据范围</h3><p>收录 30 条档案：16 条近期官方披露（2026-09-24 至 2026-10-27）与 14 条历史案例（2020–2024）。当前没有接入实时行情、外部 AI 推理接口或后台推送；中文摘要已逐项对照原文核验。</p></div>','HOW IT WORKS');
}

function showWatch() {
  const saved = state.data.events.filter(event => watched.has(event.id));
  openDialog('我的关注 · ' + saved.length + ' 个事件','<p class="muted">收藏保存在此浏览器。站内动态记录你的历史回放，不代表有新的市场披露。</p><div class="watch-items">' + (saved.length ? saved.map(event => '<div class="saved-row"><button data-event-id="' + event.id + '">' + escape(event.title) + '</button><button class="text-btn" data-unwatch="' + event.id + '">取消关注</button></div>').join('') : '<div class="empty-state">还没有收藏。先关注一条你想继续研究的事件。</div>') + '</div><h3>站内动态</h3>' + (activity.length ? activity.slice(0,8).map(item => '<article class="activity-item"><small>' + escape(item.time) + '</small><p>' + escape(item.text) + '</p></article>').join('') : '<p class="muted">关注事件后，切换历史版本即可看到变化记录。</p>'),'YOUR WATCHLIST');
}

function showSources() {
  openDialog('官方证据库 · ' + state.data.sources.length + ' 个文档','<label class="sr-only" for="source-search">检索原始文档</label><input id="source-search" type="search" placeholder="搜索文档、发布机构或内容"><div id="source-results"></div>','THE SOURCE LIBRARY');
  renderSources('');
  select('#source-search').addEventListener('input',event => renderSources(event.target.value));
}

function renderSources(query) {
  const tokens = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const sources = state.data.sources.filter(source => tokens.every(token => (source.title + source.publisher + source.summary).toLowerCase().includes(token)));
  select('#source-results').innerHTML = sources.length ? sources.map(source => '<article class="source-card"><small>' + escape(source.publisher) + ' · ' + source.publishedAt + '</small><h3>' + escape(source.title) + '</h3><p>' + escape(source.summary) + '</p><a href="' + escape(source.url) + '" target="_blank" rel="noopener noreferrer">打开官方原文 ↗</a></article>').join('') : '<div class="empty-state">没有匹配文档</div>';
}

function showLab() {
  const current = LAB_STEPS[state.lab];
  openDialog('一次消息，六种变化','<p class="lab-disclaimer">虚构公司 / 虚构材料 · 仅用于交互演练，不进入真实事件知识库</p><div class="lab-progress">' + LAB_STEPS.map((item,index) => '<span class="' + (index <= state.lab ? 'done' : '') + '">' + (index + 1) + '</span>').join('') + '</div><div class="status-chip ' + (current.type === 'rumor' ? 'rumor' : 'partial') + '">' + current.state + '</div><h3>' + current.title + '</h3><p>' + current.body + '</p><div class="relation-note">' + current.rule + '</div><div class="lab-log">' + LAB_STEPS.slice(0,state.lab+1).map((item,index) => '<p><b>V' + (index + 1) + ' / ' + item.kind + '</b> ' + item.state + '</p>').join('') + '</div><div class="lab-actions"><button class="outline-btn" data-lab="reset">重新开始</button><button class="primary-btn" data-lab="next" ' + (state.lab === LAB_STEPS.length-1 ? 'disabled' : '') + '>' + (state.lab === LAB_STEPS.length-1 ? '演练完成' : '注入下一条材料 →') + '</button></div>','CHANGE SIMULATOR');
}

async function share() {
  const url = new URL(location.href);
  url.hash = 'event=' + state.current.id;
  try { await navigator.clipboard.writeText(url.href); toast('事件直达链接已复制'); }
  catch { openDialog('分享这个事件','<p>复制下面的链接，直接回到该事件。</p><input class="share-input" readonly value="' + escape(url.href) + '">'); }
}

function exportCard() {
  const event = state.current;
  const version = event.versions[state.version];
  const records = factRecords(event,state.version,state.data.sources,state.data.checkedAt);
  const lines = ['# ' + event.title,'','历史归档版本：V' + (state.version+1) + ' / ' + version.date,'',version.summary,'','## 已知事实',version.fact,'','## 尚不支持',version.unknown,'','## 官方原始出处',...records.flatMap(record => record.sources.map(source => '- ' + source.title + ' (' + source.publishedAt + ') ' + source.url)),'','收录核验时间：' + state.data.checkedAt,'历史材料范围，不构成当前投资建议。'];
  const blob = new Blob([lines.join('\n')],{type:'text/markdown;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = event.id + '-v' + (state.version+1) + '.md';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url),1000);
  toast('已导出含原始出处的研究卡片');
}

async function loadKnowledge() {
  const button = select('#refresh-btn');
  button.disabled = true;
  button.textContent = '正在核验归档…';
  try {
    const response = await fetch('knowledge.json',{cache:'no-cache'});
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const data = validateKnowledge(await response.json());
    const oldId = state.current?.id;
    state.data = data;
    for (const id of watched) if (!data.events.some(event => event.id === id)) watched.delete(id);
    select('#category-filter').innerHTML = '<option value="all">全部领域</option>' + [...new Set(data.events.map(event => event.category))].map(category => '<option>' + escape(category) + '</option>').join('');
    select('#category-filter').value = state.category;
    select('#stat-events').textContent = data.events.length;
    select('#stat-evidence').textContent = data.sources.length;
    select('#stat-versions').textContent = data.events.reduce((count,event) => count + event.versions.length,0);
    select('#dataset-note').textContent = '近期 + 历史 · 核验 ' + data.checkedAt.slice(0,10);
    const deepLink = location.hash.startsWith('#event=') ? location.hash.slice(7) : '';
    const eventId = oldId || deepLink;
    const initial = filteredEvents(data.events,state,watched)[0] || data.events[0];
    chooseEvent(data.events.some(event => event.id === eventId) ? eventId : initial.id);
    applyFilters();
    select('#load-error').hidden = true;
    persist();
    if (oldId) toast('已重新读取 ' + data.events.length + ' 条归档；这不是实时市场抓取');
  } catch (error) {
    select('#load-error').hidden = false;
    select('#load-error').innerHTML = '<b>归档加载失败</b><p>' + escape(error.message) + '。' + (state.data ? '已保留上次成功载入的资料。' : '请检查网络后重试。') + '</p><button class="outline-btn" data-action="retry">重新加载</button>';
    if (!state.data) { select('#event-list').innerHTML = '<div class="empty-state">暂时无法读取事件目录</div>'; select('#event-view').hidden = true; }
  } finally { button.disabled = false; button.textContent = '↻ 重新载入归档'; }
}

select('#search-form').addEventListener('submit',event => {event.preventDefault();state.query = select('#event-search').value.trim();applyFilters(true)});
select('#event-search').addEventListener('input',event => {if (!event.target.value) {state.query = '';applyFilters()}});
select('#reset-search').addEventListener('click',resetFilters);
select('#clear-filters').addEventListener('click',resetFilters);
select('#category-filter').addEventListener('change',event => {state.category = event.target.value;applyFilters()});
select('#sort-select').addEventListener('change',event => {state.sort = event.target.value;applyFilters()});
select('#load-events').addEventListener('click',() => {state.visible += 8;renderDirectory()});
select('#load-more').addEventListener('click',() => {state.expanded = !state.expanded;renderTimeline()});
select('#evidence-type').addEventListener('change',renderTimeline);
select('#time-sort').addEventListener('change',renderTimeline);
select('#version-select').addEventListener('change',event => changeVersion(event.target.value));
select('#version-range').addEventListener('input',event => changeVersion(event.target.value));
select('#compare-select').addEventListener('change',event => {state.baseline=Number(event.target.value);renderComparison()});
select('#graph-map-btn').addEventListener('click',() => {state.graphMode='map';renderGraph()});
select('#graph-list-btn').addEventListener('click',() => {state.graphMode='list';renderGraph()});
select('#passport-btn').addEventListener('click',showPassport);
select('#detail-dialog').addEventListener('close',() => {passportRequest++;if (passportUrl) {URL.revokeObjectURL(passportUrl);passportUrl=null}});
new ResizeObserver(() => requestAnimationFrame(drawGraph)).observe(select('#evidence-map'));
window.addEventListener('resize',() => {if (state.current && state.graphMode === null) renderGraph()});
select('#prev-version').addEventListener('click',() => changeVersion(state.version-1));
select('#next-version').addEventListener('click',() => changeVersion(state.version+1));
select('#watch-btn').addEventListener('click',() => {
  if (watched.has(state.current.id)) watched.delete(state.current.id); else watched.add(state.current.id);
  persist();updateWatch();renderDirectory();
  toast(watched.has(state.current.id) ? '已关注，收藏保存在当前浏览器' : '已取消关注');
});
select('#refresh-btn').addEventListener('click',loadKnowledge);
select('#share-btn').addEventListener('click',share);
select('#export-btn').addEventListener('click',exportCard);
select('#show-method').addEventListener('click',showMethod);
select('#score-help').addEventListener('click',showMethod);
select('#watch-nav').addEventListener('click',() => state.data ? showWatch() : toast('请先加载归档'));
select('#manage-watch').addEventListener('click',showWatch);
select('#sources-nav').addEventListener('click',() => state.data ? showSources() : toast('请先加载归档'));
select('#lab-nav').addEventListener('click',showLab);
select('#dialog-close').addEventListener('click',() => select('#detail-dialog').close());
select('#dialog-confirm').addEventListener('click',() => select('#detail-dialog').close());
select('#shortcut-btn').addEventListener('click',() => select('#event-search').focus());
select('#detail-dialog').addEventListener('click',event => {if (event.target === event.currentTarget) { const rect = event.currentTarget.getBoundingClientRect();if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) event.currentTarget.close(); }});
document.addEventListener('click',event => {
  const card = event.target.closest('[data-event-id]');
  if (card && state.data) {
    select('#detail-dialog').close();
    if (!card.closest('#event-list')) resetFilters();
    chooseEvent(card.dataset.eventId,true);
  }
  const tag = event.target.closest('[data-query]');
  if (tag) {state.query = tag.dataset.query;state.filter='all';state.category='all';select('#event-search').value=state.query;select('#category-filter').value='all';applyFilters(true)}
  const filter = event.target.closest('[data-filter]');
  if (filter) {state.filter=filter.dataset.filter;applyFilters()}
  const record = event.target.closest('[data-record]');
  if (record) showRecord(record.dataset.record);
  const source = event.target.closest('[data-source]');
  if (source) showSource(source.dataset.source);
  const replay = event.target.closest('[data-replay]');
  if (replay) changeVersion(replay.dataset.replay);
  const action = event.target.closest('[data-action]');
  if (action?.dataset.action === 'reset') resetFilters();
  if (action?.dataset.action === 'retry') loadKnowledge();
  if (action?.dataset.action === 'export-markdown') exportCard();
  const unwatch = event.target.closest('[data-unwatch]');
  if (unwatch) {watched.delete(unwatch.dataset.unwatch);persist();updateWatch();applyFilters();showWatch()}
  const lab = event.target.closest('[data-lab]');
  if (lab) {state.lab = lab.dataset.lab === 'reset' ? 0 : Math.min(state.lab+1,LAB_STEPS.length-1);showLab()}
});
document.addEventListener('keydown',event => {
  if (event.key === 'Escape' && select('#detail-dialog').open) {
    event.preventDefault();
    select('#detail-dialog').close();
    return;
  }
  if (event.key === '/' && !select('#detail-dialog').open && !['INPUT','SELECT','TEXTAREA'].includes(document.activeElement.tagName)) {event.preventDefault();select('#event-search').focus()}
});
window.addEventListener('hashchange',() => {if (state.data && location.hash.startsWith('#event=')) chooseEvent(location.hash.slice(7))});
select('#theme-btn').addEventListener('click',() => {
  const light = document.documentElement.dataset.theme !== 'light';
  document.documentElement.dataset.theme = light ? 'light' : 'dark';
  select('#theme-btn').setAttribute('aria-label',light ? '切换档案主题' : '切换明亮阅读主题');
  try {localStorage.setItem('signal-atlas.theme',light ? 'light' : 'dark')} catch {}
});
try {document.documentElement.dataset.theme = localStorage.getItem('signal-atlas.theme') || 'dark'} catch {}
loadKnowledge();

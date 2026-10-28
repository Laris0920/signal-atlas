import {visibleSources, briefFor, titleAt} from './dossier.js';
import {STATES} from './engine.js';

export async function createPassport(event, versionIndex, sources, checkedAt, href) {
  await document.fonts.ready;
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) throw new Error('当前浏览器不支持图片生成，请使用 Markdown 导出');
  const width = 1200;
  const padding = 76;
  const contentWidth = width - padding * 2;
  const version = event.versions[versionIndex];
  const official = visibleSources(event, versionIndex, sources);
  const brief = briefFor(event, versionIndex, sources);
  const blocks = [];
  let cursor = 190;
  const font = size => `${size >= 30 ? 650 : 400} ${size}px -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif`;
  const addText = (text, size, color, gap = 24) => {
    context.font = font(size);
    let line = '';
    const lines = [];
    for (const character of Array.from(String(text))) {
      if (character === '\n' || context.measureText(line + character).width > contentWidth) {
        lines.push(line);
        line = character === '\n' ? '' : character;
      } else line += character;
    }
    if (line) lines.push(line);
    for (const content of lines) {
      blocks.push({text: content, size, color, top: cursor});
      cursor += Math.ceil(size * 1.65);
    }
    cursor += gap;
  };
  addText(titleAt(event, versionIndex), 46, '#172b45', 20);
  addText(`${event.category}  /  V${versionIndex + 1}  /  ${version.date}  /  ${STATES[version.state].label}`, 24, '#315b80', 38);
  for (const [label, content] of [['01 / 已知事实', brief.fact], ['02 / 关注价值 · 产品解读', brief.relevance], ['03 / 尚待确认', brief.unknown]]) {
    addText(label, 22, '#8a2d36', 6);
    addText(content, 28, '#26384b', 26);
  }
  addText('TIME MACHINE / 当时已披露的轨迹', 22, '#315b80', 14);
  for (const [index, entry] of event.versions.slice(0, versionIndex + 1).entries()) {
    const references = entry.sourceIds.map(id => `[${official.findIndex(source => source.id === id) + 1}]`).join(' ');
    addText(`V${index + 1} · ${entry.date} · ${STATES[entry.state].label} ${references}`, 22, '#8a2d36', 6);
    addText(entry.summary, 26, '#26384b', 24);
  }
  addText('SOURCE INDEX / 官方出处', 22, '#315b80', 14);
  official.forEach((source, index) => {
    addText(`[${index + 1}] ${source.publisher} · ${source.publishedAt} · ${source.title}`, 22, '#26384b', 4);
    addText(source.url, 19, '#526174', 18);
  });
  addText('归档核验：' + checkedAt + '；此时间不等于原文披露时间。', 19, '#526174', 4);
  addText('历史材料，不是实时资讯；产品解读不构成投资建议。', 21, '#8a2d36', 20);
  addText('事件入口（打开后按上方版本日期核对）：' + href, 18, '#526174', 10);
  canvas.width = width;
  canvas.height = cursor + 80;
  context.fillStyle = '#ded8cd';
  context.fillRect(0, 0, width, canvas.height);
  context.strokeStyle = '#c7bca9';
  context.lineWidth = 1;
  for (let position = 0; position < width; position += 50) {
    context.beginPath();context.moveTo(position, 0);context.lineTo(position, canvas.height);context.stroke();
  }
  context.fillStyle = '#f8f5ed';
  context.fillRect(44, 144, width - 88, canvas.height - 188);
  context.fillStyle = '#0b1729';
  context.fillRect(0,0,width,132);
  context.fillStyle = '#d8b36e';
  context.fillRect(padding, 64, 6, 42);
  context.font = font(22);
  context.fillStyle = '#f4eee3';
  context.fillText('SIGNAL ATLAS / 信号护照', padding + 24, 94);
  context.textBaseline = 'top';
  for (const block of blocks) {
    context.font = font(block.size);
    context.fillStyle = block.color;
    context.fillText(block.text, padding, block.top);
  }
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('图片导出失败，请使用 Markdown 导出');
  return {blob, width: canvas.width, height: canvas.height};
}

/*
 * 从 dist 产物里抽出 custom_css，落成 web/theme.css（jsDelivr 托管的那个文件）。
 *
 * 这么做是为了避免「本地一份、网络版再手抄一份」造成双份漂移：
 * web/theme.css 永远是 dist 的内嵌 CSS 原文，一个字节都不改。
 *
 * 用法：node tools/export-web.cjs
 */
'use strict';

const fs = require('fs');
const path = require('path');

const proj = path.join(__dirname, '..');
const distDir = path.join(proj, 'dist');
const themeJson = JSON.parse(fs.readFileSync(path.join(proj, 'theme.json'), 'utf8'));
const distFile = path.join(distDir, `${themeJson.name}.json`);

if (!fs.existsSync(distFile)) {
    console.error(`✗ 找不到 dist 产物：${distFile}\n  先跑 theme-tool build`);
    process.exit(1);
}

const dist = JSON.parse(fs.readFileSync(distFile, 'utf8'));
const css = dist.custom_css || '';
if (!css.trim()) {
    console.error('✗ dist 里的 custom_css 是空的，先检查 css/ 分片');
    process.exit(1);
}

const outFile = path.join(proj, 'web', 'theme.css');
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, css.endsWith('\n') ? css : css + '\n', 'utf8');

console.log(`✓ 已导出 ${path.relative(proj, outFile)}（${(css.length / 1024).toFixed(1)}KB，来自 ${themeJson.name}）`);

/*
 * 把原站的两张位图内联成 base64，生成 css/01-assets.css：
 *
 *   assets/logo.png    ← mikufans.cn/templets/images/top-logo[无水印].png（297×90，站名字标）
 *   assets/banner.png  ← mikufans.cn/templets/images/mad.png（663×31，「动画/音乐/游戏」长条）
 *
 * 为什么不用 {{svg:}}：
 *   那个占位符只吃 SVG。这两张是原站位图（初音 Q 版字标、青梅手写的频道横幅），
 *   重绘成 SVG 会丢掉原味，所以直接内联 PNG 的 data URI。
 *   生成的文件入库，构建时可复现；换图就替换 assets/ 里的 png 再跑一次。
 *
 * 用法：node tools/make-assets-css.cjs
 */
'use strict';

const fs = require('fs');
const path = require('path');

const proj = path.join(__dirname, '..');
const outPath = path.join(proj, 'css', '01-assets.css');

/** 图片清单：文件、变量名、宽高比（用于按高度算宽度） */
const assets = [
    { file: 'logo.png', variable: '--mf-logo', ratioVariable: '--mf-logo-ratio', ratio: '3.3' },
    { file: 'banner.png', variable: '--mf-banner', ratioVariable: null, ratio: null },
];

const lines = [];
let missing = false;

for (const asset of assets) {
    const file = path.join(proj, 'assets', asset.file);
    if (!fs.existsSync(file)) {
        console.error(`✗ 找不到 ${file}`);
        missing = true;
        continue;
    }
    const b64 = fs.readFileSync(file).toString('base64');
    lines.push(`    ${asset.variable}: url("data:image/png;base64,${b64}");`);
    if (asset.ratioVariable) {
        lines.push(`    /* ${asset.file} 的宽高比，供加载页按高度算宽度 */`);
        lines.push(`    ${asset.ratioVariable}: ${asset.ratio};`);
    }
    console.log(`· ${asset.file} → ${asset.variable}（${(b64.length / 1024).toFixed(1)}KB base64）`);
}

if (missing) process.exit(1);

const css = `/*
 * 原站位图（自动生成，勿手改）
 * 源文件：assets/logo.png、assets/banner.png
 * 生成：node tools/make-assets-css.cjs
 *
 * 放在 00-tokens 之后直接覆盖变量；顶栏、加载页、首页横幅都引用这些变量，
 * 换图只需要替换 assets 里的 png 再跑一次脚本。
 */

html:root {
${lines.join('\n')}
}
`;

fs.writeFileSync(outPath, css, 'utf8');
console.log(`✓ 已生成 ${path.relative(proj, outPath)}（${(css.length / 1024).toFixed(1)}KB）`);

/*
 * 把原站字标位图（assets/logo.png = mikufans.cn 的 top-logo[无水印].png）
 * 内联成 base64，生成 css/01-logo.css。
 *
 * 为什么不用 {{svg:}}：
 *   那个占位符只吃 SVG。原站 logo 是 297×90 的位图（初音 Q 版 + 三色字标），
 *   重绘成 SVG 会丢掉原味，所以这里直接内联 PNG 的 data URI。
 *   生成的文件入库，构建时可复现；改图就换 assets/logo.png 再跑一次。
 *
 * 用法：node tools/make-logo-css.cjs
 */
'use strict';

const fs = require('fs');
const path = require('path');

const proj = path.join(__dirname, '..');
const pngPath = path.join(proj, 'assets', 'logo.png');
const outPath = path.join(proj, 'css', '01-logo.css');

if (!fs.existsSync(pngPath)) {
    console.error(`✗ 找不到 ${pngPath}\n  先从 mikufans.cn/templets/images/top-logo[无水印].png 复制过来`);
    process.exit(1);
}

const png = fs.readFileSync(pngPath);
const b64 = png.toString('base64');

const css = `/*
 * 站名字标（自动生成，勿手改）
 * 源文件：assets/logo.png（原站 top-logo[无水印].png，297×90）
 * 生成：node tools/make-logo-css.cjs
 *
 * 放在 00-tokens 之后，直接覆盖 \`--mf-logo\`；
 * 顶栏与加载页都引用这个变量，所以换图只需要换 assets/logo.png 再跑脚本。
 */

html:root {
    --mf-logo: url("data:image/png;base64,${b64}");
    /* 位图宽高比 297 / 90，供加载页算宽度用 */
    --mf-logo-ratio: 3.3;
}
`;

fs.writeFileSync(outPath, css, 'utf8');
console.log(
    `✓ 已生成 ${path.relative(proj, outPath)}（PNG ${(png.length / 1024).toFixed(1)}KB → base64 ${(css.length / 1024).toFixed(1)}KB）`,
);

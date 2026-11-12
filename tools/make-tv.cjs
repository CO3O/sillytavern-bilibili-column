/*
 * 用几何图形「画」出 bilibili 小电视，输出矢量 SVG（不再用位图 favicon）。
 * 比例取自纯 CSS 版小电视（200×150 机身 + 圆角屏幕 + 天线 + 倾斜眼睛 + ω 嘴 + 两只脚），
 * 只把颜色换成品牌粉 #FB7299。
 *
 * 用法：node tools/make-tv.cjs [输出.svg]
 */

const fs = require('fs');

const [, , output = 'assets/tv.svg'] = process.argv;

const PINK = '#FB7299';
const WHITE = '#FFFFFF';

// 机身：x 20..220，y 60..210；天线、脚、眼睛都按这套坐标摆
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="20 30 200 190">
<rect x="60" y="45" width="50" height="12" rx="6" fill="${PINK}" transform="rotate(45 85 51)"/>
<rect x="130" y="45" width="50" height="12" rx="6" fill="${PINK}" transform="rotate(-45 155 51)"/>
<rect x="20" y="60" width="200" height="150" rx="20" fill="${PINK}"/>
<rect x="40" y="80" width="160" height="110" rx="15" fill="${WHITE}"/>
<rect x="60" y="110" width="40" height="16" fill="${PINK}" transform="rotate(-15 80 118)"/>
<rect x="120" y="110" width="40" height="16" fill="${PINK}" transform="rotate(15 140 118)"/>
<path d="M96 140 q10 12 20 0 M124 140 q10 12 20 0" fill="none" stroke="${PINK}" stroke-width="5" stroke-linecap="round"/>
<rect x="50" y="190" width="20" height="30" rx="10" fill="${PINK}"/>
<rect x="170" y="190" width="20" height="30" rx="10" fill="${PINK}"/>
</svg>
`;

fs.writeFileSync(output, svg, 'utf8');
console.log(`已写出 ${output}（矢量小电视，viewBox 20 30 200 190，${Math.round(svg.length / 1024)}KB）`);

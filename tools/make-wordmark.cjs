/*
 * 把用户提供的 bilibili 字标 SVG（99.svg）整理成主题素材：
 *   · 去掉 XML 声明、Illustrator 注释与内联 <style>
 *   · 把原蓝色 #07A3D7 改成品牌粉 #FB7299，直接写进 path
 *   · 压缩空白，减小内联体积
 *
 * 用法：node tools/make-wordmark.cjs <输入.svg> <输出.svg>
 */

const fs = require('fs');

const [, , input = 'd:/cai/sillytavern/主题/99.svg', output = 'assets/wordmark.svg'] = process.argv;

let svg = fs.readFileSync(input, 'utf8');

// 取 viewBox，决定新根标签
const viewBox = (/\sviewBox="([^"]+)"/.exec(svg) || [])[1];
if (!viewBox) {
    throw new Error('输入 SVG 缺少 viewBox');
}

// 只保留 <g>…</g> 内的图形
const body = (/<g[^>]*>([\s\S]*)<\/g>/.exec(svg) || [])[1];
if (!body) {
    throw new Error('未找到 <g> 图形内容');
}

const cleaned = body
    .replace(/class="st0"/g, 'fill="#FB7299"')
    .replace(/\s+/g, ' ')
    .trim();

const out = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${cleaned}</svg>`;

fs.writeFileSync(output, out, 'utf8');
console.log(`已写出 ${output}（viewBox ${viewBox}，${Math.round(out.length / 1024)}KB）`);

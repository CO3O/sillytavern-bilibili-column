/*
 * 把位图包成 SVG，使主题能用 {{svg:xxx.svg}} 占位符内联它。
 * 用法：node tools/png2svg.cjs <输入.png> <输出.svg>
 */

const fs = require('fs');

const [, , input = 'assets/tv.png', output = 'assets/tv.svg'] = process.argv;
const buf = fs.readFileSync(input);

if (buf[0] !== 0x89 || buf[1] !== 0x50) {
    throw new Error('输入不是 PNG');
}

const width = buf.readUInt32BE(16);
const height = buf.readUInt32BE(20);
const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">` +
    `<image width="${width}" height="${height}" href="data:image/png;base64,${buf.toString('base64')}"/></svg>`;

fs.writeFileSync(output, svg, 'utf8');
console.log(`已写出 ${output}（${width}x${height}，${Math.round(svg.length / 1024)}KB）`);

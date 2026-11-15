/*
 * 把插画背景（PNG）缩到合适尺寸并重新压成 PNG，供主题内联使用。
 * 纯 Node 实现（zlib 解码/编码），不依赖 sharp 之类的原生模块。
 *
 * 用法：node tools/make-bg.cjs <输入.png> [输出.png] [目标宽度] [裁掉顶部比例]
 */

const fs = require('fs');
const zlib = require('zlib');

const [, , input, output = 'assets/bg-ocean.png', targetWidth = '520', cropTop = '0'] = process.argv;

if (!input) {
    throw new Error('用法：node tools/make-bg.cjs <输入.png> [输出.png] [目标宽度]');
}

// ---------- CRC / chunk ----------
const crcTable = (() => {
    const t = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
        t[n] = c;
    }
    return t;
})();

function crc32(buf) {
    let c = -1;
    for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ -1) >>> 0;
}

function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const t = Buffer.from(type, 'ascii');
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
    return Buffer.concat([len, t, data, crc]);
}

// ---------- 解码 ----------
function decodePng(buf) {
    let off = 8, w = 0, h = 0, colorType = 6;
    const idat = [];
    while (off < buf.length) {
        const len = buf.readUInt32BE(off);
        const type = buf.toString('ascii', off + 4, off + 8);
        const data = buf.subarray(off + 8, off + 8 + len);
        if (type === 'IHDR') {
            w = data.readUInt32BE(0);
            h = data.readUInt32BE(4);
            if (data[8] !== 8) throw new Error('只支持 8 位深度');
            colorType = data[9];
        } else if (type === 'IDAT') {
            idat.push(data);
        }
        off += 12 + len;
        if (type === 'IEND') break;
    }
    if (colorType !== 6 && colorType !== 2) throw new Error(`不支持的 colorType：${colorType}`);

    const raw = zlib.inflateSync(Buffer.concat(idat));
    const bpp = colorType === 6 ? 4 : 3;
    const stride = w * bpp;
    const out = Buffer.alloc(w * h * bpp);

    let pos = 0;
    for (let y = 0; y < h; y++) {
        const filter = raw[pos++];
        const line = raw.subarray(pos, pos + stride);
        pos += stride;
        const cur = out.subarray(y * stride, (y + 1) * stride);
        const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : null;

        for (let x = 0; x < stride; x++) {
            const a = x >= bpp ? cur[x - bpp] : 0;
            const b = prev ? prev[x] : 0;
            const c = prev && x >= bpp ? prev[x - bpp] : 0;
            let v = line[x];
            if (filter === 1) v = (v + a) & 0xff;
            else if (filter === 2) v = (v + b) & 0xff;
            else if (filter === 3) v = (v + ((a + b) >> 1)) & 0xff;
            else if (filter === 4) {
                const p = a + b - c;
                const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
                v = (v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 0xff;
            }
            cur[x] = v;
        }
    }
    return { w, h, bpp, data: out };
}

// ---------- 缩放（按面积平均，缩小时不会出现锯齿） ----------
function resize(img, nw) {
    const { w, h, bpp, data } = img;
    const nh = Math.round((h * nw) / w);
    const out = Buffer.alloc(nw * nh * 4);

    for (let y = 0; y < nh; y++) {
        const sy0 = Math.floor((y * h) / nh);
        const sy1 = Math.max(sy0 + 1, Math.floor(((y + 1) * h) / nh));
        for (let x = 0; x < nw; x++) {
            const sx0 = Math.floor((x * w) / nw);
            const sx1 = Math.max(sx0 + 1, Math.floor(((x + 1) * w) / nw));
            let r = 0, g = 0, b = 0, a = 0, n = 0;
            for (let sy = sy0; sy < sy1; sy++) {
                for (let sx = sx0; sx < sx1; sx++) {
                    const i = (sy * w + sx) * bpp;
                    r += data[i];
                    g += data[i + 1];
                    b += data[i + 2];
                    a += bpp === 4 ? data[i + 3] : 255;
                    n++;
                }
            }
            const o = (y * nw + x) * 4;
            out[o] = Math.round(r / n);
            out[o + 1] = Math.round(g / n);
            out[o + 2] = Math.round(b / n);
            out[o + 3] = Math.round(a / n);
        }
    }
    return { w: nw, h: nh, data: out };
}

// ---------- 编码（每行在 0/1/2/4 里挑压缩效果最好的滤波） ----------
function paeth(a, b, c) {
    const p = a + b - c;
    const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

function encodePng(img) {
    const { w, h, data } = img;
    const stride = w * 3;
    const out = Buffer.alloc((stride + 1) * h);

    for (let y = 0; y < h; y++) {
        const rowStart = y * (stride + 1) + 1;
        let best = null;
        let bestScore = Infinity;
        for (const filter of [0, 1, 2, 4]) {
            const line = Buffer.alloc(stride);
            let score = 0;
            for (let x = 0; x < w; x++) {
                const s = (y * w + x) * 4;
                for (let k = 0; k < 3; k++) {
                    const cur = data[s + k];
                    const a = x > 0 ? data[s - 4 + k] : 0;
                    const b = y > 0 ? data[((y - 1) * w + x) * 4 + k] : 0;
                    const c = x > 0 && y > 0 ? data[((y - 1) * w + x - 1) * 4 + k] : 0;
                    let v = cur;
                    if (filter === 1) v = (cur - a) & 0xff;
                    else if (filter === 2) v = (cur - b) & 0xff;
                    else if (filter === 4) v = (cur - paeth(a, b, c)) & 0xff;
                    line[x * 3 + k] = v;
                    score += v < 128 ? v : 256 - v;
                }
            }
            if (score < bestScore) {
                bestScore = score;
                best = { filter, line };
            }
        }
        out[y * (stride + 1)] = best.filter;
        best.line.copy(out, rowStart);
    }

    const idat = zlib.deflateSync(out, { level: 9 });
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(w, 0);
    ihdr.writeUInt32BE(h, 4);
    ihdr[8] = 8;
    ihdr[9] = 2; // RGB
    return Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        chunk('IHDR', ihdr),
        chunk('IDAT', idat),
        chunk('IEND', Buffer.alloc(0)),
    ]);
}

// ---------- 裁掉顶部（天空大面积留白，裁掉后插画占比更大更清晰） ----------
function cropTopShare(img, share) {
    const cut = Math.round(img.h * share);
    if (!cut) return img;
    const { w, h, bpp, data } = img;
    const nh = h - cut;
    return { w, h: nh, bpp, data: data.subarray(cut * w * bpp) };
}

// ---------- 主流程 ----------
const src = cropTopShare(decodePng(fs.readFileSync(input)), Number(cropTop));
const scaled = resize(src, Number(targetWidth));
const png = encodePng(scaled);
fs.writeFileSync(output, png);

// 顺便报告左上角/顶部颜色，方便 CSS 里配同色底
const topColor = (() => {
    const { w, data } = scaled;
    const i = (Math.round(w / 2)) * 4;
    return `#${[data[i], data[i + 1], data[i + 2]].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
})();

console.log(
    `已写出 ${output}（${scaled.w}x${scaled.h}，${Math.round(png.length / 1024)}KB，顶部色 ${topColor}）`,
);

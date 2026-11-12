/*
 * 一次性素材提取脚本（零依赖，Node 内置模块）
 *
 * 数据源：本地保存的 bilibili 首页快照
 *   - 哔哩哔哩 (゜-゜)つロ 干杯~-bilibili.html          → 内联 <svg> 图标
 *   - ..._files/iconfont.css                          → bcc-iconfont 图标字体的「类名 → 码点」映射
 *   - ..._files/index-4d416e23.css                    → 官方设计 token（--Ga* / --Lb* / --Pi*）
 *
 * 用法：
 *   node tools/extract-assets.cjs report            列出可用的唯一 SVG 与图标字体映射
 *   node tools/extract-assets.cjs write logo=12,like=34 ...  按编号导出为 assets/*.svg
 *
 * 导出的 SVG 会统一把 fill/stroke 改成 currentColor，方便主题里用 color 控制。
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SNAPSHOT_DIR = 'd:/cai/sillytavern/主题/哔哩哔哩 (゜-゜)つロ 干杯~-bilibili_files';
const HTML_PATH = 'd:/cai/sillytavern/主题/哔哩哔哩 (゜-゜)つロ 干杯~-bilibili.html';
const ICONFONT_PATH = path.join(SNAPSHOT_DIR, 'iconfont.css');
const SITE_CSS_PATH = path.join(SNAPSHOT_DIR, 'index-4d416e23.css');
const ASSETS_DIR = path.join(ROOT, 'assets');

function readIfExists(file) {
    try {
        return fs.readFileSync(file, 'utf8');
    } catch {
        return '';
    }
}

/** 抽出所有 <svg>...</svg> 片段及其前文上下文 */
function collectSvgs(html) {
    const re = /<svg\b[\s\S]*?<\/svg>/g;
    const out = [];
    let m;
    while ((m = re.exec(html)) !== null) {
        const svg = m[0];
        const before = html.slice(Math.max(0, m.index - 400), m.index);
        out.push({ index: out.length, svg, before });
    }
    return out;
}

/** 用 path d 属性的拼接值做指纹，识别重复图标 */
function fingerprint(svg) {
    const ds = [...svg.matchAll(/\sd="([^"]+)"/g)].map(x => x[1]).join('|');
    return (ds || svg).replace(/\s+/g, ' ').trim();
}

/** 从 svg 前的上下文里猜语义：最近的 class 名 / aria-label / title */
function guessHint(before) {
    const hints = [];
    const aria = [...before.matchAll(/aria-label="([^"]{1,40})"/g)].pop();
    if (aria) hints.push(aria[1]);
    const titles = [...before.matchAll(/<title>([^<]{1,40})<\/title>/g)].pop();
    if (titles) hints.push(titles[1]);
    const classes = [...before.matchAll(/class="([^"]{1,120})"/g)].slice(-3).map(x => x[1]);
    hints.push(...classes);
    const text = before.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(-40);
    if (text) hints.push('text:' + text);
    return hints.join(' | ');
}

function parseIconfont(css) {
    const map = [];
    const re = /\.([A-Za-z0-9_-]+):before\s*\{\s*content:\s*"\\([0-9a-fA-F]+)"/g;
    let m;
    while ((m = re.exec(css)) !== null) {
        map.push({ cls: m[1], code: m[2].toLowerCase(), char: String.fromCodePoint(parseInt(m[2], 16)) });
    }
    return map;
}

function extractTokens(css) {
    const names = ['Ga0', 'Ga1', 'Ga2', 'Ga3', 'Ga5', 'Ga7', 'Ga9', 'Ga10', 'Lb1', 'Lb5', 'Lb7', 'Pi1', 'Pi5'];
    const tokens = {};
    for (const n of names) {
        const m = new RegExp(`--${n}:\\s*(#[0-9A-Fa-f]{3,8})`).exec(css);
        if (m) tokens[n] = m[1];
    }
    return tokens;
}

function report() {
    const html = readIfExists(HTML_PATH);
    const svgs = collectSvgs(html);
    const seen = new Map();
    for (const item of svgs) {
        const fp = fingerprint(item.svg);
        if (!seen.has(fp)) {
            const viewBox = (/\sviewBox="([^"]+)"/.exec(item.svg) || [])[1] || '';
            seen.set(fp, { first: item.index, count: 0, viewBox, len: item.svg.length, hint: guessHint(item.before) });
        }
        seen.get(fp).count += 1;
    }

    const uniq = [...seen.entries()].map(([fp, v], n) => ({ id: n, ...v, fp: fp.slice(0, 60) }));
    uniq.sort((a, b) => a.len - b.len);

    console.log(`HTML 内联 svg 总数：${svgs.length}，唯一图形：${uniq.length}\n`);
    for (const u of uniq) {
        console.log(`#${String(u.id).padStart(3)} | idx ${String(u.first).padStart(3)} | x${u.count} | p${String(u.len).padStart(4)} | vb ${u.viewBox || '-'} | ${u.hint}`);
    }

    const icons = parseIconfont(readIfExists(ICONFONT_PATH));
    console.log(`\n--- bcc-iconfont 图标（${icons.length} 个）---`);
    for (const i of icons) console.log(`${i.cls} = \\${i.code}`);

    console.log('\n--- 官方 token ---');
    console.log(JSON.stringify(extractTokens(readIfExists(SITE_CSS_PATH)), null, 2));

    fs.mkdirSync(path.join(ROOT, 'tools'), { recursive: true });
    fs.writeFileSync(path.join(ROOT, 'tools', 'report.json'), JSON.stringify({ uniq, icons }, null, 2), 'utf8');
    console.log('\n完整报告已写入 tools/report.json');
}

/** 把 SVG 改成可着色：fill/stroke 非 none 的一律 currentColor */
function paintCurrentColor(svg) {
    const hasStroke = /\sstroke="/.test(svg);
    return svg
        // 根标签上的 fill="none" 会让所有未显式设色的 path 隐形，这里补成 currentColor
        .replace(/^<svg\b[^>]*>/, (tag) => (hasStroke ? tag : tag.replace(/\sfill="none"/, ' fill="currentColor"')))
        .replace(/\sfill="(?!none)[^"]*"/g, ' fill="currentColor"')
        .replace(/\sstroke="(?!none)[^"]*"/g, ' stroke="currentColor"')
        .replace(/\sdata-v-[a-z0-9]+="[^"]*"/g, '')
        .replace(/\sstyle="[^"]*"/g, '')
        .replace(/\sclass="[^"]*"/g, '')
        .replace(/\swidth="[^"]*"/g, '')
        .replace(/\sheight="[^"]*"/g, '')
        .replace(/>\s+</g, '><')
        .trim();
}

function write(list) {
    const html = readIfExists(HTML_PATH);
    const svgs = collectSvgs(html);
    fs.mkdirSync(ASSETS_DIR, { recursive: true });
    for (const pair of list) {
        const [name, idxRaw] = pair.split('=');
        const idx = parseInt(idxRaw, 10);
        if (!name || Number.isNaN(idx) || !svgs[idx]) {
            console.error(`跳过：${pair}`);
            continue;
        }
        const file = path.join(ASSETS_DIR, `${name}.svg`);
        fs.writeFileSync(file, paintCurrentColor(svgs[idx].svg), 'utf8');
        console.log(`写出 ${path.basename(file)}（idx ${idx}, ${svgs[idx].svg.length}B）`);
    }
}

/** 从 iconfont.css 取出内嵌的 woff2 data URI，生成可直接使用的图标字体 CSS */
function writeFont() {
    const css = readIfExists(ICONFONT_PATH);
    const m = /url\((['"])(data:application\/x-font-woff2;charset=utf-8;base64,[^'"]+)\1\)/.exec(css);
    if (!m) {
        console.error('未在 iconfont.css 中找到内嵌 woff2 data URI');
        return;
    }
    const dataUri = m[2];

    /* 只挑语义明确的图标（来自 bcc-iconfont 官方类名） */
    const icons = [
        ['play', 'e690', '播放'],
        ['danmaku', 'e691', '弹幕'],
        ['like', 'e692', '点赞'],
        ['coin', 'e693', '投币'],
        ['share', 'e695', '分享'],
        ['comment', 'e696', '评论'],
        ['fav', 'e697', '收藏'],
        ['reward', 'e69e', '打赏'],
        ['time', 'e6a0', '时间'],
        ['warning', 'e69f', '警告'],
        ['success', 'e67d', '成功'],
        ['info', 'e67c', '提示'],
        ['more', 'e698', '更多'],
        ['sort', 'e682', '排序'],
    ];

    const lines = [
        '/*',
        ' * bilibili 官方图标字体 bcc-iconfont（旧版专栏 / 评论区专用字形）',
        ' * 数据来源：本地保存的 bilibili 页面快照 iconfont.css 中内嵌的 woff2。',
        ' * 本文件由 tools/extract-assets.cjs 生成，请勿手改。',
        ' */',
        '',
        '@font-face {',
        '    font-family: "bcc-iconfont";',
        `    src: url("${dataUri}") format("woff2");`,
        '    font-weight: normal;',
        '    font-style: normal;',
        '    font-display: swap;',
        '}',
        '',
        '/* 用法：给元素加 .bl-ic 与 .bl-ic--xxx，伪元素即显示对应图标 */',
        '.bl-ic::before {',
        '    font-family: "bcc-iconfont" !important;',
        '    font-style: normal;',
        '    font-weight: normal;',
        '    line-height: 1;',
        '    -webkit-font-smoothing: antialiased;',
        '    -moz-osx-font-smoothing: grayscale;',
        '}',
        '',
    ];
    for (const [name, code, label] of icons) {
        lines.push(`.bl-ic--${name}::before { content: "\\${code}"; } /* ${label} */`);
    }
    lines.push('');

    if (!fs.existsSync(path.join(ROOT, 'css'))) fs.mkdirSync(path.join(ROOT, 'css'), { recursive: true });
    fs.writeFileSync(path.join(ROOT, 'css', '05-iconfont.css'), lines.join('\n'), 'utf8');
    if (!fs.existsSync(ASSETS_DIR)) fs.mkdirSync(ASSETS_DIR, { recursive: true });
    fs.writeFileSync(path.join(ASSETS_DIR, 'bcc-iconfont.datauri.txt'), dataUri, 'utf8');
    console.log(`woff2 data URI ${dataUri.length} 字符 → css/05-iconfont.css（含 ${icons.length} 个图标）`);
}

/** 把 B 站原版 logo PNG 包成带 viewBox 的 SVG，便于走 {{svg:logo.svg}} 占位符 */
function writeLogo() {
    // 官网顶栏实际使用的彩色 logo（蓝 TV + 粉字，108x40 即 2x 图，显示 54x20）
    const png = 'd:/cai/sillytavern/主题/哔哩哔哩 (゜-゜)つロ 干杯~-bilibili_files/15ba085f05a9834ab1a365bdbf41618e1e5299dc.png';
    const buf = fs.readFileSync(png);
    // PNG IHDR：宽高各 4 字节，位于偏移 16 / 20
    const width = buf.readUInt32BE(16);
    const height = buf.readUInt32BE(20);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}"><image width="${width}" height="${height}" href="data:image/png;base64,${buf.toString('base64')}"/></svg>`;
    if (!fs.existsSync(ASSETS_DIR)) fs.mkdirSync(ASSETS_DIR, { recursive: true });
    fs.writeFileSync(path.join(ASSETS_DIR, 'logo.svg'), svg, 'utf8');
    console.log(`写出 logo.svg（${width}x${height}，${Math.round(svg.length / 1024)}KB）`);
}

const cmd = process.argv[2];
if (cmd === 'write') write(process.argv.slice(3));
else if (cmd === 'font') writeFont();
else if (cmd === 'logo') writeLogo();
else report();

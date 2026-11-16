/*
 * 主题 CSS 自检（只读）：
 *   1. 是否存在非标准 // 注释
 *   2. var() 引用是否都在 tokens 里定义（或属于酒馆内建变量白名单）
 *   3. 统计分片数量与体积
 *
 * 用法：node tools/check-css.cjs
 */
'use strict';

const fs = require('fs');
const path = require('path');

const cssDir = path.join(__dirname, '..', 'css');
const files = fs.readdirSync(cssDir).filter((f) => f.endsWith('.css')).sort();
let all = '';
const problems = [];

for (const f of files) {
    const text = fs.readFileSync(path.join(cssDir, f), 'utf8');
    all += text + '\n';
    text.split(/\r?\n/).forEach((line, i) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('//') || /[^:]\/\/[^/]/.test(trimmed.replace(/https?:\/\/[^\s]*/g, ''))) {
            problems.push(`非标准注释 ${f}:${i + 1} → ${trimmed}`);
        }
    });
}

const defined = new Set([...all.matchAll(/^\s*(--[\w-]+)\s*:/gm)].map((m) => m[1]));
const used = new Set([...all.matchAll(/var\(\s*(--[\w-]+)/g)].map((m) => m[1]));
const builtin = /^--(SmartTheme|black|white|grey|avatar|topBar|bottomForm|sheld|mainFont|bl-)/;
const undefinedVars = [...used].filter((v) => !defined.has(v) && !builtin.test(v));

if (undefinedVars.length) problems.push(`未定义变量 → ${undefinedVars.join(', ')}`);

console.log(`分片 ${files.length} 个 / 合计 ${(all.length / 1024).toFixed(1)}KB`);
console.log(`变量定义 ${defined.size} 个 / 引用 ${used.size} 个`);
if (problems.length) {
    problems.forEach((p) => console.log('✗ ' + p));
    process.exitCode = 1;
} else {
    console.log('✓ 自检通过');
}

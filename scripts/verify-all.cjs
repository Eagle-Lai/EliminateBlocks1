#!/usr/bin/env node
/** 聚合门：按 §16.1 顺序跑全部校验。 */
const { spawnSync } = require('child_process');
const steps = [
    ['npm', ['run', 'typecheck']],
    ['npm', ['run', 'test']],
    ['npm', ['run', 'verify:content']],
    ['npm', ['run', 'verify:assets']],
    ['npm', ['run', 'verify:prefabs']],
    ['npm', ['run', 'verify:ui']],
    ['npm', ['run', 'verify:font']],
    ['npm', ['run', 'verify:package']],
];
let failed = 0;
for (const [cmd, args] of steps) {
    const label = `${cmd} ${args.join(' ')}`;
    console.log(`\n=== ${label} ===`);
    const res = spawnSync(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32' });
    if (res.status !== 0) {
        failed++;
        console.error(`[verify-all] 失败：${label}`);
    }
}
if (failed > 0) {
    console.error(`[verify-all] ${failed} 个门未通过`);
    process.exit(1);
}
console.log('\n[verify-all] 全部通过');

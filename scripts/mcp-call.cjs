#!/usr/bin/env node
/**
 * 命令行调用 Cocos 编辑器里的 ccreator-mcp（streamable HTTP + JSON-RPC 2.0）。
 *
 *   npm run mcp:call -- editor_status
 *   npm run mcp:call -- scene_info
 *   npm run mcp:call -- component_list '{"path":"Canvas"}'
 *   npm run mcp:call -- project_setting_set '{"package":"project","key":"general.designResolution","value":{"width":750,"height":1334,"fitWidth":true,"fitHeight":false}}'
 *   npm run mcp:call -- --schema component_remove node_set_transform
 *
 * 前提：编辑器已打开本工程、扩展 `extensions/ccreator-mcp` 已在监听 3945（`npm run mcp:check` 可自查）。
 * 端口可用环境变量 CCREATOR_MCP_PORT 覆盖。
 */
const http = require('http');

const PORT = Number(process.env.CCREATOR_MCP_PORT || 3945);

function post(body, sid, timeout = 120000) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify(body);
        const req = http.request(
            {
                host: '127.0.0.1',
                port: PORT,
                path: '/mcp',
                method: 'POST',
                timeout,
                headers: {
                    'content-type': 'application/json',
                    accept: 'application/json, text/event-stream',
                    'content-length': Buffer.byteLength(data),
                    ...(sid ? { 'mcp-session-id': sid } : {}),
                },
            },
            (res) => {
                let buf = '';
                res.on('data', (c) => (buf += c));
                res.on('end', () => resolve({ status: res.statusCode, sid: res.headers['mcp-session-id'], body: buf }));
            },
        );
        req.on('timeout', () => req.destroy(new Error('timeout')));
        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

function parse(body) {
    // 可能是 SSE（event: message\ndata: {...}）或纯 JSON
    const lines = body.split('\n').filter((l) => l.startsWith('data:'));
    const raw = lines.length ? lines.map((l) => l.slice(5).trim()).join('') : body;
    try {
        return JSON.parse(raw);
    } catch {
        return { raw: body };
    }
}

(async () => {
    const args = process.argv.slice(2);
    const init = await post({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'wb', version: '1' } },
    });
    const sid = init.sid;
    await post({ jsonrpc: '2.0', method: 'notifications/initialized' }, sid);

    if (args[0] === '--schema') {
        const list = parse((await post({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }, sid)).body);
        const wanted = args.slice(1);
        for (const t of list.result.tools) {
            if (wanted.length && !wanted.includes(t.name)) continue;
            console.log('==', t.name);
            console.log(JSON.stringify(t.inputSchema || {}, null, 2).slice(0, 1600));
        }
        return;
    }

    const tool = args[0];
    const toolArgs = args[1] ? JSON.parse(args[1]) : {};
    const res = parse((await post({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: tool, arguments: toolArgs } }, sid)).body);
    const result = res.result || res.error || res;
    if (result && result.content) {
        for (const c of result.content) console.log(c.text ?? JSON.stringify(c));
    } else {
        console.log(JSON.stringify(result, null, 2));
    }
})().catch((e) => {
    console.error('FAIL', e.message);
    process.exit(1);
});

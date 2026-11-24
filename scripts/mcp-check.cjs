#!/usr/bin/env node
/**
 * Cocos MCP 健康检查：确认 Cocos Creator 里的 ccreator-mcp 扩展已在监听、并列出工具。
 *
 *   node scripts/mcp-check.cjs            # 默认 http://127.0.0.1:3945/mcp
 *   node scripts/mcp-check.cjs 3946       # 自定义端口
 *
 * 退出码：0 = 在线且握手成功；1 = 连不上 / 握手失败。
 */
const PORT = process.argv[2] || '3945';
const ENDPOINT = `http://127.0.0.1:${PORT}/mcp`;

const post = async (body, sessionId) => {
  const headers = {
    'content-type': 'application/json',
    accept: 'application/json, text/event-stream',
  };
  if (sessionId) headers['mcp-session-id'] = sessionId;
  const res = await fetch(ENDPOINT, { method: 'POST', headers, body: JSON.stringify(body) });
  const text = await res.text();

  // Streamable HTTP 可能回 SSE（data: {...}）也可能回 JSON
  let payload = null;
  for (const line of text.split(/\r?\n/)) {
    const raw = line.startsWith('data:') ? line.slice(5).trim() : line.trim();
    if (!raw.startsWith('{')) continue;
    try {
      const parsed = JSON.parse(raw);
      if (parsed.id === body.id) payload = parsed;
    } catch {}
  }
  return { res, payload, text };
};

(async () => {
  try {
    const init = await post({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'workbuddy-mcp-check', version: '1.0.0' },
      },
    });

    if (!init.payload || init.payload.error) {
      console.error(`[FAIL] 握手失败 HTTP ${init.res.status}`);
      console.error(init.text.slice(0, 400));
      process.exit(1);
    }

    const sessionId = init.res.headers.get('mcp-session-id');
    console.log(`[OK] 已连接 ${ENDPOINT}`);
    console.log(`     server: ${init.payload.result?.serverInfo?.name} ${init.payload.result?.serverInfo?.version}`);

    if (sessionId) {
      await post({ jsonrpc: '2.0', method: 'notifications/initialized' }, sessionId).catch(() => {});
    }

    const list = await post({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }, sessionId);
    const tools = list.payload?.result?.tools || [];
    console.log(`     工具数: ${tools.length}`);
    if (tools.length) console.log(`     ${tools.map((t) => t.name).join(', ')}`);
    process.exit(0);
  } catch (err) {
    console.error(`[FAIL] 连不上 ${ENDPOINT} — Cocos Creator 没开，或扩展没加载（需重启编辑器）`);
    console.error(`       ${err.code || ''} ${err.message}`);
    process.exit(1);
  }
})();

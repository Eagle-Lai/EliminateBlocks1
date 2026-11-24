const fs = require('fs');
const path = require('path');
const fontMeta = JSON.parse(fs.readFileSync(path.join(Editor.Project.path, 'assets/resources/font/game_sc.ttf.meta'), 'utf8'));
let templates = [];
try {
  templates = await Editor.Message.request('asset-db', 'query-assets', 'db://internal/default_file_content/**/*');
  templates = templates.map(t => t.url);
} catch (e) { templates = [String(e && e.message)]; }
return { fontUuid: fontMeta.uuid, fontSub: Object.keys(fontMeta.subMetas || {}), templates: templates.slice(0, 60) };

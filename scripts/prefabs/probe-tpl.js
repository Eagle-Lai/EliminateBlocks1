const fetchTpl = async (url) => {
  const info = await Editor.Message.request('asset-db', 'query-asset-info', url);
  if (!info || !info.file) return null;
  return { url, file: info.file, content: (await fs.promises.readFile(info.file, 'utf8')).slice(0, 2400) };
};
const fs = require('fs');
const atlas = await fetchTpl('db://internal/default_file_content/auto-atlas/auto-atlas.pac');
const anim = await fetchTpl('db://internal/default_file_content/animation-clip/animation-clip.anim');
return { atlas, anim };

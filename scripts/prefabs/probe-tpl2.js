const fs = require('fs');
const list = async (url) => {
  const assets = await Editor.Message.request('asset-db', 'query-assets', url + '/**/*');
  return (assets || []).map(a => ({ url: a.url, file: a.file }));
};
return { atlas: await list('db://internal/default_file_content/auto-atlas'), anim: await list('db://internal/default_file_content/animation-clip') };

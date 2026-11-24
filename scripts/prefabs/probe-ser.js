const scene = cc.director.getScene();
const node = new cc.Node('__probe__');
node.addComponent(cc.UITransform);
let out = null, err = null;
try {
  if (typeof EditorExtends !== 'undefined' && EditorExtends.serialize) out = 'EditorExtends.serialize';
  else if (typeof cc.serialization !== 'undefined' && cc.serialization.serialize) out = 'cc.serialization.serialize';
  else out = 'none:' + Object.keys(cc).filter(k => k.toLowerCase().includes('serial')).join(',');
  if (out === 'EditorExtends.serialize') {
    const json = EditorExtends.serialize(node);
    err = json.slice(0, 120);
  } else if (out === 'cc.serialization.serialize') {
    const json = cc.serialization.serialize(node);
    err = json.slice(0, 120);
  }
} catch (e) { err = 'ERR ' + (e && e.message); }
node.destroy();
return { out, head: err };

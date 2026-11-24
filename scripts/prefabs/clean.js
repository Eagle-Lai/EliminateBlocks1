const scene = cc.director.getScene();
const temp = scene.getChildByName('__PrefabTemp__');
if (temp) { temp.removeFromParent(); temp.destroy(); }
return { ok: true, remaining: scene.children.map(c => c.name) };

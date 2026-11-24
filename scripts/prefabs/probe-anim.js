const uuid = 'a1b2c3d4-0000-4000-8000-00000000d101';
let out = null, err = null;
try {
  out = await new Promise((r) => cc.assetManager.loadAny({ uuid }, (e, a) => r(e ? 'ERR ' + e : a ? { type: a.constructor.name, dur: a.duration, name: a.name } : 'null')));
} catch (e) { err = String(e); }
return { out, err };

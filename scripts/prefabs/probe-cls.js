const names = ['BurstFx','ShockwaveFx','FrostFx','PrismFx','ProgressBarView','HudView','GameScreenView'];
return names.map(n => { const k = cc.js.getClassByName(n); return { n, found: !!k, cid: k ? cc.js._getClassId(k) : null }; });

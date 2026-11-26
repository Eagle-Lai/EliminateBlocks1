/** Exercise the game services with an isolated, quota-limited localStorage. */
const assert = require('node:assert/strict');
const Module = require('node:module');
require('tsx/cjs');

const disk = new Map();
let quotaExceeded = false;
const localStorage = {
    getItem: key => disk.get(key) ?? null,
    setItem(key, value) {
        if (quotaExceeded) throw new Error('quota exceeded');
        disk.set(key, value);
    },
    removeItem: key => disk.delete(key),
};
const load = Module._load;
Module._load = function (name, ...args) {
    return name === 'cc' ? { sys: { localStorage } } : load.call(this, name, ...args);
};
const { storage, StorageKey } = require('../assets/scripts/service/StorageService.ts');
const { replayStore: records } = require('../assets/scripts/service/ReplayStore.ts');
Module._load = load;

assert.equal(storage.getNumber('missing', 7), 7);
storage.setJson(StorageKey.Coins, 30);
assert.equal(storage.getNumber(StorageKey.Coins), 30);
storage.set(StorageKey.Coins, 15);
quotaExceeded = true;
storage.set(StorageKey.Coins, 45);
assert.equal(storage.getNumber(StorageKey.Coins), 45);
quotaExceeded = false;
storage.set(StorageKey.Coins, 10);
assert.equal(disk.get(StorageKey.Coins), '10');
storage.setJson(StorageKey.LevelStars, { stars: { 2: 0, 3: 3 } });
assert.deepEqual(storage.levelProgress(), { unlocked: 4, stars: { 2: 1, 3: 3 } });
storage.setJson(StorageKey.LevelStars, { unlocked: 4 });
assert.deepEqual(storage.levelProgress(), { unlocked: 4, stars: {} });

const dec = new Date(2026, 11, 31);
const jan = new Date(2027, 0, 1);
storage.setJson(StorageKey.Daily, { lastDoneDate: '364', streak: 99, done: [363, 364], bestMoves: { 364: 8 } });
assert.equal(records.streak(dec), 2);
records.markDailyDone(365, 6, dec);
records.markDailyDone(365, 4, dec);
records.markDailyDone(360, 5, dec);
assert.equal(records.streak(dec), 3);
assert.equal(records.bestMoves(365, dec), 4);
assert.deepEqual(records.dailyDone(jan), []);
records.markDailyDone(1, 7, jan);
assert.equal(records.streak(jan), 4);
assert.deepEqual(records.dailyDone(jan), [1]);
assert.equal(records.bestMoves(364, dec), 8);
records.markDailyDone(365, 3, jan, dec.getFullYear());
assert.equal(records.bestMoves(365, dec), 3);
assert.equal(records.bestMoves(365, jan), 0);
assert.equal(records.streak(jan), 4);
assert.equal(records.streak(new Date(2027, 0, 3)), 0);
assert.equal(records.canUseHint(jan), true);
records.markHintUsed(jan);
assert.equal(records.canUseHint(jan), false);
assert.equal(records.canUseHint(dec), false);
assert.equal(records.canUseHint(new Date(2027, 0, 2)), true);
storage.setJson(StorageKey.Daily, { streak: 4 });
assert.doesNotThrow(() => records.markDailyDone(1, 2, jan));
const leap28 = new Date(2028, 1, 28);
records.markDailyDone(59, 4, leap28);
records.markDailyDone(59, 3, new Date(2028, 1, 29));
records.markDailyDone(60, 4, new Date(2028, 2, 1));
assert.equal(records.streak(new Date(2028, 2, 1)), 3);

function replay(id, score) {
    return { id, score, seed: 1, version: 1, createdAt: score, mode: 'endless', initialBoard: [], actions: [], snapshots: [] };
}
records.save(replay('a', 400));
records.save(replay('b', 100));
records.save(replay('b', 120));
assert.equal(records.list().length, 2);
assert.equal(records.best().id, 'a');
storage.remove(StorageKey.ReplayPrefix + 'a');
assert.equal(records.best().id, 'b');
console.log('存档回归通过：金币、旧星级、断签、跨年、重玩、补打、闰日、提示和最佳回放');

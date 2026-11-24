/** 特效池：实例化 Prefab，复用，不再用 Graphics。 */
import { Node, Prefab, instantiate } from 'cc';
import { BurstFx } from './BurstFx';
import { ShockwaveFx } from './ShockwaveFx';
import { FrostFx } from './FrostFx';
import { PrismFx } from './PrismFx';
import { assets } from '../service/AssetService';
import { PREFABS } from '../config/UIPrefabs';

type FxKey = 'burstFx' | 'shockwaveFx' | 'frostFx' | 'prismFx';
type FxComp = BurstFx | ShockwaveFx | FrostFx | PrismFx;

interface PoolItem {
    node: Node;
    comp: FxComp;
    busy: boolean;
}

export class BurstPool {
    private _pools = new Map<string, PoolItem[]>();
    private _prefabs = new Map<string, Prefab>();

    constructor(private readonly root: Node) {}

    async preload(): Promise<void> {
        for (const key of ['burstFx', 'shockwaveFx', 'frostFx', 'prismFx'] as FxKey[]) {
            const entry = PREFABS.find((p) => p.key === key);
            if (!entry) continue;
            const prefab = await assets.loadPrefab(entry.path);
            if (prefab) this._prefabs.set(key, prefab);
        }
    }

    play(key: FxKey, x: number, y: number, durationMs = 300): void {
        const prefab = this._prefabs.get(key);
        if (!prefab) return;
        const pool = this._pools.get(key) ?? [];
        this._pools.set(key, pool);
        let item = pool.find((p) => !p.busy);
        if (!item) {
            const node = instantiate(prefab);
            node.setParent(this.root);
            const comp =
                node.getComponent(BurstFx) ??
                node.getComponent(ShockwaveFx) ??
                node.getComponent(FrostFx) ??
                node.getComponent(PrismFx);
            if (!comp) {
                node.destroy();
                return;
            }
            item = { node, comp: comp as FxComp, busy: false };
            pool.push(item);
        }
        item.busy = true;
        item.node.active = true;
        item.node.setPosition(x, y, 0);
        const current = item;
        void (current.comp as BurstFx).play(durationMs).then(() => {
            current.busy = false;
            current.node.active = false;
        });
    }

    clear(): void {
        for (const pool of this._pools.values()) {
            for (const item of pool) {
                item.busy = false;
                item.node.active = false;
            }
        }
    }
}

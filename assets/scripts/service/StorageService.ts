/** 本地存档：读写封装 + 异常降级（读写失败不影响游戏）。 */
import { sys } from 'cc';
import { Logger } from '../utils/Logger';

class StorageServiceImpl {
    private _memory = new Map<string, string>();

    private get _store(): Storage | null {
        try {
            return sys.localStorage ?? null;
        } catch {
            return null;
        }
    }

    getNumber(key: string, fallback = 0): number {
        const raw = this.getString(key, '');
        const value = Number(raw);
        return Number.isFinite(value) ? value : fallback;
    }

    getString(key: string, fallback = ''): string {
        const store = this._store;
        if (!store) return this._memory.get(key) ?? fallback;
        try {
            const v = store.getItem(key);
            return v === null ? fallback : v;
        } catch (err) {
            Logger.warn('Storage', '读取失败', err);
            return this._memory.get(key) ?? fallback;
        }
    }

    set(key: string, value: string | number | boolean): void {
        const raw = String(value);
        this._memory.set(key, raw);
        const store = this._store;
        if (!store) return;
        try {
            store.setItem(key, raw);
        } catch (err) {
            Logger.warn('Storage', '写入失败，已降级到内存', err);
        }
    }

    getBool(key: string, fallback = false): boolean {
        const raw = this.getString(key, '');
        if (raw === '') return fallback;
        return raw === 'true' || raw === '1';
    }
}

export const storage = new StorageServiceImpl();

export const StorageKey = {
    BestScore: 'tm.best',
    BestLevel: 'tm.best.level',
    Muted: 'tm.muted',
    PlayCount: 'tm.plays',
} as const;

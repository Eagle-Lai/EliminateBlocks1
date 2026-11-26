/** 本地存档：读写封装 + JSON + 版本 + 异常降级（读写失败不影响游戏）。 */
import { sys } from 'cc';
import { Logger } from '../utils/Logger';

const VERSION = 1;

class StorageServiceImpl {
    private _memory = new Map<string, string>();
    private _pending = new Set<string>();

    private get _store(): Storage | null {
        try {
            return sys.localStorage ?? null;
        } catch {
            return null;
        }
    }

    getNumber(key: string, fallback = 0): number {
        const raw = this.getString(key, '');
        if (!raw.trim()) return fallback;
        // Early builds wrote earned coins with setJson and spent them with set.
        const value = raw.startsWith('{') ? this.getJson<unknown>(key, fallback) : Number(raw);
        return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
    }

    getString(key: string, fallback = ''): string {
        const store = this._store;
        if (!store || this._pending.has(key)) return this._memory.get(key) ?? fallback;
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
        this._pending.add(key);
        const store = this._store;
        if (!store) return;
        try {
            store.setItem(key, raw);
            this._pending.delete(key);
        } catch (err) {
            Logger.warn('Storage', '写入失败，已降级到内存', err);
        }
    }

    getBool(key: string, fallback = false): boolean {
        const raw = this.getString(key, '');
        if (raw === '') return fallback;
        return raw === 'true' || raw === '1';
    }

    /** 读 JSON：损坏时清坏键并回退默认值 */
    getJson<T>(key: string, fallback: T): T {
        const raw = this.getString(key, '');
        if (!raw) return fallback;
        try {
            const parsed = JSON.parse(raw) as { v?: number; data?: T };
            if (parsed && typeof parsed === 'object' && 'v' in parsed && 'data' in parsed) {
                if (parsed.v !== VERSION) return fallback;
                return parsed.data as T;
            }
            return parsed as unknown as T;
        } catch (err) {
            Logger.warn('Storage', `JSON 损坏，已清理：${key}`, err);
            this.remove(key);
            return fallback;
        }
    }

    setJson<T>(key: string, data: T): void {
        try {
            this.set(key, JSON.stringify({ v: VERSION, data }));
        } catch (err) {
            Logger.warn('Storage', `JSON 写入失败：${key}`, err);
        }
    }

    remove(key: string): void {
        this._memory.delete(key);
        this._pending.add(key);
        const store = this._store;
        if (!store) return;
        try {
            store.removeItem(key);
            this._pending.delete(key);
        } catch {
            /* 忽略 */
        }
    }

    levelProgress(): { unlocked: number; stars: Record<number, number> } {
        const record = this.getJson<{ unlocked?: number; stars?: Record<string, number> } | null>(StorageKey.LevelStars, null);
        const stars: Record<number, number> = {};
        let unlocked = 1;
        for (const key of Object.keys(record?.stars ?? {})) {
            const id = Number(key);
            const rating = record!.stars![key];
            if (!Number.isInteger(id) || id < 1 || id > 120 || !Number.isInteger(rating) || rating < 0) continue;
            // Only victory wrote an entry. A stored zero is a completed non-score goal.
            stars[id] = Math.min(3, Math.max(1, rating));
            unlocked = Math.max(unlocked, Math.min(120, id + 1));
        }
        if (Number.isInteger(record?.unlocked)) unlocked = Math.max(unlocked, Math.min(120, record!.unlocked!));
        return { unlocked, stars };
    }
}

export const storage = new StorageServiceImpl();

export const StorageKey = {
    BestScore: 'tm.best',
    BestLevel: 'tm.best.level',
    Muted: 'tm.muted',
    PlayCount: 'tm.plays',
    Coins: 'tm.coins',
    LevelStars: 'tm.level',
    Daily: 'tm.daily',
    Shadow: 'tm.shadow',
    ReplayIndex: 'tm.replay.index',
    ReplayPrefix: 'tm.replay.',
    Settings: 'tm.settings',
} as const;

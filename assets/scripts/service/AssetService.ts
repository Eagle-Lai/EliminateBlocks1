/**
 * 资源服务：SpriteFrame / AudioClip / Prefab 的加载、缓存与容错。
 * v2：新增 Prefab 与 Asset Bundle；缺资源在 debug 下抛错并列键，不做静默降级。
 */
import { Asset, AssetManager, AudioClip, Prefab, SpriteFrame, assetManager, resources } from 'cc';
import { Logger } from '../utils/Logger';

const IS_DEBUG = true;

class AssetServiceImpl {
    private _frames = new Map<string, SpriteFrame>();
    private _clips = new Map<string, AudioClip>();
    private _prefabs = new Map<string, Prefab>();
    private _bundles = new Map<string, AssetManager.Bundle>();

    getFrame(path: string): SpriteFrame | null {
        return this._frames.get(path) ?? null;
    }

    getClip(path: string): AudioClip | null {
        return this._clips.get(path) ?? null;
    }

    getPrefab(path: string): Prefab | null {
        return this._prefabs.get(path) ?? null;
    }

    /** 单张图：先按 spriteFrame 子资源取，失败再退回整图 */
    loadSpriteFrame(path: string): Promise<SpriteFrame | null> {
        if (this._frames.has(path)) return Promise.resolve(this._frames.get(path)!);
        return this._loadFrom(resources, path, SpriteFrame).then((sf) => {
            if (sf) this._frames.set(path, sf);
            return sf;
        });
    }

    loadClip(path: string): Promise<AudioClip | null> {
        if (this._clips.has(path)) return Promise.resolve(this._clips.get(path)!);
        return new Promise((resolve) => {
            resources.load(path, AudioClip, (err, clip) => {
                if (err || !clip) {
                    this._missing('AudioClip', path);
                    resolve(null);
                    return;
                }
                this._clips.set(path, clip);
                resolve(clip);
            });
        });
    }

    loadPrefab(path: string): Promise<Prefab | null> {
        if (this._prefabs.has(path)) return Promise.resolve(this._prefabs.get(path)!);
        return new Promise((resolve) => {
            resources.load(`${path}`, Prefab, (err, prefab) => {
                if (err || !prefab) {
                    this._missing('Prefab', path);
                    resolve(null);
                    return;
                }
                this._prefabs.set(path, prefab);
                resolve(prefab);
            });
        });
    }

    /** 加载分包（失败重试 2 次） */
    async loadBundle(name: string): Promise<AssetManager.Bundle | null> {
        const cached = this._bundles.get(name);
        if (cached) return cached;
        for (let attempt = 0; attempt < 3; attempt++) {
            const bundle = await new Promise<AssetManager.Bundle | null>((resolve) => {
                assetManager.loadBundle(name, (err, b) => resolve(err ? null : b));
            });
            if (bundle) {
                this._bundles.set(name, bundle);
                return bundle;
            }
            Logger.warn('AssetService', `Bundle 加载失败（第 ${attempt + 1} 次）：${name}`);
        }
        return null;
    }

    /** 从分包取图（Prefab 只引用主包，章节差异运行时替换） */
    async loadSpriteFrameFromBundle(bundleName: string, path: string): Promise<SpriteFrame | null> {
        const cacheKey = `${bundleName}::${path}`;
        if (this._frames.has(cacheKey)) return this._frames.get(cacheKey)!;
        const bundle = await this.loadBundle(bundleName);
        if (!bundle) return null;
        const sf = await this._loadFrom(bundle, path, SpriteFrame);
        if (sf) this._frames.set(cacheKey, sf);
        return sf;
    }

    async loadClipFromBundle(bundleName: string, path: string): Promise<AudioClip | null> {
        const cacheKey = `${bundleName}::${path}`;
        if (this._clips.has(cacheKey)) return this._clips.get(cacheKey)!;
        const bundle = await this.loadBundle(bundleName);
        if (!bundle) return null;
        const clip = await new Promise<AudioClip | null>((resolve) => {
            bundle.load(path, AudioClip, (err, c) => resolve(err ? null : c));
        });
        if (clip) this._clips.set(cacheKey, clip);
        return clip;
    }

    private _loadFrom(bundle: AssetManager.Bundle, path: string, type: typeof SpriteFrame): Promise<SpriteFrame | null> {
        return new Promise((resolve) => {
            bundle.load(`${path}/spriteFrame`, type, (err, sf) => {
                if (!err && sf) {
                    resolve(sf as SpriteFrame);
                    return;
                }
                bundle.load(path, type, (err2, sf2) => {
                    if (!err2 && sf2) {
                        resolve(sf2 as SpriteFrame);
                        return;
                    }
                    this._missing('SpriteFrame', `${bundle.name}://${path}`);
                    resolve(null);
                });
            });
        });
    }

    private _missing(type: string, path: string): void {
        const msg = `资源缺失：${type} ${path}`;
        if (IS_DEBUG) Logger.error('AssetService', msg);
        else Logger.warn('AssetService', msg);
    }

    async preloadFrames(paths: readonly string[]): Promise<void> {
        await Promise.all(paths.map((p) => this.loadSpriteFrame(p)));
    }

    async preloadClips(paths: readonly string[]): Promise<void> {
        await Promise.all(paths.map((p) => this.loadClip(p)));
    }

    async preloadPrefabs(paths: readonly string[]): Promise<void> {
        await Promise.all(paths.map((p) => this.loadPrefab(p)));
    }

    /**
     * 释放缓存资源。只能在确认场景节点已经销毁后调用，否则会把仍在使用的资源释放掉导致白块。
     */
    clear(): void {
        for (const frame of this._frames.values()) assetManager.releaseAsset(frame as Asset);
        for (const clip of this._clips.values()) assetManager.releaseAsset(clip as Asset);
        this._frames.clear();
        this._clips.clear();
        this._prefabs.clear();
    }
}

export const assets = new AssetServiceImpl();

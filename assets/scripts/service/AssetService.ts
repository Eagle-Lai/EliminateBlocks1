/**
 * 资源服务：负责 SpriteFrame / AudioClip 的加载、缓存与容错。
 * 约定：图片放在 assets/resources/art/**，音频放在 assets/resources/audio/**。
 */
import { AudioClip, SpriteFrame, assetManager, resources } from 'cc';
import { Logger } from '../utils/Logger';

class AssetServiceImpl {
    private _frames = new Map<string, SpriteFrame>();
    private _clips = new Map<string, AudioClip>();

    getFrame(path: string): SpriteFrame | null {
        return this._frames.get(path) ?? null;
    }

    getClip(path: string): AudioClip | null {
        return this._clips.get(path) ?? null;
    }

    /** 单张图：先按 spriteFrame 子资源取，失败再退回整图 */
    loadSpriteFrame(path: string): Promise<SpriteFrame | null> {
        if (this._frames.has(path)) return Promise.resolve(this._frames.get(path)!);

        return new Promise((resolve) => {
            resources.load(`${path}/spriteFrame`, SpriteFrame, (err, sf) => {
                if (!err && sf) {
                    this._frames.set(path, sf);
                    resolve(sf);
                    return;
                }
                resources.load(path, SpriteFrame, (err2, sf2) => {
                    if (!err2 && sf2) {
                        this._frames.set(path, sf2);
                        resolve(sf2);
                        return;
                    }
                    Logger.warn('AssetService', `加载失败：${path}`);
                    resolve(null);
                });
            });
        });
    }

    loadClip(path: string): Promise<AudioClip | null> {
        if (this._clips.has(path)) return Promise.resolve(this._clips.get(path)!);
        return new Promise((resolve) => {
            resources.load(path, AudioClip, (err, clip) => {
                if (err || !clip) {
                    Logger.warn('AssetService', `音频加载失败：${path}`);
                    resolve(null);
                    return;
                }
                this._clips.set(path, clip);
                resolve(clip);
            });
        });
    }

    async preloadFrames(paths: readonly string[]): Promise<void> {
        await Promise.all(paths.map((p) => this.loadSpriteFrame(p)));
    }

    async preloadClips(paths: readonly string[]): Promise<void> {
        await Promise.all(paths.map((p) => this.loadClip(p)));
    }

    /**
     * 释放缓存资源。
     * 注意：只能在确认场景节点已经销毁后调用（例如离开战斗场景），
     * 否则会把仍在使用的 SpriteFrame 释放掉导致白块。
     */
    clear(): void {
        for (const frame of this._frames.values()) assetManager.releaseAsset(frame);
        for (const clip of this._clips.values()) assetManager.releaseAsset(clip);
        this._frames.clear();
        this._clips.clear();
    }
}

export const assets = new AssetServiceImpl();

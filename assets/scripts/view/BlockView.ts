/**
 * 单格渲染单元（Prefab 实例）：Base + KindOverlay + SpecialOverlay + UIOpacity。
 * 特殊块只切 SpriteFrame，不新建节点。
 */
import { _decorator, Color, Component, Sprite, SpriteFrame, Tween, UIOpacity, UITransform, Vec3, tween } from 'cc';
import type { BlockData } from '../core/BoardModel';
import { ART } from '../config/AssetKeys';
import { loadSprite } from './ViewUtils';
import { assets } from '../service/AssetService';

const { ccclass, property } = _decorator;

@ccclass('BlockView')
export class BlockView extends Component {
    @property(Sprite) base: Sprite | null = null;
    @property(Sprite) kindOverlay: Sprite | null = null;
    @property(Sprite) specialOverlay: Sprite | null = null;
    @property(UIOpacity) opacity: UIOpacity | null = null;

    r = -1;
    c = -1;
    type = 0;
    private _cell = 60;
    private _special: string = '';
    private _kind: string = 'normal';

    get sizeScale(): number {
        return 1;
    }

    setCellSize(cell: number): void {
        this._cell = cell;
        const size = Math.round(cell);
        for (const sprite of [this.base, this.kindOverlay, this.specialOverlay]) {
            if (!sprite) continue;
            sprite.node.setScale(1, 1, 1);
            const ui = sprite.node.getComponent(UITransform);
            if (ui) ui.setContentSize(size, size);
        }
    }

    /** 按方块数据刷新外观；frames 为主包五色图 */
    applyBlock(block: BlockData, frames: (SpriteFrame | null)[]): void {
        this.type = block.type;
        const kind = block.kind ?? 'normal';
        this._kind = kind;

        if (kind === 'stone') {
            this._setBase(assets.getFrame(ART.stone));
            if (this.kindOverlay) this.kindOverlay.node.active = false;
        } else if (kind === 'brittle') {
            this._setBase(assets.getFrame(ART.brittle));
            if (this.kindOverlay) this.kindOverlay.node.active = false;
        } else {
            const frame = block.type >= 0 ? frames[block.type] ?? null : null;
            this._setBase(frame);
            if (this.kindOverlay) this.kindOverlay.node.active = false;
        }

        const special = block.special ?? '';
        if (special !== this._special) {
            this._special = special;
            if (this.specialOverlay) {
                if (special) {
                    this.specialOverlay.node.active = true;
                    loadSprite(this.specialOverlay, ART.special[special as keyof typeof ART.special]);
                } else {
                    this.specialOverlay.node.active = false;
                    loadSprite(this.specialOverlay, null);
                }
            }
        }
    }

    applyType(type: number, frame: SpriteFrame | null): void {
        this.type = type;
        this._kind = 'normal';
        this._setBase(frame);
        if (this.specialOverlay) {
            this.specialOverlay.node.active = false;
            this.specialOverlay.spriteFrame = null;
        }
        this._special = '';
    }

    private _setBase(frame: SpriteFrame | null): void {
        if (!this.base) return;
        if (this.base.spriteFrame !== frame) this.base.spriteFrame = frame;
        this.base.color = new Color(255, 255, 255, 255);
        this.base.enabled = !!frame;
    }

    setCellPos(r: number, c: number, boardW: number, boardH: number, cell: number): void {
        this.r = r;
        this.c = c;
        const x = -boardW / 2 + (c + 0.5) * cell;
        const y = boardH / 2 - (r + 0.5) * cell;
        this.node.setPosition(x, y, 0);
    }

    playSpawn(): void {
        this.node.setScale(0.86, 0.86, 1);
        if (this.opacity) this.opacity.opacity = 255;
        tween(this.node).to(0.1, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' }).start();
    }

    playPop(durationMs: number): Promise<void> {
        return new Promise((resolve) => {
            tween(this.node)
                .to(durationMs / 1000, { scale: new Vec3(0.1, 0.1, 1) }, { easing: 'quadOut' })
                .start();
            if (!this.opacity) {
                resolve();
                return;
            }
            tween(this.opacity)
                .to(durationMs / 1000, { opacity: 26 })
                .call(() => resolve())
                .start();
        });
    }

    playFade(durationMs: number): Promise<void> {
        return new Promise((resolve) => {
            if (!this.opacity) {
                resolve();
                return;
            }
            tween(this.opacity)
                .to(durationMs / 1000, { opacity: 0 })
                .call(() => resolve())
                .start();
        });
    }

    resetVisual(): void {
        Tween.stopAllByTarget(this.node);
        if (this.opacity) Tween.stopAllByTarget(this.opacity);
        this.node.setScale(1, 1, 1);
        if (this.opacity) this.opacity.opacity = 255;
    }

    setVisible(visible: boolean): void {
        this.node.active = visible;
    }

    get visible(): boolean {
        return this.node.active;
    }
}

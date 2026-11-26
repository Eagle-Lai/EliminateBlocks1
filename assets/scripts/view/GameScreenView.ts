/**
 * 局内总装：Prefab 里已经放好 Bg / BoardHost / HUD / Pad / SugarRail / ShadowBar /
 * BannerLayer / FloatLayer / FxLayer；代码只把布局数值应用到 BoardHost。
 */
import { _decorator, Node, Sprite, Tween, UITransform, Vec3, Widget, tween } from 'cc';
import { UIView } from '../ui/UIView';
import { BoardView } from './BoardView';
import { PieceView } from './PieceView';
import { HudView } from './HudView';
import { PadView } from './PadView';
import { SugarRailView } from './SugarRailView';
import { ShadowBarView } from './ShadowBarView';
import { BannerView } from './BannerView';
import { FloatTextView } from './FloatTextView';
import { MutationBadgeView } from './MutationBadgeView';
import { TUNING } from '../config/GameTuning';
import type { LayoutInfo } from '../ui/LayoutAdapter';

const { ccclass, property } = _decorator;

@ccclass('GameScreenView')
export class GameScreenView extends UIView {
    @property(Sprite) bg: Sprite | null = null;
    @property(Node) boardHost: Node | null = null;
    @property(BoardView) board: BoardView | null = null;
    @property(PieceView) piece: PieceView | null = null;
    @property(HudView) hud: HudView | null = null;
    @property(PadView) pad: PadView | null = null;
    @property(SugarRailView) sugarRail: SugarRailView | null = null;
    @property(ShadowBarView) shadowBar: ShadowBarView | null = null;
    @property(BannerView) banner: BannerView | null = null;
    @property(FloatTextView) floats: FloatTextView | null = null;
    @property(MutationBadgeView) mutationBadge: MutationBadgeView | null = null;
    @property(Node) fxLayer: Node | null = null;
    @property(Node) flyingStars: Node | null = null;
    @property(Node) hudHost: Node | null = null;
    @property(Node) padHost: Node | null = null;

    onOpen(): void {
        this.assertRefs([
            ['boardHost', this.boardHost],
            ['board', this.board],
            ['piece', this.piece],
            ['hud', this.hud],
            ['pad', this.pad],
            ['sugarRail', this.sugarRail],
            ['banner', this.banner],
            ['floats', this.floats],
        ]);
        if (this.banner) this.banner.onOpen();
        if (this.floats) this.floats.onOpen();
    }

    private _hudTop: number | null = null;
    private _padBottom: number | null = null;

    /** 从实际消除点划弧飞向分数。复用三颗星，连续结算时接续最新的轨迹。 */
    flyScoreStars(anchor: Vec3, count: number): void {
        const layer = this.flyingStars?.getComponent(UITransform);
        const board = this.boardHost?.getComponent(UITransform);
        const score = this.hud?.scoreLabel?.node;
        if (!layer || !board || !score) return;
        const start = layer.convertToNodeSpaceAR(board.convertToWorldSpaceAR(anchor));
        const end = layer.convertToNodeSpaceAR(score.worldPosition);
        layer.node.children.forEach((star, i) => {
            Tween.stopAllByTarget(star);
            star.active = i < count;
            if (!star.active) return;
            const controlX = (start.x + end.x) / 2 + (i - 1) * 126;
            const controlY = Math.min(start.y, end.y) + 40 + i * 49;
            star.setPosition(start);
            star.setScale(0, 0, 1);
            tween(star).delay(i * 0.055).update(0.57, (_, ratio) => {
                const u = ratio * ratio;
                const v = 1 - u;
                star.setPosition(
                    v * v * start.x + 2 * v * u * controlX + u * u * end.x,
                    v * v * start.y + 2 * v * u * controlY + u * u * end.y, 0,
                );
                const dx = v * (controlX - start.x) + u * (end.x - controlX);
                const dy = v * (controlY - start.y) + u * (end.y - controlY);
                star.angle = Math.atan2(dy, dx) * 180 / Math.PI - 90;
                const scale = Math.min(1, ratio * 9) * (1 - 0.45 * u);
                star.setScale(scale, scale, 1);
            }).call(() => { star.active = false; }).start();
        });
    }

    clearScoreStars(): void {
        this.flyingStars?.children.forEach(star => {
            Tween.stopAllByTarget(star);
            star.active = false;
        });
    }

    onDisable(): void { this.clearScoreStars(); }

    /** 安全区：HUD 顶对齐、Pad 底对齐的 Widget 叠加刘海/Home 条高度（只改 Widget 偏移） */
    private _applySafeArea(layout: LayoutInfo): void {
        const hudWidget = this.hud?.node.getComponent(Widget) ?? null;
        if (hudWidget) {
            if (this._hudTop === null) this._hudTop = hudWidget.top;
            hudWidget.top = this._hudTop + layout.safeTop + layout.outerGap;
            hudWidget.updateAlignment();
        }
        const padWidget = this.pad?.node.getComponent(Widget) ?? null;
        if (padWidget) {
            if (this._padBottom === null) this._padBottom = padWidget.bottom;
            padWidget.bottom = this._padBottom + layout.safeBottom + layout.outerGap;
            padWidget.updateAlignment();
        }
    }

    /** 设置棋盘与右轨的位置/尺寸；HUD/Pad 的位置由 Prefab 的 Widget 决定（叠加安全区） */
    applyLayout(layout: LayoutInfo): void {
        this._applySafeArea(layout);
        if (this.boardHost) {
            const ut = this.boardHost.getComponent(UITransform);
            if (ut) ut.setContentSize(layout.boardW, layout.boardH);
            this.boardHost.setPosition(layout.boardCenterX, layout.boardCenterY, 0);
        }
        this.fxLayer?.setPosition(layout.boardCenterX, layout.boardCenterY, 0);
        this.floats?.node.setPosition(layout.boardCenterX, layout.boardCenterY, 0);
        if (this.sugarRail) {
            const ut = this.sugarRail.node.getComponent(UITransform);
            if (ut) ut.setContentSize(this.sugarRail.node.getComponent(UITransform)?.width ?? 56, layout.boardH);
            this.sugarRail.node.setPosition(
                layout.boardCenterX + layout.boardW / 2 + TUNING.ui.railGap,
                layout.boardCenterY,
                0,
            );
        }
        if (this.shadowBar) {
            this.shadowBar.node.setPosition(layout.boardCenterX, layout.boardCenterY + layout.boardH / 2 + TUNING.ui.shadowGap, 0);
        }
    }

    setBackground(frame: unknown): void {
        if (this.bg) this.bg.spriteFrame = frame as never;
    }
}

/**
 * 局内总装：Prefab 里已经放好 Bg / BoardHost / HUD / Pad / SugarRail / ShadowBar /
 * BannerLayer / FloatLayer / FxLayer；代码只把布局数值应用到 BoardHost。
 */
import { _decorator, Node, Sprite, UITransform } from 'cc';
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

    /** 只设置棋盘与右轨的位置/尺寸；HUD/Pad 的位置由 Prefab 的 Widget 决定 */
    applyLayout(layout: LayoutInfo): void {
        if (this.boardHost) {
            const ut = this.boardHost.getComponent(UITransform);
            if (ut) ut.setContentSize(layout.boardW, layout.boardH);
            this.boardHost.setPosition(0, layout.boardCenterY, 0);
        }
        if (this.sugarRail) {
            const ut = this.sugarRail.node.getComponent(UITransform);
            if (ut) ut.setContentSize(this.sugarRail.node.getComponent(UITransform)?.width ?? 56, layout.boardH);
            this.sugarRail.node.setPosition(
                layout.boardW / 2 + TUNING.ui.railGap,
                layout.boardCenterY,
                0,
            );
        }
        if (this.shadowBar) {
            this.shadowBar.node.setPosition(0, layout.boardCenterY + layout.boardH / 2 + TUNING.ui.shadowGap, 0);
        }
    }

    setBackground(frame: unknown): void {
        if (this.bg) this.bg.spriteFrame = frame as never;
    }
}

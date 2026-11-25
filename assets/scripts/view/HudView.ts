/**
 * 顶部 HUD：品牌行（异变角标 / 暂停 / 重开）、得分卡、等级卡 + 进度条、目标卡、下一块预览。
 * 所有子节点来自 Prefab，代码只改字符串、进度与显隐。
 */
import { _decorator, Label, Node, Sprite, SpriteFrame, Vec3, tween } from 'cc';
import { UIView } from '../ui/UIView';
import { UIButton } from '../ui/UIButton';
import { setLabel, setActive, setSize, fmt } from './ViewUtils';
import { TUNING } from '../config/GameTuning';
import type { PieceModel } from '../core/PieceModel';

const { ccclass, property } = _decorator;

@ccclass('HudView')
export class HudView extends UIView {
    @property(Label) brandLabel: Label | null = null;
    @property(Label) titleLabel: Label | null = null;
    @property(Label) scoreLabel: Label | null = null;
    @property(Label) bestLabel: Label | null = null;
    @property(Label) levelLabel: Label | null = null;
    @property(Label) goalLabel: Label | null = null;
    @property(Label) goalValueLabel: Label | null = null;
    @property(Sprite) progressFill: Sprite | null = null;
    @property(Node) goalCard: Node | null = null;
    @property(Node) mutationBadgeHost: Node | null = null;
    @property(Node) nextCard: Node | null = null;
    @property(Sprite) next0: Sprite | null = null;
    @property(Sprite) next1: Sprite | null = null;
    @property(Sprite) next2: Sprite | null = null;
    @property(Sprite) next3: Sprite | null = null;
    @property(UIButton) pauseBtn: UIButton | null = null;
    @property(UIButton) restartBtn: UIButton | null = null;

    private _lastScore = -1;
    private _lastLevel = -1;
    private _lastProgress = -1;

    onOpen(): void {
        this.assertRefs([
            ['scoreLabel', this.scoreLabel],
            ['levelLabel', this.levelLabel],
            ['progressFill', this.progressFill],
            ['pauseBtn', this.pauseBtn],
            ['restartBtn', this.restartBtn],
        ]);
    }

    bind(onPause: () => void, onRestart: () => void): void {
        if (this.pauseBtn) this.pauseBtn.onClick = onPause;
        if (this.restartBtn) this.restartBtn.onClick = onRestart;
    }

    setTitle(text: string): void {
        setLabel(this.titleLabel, text);
    }

    setScore(score: number): void {
        if (this._lastScore === score) return;
        this._lastScore = score;
        setLabel(this.scoreLabel, fmt(score));
        if (this.scoreLabel) {
            const node = this.scoreLabel.node;
            node.setScale(1.08, 1.08, 1);
            tween(node).to(0.12, { scale: new Vec3(1, 1, 1) }).start();
        }
    }

    setBest(best: number): void {
        setLabel(this.bestLabel, `最高 ${fmt(best)}`);
    }

    setLevel(level: number): void {
        if (this._lastLevel === level) return;
        this._lastLevel = level;
        setLabel(this.levelLabel, String(level));
    }

    setProgress(p: number): void {
        const value = Math.max(0, Math.min(1, p));
        if (Math.abs(value - this._lastProgress) < 0.005) return;
        this._lastProgress = value;
        if (this.progressFill) {
            this.progressFill.type = Sprite.Type.FILLED;
            this.progressFill.fillType = Sprite.FillType.HORIZONTAL;
            this.progressFill.fillStart = 0;
            this.progressFill.fillRange = value;
        }
    }

    setGoal(visible: boolean, text = '', value = ''): void {
        setActive(this.goalCard, visible);
        if (!visible) return;
        setLabel(this.goalLabel, text);
        setLabel(this.goalValueLabel, value);
    }

    /** 下一块预览：按包围盒居中到 4 个 Prefab 小方块 */
    setNext(piece: PieceModel | null, frames: (SpriteFrame | null)[]): void {
        const cells = [this.next0, this.next1, this.next2, this.next3];
        for (const sprite of cells) if (sprite) sprite.node.active = false;
        if (!piece) return;

        let maxR = 0;
        let maxC = 0;
        for (const c of piece.cells) {
            maxR = Math.max(maxR, c.r);
            maxC = Math.max(maxC, c.c);
        }
        const cols = maxC + 1;
        const rows = maxR + 1;
        const cellSize = Math.min(TUNING.ui.nextCellMax, TUNING.ui.nextCellBaseline / Math.max(cols, rows));
        const totalW = cols * cellSize;
        const totalH = rows * cellSize;

        for (let i = 0; i < piece.cells.length && i < 4; i++) {
            const cell = piece.cells[i];
            const sprite = cells[i];
            if (!sprite) continue;
            sprite.node.active = true;
            setSize(sprite.node, cellSize * 0.94, cellSize * 0.94);
            sprite.node.setPosition(
                -totalW / 2 + (cell.c + 0.5) * cellSize,
                totalH / 2 - (cell.r + 0.5) * cellSize - TUNING.ui.nextCellShiftY,
                0,
            );
            sprite.spriteFrame = frames[piece.color] ?? null;
        }
    }

    setMutationVisible(visible: boolean): void {
        setActive(this.mutationBadgeHost, visible);
    }
}

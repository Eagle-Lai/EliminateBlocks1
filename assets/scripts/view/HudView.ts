/**
 * 顶部 HUD：品牌行（异变角标 / 暂停 / 重开）、得分卡、等级卡 + 进度条、目标卡、下一块预览。
 * 所有子节点来自 Prefab，代码只改字符串、进度与显隐。
 */
import { _decorator, Label, Node, Sprite, SpriteFrame, Tween, Vec3, tween } from 'cc';
import { UIView } from '../ui/UIView';
import { UIButton } from '../ui/UIButton';
import { loadSprite, setLabel, setActive, setSize, setPos, fmt } from './ViewUtils';
import { ART } from '../config/AssetKeys';
import { TUNING } from '../config/GameTuning';
import type { PieceModel } from '../core/PieceModel';
import { popArt, scatter } from './UIMotion';

const { ccclass, property } = _decorator;

@ccclass('HudView')
export class HudView extends UIView {
    @property(Sprite) artwork: Sprite | null = null;
    @property(Node) scoreSparks: Node | null = null;
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

    setTitle(text: string, theme: number): void {
        loadSprite(this.artwork, ART.chapterScene(theme));
        setLabel(this.titleLabel, text);
    }

    setScore(score: number): void {
        if (this._lastScore === score) return;
        const gained = this._lastScore >= 0 && score > this._lastScore;
        this._lastScore = score;
        setLabel(this.scoreLabel, fmt(score));
        if (gained) {
            popArt(this.scoreLabel?.node, 0, 1.16);
            scatter(this.scoreSparks, 80, 28);
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
            Tween.stopAllByTarget(this.progressFill);
            if (value > this.progressFill.fillRange) {
                tween(this.progressFill).to(0.23, { fillRange: value }, { easing: 'quadOut' }).start();
            } else this.progressFill.fillRange = value;
        }
    }

    setGoal(visible: boolean, text = '', value = ''): void {
        if (this.goalCard && visible !== this.goalCard.active) {
            const score = this.scoreLabel?.node.parent ?? null;
            const level = this.levelLabel?.node.parent ?? null;
            setSize(score, visible ? 220 : 320, 96);
            setPos(score, visible ? -240 : -190, -34);
            setSize(level, visible ? 170 : 246, 96);
            setPos(level, visible ? -35 : 98, -34);
        }
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
            Tween.stopAllByTarget(sprite.node);
            sprite.node.setScale(0.75, 0.75, 1);
            tween(sprite.node).to(0.18, { scale: Vec3.ONE }, { easing: 'backOut' }).start();
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

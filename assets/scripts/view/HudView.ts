/**
 * 顶部 HUD：品牌栏（暂停 / 重开）、得分卡、等级卡（含进度条）、下一块预览。
 * 只在数值变化时刷新文字，避免每帧触发 Label 重排。
 */
import { _decorator, Component, Graphics, Label, Node, Sprite, SpriteFrame, Vec3, tween } from 'cc';
import { THEME } from '../config/ThemeConfig';
import type { LayoutInfo } from '../ui/LayoutAdapter';
import type { PieceModel } from '../core/PieceModel';
import { createLabel, createNode, createPanel, drawRoundRect, setSize } from '../ui/UIFactory';
import { UIButton } from '../ui/UIButton';

const { ccclass } = _decorator;

export interface HudCallbacks {
    onPause: () => void;
    onRestart: () => void;
}

@ccclass('HudView')
export class HudView extends Component {
    private _scoreLabel: Label | null = null;
    private _bestLabel: Label | null = null;
    private _levelLabel: Label | null = null;
    private _progressFill: Graphics | null = null;
    private _progressNode: Node | null = null;
    private _progressWidth = 100;
    private _nextCells: Node[] = [];
    private _lastScore = -1;

    build(layout: LayoutInfo, callbacks: HudCallbacks): void {
        const w = layout.contentWidth;

        // ── 品牌行 ──
        const brand = createLabel(this.node, '落块消消', {
            size: 28,
            bold: true,
            color: THEME.textPrimary,
            align: 'left',
            width: 240,
        });
        brand.node.setPosition(-w / 2, layout.headerCenterY - 2, 0);

        const sub = createLabel(this.node, 'TETRIS MATCH', {
            size: 14,
            color: THEME.textSecondary,
            align: 'left',
            width: 200,
        });
        sub.node.setPosition(-w / 2 + 150, layout.headerCenterY - 3, 0);

        const pauseNode = createNode('BtnPause', this.node);
        setSize(pauseNode, 56, 56);
        pauseNode.setPosition(w / 2 - 28, layout.headerCenterY, 0);
        const pauseBtn = pauseNode.addComponent(UIButton);
        pauseBtn.init({ width: 56, height: 56, text: 'Ⅱ', kind: 'icon', fontSize: 26, onClick: callbacks.onPause });

        const restartNode = createNode('BtnRestart', this.node);
        setSize(restartNode, 56, 56);
        restartNode.setPosition(w / 2 - 94, layout.headerCenterY, 0);
        const restartBtn = restartNode.addComponent(UIButton);
        restartBtn.init({ width: 56, height: 56, text: '↻', kind: 'icon', fontSize: 28, onClick: callbacks.onRestart });

        // ── 三张卡片 ──
        const nextW = 132;
        const levelW = 180;
        const gap = 12;
        const scoreW = w - nextW - levelW - gap * 2;

        const scoreCard = createPanel(this.node, scoreW, 96, { radius: 22, shadowOffset: 4 });
        scoreCard.setPosition(-w / 2 + scoreW / 2, layout.cardsCenterY, 0);
        createLabel(scoreCard, '得分', {
            size: 16,
            color: THEME.textSecondary,
            align: 'left',
            width: scoreW - 36,
        }).node.setPosition(-scoreW / 2 + 18, 28, 0);
        this._scoreLabel = createLabel(scoreCard, '0', {
            size: 40,
            bold: true,
            align: 'left',
            width: scoreW - 36,
            height: 46,
        });
        this._scoreLabel.node.setPosition(-scoreW / 2 + 18, -10, 0);
        this._bestLabel = createLabel(scoreCard, '最高 0', {
            size: 16,
            color: THEME.textSecondary,
            align: 'right',
            width: 160,
        });
        this._bestLabel.node.setPosition(scoreW / 2 - 18, -20, 0);

        const levelCard = createPanel(this.node, levelW, 96, { radius: 22, shadowOffset: 4 });
        levelCard.setPosition(-w / 2 + scoreW + gap + levelW / 2, layout.cardsCenterY, 0);
        createLabel(levelCard, '等级', {
            size: 16,
            color: THEME.textSecondary,
            align: 'left',
            width: levelW - 32,
        }).node.setPosition(-levelW / 2 + 16, 28, 0);
        this._levelLabel = createLabel(levelCard, '1', {
            size: 34,
            bold: true,
            align: 'left',
            width: levelW - 32,
            height: 40,
        });
        this._levelLabel.node.setPosition(-levelW / 2 + 16, -2, 0);

        this._progressWidth = levelW - 32;
        const track = createNode('ProgressTrack', levelCard);
        setSize(track, this._progressWidth, 10);
        track.setPosition(0, -32, 0);
        const tg = track.addComponent(Graphics);
        drawRoundRect(tg, this._progressWidth, 10, 5, THEME.progressTrack);

        this._progressNode = createNode('ProgressFill', levelCard);
        setSize(this._progressNode, this._progressWidth, 10);
        this._progressNode.setPosition(0, -32, 0);
        this._progressFill = this._progressNode.addComponent(Graphics);
        this.setProgress(0);

        const nextCard = createPanel(this.node, nextW, 96, { radius: 22, shadowOffset: 4 });
        nextCard.setPosition(w / 2 - nextW / 2, layout.cardsCenterY, 0);
        createLabel(nextCard, 'NEXT', {
            size: 14,
            color: THEME.textSecondary,
            width: nextW - 20,
        }).node.setPosition(0, 30, 0);

        for (let i = 0; i < 4; i++) {
            const n = createNode(`NextCell_${i}`, nextCard);
            setSize(n, 24, 24);
            const sp = n.addComponent(Sprite);
            sp.sizeMode = Sprite.SizeMode.CUSTOM;
            sp.type = Sprite.Type.SIMPLE;
            n.active = false;
            this._nextCells.push(n);
        }
    }

    setScore(score: number): void {
        if (!this._scoreLabel || this._lastScore === score) return;
        this._lastScore = score;
        this._scoreLabel.string = String(score);
        const node = this._scoreLabel.node;
        node.setScale(1.08, 1.08, 1);
        tween(node).to(0.12, { scale: new Vec3(1, 1, 1) }).start();
    }

    setBest(best: number): void {
        if (this._bestLabel) this._bestLabel.string = `最高 ${best}`;
    }

    setLevel(level: number): void {
        if (this._levelLabel) this._levelLabel.string = String(level);
    }

    setProgress(p: number): void {
        if (!this._progressFill || !this._progressNode) return;
        const width = Math.max(0, this._progressWidth * Math.max(0, Math.min(1, p)));
        const g = this._progressFill;
        g.clear();
        if (width <= 1) return;
        g.fillColor = THEME.progressFill;
        g.roundRect(-this._progressWidth / 2, -5, width, 10, 5);
        g.fill();
    }

    /** 下一块预览：按包围盒居中 */
    setNext(piece: PieceModel | null, frames: (SpriteFrame | null)[]): void {
        for (const cell of this._nextCells) cell.active = false;
        if (!piece) return;

        let maxR = 0;
        let maxC = 0;
        for (const c of piece.cells) {
            maxR = Math.max(maxR, c.r);
            maxC = Math.max(maxC, c.c);
        }
        const cols = maxC + 1;
        const rows = maxR + 1;
        const cellSize = Math.min(24, 100 / Math.max(cols, rows));
        const totalW = cols * cellSize;
        const totalH = rows * cellSize;

        for (let i = 0; i < piece.cells.length && i < 4; i++) {
            const c = piece.cells[i];
            const node = this._nextCells[i];
            node.active = true;
            const size = cellSize * 0.96;
            setSize(node, size, size);
            node.setPosition(
                -totalW / 2 + (c.c + 0.5) * cellSize,
                totalH / 2 - (c.r + 0.5) * cellSize - 10,
                0,
            );
            const sp = node.getComponent(Sprite)!;
            sp.spriteFrame = frames[piece.color] ?? null;
            if (!sp.spriteFrame) {
                const g = node.getComponent(Graphics) || node.addComponent(Graphics);
                g.clear();
                drawRoundRect(g, size, size, size * 0.24, THEME.blockColors[piece.color]);
            }
        }
    }
}

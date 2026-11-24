/**
 * 横幅提示：同色 xN / 连锁 xN / 整行清除 / LEVEL UP。
 * 同一时间只显示一条，多余的排队（最多 3 条），避免刷屏遮挡棋盘。
 */
import { _decorator, Color, Component, Graphics, Label, Node, Vec3, tween } from 'cc';
import { THEME } from '../config/ThemeConfig';
import { createLabel, createNode, drawRoundRect, getOpacity, setSize } from '../ui/UIFactory';

const { ccclass } = _decorator;

export type BannerKind = 'combo' | 'chain' | 'row' | 'level';

@ccclass('BannerView')
export class BannerView extends Component {
    private _label: Label | null = null;
    private _bg: Graphics | null = null;
    private _panel: Node | null = null;
    private _queue: Array<{ text: string; kind: BannerKind }> = [];
    private _playing = false;
    private _width = 300;

    build(width = 300): void {
        this._width = width;
        const panel = createNode('BannerPanel', this.node);
        setSize(panel, width, 52);
        this._panel = panel;
        this._bg = panel.addComponent(Graphics);
        drawRoundRect(this._bg, width, 52, 26, new Color(59, 42, 31, 224));

        this._label = createLabel(panel, '', {
            size: 26,
            bold: true,
            color: new Color(255, 209, 102, 255),
            width: width - 32,
            height: 52,
        });
        this.node.active = false;
    }

    show(text: string, kind: BannerKind = 'combo'): void {
        this._queue.push({ text, kind });
        if (this._queue.length > 3) this._queue.shift();
        if (!this._playing) void this._next();
    }

    private async _next(): Promise<void> {
        const item = this._queue.shift();
        if (!item) {
            this._playing = false;
            this.node.active = false;
            return;
        }
        this._playing = true;
        if (!this._label || !this._panel) return;

        this.node.active = true;
        this._label.string = item.text;
        if (this._bg) {
            this._bg.clear();
            const color =
                item.kind === 'level'
                    ? new Color(78, 203, 138, 235)
                    : item.kind === 'row'
                      ? new Color(74, 157, 240, 235)
                      : new Color(59, 42, 31, 232);
            drawRoundRect(this._bg, this._width, 52, 26, color);
        }

        const op = getOpacity(this._panel);
        op.opacity = 0;
        this._panel.setScale(0.9, 0.9, 1);
        tween(op).to(0.14, { opacity: 255 }).start();
        tween(this._panel).to(0.18, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' }).start();

        await new Promise<void>((resolve) => setTimeout(resolve, 720));

        await new Promise<void>((resolve) => {
            tween(op)
                .to(0.2, { opacity: 0 })
                .call(() => resolve())
                .start();
        });

        await this._next();
    }

    clear(): void {
        this._queue.length = 0;
        this._playing = false;
        this.node.active = false;
    }
}

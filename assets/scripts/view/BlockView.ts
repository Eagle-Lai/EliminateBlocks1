/**
 * 单格渲染单元：优先使用美术图（含高光与形状标记），缺图时用 Graphics 画圆角块兜底。
 */
import { Color, Graphics, Node, Sprite, SpriteFrame, UIOpacity, Vec3, tween } from 'cc';
import { createNode, drawRoundRect, setSize } from '../ui/UIFactory';
import { THEME } from '../config/ThemeConfig';

export class BlockView {
    readonly node: Node;
    private readonly _sprite: Sprite;
    private readonly _fallback: Node;
    private readonly _graphics: Graphics;
    private readonly _opacity: UIOpacity;
    private _cell = 60;
    private _color: Color = THEME.blockColors[0];
    private _frame: SpriteFrame | null = null;
    private _sizeScale = 0.92;

    r = -1;
    c = -1;
    type = 0;

    constructor(parent: Node, name = 'Block') {
        this.node = createNode(name, parent);
        setSize(this.node, 10, 10);
        this._opacity = this.node.addComponent(UIOpacity);
        this._sprite = this.node.addComponent(Sprite);
        this._sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        this._sprite.type = Sprite.Type.SIMPLE;
        // 一个节点只能挂一个 UIRenderer，缺图兜底画在子节点上
        this._fallback = createNode('Fallback', this.node);
        setSize(this._fallback, 10, 10);
        this._graphics = this._fallback.addComponent(Graphics);
    }

    setCellSize(cell: number, sizeScale = 0.96): void {
        this._cell = cell;
        this._sizeScale = sizeScale;
        const size = Math.round(cell * sizeScale);
        setSize(this.node, size, size);
        setSize(this._fallback, size, size);
        this._redraw();
    }

    setStyle(frame: SpriteFrame | null, color: Color): void {
        this._frame = frame;
        this._color = color;
        if (frame) {
            this._sprite.spriteFrame = frame;
            this._sprite.enabled = true;
            this._fallback.active = false;
        } else {
            this._sprite.enabled = false;
            this._fallback.active = true;
            this._redraw();
        }
    }

    /** 按颜色索引设置外观（图集有图则用图，无图则程序化绘制） */
    applyType(type: number, frame: SpriteFrame | null): void {
        this.type = type;
        this.setStyle(frame, THEME.blockColors[type] ?? THEME.blockColors[0]);
    }

    private _redraw(): void {
        if (this._frame) return;
        const size = this._cell * this._sizeScale;
        const g = this._graphics;
        g.clear();
        drawRoundRect(g, size, size, size * 0.22, this._color);
        g.fillColor = new Color(255, 255, 255, 46);
        g.roundRect(-size / 2 + 3, size * 0.06, size - 6, size * 0.34, size * 0.16);
        g.fill();
    }

    setCellPos(r: number, c: number, boardW: number, boardH: number, cell: number): void {
        this.r = r;
        this.c = c;
        const x = -boardW / 2 + (c + 0.5) * cell;
        const y = boardH / 2 - (r + 0.5) * cell;
        this.node.setPosition(x, y, 0);
    }

    setLocalPos(pos: Vec3): void {
        this.node.setPosition(pos);
    }

    /** 新块出现：轻微弹入 */
    playSpawn(): void {
        this.node.setScale(0.86, 0.86, 1);
        this._opacity.opacity = 255;
        tween(this.node).to(0.09, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' }).start();
    }

    playPop(durationMs: number): Promise<void> {
        return new Promise((resolve) => {
            tween(this.node)
                .to(durationMs / 1000, { scale: new Vec3(0.1, 0.1, 1) }, { easing: 'quadOut' })
                .start();
            tween(this._opacity)
                .to(durationMs / 1000, { opacity: 26 })
                .call(() => resolve())
                .start();
        });
    }

    playFade(durationMs: number): Promise<void> {
        return new Promise((resolve) => {
            tween(this._opacity)
                .to(durationMs / 1000, { opacity: 0 })
                .call(() => resolve())
                .start();
        });
    }

    resetVisual(): void {
        this.node.setScale(1, 1, 1);
        this._opacity.opacity = 255;
    }

    setVisible(visible: boolean): void {
        this.node.active = visible;
    }

    get visible(): boolean {
        return this.node.active;
    }
}

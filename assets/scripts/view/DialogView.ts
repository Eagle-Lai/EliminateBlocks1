/**
 * 通用弹窗：遮罩 + 卡片 + 主/次按钮。
 * 用于结算、暂停、重开确认三种场景，避免重复实现。
 */
import {
    _decorator,
    BlockInputEvents,
    Component,
    Graphics,
    Node,
    Vec3,
    tween,
} from 'cc';
import { THEME } from '../config/ThemeConfig';
import { LayoutAdapter } from '../ui/LayoutAdapter';
import { createLabel, createNode, createPanel, getOpacity, setSize } from '../ui/UIFactory';
import { UIButton } from '../ui/UIButton';

const { ccclass } = _decorator;

export interface DialogButton {
    text: string;
    onClick: () => void;
    kind?: 'primary' | 'secondary';
}

export interface DialogOptions {
    tag?: string;
    title: string;
    score?: string;
    subtitle?: string;
    buttons: DialogButton[];
}

@ccclass('DialogView')
export class DialogView extends Component {
    private _width = 750;
    private _height = 1334;
    private _mask: Node | null = null;
    private _card: Node | null = null;
    private _visible = false;

    build(width: number, height: number): void {
        this._width = width;
        this._height = height;
        // 遮罩要盖住整个可视区域（含 SHOW_ALL 的留边），否则宽窗口下两侧会亮着一条
        const viewport = LayoutAdapter.viewport(width, height);
        const maskW = Math.max(width, viewport.width) + 40;
        const maskH = Math.max(height, viewport.height) + 40;
        setSize(this.node, maskW, maskH);
        this.node.addComponent(BlockInputEvents);

        const mask = createNode('Mask', this.node);
        setSize(mask, maskW, maskH);
        const g = mask.addComponent(Graphics);
        g.fillColor = THEME.mask;
        g.rect(-maskW / 2, -maskH / 2, maskW, maskH);
        g.fill();
        getOpacity(mask).opacity = 0;
        this._mask = mask;
        this.node.active = false;
    }

    get visible(): boolean {
        return this._visible;
    }

    show(opts: DialogOptions): void {
        this._visible = true;
        this.node.active = true;

        if (this._card) {
            this._card.destroy();
            this._card = null;
        }

        const cardW = 600;
        let cardH = 96;
        if (opts.tag) cardH += 30;
        cardH += 56;
        if (opts.score) cardH += 84;
        if (opts.subtitle) cardH += 46;
        cardH += opts.buttons.length * 108;
        cardH += 24;

        const card = createPanel(this.node, cardW, cardH, { radius: 32, shadowOffset: 6 });
        card.setPosition(0, 20, 0);
        this._card = card;

        let cursor = cardH / 2 - 46;
        if (opts.tag) {
            createLabel(card, opts.tag, {
                size: 18,
                color: THEME.textSecondary,
                width: cardW - 80,
            }).node.setPosition(0, cursor, 0);
            cursor -= 34;
        }

        createLabel(card, opts.title, {
            size: 38,
            bold: true,
            width: cardW - 80,
            height: 48,
        }).node.setPosition(0, cursor, 0);
        cursor -= 54;

        if (opts.score) {
            createLabel(card, opts.score, {
                size: 76,
                bold: true,
                color: THEME.primary,
                width: cardW - 80,
                height: 84,
            }).node.setPosition(0, cursor - 12, 0);
            cursor -= 96;
        }

        if (opts.subtitle) {
            createLabel(card, opts.subtitle, {
                size: 22,
                color: THEME.textSecondary,
                width: cardW - 80,
                height: 34,
            }).node.setPosition(0, cursor, 0);
            cursor -= 46;
        }

        for (const btn of opts.buttons) {
            const isPrimary = (btn.kind ?? 'primary') === 'primary';
            const node = createNode(`Btn_${btn.text}`, card);
            const w = cardW - 96;
            const h = isPrimary ? 96 : 64;
            setSize(node, w, h);
            node.setPosition(0, cursor - h / 2, 0);
            const comp = node.addComponent(UIButton);
            comp.init({
                width: w,
                height: h,
                text: btn.text,
                kind: isPrimary ? 'primary' : 'secondary',
                fontSize: isPrimary ? 32 : 26,
                onClick: () => {
                    this.hide();
                    btn.onClick();
                },
            });
            cursor -= 104;
        }

        const op = getOpacity(card);
        op.opacity = 0;
        card.setScale(0.88, 0.88, 1);
        tween(op).to(0.16, { opacity: 255 }).start();
        tween(card).to(0.22, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' }).start();

        if (this._mask) {
            tween(getOpacity(this._mask)).to(0.2, { opacity: 255 }).start();
        }
    }

    hide(): void {
        this._visible = false;
        if (this._mask) getOpacity(this._mask).opacity = 0;
        this.node.active = false;
    }
}

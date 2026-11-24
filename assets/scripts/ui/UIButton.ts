/**
 * 统一按钮组件：按压反馈（缩放 + 下沉）、点击冷却、可选长按连发、禁用态。
 * 视觉用 Graphics 现画，保证任意分辨率下圆角清晰且不依赖九宫格资源。
 */
import {
    _decorator,
    Color,
    Component,
    EventTouch,
    Graphics,
    Label,
    Node,
    Tween,
    UIOpacity,
    UITransform,
    Vec3,
    tween,
} from 'cc';
import { THEME } from '../config/ThemeConfig';
import { TUNING } from '../config/GameTuning';
import { createLabel, createNode, drawRoundRect, setSize } from './UIFactory';

const { ccclass } = _decorator;

export type ButtonKind = 'primary' | 'secondary' | 'ghost' | 'icon';

export interface ButtonOptions {
    width: number;
    height: number;
    text?: string;
    kind?: ButtonKind;
    fontSize?: number;
    /** 长按连发（左右移动用） */
    hold?: { delayMs: number; repeatMs: number };
    onClick?: () => void;
    onPressStart?: () => void;
}

@ccclass('UIButton')
export class UIButton extends Component {
    private _face: Node | null = null;
    private _label: Label | null = null;
    private _onClick: (() => void) | null = null;
    private _onPressStart: (() => void) | null = null;
    private _hold: { delayMs: number; repeatMs: number } | null = null;
    private _pressed = false;
    private _lastClickAt = 0;
    private _interactable = true;

    init(opts: ButtonOptions): void {
        const kind: ButtonKind = opts.kind ?? 'secondary';
        const radius =
            kind === 'icon' ? Math.min(opts.width, opts.height) / 2 : TUNING.ui.radiusButton;

        this.node.getComponent(UITransform)!.setContentSize(opts.width, opts.height);
        this._onClick = opts.onClick ?? null;
        this._onPressStart = opts.onPressStart ?? null;
        this._hold = opts.hold ?? null;

        if (kind === 'primary') {
            const shadow = createNode('Shadow', this.node);
            setSize(shadow, opts.width, opts.height);
            shadow.setPosition(0, -6, 0);
            drawRoundRect(
                shadow.addComponent(Graphics),
                opts.width,
                opts.height,
                radius,
                THEME.primaryShadow,
            );
        }

        const face = createNode('Face', this.node);
        setSize(face, opts.width, opts.height);
        this._face = face;

        const g = face.addComponent(Graphics);
        if (kind === 'primary') {
            drawRoundRect(g, opts.width, opts.height, radius, THEME.primary);
        } else if (kind === 'secondary') {
            drawRoundRect(g, opts.width, opts.height, radius, THEME.secondary, THEME.secondaryBorder, 3);
        } else if (kind === 'icon') {
            drawRoundRect(
                g,
                opts.width,
                opts.height,
                radius,
                new Color(255, 255, 255, 220),
                THEME.secondaryBorder,
                3,
            );
        } else {
            drawRoundRect(g, opts.width, opts.height, radius, new Color(59, 42, 31, 26));
        }

        if (opts.text) {
            const color =
                kind === 'primary'
                    ? THEME.textOnDark
                    : kind === 'ghost'
                      ? THEME.textSecondary
                      : THEME.textPrimary;
            this._label = createLabel(face, opts.text, {
                size: opts.fontSize ?? (kind === 'icon' ? 34 : 30),
                color,
                bold: true,
                width: opts.width - 8,
                height: opts.height,
            });
        }

        this.node.on(Node.EventType.TOUCH_START, this._handleDown, this);
        this.node.on(Node.EventType.TOUCH_END, this._handleUp, this);
        this.node.on(Node.EventType.TOUCH_CANCEL, this._handleCancel, this);
    }

    setText(text: string): void {
        if (this._label) this._label.string = text;
    }

    setInteractable(value: boolean): void {
        this._interactable = value;
        const op = this.node.getComponent(UIOpacity) || this.node.addComponent(UIOpacity);
        op.opacity = value ? 255 : 120;
        if (!value) this._restore();
    }

    private _handleDown(_e: EventTouch): void {
        if (!this._interactable) return;
        this._pressed = true;

        if (this._face) {
            Tween.stopAllByTarget(this._face);
            tween(this._face).to(0.06, { position: new Vec3(0, -4, 0) }).start();
        }
        Tween.stopAllByTarget(this.node);
        tween(this.node).to(0.06, { scale: new Vec3(0.97, 0.97, 1) }).start();

        if (this._onPressStart) this._onPressStart();
        if (this._hold) {
            this.unscheduleAllCallbacks();
            this.scheduleOnce(() => {
                if (!this._pressed) return;
                this.schedule(() => this._fire(), this._hold!.repeatMs / 1000);
            }, this._hold.delayMs / 1000);
        }
    }

    private _handleUp(_e: EventTouch): void {
        if (!this._pressed) return;
        this._restore();
        const now = Date.now();
        if (now - this._lastClickAt >= TUNING.input.buttonCooldownMs) {
            this._lastClickAt = now;
            this._fire();
        }
    }

    private _handleCancel(_e: EventTouch): void {
        this._restore();
    }

    private _restore(): void {
        this._pressed = false;
        this.unscheduleAllCallbacks();
        if (this._face) {
            Tween.stopAllByTarget(this._face);
            tween(this._face).to(0.08, { position: new Vec3(0, 0, 0) }).start();
        }
        Tween.stopAllByTarget(this.node);
        tween(this.node).to(0.08, { scale: new Vec3(1, 1, 1) }).start();
    }

    private _fire(): void {
        if (this._onClick) this._onClick();
    }
}

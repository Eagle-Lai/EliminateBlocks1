/**
 * 统一按钮组件：绑定 Prefab 里的 Sprite + Label（不再用 Graphics 画）。
 * 三态（常态/按下/禁用）由 Sprite.color 派生；可选选中态；点击冷却；长按连发。
 */
import {
    _decorator,
    Color,
    Component,
    EventTouch,
    Label,
    Node,
    Sprite,
    SpriteFrame,
    Tween,
    UIOpacity,
    Vec3,
    tween,
} from 'cc';
import { BUTTON_SKINS, PRESSED_COLOR, type ButtonKind } from '../config/ButtonSkinTable';
import { TUNING } from '../config/GameTuning';
import { THEME } from '../config/ThemeConfig';
import { assets } from '../service/AssetService';
import { audio } from '../service/AudioService';

const { ccclass, property } = _decorator;

@ccclass('UIButton')
export class UIButton extends Component {
    @property(Sprite) bg: Sprite | null = null;
    @property(Label) label: Label | null = null;
    @property(Sprite) iconSprite: Sprite | null = null;
    @property(Node) iconNode: Node | null = null;

    /** primary / secondary / ghost / icon / close / tab */
    @property skin: string = 'primary';

    onClick: (() => void) | null = null;
    onPressStart: (() => void) | null = null;

    private _hold: { delayMs: number; repeatMs: number } | null = null;
    private _pressed = false;
    private _lastClickAt = 0;
    private _interactable = true;
    private _selected = false;
    private _bound = false;
    private _baseColor = new Color(255, 255, 255, 255);

    onLoad(): void {
        this._bind();
        this.applySkin();
    }

    private _bind(): void {
        if (this._bound) return;
        this._bound = true;
        this.node.on(Node.EventType.TOUCH_START, this._down, this);
        this.node.on(Node.EventType.TOUCH_END, this._up, this);
        this.node.on(Node.EventType.TOUCH_CANCEL, this._cancel, this);
    }

    /** 皮肤来自 ButtonSkinTable；按下/禁用只改颜色 */
    applySkin(): void {
        const kind = (this.skin || 'primary') as ButtonKind;
        const skin = BUTTON_SKINS[kind] ?? BUTTON_SKINS.primary;
        if (this.label) this.label.color = skin.textColor;
        if (this.bg) {
            this.bg.type = skin.sliced ? Sprite.Type.SLICED : Sprite.Type.SIMPLE;
            this.bg.sizeMode = Sprite.SizeMode.CUSTOM;
            assets.loadSpriteFrame(skin.frame).then((sf: SpriteFrame | null) => {
                if (sf && this.bg) this.bg.spriteFrame = sf;
            });
        }
    }

    setKind(kind: ButtonKind): void {
        this.skin = kind;
        this.applySkin();
    }

    setText(text: string): void {
        if (this.label) this.label.string = text;
    }

    setIconFrame(frame: SpriteFrame | null): void {
        if (this.iconSprite) this.iconSprite.spriteFrame = frame;
        if (this.iconNode) this.iconNode.active = !!frame;
    }

    setHold(delayMs: number, repeatMs: number): void {
        this._hold = { delayMs, repeatMs };
    }

    setInteractable(value: boolean): void {
        this._interactable = value;
        const op = this.node.getComponent(UIOpacity) || this.node.addComponent(UIOpacity);
        op.opacity = value ? 255 : 130;
        if (!value) this._restore();
    }

    get interactable(): boolean {
        return this._interactable;
    }

    setSelected(value: boolean): void {
        this._selected = value;
        if (this.bg) this.bg.color = value ? THEME.selected : this._baseColor;
    }

    private _down(_e: EventTouch): void {
        if (!this._interactable) return;
        this._pressed = true;
        if (this.bg) this.bg.color = PRESSED_COLOR;
        Tween.stopAllByTarget(this.node);
        tween(this.node).to(0.05, { scale: new Vec3(0.97, 0.97, 1) }).start();
        this.onPressStart?.();
        if (this._hold) {
            this.unscheduleAllCallbacks();
            this.scheduleOnce(() => {
                if (!this._pressed) return;
                this.schedule(() => this._fire(), this._hold!.repeatMs / 1000);
            }, this._hold.delayMs / 1000);
        }
    }

    private _up(_e: EventTouch): void {
        if (!this._pressed) return;
        this._restore();
        const now = Date.now();
        if (now - this._lastClickAt < TUNING.input.buttonCooldownMs) return;
        this._lastClickAt = now;
        this._fire();
    }

    private _cancel(_e: EventTouch): void {
        this._restore();
    }

    private _restore(): void {
        this._pressed = false;
        this.unscheduleAllCallbacks();
        if (this.bg) this.bg.color = this._selected ? THEME.selected : this._baseColor;
        Tween.stopAllByTarget(this.node);
        tween(this.node).to(0.06, { scale: new Vec3(1, 1, 1) }).start();
    }

    private _fire(): void {
        if (!this._interactable) return;
        audio.play('ui_click', 0.8);
        this.onClick?.();
    }

    onDestroy(): void {
        this.unscheduleAllCallbacks();
    }
}

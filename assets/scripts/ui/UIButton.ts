/**
 * 统一按钮组件：绑定 Prefab 里的 Sprite + Label（不再用 Graphics 画）。
 * 四态：常态 / 按下（压暗 + 下沉缩放，松手回弹）/ 禁用（灰化半透明）/ 选中（换 selectedFrame）；
 * 点击冷却；长按连发。文字颜色/描边/唇边偏移全部来自 ButtonSkinTable。
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
import { BUTTON_SKINS, DISABLED_COLOR, PRESSED_COLOR, type ButtonKind } from '../config/ButtonSkinTable';
import { TUNING } from '../config/GameTuning';
import { THEME } from '../config/ThemeConfig';
import { assets } from '../service/AssetService';
import { audio } from '../service/AudioService';
import { UIManager } from './UIManager';

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
        const skin = this._skin();
        if (this.label) {
            this.label.color = skin.textColor;
            const outline = skin.outline;
            this.label.enableOutline = !!outline;
            if (outline) {
                this.label.outlineColor = outline.color;
                this.label.outlineWidth = outline.width;
            }
            // 立体按钮底部有唇边：文字（直接子节点）上移，保证视觉居中
            if (this.label.node.parent === this.node) {
                const p = this.label.node.position;
                this.label.node.setPosition(p.x, skin.lipOffset ?? 0, p.z);
            }
        }
        if (this.iconNode && this.iconNode.parent === this.node) {
            const p = this.iconNode.position;
            this.iconNode.setPosition(p.x, skin.lipOffset ?? 0, p.z);
        }
        if (this.bg) {
            this.bg.type = skin.sliced ? Sprite.Type.SLICED : Sprite.Type.SIMPLE;
            this.bg.sizeMode = Sprite.SizeMode.CUSTOM;
            this._applyFrame();
        }
    }

    private _skin() {
        const kind = (this.skin || 'primary') as ButtonKind;
        return BUTTON_SKINS[kind] ?? BUTTON_SKINS.primary;
    }

    /** 常态/选中两套底图；异步加载完成时以最新状态为准 */
    private _applyFrame(): void {
        const skin = this._skin();
        const path = this._selected && skin.selectedFrame ? skin.selectedFrame : skin.frame;
        const cached = assets.getFrame(path);
        if (cached && this.bg) {
            this.bg.spriteFrame = cached;
            return;
        }
        assets.loadSpriteFrame(path).then((sf: SpriteFrame | null) => {
            const now = this._skin();
            const want = this._selected && now.selectedFrame ? now.selectedFrame : now.frame;
            if (sf && this.bg && this.bg.isValid && want === path) this.bg.spriteFrame = sf;
        });
    }

    private _restColor(): Color {
        if (!this._interactable) return DISABLED_COLOR;
        if (this._selected && !this._skin().selectedFrame) return THEME.selected;
        return this._baseColor;
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
        op.opacity = value ? 255 : 150;
        if (!value) this._restore();
        else if (this.bg) this.bg.color = this._restColor();
    }

    get interactable(): boolean {
        return this._interactable;
    }

    setSelected(value: boolean): void {
        this._selected = value;
        if (this.bg) {
            this.bg.color = this._restColor();
            if (this._skin().selectedFrame) this._applyFrame();
        }
    }

    private _down(e: EventTouch): void {
        if (!this._interactable) return;
        UIManager.instance?.rippleAt(e.getUILocation());
        this._pressed = true;
        if (this.bg) this.bg.color = PRESSED_COLOR;
        Tween.stopAllByTarget(this.node);
        tween(this.node).to(0.05, { scale: new Vec3(0.94, 0.94, 1) }, { easing: 'quadOut' }).start();
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
        const wasPressed = this._pressed;
        this._pressed = false;
        this.unscheduleAllCallbacks();
        if (this.bg) this.bg.color = this._restColor();
        Tween.stopAllByTarget(this.node);
        if (wasPressed) {
            // 松手回弹：1.04 → 1（主流手游按钮的「果冻」反馈）
            tween(this.node)
                .to(0.07, { scale: new Vec3(1.04, 1.04, 1) }, { easing: 'quadOut' })
                .to(0.1, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' })
                .start();
        } else {
            this.node.setScale(1, 1, 1);
        }
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

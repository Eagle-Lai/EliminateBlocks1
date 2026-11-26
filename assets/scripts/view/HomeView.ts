/** 首页：Logo / 模式入口 / 金币 / 最高分。 */
import { _decorator, Color, Label, Node, Sprite, Tween, UIOpacity, Vec3, tween } from 'cc';
import { UIView } from '../ui/UIView';
import { UIButton } from '../ui/UIButton';
import { fmt, setLabel } from './ViewUtils';
import { popArt, scatter } from './UIMotion';
import { ART } from '../config/AssetKeys';
import { THEME } from '../config/ThemeConfig';
import { assets } from '../service/AssetService';

const { ccclass, property } = _decorator;
const CELL = 45;
type MatchPattern = 'row' | 'corner' | 'cascade';

export interface HomeHandlers {
    onEndless: () => void;
    onLevels: () => void;
    onDaily: () => void;
    onSettings: () => void;
}

@ccclass('HomeView')
export class HomeView extends UIView {
    @property(Sprite) logo: Sprite | null = null;
    @property(Node) demoPieces: Node | null = null;
    @property(Node) matchSparks: Node | null = null;
    @property(Node) matchWave: Node | null = null;
    @property(UIButton) endlessBtn: UIButton | null = null;
    @property(UIButton) levelsBtn: UIButton | null = null;
    @property(UIButton) dailyBtn: UIButton | null = null;
    @property(UIButton) settingsBtn: UIButton | null = null;
    @property(Label) coinLabel: Label | null = null;
    @property(Label) bestLabel: Label | null = null;
    @property(Label) hintLabel: Label | null = null;

    private _patterns: MatchPattern[] = [];
    private _lastPattern: MatchPattern | null = null;
    private _color = 0;

    onOpen(data?: unknown): void {
        this.assertRefs([
            ['endlessBtn', this.endlessBtn],
            ['levelsBtn', this.levelsBtn],
            ['dailyBtn', this.dailyBtn],
            ['settingsBtn', this.settingsBtn],
        ]);
        const info = data as { coins?: number; best?: number } | undefined;
        this.setCoins(info?.coins ?? 0);
        this.setBest(info?.best ?? 0);
        popArt(this.logo?.node, 0, 0.9);
        [this.endlessBtn, this.levelsBtn, this.dailyBtn].forEach((btn, i) =>
            popArt(btn?.node.getChildByName('Cover'), 0.06 * i));
    }

    onEnable(): void {
        this.playMatch();
    }

    onDisable(): void {
        this.unschedule(this.playMatch);
        for (const group of [this.demoPieces, this.matchSparks, this.matchWave]) {
            if (!group) continue;
            Tween.stopAllByTarget(group);
            group?.children.forEach(child => Tween.stopAllByTarget(child));
        }
    }

    private nextPattern(): MatchPattern {
        if (!this._patterns.length) this._patterns = ['row', 'corner', 'cascade'];
        const choices = this._patterns.filter(pattern => pattern !== this._lastPattern);
        const next = choices[Math.floor(Math.random() * choices.length)];
        this._patterns.splice(this._patterns.indexOf(next), 1);
        this._lastPattern = next;
        return next;
    }

    private playMatch(): void {
        const group = this.demoPieces;
        if (!group || group.children.length < 6) return;
        const pattern = this.nextPattern();
        const dir = Math.random() < 0.5 ? -1 : 1;
        this._color = (this._color + 1 + Math.floor(Math.random() * 4)) % ART.blocks.length;
        const color = this._color;
        const second = (color + 2) % ART.blocks.length;
        group.children.forEach(node => { node.active = false; });
        this.matchSparks?.children.forEach(node => node.setScale(0, 0, 1));
        this.matchWave?.setScale(0, 0, 1);

        const block = (index: number, shade: number) => {
            const node = group.children[index];
            Tween.stopAllByTarget(node);
            node.active = true;
            node.angle = 0;
            node.setScale(0, 0, 1);
            const sprite = node.getComponent(Sprite)!;
            const frame = assets.getFrame(ART.blocks[shade]);
            if (frame) sprite.spriteFrame = frame;
            return node;
        };
        const land = (i: number, shade: number, col: number, row: number, dx: number, dy: number, delay: number) => {
            const node = block(i, shade);
            const end = new Vec3(dir * col * CELL, row * CELL, 0);
            node.setPosition(end.x + dir * dx, end.y + dy, 0);
            tween(node).delay(delay).to(0.13, { scale: Vec3.ONE }, { easing: 'backOut' })
                .to(0.30, { position: end, scale: new Vec3(1.10, 0.90, 1) }, { easing: 'quadIn' })
                .to(0.12, { scale: Vec3.ONE }, { easing: 'backOut' }).start();
        };
        const timeline = tween(group);
        if (pattern === 'row') {
            land(0, color, -1, 0, -36, 32, 0);
            land(1, color, 1, 0, 36, 32, 0.13);
            land(2, color, 0, 0, 0, 103, 0.66);
            timeline.delay(1.44).call(() => this.popMatch([0, 2, 1], color, 0, 0, 119, 42));
        } else if (pattern === 'corner') {
            land(0, color, -1, 0, -22, 39, 0);
            land(1, color, 0, 0, 0, 45, 0.12);
            // 两格共用一个转轴，保持连接转过 90 度后与底排拼成 L 形。
            for (let arm = 0; arm < 2; arm++) {
                const node = block(arm + 2, color);
                tween(node).delay(0.54).update(0.72, (_, t) => {
                    const turn = t * t * (3 - 2 * t);
                    const angle = turn * Math.PI / 2;
                    const x = CELL + 12 * (1 - t) - arm * CELL * Math.cos(angle);
                    const y = 74 * (1 - t * t) + arm * CELL * Math.sin(angle);
                    node.setPosition(dir * x, y, 0);
                    node.angle = dir * 90 * (1 - turn);
                    const scale = Math.min(1, t * 6);
                    node.setScale(scale, scale, 1);
                }).start();
            }
            timeline.delay(1.57).call(() => this.popMatch([0, 1, 2, 3], color, dir * 12, 14, 88, 81));
        } else {
            land(0, color, 0, 0, 0, 32, 0);
            land(1, color, 0, 1, 0, 33, 0.12);
            land(2, color, 1, 1, 40, 45, 0.74);
            land(3, second, -1, 0, -20, 25, 0.04);
            land(4, second, 1, 0, 22, 33, 0.10);
            land(5, second, 0, 2, 0, 28, 0.24);
            timeline.delay(1.48).call(() => this.popMatch([2, 1, 0], color, 10 * dir, 24, 76, 66))
                .delay(0.48).call(() => {
                    tween(group.children[5]).to(0.33, { position: new Vec3(0, 0, 0) }, { easing: 'bounceOut' }).start();
                }).delay(0.63).call(() => this.popMatch([3, 5, 4], second, 0, 0, 118, 90));
        }
        timeline.call(() => this.scheduleOnce(this.playMatch, 0.77 + Math.random() * 0.28)).start();
    }

    private popMatch(indices: number[], color: number, x: number, y: number, rx: number, ry: number): void {
        const group = this.demoPieces!;
        indices.forEach((index, order) => {
            const node = group.children[index];
            tween(node).delay(order * 0.033).to(0.10, { scale: new Vec3(1.16, 1.16, 1) })
                .to(0.16, { scale: new Vec3(0, 0, 1) }, { easing: 'backIn' })
                .call(() => { node.active = false; }).start();
        });
        this.matchSparks?.setPosition(group.position.x + x, group.position.y + y, 0);
        scatter(this.matchSparks, rx, ry, 0.06);
        const wave = this.matchWave;
        if (!wave) return;
        Tween.stopAllByTarget(wave);
        wave.setPosition(group.position.x + x, group.position.y + y, 0);
        wave.getComponent(Sprite)!.color = Color.lerp(new Color(), THEME.blockColors[color], Color.WHITE, 0.38);
        const op = wave.getComponent(UIOpacity) ?? wave.addComponent(UIOpacity);
        tween(wave).update(0.47, (_, t) => {
            const radius = 0.20 + 0.95 * (1 - (1 - t) * (1 - t));
            wave.setScale(radius * rx / 100, radius * ry / 90, 1);
            op.opacity = 245 * (1 - t);
        }).start();
    }

    bind(handlers: HomeHandlers): void {
        if (this.endlessBtn) this.endlessBtn.onClick = handlers.onEndless;
        if (this.levelsBtn) this.levelsBtn.onClick = handlers.onLevels;
        if (this.dailyBtn) this.dailyBtn.onClick = handlers.onDaily;
        if (this.settingsBtn) this.settingsBtn.onClick = handlers.onSettings;
    }

    setCoins(coins: number): void {
        setLabel(this.coinLabel, fmt(coins));
    }

    setBest(best: number): void {
        setLabel(this.bestLabel, `最高 ${fmt(best)}`);
    }

    setHint(text: string): void {
        setLabel(this.hintLabel, text);
    }
}

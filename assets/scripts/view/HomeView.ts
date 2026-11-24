/** 首页：Logo / 5 个入口 / 金币 / 最高分。 */
import { _decorator, Label, Sprite } from 'cc';
import { UIView } from '../ui/UIView';
import { UIButton } from '../ui/UIButton';
import { setLabel } from './ViewUtils';
import { fmt } from './ViewUtils';

const { ccclass, property } = _decorator;

export interface HomeHandlers {
    onEndless: () => void;
    onLevels: () => void;
    onDaily: () => void;
    onReplay: () => void;
    onSettings: () => void;
}

@ccclass('HomeView')
export class HomeView extends UIView {
    @property(Sprite) logo: Sprite | null = null;
    @property(UIButton) endlessBtn: UIButton | null = null;
    @property(UIButton) levelsBtn: UIButton | null = null;
    @property(UIButton) dailyBtn: UIButton | null = null;
    @property(UIButton) replayBtn: UIButton | null = null;
    @property(UIButton) settingsBtn: UIButton | null = null;
    @property(Label) coinLabel: Label | null = null;
    @property(Label) bestLabel: Label | null = null;
    @property(Label) hintLabel: Label | null = null;

    onOpen(data?: unknown): void {
        this.assertRefs([
            ['endlessBtn', this.endlessBtn],
            ['levelsBtn', this.levelsBtn],
            ['dailyBtn', this.dailyBtn],
            ['settingsBtn', this.settingsBtn],
        ]);
        const info = data as { coins?: number; best?: number; replayAvailable?: boolean } | undefined;
        this.setCoins(info?.coins ?? 0);
        this.setBest(info?.best ?? 0);
        if (this.replayBtn) this.replayBtn.node.active = info?.replayAvailable !== false;
    }

    bind(handlers: HomeHandlers): void {
        if (this.endlessBtn) this.endlessBtn.onClick = handlers.onEndless;
        if (this.levelsBtn) this.levelsBtn.onClick = handlers.onLevels;
        if (this.dailyBtn) this.dailyBtn.onClick = handlers.onDaily;
        if (this.replayBtn) this.replayBtn.onClick = handlers.onReplay;
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

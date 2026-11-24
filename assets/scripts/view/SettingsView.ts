/** 设置：静音 / 制作名单 / 返回。 */
import { _decorator, Label } from 'cc';
import { UIView } from '../ui/UIView';
import { UIButton } from '../ui/UIButton';
import { setLabel } from './ViewUtils';

const { ccclass, property } = _decorator;

@ccclass('SettingsView')
export class SettingsView extends UIView {
    @property(UIButton) muteBtn: UIButton | null = null;
    @property(UIButton) creditsBtn: UIButton | null = null;
    @property(UIButton) backBtn: UIButton | null = null;
    @property(Label) creditsLabel: Label | null = null;

    onOpen(data?: unknown): void {
        this.assertRefs([['muteBtn', this.muteBtn], ['backBtn', this.backBtn]]);
        const info = data as { muted?: boolean } | undefined;
        this.setMuted(info?.muted ?? false);
    }

    bind(handlers: { onToggleMute: () => boolean; onBack: () => void }): void {
        if (this.muteBtn) {
            this.muteBtn.onClick = () => {
                const muted = handlers.onToggleMute();
                this.setMuted(muted);
            };
        }
        if (this.backBtn) this.backBtn.onClick = handlers.onBack;
        if (this.creditsBtn) {
            this.creditsBtn.onClick = () => {
                setLabel(this.creditsLabel, '美术/音频/代码均由本工程管线生成');
            };
        }
    }

    setMuted(muted: boolean): void {
        this.muteBtn?.setText(muted ? '音效：关' : '音效：开');
    }
}

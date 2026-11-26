/** 回放：BoardHost / Score / Time / Btn_Play / Btn_Speed / Slider / Btn_Close。 */
import { _decorator, EventTouch, Label, Node, Slider, Sprite, UITransform, Vec3 } from 'cc';
import { animateMeter, popArt } from './UIMotion';
import { UIView } from '../ui/UIView';
import { UIButton } from '../ui/UIButton';
import { BoardView } from './BoardView';
import { setLabel } from './ViewUtils';
import type { ReplaySnapshot } from '../core/InputRecorder';

const { ccclass, property } = _decorator;

@ccclass('ReplayView')
export class ReplayView extends UIView {
    @property(BoardView) board: BoardView | null = null;
    @property(Label) scoreLabel: Label | null = null;
    @property(Label) timeLabel: Label | null = null;
    @property(Label) titleLabel: Label | null = null;
    @property(UIButton) playBtn: UIButton | null = null;
    @property(UIButton) speedBtn: UIButton | null = null;
    @property(Slider) slider: Slider | null = null;
    @property(Sprite) timelineFill: Sprite | null = null;
    @property(Node) meter: Node | null = null;
    @property(Node) playbackTrace: Node | null = null;
    @property(UIButton) closeBtn: UIButton | null = null;

    onOpen(data?: unknown): void {
        this.assertRefs([
            ['board', this.board],
            ['playBtn', this.playBtn],
            ['closeBtn', this.closeBtn],
        ]);
        const info = data as { title?: string } | undefined;
        setLabel(this.titleLabel, info?.title ?? '最佳局回放');
        this.setProgress(0);
        animateMeter(this.meter, false);
        if (this.playbackTrace) this.playbackTrace.active = false;
    }

    bind(handlers: {
        onPlayPause: () => void;
        onSpeed: () => void;
        onSeek: (ratio: number) => void;
        onClose: () => void;
    }): void {
        if (this.playBtn) this.playBtn.onClick = handlers.onPlayPause;
        if (this.speedBtn) this.speedBtn.onClick = handlers.onSpeed;
        if (this.closeBtn) this.closeBtn.onClick = handlers.onClose;
        if (this.slider) {
            this.slider.node.on('slide', () => handlers.onSeek(this.slider?.progress ?? 0));
        } else {
            const track = this.timelineFill?.node.parent?.getComponent(UITransform);
            if (track) {
                const seek = (event: EventTouch) => {
                    const point = event.getUILocation();
                    const local = track.convertToNodeSpaceAR(new Vec3(point.x, point.y, 0));
                    handlers.onSeek(Math.max(0, Math.min(1, local.x / track.width + track.anchorX)));
                };
                track.node.on(Node.EventType.TOUCH_END, seek, this);
                track.node.on(Node.EventType.TOUCH_MOVE, seek, this);
            }
        }
    }

    setPlaying(playing: boolean): void {
        if (this.playbackTrace) this.playbackTrace.active = playing;
        animateMeter(this.meter, playing);
        this.playBtn?.setText(playing ? '暂停' : '播放');
        this.playBtn?.setKind(playing ? 'secondary' : 'primary');
    }

    setSpeed(speed: number): void {
        this.speedBtn?.setText(`${speed}×`);
    }

    setScore(score: number): void {
        if (this.scoreLabel && this.scoreLabel.string !== String(score)) popArt(this.scoreLabel.node, 0, 1.12);
        setLabel(this.scoreLabel, String(score));
    }

    setProgress(ratio: number): void {
        if (this.slider) this.slider.progress = Math.min(1, Math.max(0, ratio));
        if (this.timelineFill) this.timelineFill.fillRange = Math.min(1, Math.max(0, ratio));
    }

    setTime(text: string): void {
        setLabel(this.timeLabel, text);
    }

    renderSnapshot(snap: ReplaySnapshot): void {
        setLabel(this.scoreLabel, String(snap.score));
    }

    setBackground(_frame: Sprite | null): void {
        /* 回放背景复用 GameScreen 的章节图，这里留空 */
    }
}

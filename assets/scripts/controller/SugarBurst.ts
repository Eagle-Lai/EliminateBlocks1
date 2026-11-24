/**
 * 糖爆：0.4s 慢动作 → 闪 3 次 → 清除 → 重力 → 再结算 → 归零。
 * 不增加 lockCount、不免疫堆顶。
 */
import { UIOpacity, Vec3, tween } from 'cc';
import { applyBurst } from '../core/Simulator';
import { SugarEnergy } from '../core/SugarEnergy';
import { TUNING } from '../config/GameTuning';
import { wait } from '../utils/Anim';
import { audio } from '../service/AudioService';
import { haptic } from '../service/HapticService';
import type { RunContext } from '../app/RunContext';
import type { BoardModel } from '../core/BoardModel';
import type { GameScreenView } from '../view/GameScreenView';
import type { ResolvePresenter } from './ResolvePresenter';
import type { ScoreService } from '../core/ScoreService';

export class SugarBurst {
    constructor(
        private readonly view: GameScreenView,
        private readonly model: BoardModel,
        private readonly score: ScoreService,
        private readonly presenter: ResolvePresenter,
    ) {}

    /** @param color 指定色（Lv3）；null 用最多颜色 */
    async run(run: RunContext, color: number | null = null): Promise<void> {
        if (!run.sugar.full) return;
        const level = run.sugar.consume();
        run.burstsUsed++;
        run.recorder?.recordBurst(level);

        audio.play('sugar_burst');
        haptic.medium();
        this.view.banner?.show(`糖爆 Lv${level}`, 'level');
        await wait(TUNING.sugar.slowMoMs);

        const host = this.view.boardHost;
        if (host) {
            const op = host.getComponent(UIOpacity) || host.addComponent(UIOpacity);
            for (let i = 0; i < TUNING.sugar.flashCount; i++) {
                tween(op).to(0.06, { opacity: 90 }).to(0.06, { opacity: 255 }).start();
            }
        }

        const target = color ?? SugarEnergy.targetColor(this.model);
        const radius = level >= 2 ? TUNING.sugar.burstRadius + run.mods.burstRadiusBonus : 0;
        const removed = applyBurst(this.model, target, radius);
        const bonus = Math.round(removed.length * 5 * level * run.mods.burstScoreMul);
        this.score.add(bonus);
        this.view.hud?.setScore(this.score.score);
        this.view.hud?.setProgress(0);
        if (host) {
            const pos = this.view.board?.cellToLocal(Math.floor(this.model.rows / 2), Math.floor(this.model.cols / 2));
            this.view.floats?.spawn(`+${bonus}`, pos ?? new Vec3(0, 0, 0), { r: 255, g: 196, b: 64, a: 255 } as never);
        }
        run.goal?.onBurst(1);
        run.goal?.syncScore(this.score.score);

        this.presenter.prepare(true);
        await this.presenter.run(run, true);
        run.sugar.reset();
        this.view.sugarRail?.setValue(0);
        run.deferredLocks = 0;
    }
}

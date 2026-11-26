/**
 * 糖爆：0.4s 慢动作 → 闪 3 次 → 清除 → 重力 → 再结算 → 归零。
 * 不增加 lockCount、不免疫堆顶。
 */
import { UIOpacity, Vec3, tween } from 'cc';
import { applyGravity } from '../core/GravityResolver';
import { applyBurst } from '../core/Simulator';
import { SugarEnergy } from '../core/SugarEnergy';
import { TUNING } from '../config/GameTuning';
import { THEME } from '../config/ThemeConfig';
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
        this.view.banner?.show(`${level} 级糖爆`, 'level');
        await wait(TUNING.sugar.slowMoMs);

        run.token.throwIfCancelled();
        const host = this.view.boardHost;
        if (host) {
            const op = host.getComponent(UIOpacity) || host.addComponent(UIOpacity);
            const flash = tween(op).to(0.06, { opacity: 90 }).to(0.06, { opacity: 255 });
            tween(op).repeat(TUNING.sugar.flashCount, flash).start();
            await wait(120 * TUNING.sugar.flashCount);
            run.token.throwIfCancelled();
        }

        const target = color ?? SugarEnergy.targetColor(this.model);
        const radius = level >= 2 ? TUNING.sugar.burstRadius + run.mods.burstRadiusBonus : 0;
        const removed = applyBurst(this.model, target, radius, blocks => run.recordCleared(blocks));
        const bonus = Math.round(removed.length * 5 * level * run.mods.burstScoreMul * run.mods.scoreMul);
        this.score.add(bonus);
        this.view.hud?.setScore(this.score.score);

        if (host) {
            const pos = this.view.board?.cellToLocal(Math.floor(this.model.rows / 2), Math.floor(this.model.cols / 2));
            this.view.floats?.spawn(`+${bonus}`, pos ?? new Vec3(0, 0, 0), THEME.accent);
        }
        run.goal?.onBurst(1);
        run.goal?.syncScore(this.score.score);

        applyGravity(this.model, run.mutation?.dir ?? 1);
        const fogRows = run.mutation?.fogRows ?? 0;
        await this.view.board?.rebuild(this.model, TUNING.settle.dropMs, { fogRows });
        run.token.throwIfCancelled();
        this.presenter.prepare(run.config.specials);
        await this.presenter.run(run, true);
        run.token.throwIfCancelled();
        this.view.sugarRail?.setValue(0);
        run.deferredLocks = 0;
    }
}

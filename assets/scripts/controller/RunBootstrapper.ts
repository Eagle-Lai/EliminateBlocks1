/** 开局装配：把 RunConfig 变成 BoardModel + 出牌源 + 记录器 + 异变运行时。 */
import { BoardModel } from '../core/BoardModel';
import { buildStoneBoard } from '../core/BoardPatterns';
import { PieceFactory } from '../core/PieceFactory';
import { QueuePieceSource, type PieceSource } from '../core/PieceSource';
import { InputRecorder } from '../core/InputRecorder';
import { TUNING } from '../config/GameTuning';
import type { RunConfig } from '../app/GameMode';
import { RunContext } from '../app/RunContext';

export interface BootResult {
    run: RunContext;
    model: BoardModel;
    source: PieceSource;
    initialDump: string[];
}

export class RunBootstrapper {
    static create(config: RunConfig): BootResult {
        const run = new RunContext(0, config.seed, config);
        const model = RunBootstrapper.buildBoard(config);
        const initialRows = model.dump().split('\n');

        const colorCount = run.mutation?.colorCount || config.colorCount;
        const source: PieceSource = config.pieceQueue
            ? new QueuePieceSource(config.pieceQueue, model.cols)
            : new PieceFactory(run.rng, model.cols, colorCount);

        run.recorder = new InputRecorder(config.seed, config.mode, initialRows, `r${Date.now()}`);
        return { run, model, source, initialDump: initialRows };
    }

    static buildBoard(config: RunConfig): BoardModel {
        if (config.initialBoard && config.initialBoard.length > 0) {
            return BoardModel.fromPattern(config.initialBoard);
        }
        if (config.stoneCount && config.stoneCount > 0) {
            return BoardModel.fromPattern(buildStoneBoard(config.stoneSeed ?? config.seed, config.stoneCount));
        }
        return new BoardModel(TUNING.board.cols, TUNING.board.rows);
    }
}

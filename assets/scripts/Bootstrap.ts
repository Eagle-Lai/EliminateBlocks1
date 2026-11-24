/**
 * 场景启动兜底钩子。
 *
 * 入口组件现在按脚本 uuid（cid，形如 e3b44zIIG5P26wmc+9MfW5v）序列化在 Main.scene 的 Canvas 上，
 * 编辑器与构建都能正常解析。这里保留一层兜底：万一场景里的组件被删掉，
 * 或者被写成了 `"__type__": "GameEntry"` 这种按类名存储的失效类型（控制台报 Missing class），
 * 场景启动后仍会把 GameEntry 补挂到 Canvas 上，保证游戏一定能跑起来。
 */
import { director, Director } from 'cc';
import { GameEntry } from './app/GameEntry';
import { Logger } from './utils/Logger';

function attachEntry(): void {
    const scene = director.getScene();
    if (!scene) return;
    // 只在主场景检查：预制体编辑场景（如 DailyPanel-scene）没有 Canvas，刷警告无意义
    if (scene.name !== 'Main') return;

    const canvas = scene.getChildByName('Canvas');
    if (!canvas) {
        Logger.warn('Bootstrap', '场景中未找到 Canvas 节点');
        return;
    }
    if (canvas.getComponent(GameEntry)) return;

    canvas.addComponent(GameEntry);
    Logger.info('Bootstrap', 'GameEntry 已挂载（兜底）');
}

director.on(Director.EVENT_AFTER_SCENE_LAUNCH, attachEntry);
attachEntry();

/** 逻辑键 → Prefab 路径/层级/缓存/预载组（与 §4 的 38 个预制体一一对应）。 */
export type UILayer = 'scene' | 'panel' | 'popup' | 'toast';

export interface PrefabEntry {
    key: string;
    path: string;
    layer: UILayer;
    cache: boolean;
    preload: boolean;
    /** 是否模态（阻断下层输入） */
    modal?: boolean;
}

export const PREFABS: readonly PrefabEntry[] = [
    { key: 'boot', path: 'prefabs/ui/Boot', layer: 'panel', cache: false, preload: true },
    { key: 'home', path: 'prefabs/ui/Home', layer: 'panel', cache: true, preload: true },
    { key: 'chapterMap', path: 'prefabs/ui/ChapterMap', layer: 'panel', cache: true, preload: false },
    { key: 'chapterTab', path: 'prefabs/ui/ChapterTab', layer: 'panel', cache: true, preload: false },
    { key: 'levelNode', path: 'prefabs/ui/LevelNode', layer: 'panel', cache: true, preload: false },
    { key: 'dailyPanel', path: 'prefabs/ui/DailyPanel', layer: 'panel', cache: true, preload: false },
    { key: 'dayCell', path: 'prefabs/ui/DayCell', layer: 'panel', cache: true, preload: false },
    { key: 'settings', path: 'prefabs/ui/Settings', layer: 'popup', cache: false, preload: false, modal: true },
    { key: 'replay', path: 'prefabs/ui/Replay', layer: 'panel', cache: false, preload: false },
    { key: 'background', path: 'prefabs/ui/Background', layer: 'panel', cache: true, preload: true },
    { key: 'gameScreen', path: 'prefabs/game/GameScreen', layer: 'scene', cache: false, preload: false },
    { key: 'hud', path: 'prefabs/game/HUD', layer: 'scene', cache: true, preload: false },
    { key: 'pad', path: 'prefabs/game/Pad', layer: 'scene', cache: true, preload: false },
    { key: 'sugarRail', path: 'prefabs/game/SugarRail', layer: 'scene', cache: true, preload: false },
    { key: 'board', path: 'prefabs/game/Board', layer: 'scene', cache: true, preload: false },
    { key: 'gridCell', path: 'prefabs/game/GridCell', layer: 'scene', cache: true, preload: true },
    { key: 'block', path: 'prefabs/game/Block', layer: 'scene', cache: true, preload: true },
    { key: 'pieceCell', path: 'prefabs/game/PieceCell', layer: 'scene', cache: true, preload: true },
    { key: 'ghostCell', path: 'prefabs/game/GhostCell', layer: 'scene', cache: true, preload: true },
    { key: 'fogCell', path: 'prefabs/game/FogCell', layer: 'scene', cache: true, preload: true },
    { key: 'shadowBar', path: 'prefabs/game/ShadowBar', layer: 'scene', cache: true, preload: false },
    { key: 'mutationBadge', path: 'prefabs/game/MutationBadge', layer: 'scene', cache: true, preload: false },
    { key: 'mutationIntro', path: 'prefabs/game/MutationIntro', layer: 'popup', cache: false, preload: true, modal: true },
    { key: 'highlight', path: 'prefabs/game/Highlight', layer: 'scene', cache: true, preload: false },
    { key: 'dialog', path: 'prefabs/ui/Dialog', layer: 'popup', cache: true, preload: true, modal: true },
    { key: 'toast', path: 'prefabs/ui/Toast', layer: 'toast', cache: true, preload: true },
    { key: 'banner', path: 'prefabs/ui/Banner', layer: 'scene', cache: true, preload: true },
    { key: 'floatText', path: 'prefabs/ui/FloatText', layer: 'scene', cache: true, preload: true },
    { key: 'talentPicker', path: 'prefabs/ui/TalentPicker', layer: 'popup', cache: false, preload: false, modal: true },
    { key: 'talentCard', path: 'prefabs/ui/TalentCard', layer: 'popup', cache: true, preload: false },
    { key: 'colorPicker', path: 'prefabs/ui/ColorPicker', layer: 'popup', cache: false, preload: false, modal: true },
    { key: 'starRow', path: 'prefabs/ui/StarRow', layer: 'popup', cache: true, preload: false },
    { key: 'button', path: 'prefabs/ui/Button', layer: 'panel', cache: true, preload: true },
    { key: 'progressBar', path: 'prefabs/ui/ProgressBar', layer: 'panel', cache: true, preload: true },
    { key: 'burstFx', path: 'prefabs/fx/BurstFx', layer: 'scene', cache: true, preload: true },
    { key: 'shockwaveFx', path: 'prefabs/fx/ShockwaveFx', layer: 'scene', cache: true, preload: true },
    { key: 'frostFx', path: 'prefabs/fx/FrostFx', layer: 'scene', cache: true, preload: true },
    { key: 'prismFx', path: 'prefabs/fx/PrismFx', layer: 'scene', cache: true, preload: true },
] as const;

export const PREFAB_MAP: Record<string, PrefabEntry> = PREFABS.reduce(
    (acc, e) => {
        acc[e.key] = e;
        return acc;
    },
    {} as Record<string, PrefabEntry>,
);

export function prefabPath(key: string): string {
    const entry = PREFAB_MAP[key];
    if (!entry) throw new Error(`未注册的 Prefab 键：${key}`);
    return entry.path;
}

/** 启动预载组 */
export const BOOT_PREFABS: readonly string[] = PREFABS.map((p) => p.path);

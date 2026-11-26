/**
 * 章节地图：Tabs / LevelGrid / Progress / Btn_Back。
 * 关卡格由 LevelNode.prefab 实例化到 LevelGrid（Layout 在 Prefab 里配好）。
 */
import { _decorator, Color, Label, Node, Prefab, Sprite, instantiate } from 'cc';
import { UIView } from '../ui/UIView';
import { UIButton } from '../ui/UIButton';
import { ChapterTabView } from './ChapterTabView';
import { LevelNodeView } from './LevelNodeView';
import { revealGrid, setLabel } from './ViewUtils';
import { assets } from '../service/AssetService';
import { CHAPTERS, LEVELS } from '../config/LevelTable';
import { chapterCleared, chapterUnlocked } from '../config/LevelTable';
import { THEME } from '../config/ThemeConfig';
import { popArt } from './UIMotion';

const { ccclass, property } = _decorator;

@ccclass('ChapterMapView')
export class ChapterMapView extends UIView {
    @property(Node) tabsRoot: Node | null = null;
    @property(Node) levelGrid: Node | null = null;
    @property(Node) butterflies: Node | null = null;
    @property(Prefab) levelNodePrefab: Prefab | null = null;
    @property(Label) progressLabel: Label | null = null;
    @property(Label) titleLabel: Label | null = null;
    @property(UIButton) backBtn: UIButton | null = null;

    private _chapter = 1;
    private _stars: Record<number, number> = {};
    private _nodes: LevelNodeView[] = [];

    onOpen(data?: unknown): void {
        this.assertRefs([
            ['levelGrid', this.levelGrid],
            ['backBtn', this.backBtn],
        ]);
        const info = data as { stars?: Record<number, number>; chapter?: number } | undefined;
        this._stars = info?.stars ?? {};
        this._chapter = info?.chapter ?? 1;
        this.setChapter(this._chapter);
    }

    bind(handlers: { onBack: () => void; onSelectLevel: (id: number) => void }): void {
        if (this.backBtn) this.backBtn.onClick = handlers.onBack;
        this._onSelect = handlers.onSelectLevel;
    }

    private _onSelect: ((id: number) => void) | null = null;

    private _buildTabs(): void {
        if (!this.tabsRoot) return;
        for (let i = 0; i < this.tabsRoot.children.length; i++) {
            const node = this.tabsRoot.children[i];
            const view = node.getComponent(ChapterTabView);
            if (!view) continue;
            const chapter = i + 1;
            const cfg = CHAPTERS[i];
            const unlocked = chapterUnlocked(this._stars, chapter);
            let stars = 0;
            for (let s = 1; s <= 20; s++) stars += this._stars[(chapter - 1) * 20 + s] ?? 0;
            view.setChapter(chapter, cfg?.name ?? `第 ${chapter} 章`, stars, unlocked, chapter === this._chapter);
            view.bind(() => {
                if (!unlocked) return;
                this.setChapter(chapter);
            });
        }
    }

    setChapter(chapter: number): void {
        this._chapter = chapter;
        this._buildTabs();
        const cfg = CHAPTERS[chapter - 1];
        const wingColor = THEME.blockColors[chapter - 1] ?? THEME.accent;
        this.butterflies?.children.forEach((wing, i) => {
            const sprite = wing.getComponent(Sprite);
            if (!sprite) return;
            const tint = Color.lerp(new Color(), wingColor, Color.WHITE, 0.46);
            sprite.color = new Color(tint.r, tint.g, tint.b - i * 16, 224);
            popArt(wing, i * 0.045, 0.54);
        });
        setLabel(this.titleLabel, cfg?.name ?? `第 ${chapter} 章`);
        setLabel(
            this.progressLabel,
            `本章 ${chapterCleared(this._stars, chapter)}/20 · 已获 ${this._chapterStars(chapter)} 星`,
        );

        const prefab = this.levelNodePrefab ?? assets.getPrefab('prefabs/ui/LevelNode');
        if (!this.levelGrid || !prefab) return;
        for (const item of this._nodes) {
            item.node.removeFromParent();
            item.node.destroy();
        }
        this._nodes = [];
        const list = LEVELS.filter((l) => l.chapter === chapter);
        for (const level of list) {
            const node = instantiate(prefab);
            node.setParent(this.levelGrid);
            const view = node.getComponent(LevelNodeView);
            if (!view) continue;
            view.onOpen();
            const unlocked = chapterUnlocked(this._stars, chapter) && this._prevCleared(chapter, level.slot);
            view.setLevel(level.id, level.name, this._stars[level.id] ?? 0, unlocked, level.mutationId, chapter);
            view.bind(() => {
                if (!unlocked) return;
                this._onSelect?.(level.id);
            });
            this._nodes.push(view);
        }
        // 重新排列：Layout 组件在 Prefab 上，调用一次即可
        const layout = this.levelGrid.getComponent('cc.Layout') as unknown as { updateLayout: () => void } | null;
        layout?.updateLayout();
        revealGrid(this.levelGrid, 4);
    }

    private _prevCleared(chapter: number, slot: number): boolean {
        if (slot <= 1) return true;
        return (this._stars[(chapter - 1) * 20 + slot - 1] ?? 0) > 0;
    }

    private _chapterStars(chapter: number): number {
        let n = 0;
        for (let s = 1; s <= 20; s++) n += this._stars[(chapter - 1) * 20 + s] ?? 0;
        return n;
    }

    refreshStars(stars: Record<number, number>): void {
        this._stars = stars;
        this.setChapter(this._chapter);
    }
}

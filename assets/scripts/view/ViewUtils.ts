/** 视图工具：只做属性赋值与尺寸设置，不创建节点。 */
import { Label, Node, Sprite, SpriteFrame, UITransform, UIOpacity } from 'cc';
import { popArt } from './UIMotion';
import { assets } from '../service/AssetService';

export function setLabel(label: Label | null, text: string): void {
    if (label && label.string !== text) label.string = text;
}

export function setSprite(sprite: Sprite | null, frame: SpriteFrame | null): void {
    if (sprite && sprite.spriteFrame !== frame) sprite.spriteFrame = frame;
}

const requestedFrame = new WeakMap<Sprite, string | null>();
export function loadSprite(sprite: Sprite | null, path: string | null): void {
    if (!sprite) return;
    requestedFrame.set(sprite, path);
    if (!path) { sprite.spriteFrame = null; return; }
    assets.loadSpriteFrame(path).then((sf) => {
        if (sf && sprite.isValid && requestedFrame.get(sprite) === path) sprite.spriteFrame = sf;
    });
}

export function setSize(node: Node | null, w: number, h: number): void {
    if (!node) return;
    const ut = node.getComponent(UITransform);
    if (ut) ut.setContentSize(w, h);
}

export function setPos(node: Node | null, x: number, y: number): void {
    if (node) node.setPosition(x, y, 0);
}

export function setActive(node: Node | null, active: boolean): void {
    if (node && node.active !== active) node.active = active;
}

export function setOpacity(target: Node | UIOpacity | null, value: number): void {
    if (!target) return;
    const op = target instanceof Node ? target.getComponent(UIOpacity) : target;
    if (op) op.opacity = value;
}

/** 插画沿网格对角线依次翻开，格子和按钮可立即操作。 */
export function revealGrid(grid: Node | null, columns: number): void {
    grid?.children.forEach((cell, i) => {
        const diagonal = i % columns + Math.floor(i / columns);
        popArt(cell.getChildByName('Artwork'), diagonal * 0.033, 0.52);
    });
}

export function fmt(n: number): string {
    if (n >= 1e8) return `${+(n / 1e8).toFixed(1)}亿`;
    if (n >= 1e4) return `${+(n / 1e4).toFixed(1)}万`;
    return String(n);
}

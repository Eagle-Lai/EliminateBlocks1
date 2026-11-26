import { Node, Tween, Vec3, tween } from 'cc';

/** 专用于装饰、文字与插画。按钮自身仍负责按压与命中区域。 */
export function popArt(node: Node | null | undefined, delay = 0, from = 0.82): void {
    if (!node) return;
    Tween.stopAllByTarget(node);
    node.setScale(from, from, 1);
    tween(node).delay(delay).to(0.28, { scale: Vec3.ONE }, { easing: 'backOut' }).start();
}

/** 固定数量的晶屑从容器中心飞出，收尾缩回零；再次触发时复用同一批节点。 */
export function scatter(group: Node | null, rx: number, ry: number, delay = 0): void {
    if (!group) return;
    group.children.forEach((particle, i, list) => {
        const angle = (i + 0.5) * Math.PI * 2 / list.length;
        const dx = Math.cos(angle) * rx;
        const dy = Math.sin(angle) * ry;
        Tween.stopAllByTarget(particle);
        particle.setPosition(dx * 0.24, dy * 0.24, 0);
        particle.setScale(0, 0, 1);
        tween(particle).delay(delay + (i % 3) * 0.025)
            .to(0.23, { position: new Vec3(dx * 0.8, dy * 0.8), scale: Vec3.ONE }, { easing: 'quadOut' })
            .to(0.38, { position: new Vec3(dx, dy - 10), scale: new Vec3(0, 0, 1) }, { easing: 'sineInOut' })
            .start();
    });
}

/** 音量和播放状态的小指示灯。停止时留下静止的低电平。 */
export function animateMeter(group: Node | null, playing: boolean): void {
    group?.children.forEach((bar, i) => {
        Tween.stopAllByTarget(bar);
        bar.setScale(1, 0.22, 1);
        if (!playing) return;
        const beat = 0.28 + (i % 3) * 0.09;
        tween(bar).delay(i * 0.07).repeatForever(tween<Node>()
            .to(beat, { scale: new Vec3(1, 1, 1) }, { easing: 'sineInOut' })
            .to(beat, { scale: new Vec3(1, 0.32, 1) }, { easing: 'sineInOut' })
        ).start();
    });
}

/** 动画辅助：把 tween / 定时器包装成 Promise，供 async 结算流程使用。 */
import { Animation, Node, Tween, tween } from 'cc';

export function wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
}

export function tweenNode(
    node: Node,
    durationMs: number,
    props: Record<string, unknown>,
    easing?: string,
): Promise<void> {
    return new Promise((resolve) => {
        tween(node)
            .to(durationMs / 1000, props as never, { easing: (easing ?? 'linear') as never })
            .call(() => resolve())
            .start();
    });
}

export function stopTweens(node: Node): void {
    Tween.stopAllByTarget(node);
}

/** 优先播放预制体里的 AnimationClip（v2 管线），没有时退回 tween 代码动效 */
export function playClip(node: Node | null, clipName: string, fallback?: () => void): void {
    if (!node) {
        fallback?.();
        return;
    }
    const anim = node.getComponent(Animation);
    if (anim && anim.clips.some((c) => c && c.name === clipName)) {
        anim.play(clipName);
        return;
    }
    fallback?.();
}

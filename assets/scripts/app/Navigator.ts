/** 导航：把屏幕跳转从 controller 解耦，由 GameEntry 注册实现。 */
export interface NavigatorHandlers {
    toHome: (fresh?: boolean) => void;
    toChapter: (chapter?: number) => void;
    toDaily: () => void;
    startLevel: (id: number) => void;
    startDaily: (dayOfYear: number) => void;
    startEndless: () => void;
    openReplay: () => void;
    openSettings: () => void;
}

const noop = (): void => {
    /* 未注册 */
};

export const nav: NavigatorHandlers = {
    toHome: noop,
    toChapter: noop,
    toDaily: noop,
    startLevel: noop,
    startDaily: noop,
    startEndless: noop,
    openReplay: noop,
    openSettings: noop,
};

export function setNavigator(handlers: Partial<NavigatorHandlers>): void {
    Object.assign(nav, handlers);
}

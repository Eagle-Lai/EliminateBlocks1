/** 分级日志：生产环境只保留 warn/error，避免刷屏拖慢小游戏。 */
export class Logger {
    static verbose = false;

    static info(tag: string, ...args: unknown[]): void {
        if (!Logger.verbose) return;
        console.log(`[${tag}]`, ...args);
    }

    static warn(tag: string, ...args: unknown[]): void {
        console.warn(`[${tag}]`, ...args);
    }

    static error(tag: string, ...args: unknown[]): void {
        console.error(`[${tag}]`, ...args);
    }
}

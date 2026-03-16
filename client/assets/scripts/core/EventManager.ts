/**
 * EventManager.ts - 全局事件总线
 * 解耦模块间通信
 */

type EventCallback = (...args: any[]) => void;

export class EventManager {
    private static _instance: EventManager;
    private _listeners: Map<string, EventCallback[]> = new Map();

    static get instance(): EventManager {
        if (!this._instance) {
            this._instance = new EventManager();
        }
        return this._instance;
    }

    init(): void {
        this._listeners.clear();
    }

    /** 注册事件监听 */
    on(event: string, callback: EventCallback): void {
        if (!this._listeners.has(event)) {
            this._listeners.set(event, []);
        }
        this._listeners.get(event)!.push(callback);
    }

    /** 注销事件监听 */
    off(event: string, callback: EventCallback): void {
        const callbacks = this._listeners.get(event);
        if (!callbacks) return;
        const idx = callbacks.indexOf(callback);
        if (idx >= 0) {
            callbacks.splice(idx, 1);
        }
    }

    /** 触发事件 */
    emit(event: string, ...args: any[]): void {
        const callbacks = this._listeners.get(event);
        if (!callbacks) return;
        for (const cb of callbacks) {
            cb(...args);
        }
    }

    /** 只监听一次 */
    once(event: string, callback: EventCallback): void {
        const wrapper = (...args: any[]) => {
            callback(...args);
            this.off(event, wrapper);
        };
        this.on(event, wrapper);
    }
}

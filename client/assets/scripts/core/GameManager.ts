/**
 * GameManager.ts - 全局游戏管理器（单例）
 * 管理所有子管理器的初始化和生命周期
 */

export class GameManager {
    private static _instance: GameManager;
    private _layout: 'portrait' | 'tablet' | 'landscape' = 'portrait';

    static get instance(): GameManager {
        if (!this._instance) {
            this._instance = new GameManager();
        }
        return this._instance;
    }

    /** 初始化所有子管理器 */
    async init(): Promise<void> {
        // 初始化顺序：日志 → 存储 → 事件 → 网络 → 音频 → 资源
        EventManager.instance.init();
        StorageManager.instance.init();
        // NetworkManager 在登录后初始化
        // AudioManager 延迟初始化（用户交互后）
    }

    /** 设置布局模式 */
    static setLayout(layout: 'portrait' | 'tablet' | 'landscape'): void {
        GameManager.instance._layout = layout;
        EventManager.instance.emit('LAYOUT_CHANGED', layout);
    }

    /** 获取当前布局模式 */
    static getLayout(): string {
        return GameManager.instance._layout;
    }
}

// 避免循环引用，延迟 import
import { EventManager } from './EventManager';
import { StorageManager } from './StorageManager';

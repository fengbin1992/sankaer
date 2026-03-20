/**
 * GameManager.ts - 全局游戏管理器（单例）
 * 管理所有子管理器的初始化和生命周期
 */

export class GameManager {
    private static _instance: GameManager;

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
        LayoutManager.instance.init();
        AudioManager.instance.init();
    }

    /** 设置布局模式 */
    static setLayout(layout: 'portrait' | 'tablet' | 'landscape'): void {
        EventManager.instance.emit('LAYOUT_CHANGED', layout);
    }

    /** 获取当前布局模式 */
    static getLayout(): string {
        return LayoutManager.instance.mode;
    }
}

// 避免循环引用，延迟 import
import { AudioManager } from './AudioManager';
import { EventManager } from './EventManager';
import { LayoutManager } from './LayoutManager';
import { StorageManager } from './StorageManager';

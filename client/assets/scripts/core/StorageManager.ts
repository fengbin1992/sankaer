/**
 * StorageManager.ts - 本地存储管理
 * 统一封装各平台本地存储接口
 */

export class StorageManager {
    private static _instance: StorageManager;
    private _prefix = 'sankaer_';

    static get instance(): StorageManager {
        if (!this._instance) {
            this._instance = new StorageManager();
        }
        return this._instance;
    }

    init(): void {
        // 初始化，检查存储可用性
    }

    /** 保存字符串 */
    set(key: string, value: string): void {
        try {
            if (typeof wx !== 'undefined') {
                wx.setStorageSync(this._prefix + key, value);
            } else {
                localStorage.setItem(this._prefix + key, value);
            }
        } catch (e) {
            console.error('StorageManager.set failed:', e);
        }
    }

    /** 读取字符串 */
    get(key: string): string | null {
        try {
            if (typeof wx !== 'undefined') {
                return wx.getStorageSync(this._prefix + key) || null;
            } else {
                return localStorage.getItem(this._prefix + key);
            }
        } catch (e) {
            console.error('StorageManager.get failed:', e);
            return null;
        }
    }

    /** 保存对象（JSON 序列化）*/
    setObject<T>(key: string, value: T): void {
        this.set(key, JSON.stringify(value));
    }

    /** 读取对象（JSON 反序列化）*/
    getObject<T>(key: string): T | null {
        const str = this.get(key);
        if (!str) return null;
        try {
            return JSON.parse(str) as T;
        } catch {
            return null;
        }
    }

    /** 删除 */
    remove(key: string): void {
        try {
            if (typeof wx !== 'undefined') {
                wx.removeStorageSync(this._prefix + key);
            } else {
                localStorage.removeItem(this._prefix + key);
            }
        } catch (e) {
            console.error('StorageManager.remove failed:', e);
        }
    }
}

declare const wx: any;

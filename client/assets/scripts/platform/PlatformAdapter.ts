/**
 * PlatformAdapter.ts - 平台适配器
 * 统一各平台差异化接口
 */

export interface LoginResult {
    method: string;    // 'wechat' | 'phone' | 'account' | 'guest'
    code?: string;     // 微信 login code
    token?: string;
}

export interface PayOrder {
    orderId: string;
    amount: number;
    productName: string;
    wxPayParams?: any;
}

export interface PayResult {
    success: boolean;
}

export interface ShareData {
    title: string;
    imageUrl?: string;
    query?: string;
}

export interface SystemInfo {
    platform: string;
    screenWidth: number;
    screenHeight: number;
    pixelRatio: number;
}

export interface IPlatform {
    login(): Promise<LoginResult>;
    pay(order: PayOrder): Promise<PayResult>;
    share(data: ShareData): Promise<void>;
    getSystemInfo(): SystemInfo;
    vibrate(type: 'light' | 'heavy'): void;
    setClipboard(text: string): void;
    createWebSocket(url: string): WebSocket;
}

/** 根据运行环境自动选择平台适配器 */
export function createPlatform(): IPlatform {
    if (typeof wx !== 'undefined' && (wx as any).getSystemInfoSync) {
        return new WechatPlatform();
    }
    return new WebPlatform();
}

/** 微信小游戏平台 */
class WechatPlatform implements IPlatform {
    login(): Promise<LoginResult> {
        return new Promise((resolve, reject) => {
            (wx as any).login({
                success: (res: any) => {
                    resolve({ method: 'wechat', code: res.code });
                },
                fail: (err: any) => reject(err),
            });
        });
    }

    pay(order: PayOrder): Promise<PayResult> {
        return new Promise((resolve, reject) => {
            (wx as any).requestPayment({
                ...order.wxPayParams,
                success: () => resolve({ success: true }),
                fail: (err: any) => reject(err),
            });
        });
    }

    share(data: ShareData): Promise<void> {
        (wx as any).shareAppMessage({
            title: data.title,
            imageUrl: data.imageUrl,
            query: data.query,
        });
        return Promise.resolve();
    }

    getSystemInfo(): SystemInfo {
        const info = (wx as any).getSystemInfoSync();
        return {
            platform: 'wechat',
            screenWidth: info.screenWidth,
            screenHeight: info.screenHeight,
            pixelRatio: info.pixelRatio,
        };
    }

    vibrate(type: 'light' | 'heavy'): void {
        if (type === 'light') {
            (wx as any).vibrateShort({ type: 'light' });
        } else {
            (wx as any).vibrateLong();
        }
    }

    setClipboard(text: string): void {
        (wx as any).setClipboardData({ data: text });
    }

    createWebSocket(url: string): WebSocket {
        return (wx as any).connectSocket({ url }) as WebSocket;
    }
}

/** H5 Web 平台 */
class WebPlatform implements IPlatform {
    login(): Promise<LoginResult> {
        // TODO: 弹出登录对话框
        return Promise.resolve({ method: 'guest' });
    }

    pay(_order: PayOrder): Promise<PayResult> {
        // TODO: Web 支付
        return Promise.reject(new Error('Web pay not implemented'));
    }

    share(data: ShareData): Promise<void> {
        // 复制链接到剪贴板
        if (navigator.clipboard) {
            navigator.clipboard.writeText(data.title + ' ' + window.location.href);
        }
        return Promise.resolve();
    }

    getSystemInfo(): SystemInfo {
        return {
            platform: 'web',
            screenWidth: window.innerWidth,
            screenHeight: window.innerHeight,
            pixelRatio: window.devicePixelRatio || 1,
        };
    }

    vibrate(type: 'light' | 'heavy'): void {
        if (navigator.vibrate) {
            navigator.vibrate(type === 'light' ? 50 : 200);
        }
    }

    setClipboard(text: string): void {
        navigator.clipboard?.writeText(text);
    }

    createWebSocket(url: string): WebSocket {
        return new WebSocket(url);
    }
}

declare const wx: any;

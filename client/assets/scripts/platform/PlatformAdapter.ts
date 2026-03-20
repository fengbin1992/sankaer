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

export interface PlatformSocketMessage {
    data: string | ArrayBuffer;
}

export interface PlatformSocket {
    binaryType?: BinaryType;
    onopen: (() => void) | null;
    onclose: (() => void) | null;
    onerror: ((error?: unknown) => void) | null;
    onmessage: ((event: PlatformSocketMessage) => void) | null;
    send(data: string | ArrayBuffer): void;
    close(): void;
}

export interface IPlatform {
    login(): Promise<LoginResult>;
    pay(order: PayOrder): Promise<PayResult>;
    share(data: ShareData): Promise<void>;
    getSystemInfo(): SystemInfo;
    vibrate(type: 'light' | 'heavy'): void;
    setClipboard(text: string): void;
    createWebSocket(url: string): PlatformSocket;
}

/** 根据运行环境自动选择平台适配器 */
export function createPlatform(): IPlatform {
    if (typeof wx !== 'undefined' && (wx as any).getSystemInfoSync) {
        return new WechatPlatform();
    }
    return new WebPlatform();
}

let platformInstance: IPlatform | null = null;

export function getPlatform(): IPlatform {
    if (!platformInstance) {
        platformInstance = createPlatform();
    }
    return platformInstance;
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

    createWebSocket(url: string): PlatformSocket {
        return new WechatSocketAdapter(url);
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
            screenWidth: typeof window !== 'undefined' ? window.innerWidth : 720,
            screenHeight: typeof window !== 'undefined' ? window.innerHeight : 1280,
            pixelRatio: typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1,
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

    createWebSocket(url: string): PlatformSocket {
        return new BrowserSocketAdapter(url);
    }
}

class BrowserSocketAdapter implements PlatformSocket {
    private readonly _socket: WebSocket;
    onopen: (() => void) | null = null;
    onclose: (() => void) | null = null;
    onerror: ((error?: unknown) => void) | null = null;
    onmessage: ((event: PlatformSocketMessage) => void) | null = null;

    constructor(url: string) {
        this._socket = new WebSocket(url);
        this._socket.onopen = () => this.onopen?.();
        this._socket.onclose = () => this.onclose?.();
        this._socket.onerror = (event) => this.onerror?.(event);
        this._socket.onmessage = (event) => {
            this.onmessage?.({
                data: event.data as string | ArrayBuffer,
            });
        };
    }

    get binaryType(): BinaryType {
        return this._socket.binaryType;
    }

    set binaryType(value: BinaryType) {
        this._socket.binaryType = value;
    }

    send(data: string | ArrayBuffer): void {
        this._socket.send(data);
    }

    close(): void {
        this._socket.close();
    }
}

class WechatSocketAdapter implements PlatformSocket {
    private readonly _task: any;
    binaryType?: BinaryType;
    onopen: (() => void) | null = null;
    onclose: (() => void) | null = null;
    onerror: ((error?: unknown) => void) | null = null;
    onmessage: ((event: PlatformSocketMessage) => void) | null = null;

    constructor(url: string) {
        this._task = (wx as any).connectSocket({ url });
        this._task.onOpen(() => this.onopen?.());
        this._task.onClose(() => this.onclose?.());
        this._task.onError((error: unknown) => this.onerror?.(error));
        this._task.onMessage((message: { data: unknown }) => {
            const data = message.data;
            if (typeof data === 'string' || data instanceof ArrayBuffer) {
                this.onmessage?.({ data });
                return;
            }
            this.onmessage?.({ data: JSON.stringify(data ?? {}) });
        });
    }

    send(data: string | ArrayBuffer): void {
        this._task.send({ data });
    }

    close(): void {
        this._task.close();
    }
}

declare const wx: any;

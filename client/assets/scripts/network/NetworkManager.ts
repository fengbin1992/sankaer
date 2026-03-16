/**
 * NetworkManager.ts - 网络管理器
 * WebSocket 连接管理、断线重连、消息缓冲
 */

import { EventManager } from '../core/EventManager';
import { MessageRouter } from './MessageRouter';

export class NetworkManager {
    private static _instance: NetworkManager;

    private _ws: WebSocket | null = null;
    private _url: string = '';
    private _token: string = '';
    private _reconnectAttempts = 0;
    private _maxReconnect = 5;
    private _heartbeatTimer: number | null = null;
    private _msgQueue: ArrayBuffer[] = [];
    private _isConnected = false;

    static get instance(): NetworkManager {
        if (!this._instance) {
            this._instance = new NetworkManager();
        }
        return this._instance;
    }

    get isConnected(): boolean {
        return this._isConnected;
    }

    /** 连接服务器 */
    connect(url: string, token: string): Promise<void> {
        this._url = url;
        this._token = token;

        return new Promise((resolve, reject) => {
            // TODO: 平台适配 - 微信用 wx.connectSocket
            this._ws = new WebSocket(`${url}?token=${token}`);
            this._ws.binaryType = 'arraybuffer';

            this._ws.onopen = () => {
                this._isConnected = true;
                this._reconnectAttempts = 0;
                this.startHeartbeat();
                this.flushQueue();
                EventManager.instance.emit('NETWORK_CONNECTED');
                resolve();
            };

            this._ws.onclose = () => {
                this._isConnected = false;
                this.stopHeartbeat();
                EventManager.instance.emit('NETWORK_CLOSED');
                this.autoReconnect();
            };

            this._ws.onmessage = (event: MessageEvent) => {
                const data = event.data as ArrayBuffer;
                // TODO: Protobuf 解码
                MessageRouter.dispatch(data);
            };

            this._ws.onerror = () => {
                reject(new Error('WebSocket connection failed'));
            };
        });
    }

    /** 发送二进制消息 */
    send(data: ArrayBuffer): void {
        if (this._isConnected && this._ws) {
            this._ws.send(data);
        } else {
            this._msgQueue.push(data);
        }
    }

    /** 断开连接 */
    disconnect(): void {
        this._maxReconnect = 0; // 阻止自动重连
        if (this._ws) {
            this._ws.close();
            this._ws = null;
        }
        this.stopHeartbeat();
        this._isConnected = false;
    }

    /** 指数退避重连 */
    private autoReconnect(): void {
        if (this._reconnectAttempts >= this._maxReconnect) {
            EventManager.instance.emit('NETWORK_DISCONNECT');
            return;
        }
        const delay = Math.min(1000 * Math.pow(2, this._reconnectAttempts), 30000);
        this._reconnectAttempts++;
        console.log(`[Network] 重连中... 第${this._reconnectAttempts}次，${delay}ms后重试`);
        setTimeout(() => {
            this.connect(this._url, this._token).catch(() => {});
        }, delay);
    }

    /** 心跳保活 */
    private startHeartbeat(): void {
        this._heartbeatTimer = window.setInterval(() => {
            // TODO: 发送 PING 消息
        }, 30000);
    }

    private stopHeartbeat(): void {
        if (this._heartbeatTimer !== null) {
            clearInterval(this._heartbeatTimer);
            this._heartbeatTimer = null;
        }
    }

    /** 刷新缓冲队列 */
    private flushQueue(): void {
        while (this._msgQueue.length > 0) {
            const data = this._msgQueue.shift()!;
            this.send(data);
        }
    }
}

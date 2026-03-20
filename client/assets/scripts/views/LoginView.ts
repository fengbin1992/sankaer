/**
 * LoginView.ts - 登录页
 * 游客一键登录，色块/文字版 UI
 */

import { NetworkManager } from '../network/NetworkManager';
import { EventManager } from '../core/EventManager';
import { StorageManager } from '../core/StorageManager';
import { GameStore } from '../stores/GameStore';
import { MSG_C2S_GUEST_LOGIN } from '../protocol/MsgType';

export class LoginView {
    private container: HTMLDivElement | null = null;

    show(): void {
        this.container = document.createElement('div');
        this.container.id = 'login-view';
        this.container.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            background: #1a1a2e; color: #fff; font-family: sans-serif;
        `;

        // 标题
        const title = document.createElement('h1');
        title.textContent = '三卡二';
        title.style.cssText = 'font-size: 48px; margin-bottom: 8px; color: #e94560;';
        this.container.appendChild(title);

        const subtitle = document.createElement('p');
        subtitle.textContent = '五人升级扑克牌在线游戏';
        subtitle.style.cssText = 'font-size: 18px; margin-bottom: 40px; color: #aaa;';
        this.container.appendChild(subtitle);

        // 游客登录按钮
        const btn = document.createElement('button');
        btn.textContent = '游客登录';
        btn.style.cssText = `
            padding: 16px 48px; font-size: 20px; border: none; border-radius: 8px;
            background: #e94560; color: #fff; cursor: pointer;
            transition: background 0.2s;
        `;
        btn.onmouseenter = () => btn.style.background = '#ff6b6b';
        btn.onmouseleave = () => btn.style.background = '#e94560';
        btn.onclick = () => this.doLogin();
        this.container.appendChild(btn);

        // 状态文字
        const status = document.createElement('p');
        status.id = 'login-status';
        status.style.cssText = 'margin-top: 20px; color: #888; font-size: 14px;';
        this.container.appendChild(status);

        document.body.appendChild(this.container);
    }

    hide(): void {
        if (this.container) {
            this.container.remove();
            this.container = null;
        }
    }

    private async doLogin(): Promise<void> {
        const statusEl = document.getElementById('login-status');
        if (statusEl) statusEl.textContent = '连接服务器中...';

        try {
            // 生成设备 ID
            let deviceId = StorageManager.instance.get('device_id');
            if (!deviceId) {
                deviceId = 'dev_' + Math.random().toString(36).substring(2, 10);
                StorageManager.instance.set('device_id', deviceId);
            }

            // 先用临时 token 连接（游客模式）
            const wsUrl = 'ws://127.0.0.1:8080/ws';
            await NetworkManager.instance.connect(wsUrl, 'guest:' + deviceId);

            if (statusEl) statusEl.textContent = '登录中...';

            // 发送游客登录请求
            NetworkManager.instance.sendMsg(MSG_C2S_GUEST_LOGIN, {
                device_id: deviceId,
                platform: 'web',
            });
        } catch (e) {
            if (statusEl) statusEl.textContent = '连接失败，请重试';
            console.error('[LoginView] 登录失败:', e);
        }
    }
}

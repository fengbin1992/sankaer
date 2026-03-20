/**
 * LoginView.ts - 登录页
 * 游客一键登录，正式视觉登录页
 */

import { AudioManager } from '../core/AudioManager';
import { LayoutManager } from '../core/LayoutManager';
import { NetworkManager } from '../network/NetworkManager';
import { StorageManager } from '../core/StorageManager';
import { getPlatform } from '../platform/PlatformAdapter';
import { MSG_C2S_GUEST_LOGIN } from '../protocol/MsgType';
import { createButton, createScreenRoot, getScreenShell } from '../ui/Theme';

export class LoginView {
    private container: HTMLDivElement | null = null;

    show(): void {
        this.container = createScreenRoot('login-view');
        const shell = getScreenShell(this.container);
        const layout = LayoutManager.instance.mode;
        shell.style.justifyContent = 'center';
        shell.style.alignItems = 'center';

        const hero = document.createElement('div');
        hero.className = 'sk-panel sk-wood sk-pop-in';
        hero.style.cssText = `
            width: min(100%, ${layout === 'portrait' ? '520px' : '960px'});
            min-height: ${layout === 'portrait' ? '540px' : '420px'};
            display: grid;
            grid-template-columns: ${layout === 'portrait' ? '1fr' : '1.05fr 0.95fr'};
            gap: 24px;
            padding: 28px;
            box-sizing: border-box;
        `;

        const intro = document.createElement('div');
        intro.style.cssText = 'display:flex;flex-direction:column;justify-content:center;gap:16px;';

        const eyebrow = document.createElement('div');
        eyebrow.className = 'sk-chip';
        eyebrow.textContent = 'Phase 4 Multi-Platform Build';
        intro.appendChild(eyebrow);

        const title = document.createElement('h1');
        title.className = 'sk-title';
        title.style.cssText = 'font-size: clamp(44px, 8vw, 76px); margin: 0; color: #ffe7c2;';
        title.textContent = '三卡二';
        intro.appendChild(title);

        const subtitle = document.createElement('p');
        subtitle.className = 'sk-muted';
        subtitle.style.cssText = 'margin:0; font-size:16px; line-height:1.8;';
        subtitle.textContent = '五人升级扑克牌在线对局，现已接入动态布局、正式牌面组件与多端平台适配。';
        intro.appendChild(subtitle);

        const tips = document.createElement('div');
        tips.style.cssText = 'display:flex;flex-wrap:wrap;gap:10px;margin-top:6px;';
        ['5人同桌', '叫分/扣底/叫搭档', 'H5/微信适配'].forEach((text) => {
            const chip = document.createElement('div');
            chip.className = 'sk-chip';
            chip.textContent = text;
            tips.appendChild(chip);
        });
        intro.appendChild(tips);

        const actionPanel = document.createElement('div');
        actionPanel.className = 'sk-panel sk-felt';
        actionPanel.style.cssText = `
            display:flex;flex-direction:column;justify-content:center;gap:18px;
            padding: 24px; box-sizing: border-box;
        `;

        const actionTitle = document.createElement('div');
        actionTitle.className = 'sk-title';
        actionTitle.style.cssText = 'font-size: 24px; color: #f8e2ba;';
        actionTitle.textContent = '进入牌局';
        actionPanel.appendChild(actionTitle);

        const actionDesc = document.createElement('p');
        actionDesc.className = 'sk-muted';
        actionDesc.style.cssText = 'margin:0; line-height:1.7;';
        actionDesc.textContent = '当前服务端保持游客登录兼容模式，Web 和微信端都会走统一连接流程。';
        actionPanel.appendChild(actionDesc);

        const btn = createButton('游客登录', 'primary', () => {
            AudioManager.instance.playSfx('click');
            void this.doLogin();
        });
        btn.style.fontSize = '18px';
        btn.style.padding = '16px 26px';
        actionPanel.appendChild(btn);

        const status = document.createElement('p');
        status.id = 'login-status';
        status.className = 'sk-muted';
        status.style.cssText = 'margin:0; font-size:14px; min-height:20px;';
        actionPanel.appendChild(status);

        hero.appendChild(intro);
        hero.appendChild(actionPanel);
        shell.appendChild(hero);
        if (this.container) {
            document.body.appendChild(this.container);
        }
        LayoutManager.instance.init();
        window.addEventListener('resize', this.handleResize);
    }

    hide(): void {
        window.removeEventListener('resize', this.handleResize);
        if (this.container) {
            this.container.remove();
            this.container = null;
        }
    }

    private async doLogin(): Promise<void> {
        const statusEl = document.getElementById('login-status');
        if (statusEl) statusEl.textContent = '连接服务器中...';

        try {
            const platform = getPlatform();
            const loginResult = await platform.login();

            // 生成设备 ID
            let deviceId = StorageManager.instance.get('device_id');
            if (!deviceId) {
                deviceId = 'dev_' + Math.random().toString(36).substring(2, 10);
                StorageManager.instance.set('device_id', deviceId);
            }
            if (loginResult.code) {
                StorageManager.instance.set('wechat_login_code', loginResult.code);
            }

            // 先用临时 token 连接（游客模式）
            const wsUrl = 'ws://127.0.0.1:8080/ws';
            await NetworkManager.instance.connect(wsUrl, 'guest:' + deviceId);

            if (statusEl) statusEl.textContent = '登录中...';

            // 发送游客登录请求
            NetworkManager.instance.sendMsg(MSG_C2S_GUEST_LOGIN, {
                device_id: deviceId,
                platform: platform.getSystemInfo().platform,
            });
        } catch (e) {
            if (statusEl) statusEl.textContent = '连接失败，请重试';
            console.error('[LoginView] 登录失败:', e);
        }
    }

    private handleResize = (): void => {
        if (!this.container) {
            return;
        }
        this.hide();
        this.show();
    };
}

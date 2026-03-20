/**
 * LobbyView.ts - 大厅页
 * 显示金币、匹配按钮、场次选择
 */

import { NetworkManager } from '../network/NetworkManager';
import { EventManager } from '../core/EventManager';
import { GameStore } from '../stores/GameStore';
import { MSG_C2S_QUICK_MATCH, MSG_C2S_CANCEL_MATCH } from '../protocol/MsgType';

export class LobbyView {
    private container: HTMLDivElement | null = null;
    private selectedTier: number = 10;
    private isMatching: boolean = false;

    show(): void {
        const store = GameStore.instance;

        this.container = document.createElement('div');
        this.container.id = 'lobby-view';
        this.container.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            display: flex; flex-direction: column; align-items: center;
            background: #1a1a2e; color: #fff; font-family: sans-serif;
        `;

        // 顶部栏
        const topBar = document.createElement('div');
        topBar.style.cssText = `
            width: 100%; padding: 16px 24px; display: flex; justify-content: space-between;
            align-items: center; background: #16213e; box-sizing: border-box;
        `;
        topBar.innerHTML = `
            <span style="font-size:20px;color:#e94560;font-weight:bold;">三卡二</span>
            <span style="font-size:16px;">
                <span id="lobby-nickname" style="color:#ccc;">${store.nickname}</span>
                &nbsp;|&nbsp;
                <span style="color:#ffd700;">💰 <span id="lobby-coins">${store.coins}</span></span>
            </span>
        `;
        this.container.appendChild(topBar);

        // 中间内容区
        const content = document.createElement('div');
        content.style.cssText = `
            flex: 1; display: flex; flex-direction: column; align-items: center;
            justify-content: center; gap: 24px;
        `;

        // 场次选择
        const tierBar = document.createElement('div');
        tierBar.style.cssText = 'display: flex; gap: 12px; margin-bottom: 24px;';
        [10, 100, 1000, 10000].forEach(tier => {
            const btn = document.createElement('button');
            btn.textContent = `${tier}倍场`;
            btn.style.cssText = `
                padding: 10px 20px; font-size: 16px; border: 2px solid #333;
                border-radius: 6px; background: ${tier === this.selectedTier ? '#e94560' : '#2a2a4a'};
                color: #fff; cursor: pointer;
            `;
            btn.onclick = () => {
                this.selectedTier = tier;
                tierBar.querySelectorAll('button').forEach(b =>
                    (b as HTMLButtonElement).style.background = '#2a2a4a'
                );
                btn.style.background = '#e94560';
            };
            tierBar.appendChild(btn);
        });
        content.appendChild(tierBar);

        // 快速匹配按钮
        const matchBtn = document.createElement('button');
        matchBtn.id = 'match-btn';
        matchBtn.textContent = '快速匹配';
        matchBtn.style.cssText = `
            padding: 20px 60px; font-size: 24px; border: none; border-radius: 12px;
            background: #e94560; color: #fff; cursor: pointer;
        `;
        matchBtn.onclick = () => this.toggleMatch();
        content.appendChild(matchBtn);

        // 匹配状态
        const matchStatus = document.createElement('p');
        matchStatus.id = 'match-status';
        matchStatus.style.cssText = 'color: #888; font-size: 14px;';
        content.appendChild(matchStatus);

        this.container.appendChild(content);
        document.body.appendChild(this.container);

        // 监听匹配更新
        EventManager.instance.on('MATCH_UPDATE', this.onMatchUpdate);
    }

    hide(): void {
        EventManager.instance.off('MATCH_UPDATE', this.onMatchUpdate);
        if (this.container) {
            this.container.remove();
            this.container = null;
        }
    }

    private toggleMatch(): void {
        const btn = document.getElementById('match-btn') as HTMLButtonElement;
        if (this.isMatching) {
            NetworkManager.instance.sendMsg(MSG_C2S_CANCEL_MATCH);
            this.isMatching = false;
            if (btn) { btn.textContent = '快速匹配'; btn.style.background = '#e94560'; }
            const status = document.getElementById('match-status');
            if (status) status.textContent = '';
        } else {
            NetworkManager.instance.sendMsg(MSG_C2S_QUICK_MATCH, { tier: this.selectedTier });
            this.isMatching = true;
            if (btn) { btn.textContent = '取消匹配'; btn.style.background = '#666'; }
            const status = document.getElementById('match-status');
            if (status) status.textContent = '匹配中...';
        }
    }

    private onMatchUpdate = (data: any): void => {
        const status = document.getElementById('match-status');
        if (status) {
            status.textContent = `匹配中... 排队人数: ${data.waiting_count}  等待: ${data.elapsed_sec}秒`;
        }
    };
}

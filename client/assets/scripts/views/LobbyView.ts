/**
 * LobbyView.ts - 大厅页
 * 显示金币、匹配按钮、场次选择
 */

import { AudioManager } from '../core/AudioManager';
import { NetworkManager } from '../network/NetworkManager';
import { EventManager } from '../core/EventManager';
import { LayoutManager } from '../core/LayoutManager';
import { GameStore } from '../stores/GameStore';
import { MSG_C2S_QUICK_MATCH, MSG_C2S_CANCEL_MATCH } from '../protocol/MsgType';
import { createButton, createScreenRoot, getScreenShell } from '../ui/Theme';

export class LobbyView {
    private container: HTMLDivElement | null = null;
    private selectedTier: number = 10;
    private isMatching: boolean = false;

    show(): void {
        this.render();
        if (this.container) {
            document.body.appendChild(this.container);
        }

        // 监听匹配更新
        EventManager.instance.on('MATCH_UPDATE', this.onMatchUpdate);
        EventManager.instance.on('LAYOUT_CHANGED', this.render);
    }

    hide(): void {
        EventManager.instance.off('MATCH_UPDATE', this.onMatchUpdate);
        EventManager.instance.off('LAYOUT_CHANGED', this.render);
        if (this.container) {
            this.container.remove();
            this.container = null;
        }
    }

    private render = (): void => {
        const store = GameStore.instance;
        const layout = LayoutManager.instance.mode;
        const root = createScreenRoot('lobby-view');
        const shell = getScreenShell(root);

        const topBar = document.createElement('div');
        topBar.className = 'sk-panel sk-wood';
        topBar.style.cssText = `
            padding: 18px 22px;
            display:flex;
            flex-wrap:wrap;
            justify-content:space-between;
            align-items:center;
            gap: 12px;
        `;
        topBar.innerHTML = `
            <div>
                <div class="sk-title" style="font-size:30px;color:#ffe4ba;">三卡二</div>
                <div class="sk-muted" style="font-size:13px;">正式大厅视觉 / 多端适配大厅</div>
            </div>
            <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end;">
                <div class="sk-chip">玩家 ${store.nickname || '游客'}</div>
                <div class="sk-chip">金币 ${store.coins}</div>
                <div class="sk-chip">默认场 ${this.selectedTier} 倍</div>
            </div>
        `;
        shell.appendChild(topBar);

        const content = document.createElement('div');
        content.style.cssText = `
            flex:1;
            display:grid;
            grid-template-columns:${layout === 'portrait' ? '1fr' : '1.1fr 0.9fr'};
            gap:18px;
            min-height:0;
        `;

        const tierPanel = document.createElement('div');
        tierPanel.className = 'sk-panel sk-felt';
        tierPanel.style.cssText = 'padding:26px;display:flex;flex-direction:column;gap:18px;';
        tierPanel.innerHTML = `
            <div class="sk-title" style="font-size:26px;color:#f7e2bb;">选择场次</div>
            <div class="sk-muted" style="line-height:1.7;">大厅已升级为正式布局，优先保留现有快速匹配流程，后续可以继续挂接创房与练习场。</div>
        `;

        const tierGrid = document.createElement('div');
        tierGrid.style.cssText = `
            display:grid;
            grid-template-columns:repeat(${layout === 'portrait' ? 2 : 4}, minmax(0, 1fr));
            gap:12px;
        `;

        [10, 100, 1000, 10000].forEach((tier) => {
            const card = document.createElement('button');
            card.type = 'button';
            card.style.cssText = `
                border:${tier === this.selectedTier ? '1px solid rgba(244,184,96,0.9)' : '1px solid rgba(255,255,255,0.08)'};
                background:${tier === this.selectedTier ? 'linear-gradient(180deg, rgba(244,184,96,0.22), rgba(134,80,36,0.28))' : 'rgba(255,255,255,0.05)'};
                border-radius:18px;
                padding:18px 14px;
                color:#fff7ea;
                cursor:pointer;
                text-align:left;
            `;
            card.innerHTML = `
                <div class="sk-title" style="font-size:24px;color:#ffe5bb;">${tier}x</div>
                <div class="sk-muted" style="font-size:13px;">${tier === 10 ? '新手热身' : tier === 100 ? '标准节奏' : tier === 1000 ? '高倍冲刺' : '豪华牌桌'}</div>
            `;
            card.onclick = () => {
                AudioManager.instance.playSfx('switch', 0.6);
                this.selectedTier = tier;
                this.render();
            };
            tierGrid.appendChild(card);
        });
        tierPanel.appendChild(tierGrid);

        const actionPanel = document.createElement('div');
        actionPanel.className = 'sk-panel';
        actionPanel.style.cssText = 'padding:26px;display:flex;flex-direction:column;gap:18px;justify-content:center;';

        const quickAction = createButton(this.isMatching ? '取消匹配' : '快速匹配', this.isMatching ? 'warning' : 'primary', () => {
            AudioManager.instance.playSfx('click');
            this.toggleMatch();
        });
        quickAction.id = 'match-btn';
        quickAction.style.fontSize = '22px';
        quickAction.style.padding = '20px 28px';

        const matchStatus = document.createElement('div');
        matchStatus.id = 'match-status';
        matchStatus.className = 'sk-chip';
        matchStatus.style.width = 'fit-content';
        matchStatus.textContent = this.isMatching ? '匹配中...' : '等待开始';

        actionPanel.innerHTML = `
            <div class="sk-title" style="font-size:26px;color:#f7e2bb;">开始一局</div>
            <div class="sk-muted" style="line-height:1.8;">当前版本保留稳定的快速匹配主流程。创房和练习场入口可在第五阶段 AI 与练习场中继续补齐。</div>
        `;
        actionPanel.appendChild(quickAction);
        actionPanel.appendChild(matchStatus);

        const footer = document.createElement('div');
        footer.style.cssText = 'display:flex;gap:10px;flex-wrap:wrap;';
        ['正式牌面', '动态分辨率', '微信/H5'].forEach((label) => {
            const chip = document.createElement('div');
            chip.className = 'sk-chip';
            chip.textContent = label;
            footer.appendChild(chip);
        });
        actionPanel.appendChild(footer);

        content.appendChild(tierPanel);
        content.appendChild(actionPanel);
        shell.appendChild(content);

        if (this.container) {
            this.container.replaceWith(root);
        }
        this.container = root;
    };

    private toggleMatch(): void {
        const btn = document.getElementById('match-btn') as HTMLButtonElement;
        if (this.isMatching) {
            NetworkManager.instance.sendMsg(MSG_C2S_CANCEL_MATCH);
            this.isMatching = false;
            if (btn) {
                btn.textContent = '快速匹配';
                btn.className = 'sk-btn sk-btn-primary';
            }
            const status = document.getElementById('match-status');
            if (status) status.textContent = '';
        } else {
            NetworkManager.instance.sendMsg(MSG_C2S_QUICK_MATCH, { tier: this.selectedTier });
            this.isMatching = true;
            if (btn) {
                btn.textContent = '取消匹配';
                btn.className = 'sk-btn sk-btn-warning';
            }
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

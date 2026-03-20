/**
 * ResultView.ts - 结算页
 * 显示胜负结果、搭档揭晓、金币变化
 */

import { AudioManager } from '../core/AudioManager';
import { NetworkManager } from '../network/NetworkManager';
import { EventManager } from '../core/EventManager';
import { LayoutManager } from '../core/LayoutManager';
import { GameStore, cardToString } from '../stores/GameStore';
import { MSG_C2S_READY } from '../protocol/MsgType';
import { createButton, createScreenRoot, getScreenShell } from '../ui/Theme';

export class ResultView {
    private container: HTMLDivElement | null = null;

    show(): void {
        this.render();
        if (this.container) {
            document.body.appendChild(this.container);
        }
        EventManager.instance.on('LAYOUT_CHANGED', this.render);
    }

    hide(): void {
        EventManager.instance.off('LAYOUT_CHANGED', this.render);
        if (this.container) {
            this.container.remove();
            this.container = null;
        }
    }

    private render = (): void => {
        const store = GameStore.instance;
        const layout = LayoutManager.instance.mode;
        const root = createScreenRoot('result-view');
        const shell = getScreenShell(root);
        shell.style.justifyContent = 'center';
        shell.style.alignItems = 'center';

        const panel = document.createElement('div');
        panel.className = 'sk-panel sk-wood sk-pop-in';
        panel.style.cssText = `
            width:min(100%, ${layout === 'portrait' ? '560px' : '980px'});
            padding:28px;
            box-sizing:border-box;
            display:grid;
            grid-template-columns:${layout === 'portrait' ? '1fr' : '0.95fr 1.05fr'};
            gap:22px;
        `;

        const titleBlock = document.createElement('div');
        titleBlock.style.cssText = 'display:flex;flex-direction:column;gap:14px;justify-content:center;';
        const winText = store.winner === 'dealer' ? '庄家方胜' :
            store.winner === 'catcher' ? '抓分方胜' : '弃局';

        titleBlock.innerHTML = `
            <div class="sk-chip">${store.isSolo ? '独庄结算' : '团队结算'}</div>
            <div class="sk-title" style="font-size: clamp(34px, 6vw, 56px); color:${store.winner === 'dealer' ? '#ffe1ba' : '#d9ffe8'};">${winText}</div>
            <div class="sk-muted" style="line-height:1.8;">
                叫分 ${store.bidScore} · 抓分方得分 ${store.catcherScore}
                ${store.partnerCard ? `· 搭档牌 ${cardToString(store.partnerCard)}` : ''}
                ${store.isSolo ? ' · 独庄 1v4' : ''}
            </div>
        `;

        const table = document.createElement('div');
        table.className = 'sk-panel';
        table.style.cssText = 'padding:18px;';

        store.settlements.forEach((settlement) => {
            if (!settlement.player_id) {
                return;
            }

            const row = document.createElement('div');
            const isMe = settlement.player_id === store.userId;
            const roleText = settlement.role === 'dealer' ? '庄家' :
                settlement.role === 'partner' ? '搭档' : '抓分';
            const amountColor = settlement.amount >= 0 ? '#80efac' : '#ff9986';
            const sign = settlement.amount >= 0 ? '+' : '';

            row.style.cssText = `
                display:flex;
                justify-content:space-between;
                align-items:center;
                gap:12px;
                padding:14px 10px;
                border-bottom:1px solid rgba(255,255,255,0.08);
                color:${isMe ? '#fff0cb' : '#d8e0e7'};
            `;
            row.innerHTML = `
                <div>
                    <div style="font-family:'Segoe UI Semibold',sans-serif;font-size:14px;">${settlement.player_id.slice(0, 12)}${isMe ? ' · 我' : ''}</div>
                    <div class="sk-muted" style="font-size:12px;">${roleText} · 倍率 ${settlement.multiplier}x</div>
                </div>
                <div style="font-family:'Segoe UI Semibold',sans-serif;font-size:22px;color:${amountColor};">${sign}${settlement.amount}</div>
            `;
            table.appendChild(row);
        });

        const btnArea = document.createElement('div');
        btnArea.style.cssText = 'display:flex;gap:14px;flex-wrap:wrap;margin-top:16px;';

        const againBtn = createButton('再来一局', 'primary', () => {
            AudioManager.instance.playSfx('click');
            NetworkManager.instance.sendMsg(MSG_C2S_READY);
            store.phase = 'room';
            EventManager.instance.emit('PHASE_CHANGE', 'room');
        });

        const backBtn = createButton('返回大厅', 'ghost', () => {
            AudioManager.instance.playSfx('switch');
            store.phase = 'lobby';
            EventManager.instance.emit('PHASE_CHANGE', 'lobby');
        });

        btnArea.appendChild(againBtn);
        btnArea.appendChild(backBtn);
        titleBlock.appendChild(btnArea);

        panel.appendChild(titleBlock);
        panel.appendChild(table);
        shell.appendChild(panel);

        if (this.container) {
            this.container.replaceWith(root);
        }
        this.container = root;
    };
}

/**
 * ResultView.ts - 结算页
 * 显示胜负结果、搭档揭晓、金币变化
 */

import { NetworkManager } from '../network/NetworkManager';
import { EventManager } from '../core/EventManager';
import { GameStore, cardToString } from '../stores/GameStore';
import { MSG_C2S_READY } from '../protocol/MsgType';

export class ResultView {
    private container: HTMLDivElement | null = null;

    show(): void {
        const store = GameStore.instance;

        this.container = document.createElement('div');
        this.container.id = 'result-view';
        this.container.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            background: #1a1a2e; color: #fff; font-family: sans-serif;
        `;

        // 胜负标题
        const title = document.createElement('h1');
        const winText = store.winner === 'dealer' ? '庄家方胜' :
                       store.winner === 'catcher' ? '抓分方胜' : '弃局';
        title.textContent = winText;
        title.style.cssText = `
            font-size: 36px; margin-bottom: 16px;
            color: ${store.winner === 'dealer' ? '#e94560' : '#16c79a'};
        `;
        this.container.appendChild(title);

        // 搭档揭晓
        if (store.partnerCard) {
            const partner = document.createElement('p');
            partner.textContent = `搭档牌: ${cardToString(store.partnerCard)} ${store.isSolo ? '(独庄 1v4)' : ''}`;
            partner.style.cssText = 'font-size: 18px; color: #ccc; margin-bottom: 24px;';
            this.container.appendChild(partner);
        }

        // 得分信息
        const info = document.createElement('div');
        info.style.cssText = 'text-align: center; margin-bottom: 24px; color: #aaa; font-size: 14px;';
        info.innerHTML = `叫分: ${store.bidScore} | 抓分方得分: ${store.catcherScore}`;
        this.container.appendChild(info);

        // 结算列表
        const table = document.createElement('div');
        table.style.cssText = `
            background: #16213e; border-radius: 12px; padding: 16px 24px;
            min-width: 300px; max-width: 500px;
        `;

        store.settlements.forEach(s => {
            if (!s.player_id) return;
            const row = document.createElement('div');
            row.style.cssText = `
                display: flex; justify-content: space-between; padding: 8px 0;
                border-bottom: 1px solid #333;
            `;
            const isMe = s.player_id === store.userId;
            const roleText = s.role === 'dealer' ? '庄家' :
                           s.role === 'partner' ? '搭档' : '抓分';
            const amountColor = s.amount >= 0 ? '#16c79a' : '#e94560';
            const sign = s.amount >= 0 ? '+' : '';

            row.innerHTML = `
                <span style="color:${isMe ? '#ffd700' : '#ccc'};">
                    ${s.player_id.slice(0, 10)}${isMe ? ' (我)' : ''} [${roleText}]
                </span>
                <span style="color:${amountColor};font-weight:bold;">${sign}${s.amount}</span>
            `;
            table.appendChild(row);
        });
        this.container.appendChild(table);

        // 按钮区
        const btnArea = document.createElement('div');
        btnArea.style.cssText = 'display: flex; gap: 16px; margin-top: 32px;';

        const againBtn = document.createElement('button');
        againBtn.textContent = '再来一局';
        againBtn.style.cssText = `
            padding: 14px 40px; font-size: 18px; border: none; border-radius: 8px;
            background: #e94560; color: #fff; cursor: pointer;
        `;
        againBtn.onclick = () => {
            NetworkManager.instance.sendMsg(MSG_C2S_READY);
            store.phase = 'room';
            EventManager.instance.emit('PHASE_CHANGE', 'room');
        };
        btnArea.appendChild(againBtn);

        const backBtn = document.createElement('button');
        backBtn.textContent = '返回大厅';
        backBtn.style.cssText = `
            padding: 14px 40px; font-size: 18px; border: none; border-radius: 8px;
            background: #444; color: #fff; cursor: pointer;
        `;
        backBtn.onclick = () => {
            store.phase = 'lobby';
            EventManager.instance.emit('PHASE_CHANGE', 'lobby');
        };
        btnArea.appendChild(backBtn);

        this.container.appendChild(btnArea);
        document.body.appendChild(this.container);
    }

    hide(): void {
        if (this.container) {
            this.container.remove();
            this.container = null;
        }
    }
}

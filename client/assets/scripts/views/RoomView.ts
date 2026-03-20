/**
 * RoomView.ts - 房间等待页
 * 5 人座位显示、准备/取消准备
 */

import { AudioManager } from '../core/AudioManager';
import { NetworkManager } from '../network/NetworkManager';
import { EventManager } from '../core/EventManager';
import { LayoutManager } from '../core/LayoutManager';
import { GameStore } from '../stores/GameStore';
import { MSG_C2S_READY, MSG_C2S_CANCEL_READY, MSG_C2S_LEAVE_ROOM } from '../protocol/MsgType';
import { createButton, createScreenRoot, getScreenShell } from '../ui/Theme';

const SEAT_COLORS = ['#e94560', '#0f3460', '#533483', '#16c79a', '#f7b731'];

export class RoomView {
    private container: HTMLDivElement | null = null;

    show(): void {
        this.render();
        if (this.container) {
            document.body.appendChild(this.container);
        }

        // 监听事件
        EventManager.instance.on('PLAYER_JOINED', this.refresh);
        EventManager.instance.on('PLAYER_LEFT', this.refresh);
        EventManager.instance.on('READY_UPDATE', this.refresh);
        EventManager.instance.on('LAYOUT_CHANGED', this.refresh);
    }

    hide(): void {
        EventManager.instance.off('PLAYER_JOINED', this.refresh);
        EventManager.instance.off('PLAYER_LEFT', this.refresh);
        EventManager.instance.off('READY_UPDATE', this.refresh);
        EventManager.instance.off('LAYOUT_CHANGED', this.refresh);
        if (this.container) {
            this.container.remove();
            this.container = null;
        }
    }

    private refresh = (): void => {
        this.render();
    };

    private render(): void {
        const store = GameStore.instance;
        const root = createScreenRoot('room-view');
        const shell = getScreenShell(root);
        const layout = LayoutManager.instance.mode;

        const header = document.createElement('div');
        header.className = 'sk-panel sk-wood';
        header.style.cssText = `
            padding:18px 22px;
            display:flex;
            justify-content:space-between;
            align-items:center;
            gap: 12px;
            flex-wrap: wrap;
        `;
        header.innerHTML = `
            <div>
                <div class="sk-title" style="font-size:26px;color:#ffe0b4;">房间 ${store.roomId}</div>
                <div class="sk-muted" style="font-size:13px;">${store.tier} 倍场 · 等待五人全部准备</div>
            </div>
            <div style="display:flex;gap:10px;flex-wrap:wrap;">
                <div class="sk-chip">当前人数 ${store.players.length}/5</div>
                <div class="sk-chip">模式 房间准备</div>
            </div>
        `;
        shell.appendChild(header);

        const seatPanel = document.createElement('div');
        seatPanel.className = 'sk-panel sk-felt';
        seatPanel.style.cssText = 'position:relative;flex:1;min-height:360px;overflow:hidden;';

        const seatStage = document.createElement('div');
        seatStage.id = 'room-seats';
        seatStage.style.cssText = 'position:relative;width:100%;height:100%;';

        for (let i = 0; i < 5; i++) {
            const player = store.players.find(p => p.seat_idx === i);
            const pos = LayoutManager.instance.getRoomSeatPosition(i);
            const seat = document.createElement('div');
            seat.style.cssText = `
                position:absolute;
                top:${pos.top};
                left:${pos.left};
                transform:translate(-50%, -50%) scale(${pos.scale});
                width:${layout === 'portrait' ? '120px' : '136px'};
                padding:14px 12px;
                box-sizing:border-box;
                border-radius:20px;
                text-align:center;
                border:1px solid rgba(255,255,255,0.14);
                background:${player ? `linear-gradient(180deg, ${SEAT_COLORS[i]}cc, rgba(7, 17, 24, 0.78))` : 'rgba(255,255,255,0.06)'};
                transition:top 0.28s ease,left 0.28s ease,transform 0.28s ease;
            `;

            if (player) {
                const isMe = player.user_id === store.userId;
                seat.innerHTML = `
                    <div style="width:46px;height:46px;border-radius:50%;margin:0 auto 10px;background:rgba(255,255,255,0.18);border:2px solid rgba(255,255,255,0.18);"></div>
                    <div style="font-family:'Segoe UI Semibold',sans-serif;font-size:14px;color:#fff7ed;">${player.nickname || player.user_id.slice(0, 8)}${isMe ? ' · 我' : ''}</div>
                    <div class="sk-muted" style="font-size:12px;margin-top:6px;">${player.is_ready ? '已准备' : '等待中'} · 座位${i + 1}</div>
                `;
            } else {
                seat.innerHTML = `
                    <div style="width:46px;height:46px;border-radius:50%;margin:0 auto 10px;background:rgba(255,255,255,0.06);border:1px dashed rgba(255,255,255,0.12);"></div>
                    <div style="font-family:'Segoe UI Semibold',sans-serif;font-size:14px;color:#d4dce4;">空座位</div>
                    <div class="sk-muted" style="font-size:12px;margin-top:6px;">座位${i + 1}</div>
                `;
            }

            seatStage.appendChild(seat);
        }

        seatPanel.appendChild(seatStage);
        shell.appendChild(seatPanel);

        const btnBar = document.createElement('div');
        btnBar.style.cssText = 'display:flex;gap:14px;justify-content:center;flex-wrap:wrap;';

        const me = store.getPlayer(store.userId);
        const readyBtn = createButton(me?.is_ready ? '取消准备' : '准备', me?.is_ready ? 'warning' : 'success', () => {
            AudioManager.instance.playSfx('click');
            if (me && me.is_ready) {
                NetworkManager.instance.sendMsg(MSG_C2S_CANCEL_READY);
            } else {
                NetworkManager.instance.sendMsg(MSG_C2S_READY);
            }
        });
        readyBtn.id = 'ready-btn';

        const leaveBtn = createButton('离开房间', 'ghost', () => {
            AudioManager.instance.playSfx('switch');
            NetworkManager.instance.sendMsg(MSG_C2S_LEAVE_ROOM);
        });

        btnBar.appendChild(readyBtn);
        btnBar.appendChild(leaveBtn);
        shell.appendChild(btnBar);

        if (this.container) {
            this.container.replaceWith(root);
        }
        this.container = root;
    }
}

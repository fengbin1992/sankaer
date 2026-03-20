/**
 * RoomView.ts - 房间等待页
 * 5 人座位显示、准备/取消准备
 */

import { NetworkManager } from '../network/NetworkManager';
import { EventManager } from '../core/EventManager';
import { GameStore } from '../stores/GameStore';
import { MSG_C2S_READY, MSG_C2S_CANCEL_READY, MSG_C2S_LEAVE_ROOM } from '../protocol/MsgType';

const SEAT_COLORS = ['#e94560', '#0f3460', '#533483', '#16c79a', '#f7b731'];

export class RoomView {
    private container: HTMLDivElement | null = null;

    show(): void {
        const store = GameStore.instance;

        this.container = document.createElement('div');
        this.container.id = 'room-view';
        this.container.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            display: flex; flex-direction: column; align-items: center;
            background: #1a1a2e; color: #fff; font-family: sans-serif;
        `;

        // 标题
        const title = document.createElement('div');
        title.style.cssText = 'padding: 20px; font-size: 20px; color: #ccc;';
        title.textContent = `房间 ${store.roomId} | ${store.tier}倍场`;
        this.container.appendChild(title);

        // 5 人座位
        const seats = document.createElement('div');
        seats.id = 'room-seats';
        seats.style.cssText = `
            display: flex; flex-wrap: wrap; gap: 16px; justify-content: center;
            margin: 32px 0; max-width: 600px;
        `;
        this.renderSeats(seats);
        this.container.appendChild(seats);

        // 按钮区
        const btnBar = document.createElement('div');
        btnBar.style.cssText = 'display: flex; gap: 16px;';

        const readyBtn = document.createElement('button');
        readyBtn.id = 'ready-btn';
        readyBtn.textContent = '准备';
        readyBtn.style.cssText = `
            padding: 14px 40px; font-size: 18px; border: none; border-radius: 8px;
            background: #16c79a; color: #fff; cursor: pointer;
        `;
        readyBtn.onclick = () => {
            const me = store.getPlayer(store.userId);
            if (me && me.is_ready) {
                NetworkManager.instance.sendMsg(MSG_C2S_CANCEL_READY);
            } else {
                NetworkManager.instance.sendMsg(MSG_C2S_READY);
            }
        };
        btnBar.appendChild(readyBtn);

        const leaveBtn = document.createElement('button');
        leaveBtn.textContent = '离开房间';
        leaveBtn.style.cssText = `
            padding: 14px 40px; font-size: 18px; border: none; border-radius: 8px;
            background: #444; color: #fff; cursor: pointer;
        `;
        leaveBtn.onclick = () => NetworkManager.instance.sendMsg(MSG_C2S_LEAVE_ROOM);
        btnBar.appendChild(leaveBtn);

        this.container.appendChild(btnBar);
        document.body.appendChild(this.container);

        // 监听事件
        EventManager.instance.on('PLAYER_JOINED', this.refresh);
        EventManager.instance.on('PLAYER_LEFT', this.refresh);
        EventManager.instance.on('READY_UPDATE', this.refresh);
    }

    hide(): void {
        EventManager.instance.off('PLAYER_JOINED', this.refresh);
        EventManager.instance.off('PLAYER_LEFT', this.refresh);
        EventManager.instance.off('READY_UPDATE', this.refresh);
        if (this.container) {
            this.container.remove();
            this.container = null;
        }
    }

    private refresh = (): void => {
        const seats = document.getElementById('room-seats');
        if (seats) this.renderSeats(seats);

        const me = GameStore.instance.getPlayer(GameStore.instance.userId);
        const readyBtn = document.getElementById('ready-btn') as HTMLButtonElement;
        if (readyBtn && me) {
            readyBtn.textContent = me.is_ready ? '取消准备' : '准备';
            readyBtn.style.background = me.is_ready ? '#e94560' : '#16c79a';
        }
    };

    private renderSeats(container: HTMLElement): void {
        container.innerHTML = '';
        const store = GameStore.instance;

        for (let i = 0; i < 5; i++) {
            const player = store.players.find(p => p.seat_idx === i);
            const seat = document.createElement('div');
            seat.style.cssText = `
                width: 100px; height: 120px; border-radius: 8px; display: flex;
                flex-direction: column; align-items: center; justify-content: center;
                background: ${player ? SEAT_COLORS[i] : '#333'};
                border: 3px solid ${player?.is_ready ? '#16c79a' : 'transparent'};
            `;

            if (player) {
                seat.innerHTML = `
                    <div style="width:40px;height:40px;border-radius:50%;background:#fff3;margin-bottom:8px;"></div>
                    <div style="font-size:12px;">${player.nickname || player.user_id.slice(0, 8)}</div>
                    <div style="font-size:11px;color:#ccc;margin-top:4px;">${player.is_ready ? '✓ 已准备' : '等待中'}</div>
                `;
            } else {
                seat.innerHTML = `
                    <div style="font-size:14px;color:#666;">空座位</div>
                    <div style="font-size:12px;color:#444;">座位${i + 1}</div>
                `;
            }
            container.appendChild(seat);
        }
    }
}

/**
 * GameView.ts - 游戏牌桌页
 * 手牌、出牌、叫分/扣底/叫搭档面板
 */

import { NetworkManager } from '../network/NetworkManager';
import { EventManager } from '../core/EventManager';
import { GameStore, cardToString, CardData } from '../stores/GameStore';
import {
    MSG_C2S_BID, MSG_C2S_PASS_BID, MSG_C2S_SET_BOTTOM,
    MSG_C2S_CALL_PARTNER, MSG_C2S_PLAY_CARD,
} from '../protocol/MsgType';

const SEAT_COLORS = ['#e94560', '#0f3460', '#533483', '#16c79a', '#f7b731'];

export class GameView {
    private container: HTMLDivElement | null = null;

    show(): void {
        this.container = document.createElement('div');
        this.container.id = 'game-view';
        this.container.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            display: flex; flex-direction: column;
            background: #0a3d0a; color: #fff; font-family: sans-serif;
        `;

        this.render();
        document.body.appendChild(this.container);

        // 监听事件
        const events = [
            'DEAL_CARDS', 'FLIP_RESULT', 'BID_UPDATE', 'BID_RESULT',
            'BOTTOM_CARDS', 'PARTNER_CALLED', 'TURN', 'CARD_PLAYED',
            'ROUND_RESULT', 'SERVER_ERROR',
        ];
        events.forEach(e => EventManager.instance.on(e, this.refresh));
    }

    hide(): void {
        const events = [
            'DEAL_CARDS', 'FLIP_RESULT', 'BID_UPDATE', 'BID_RESULT',
            'BOTTOM_CARDS', 'PARTNER_CALLED', 'TURN', 'CARD_PLAYED',
            'ROUND_RESULT', 'SERVER_ERROR',
        ];
        events.forEach(e => EventManager.instance.off(e, this.refresh));
        if (this.container) {
            this.container.remove();
            this.container = null;
        }
    }

    private refresh = (): void => {
        if (this.container) this.render();
    };

    private render(): void {
        if (!this.container) return;
        const store = GameStore.instance;

        this.container.innerHTML = '';

        // 顶部信息栏
        const topBar = document.createElement('div');
        topBar.style.cssText = `
            padding: 8px 16px; background: #062806; display: flex;
            justify-content: space-between; font-size: 14px;
        `;
        topBar.innerHTML = `
            <span>房间: ${store.roomId} | ${store.tier}倍场</span>
            <span>叫分: ${store.bidScore} | 主: ${suitSymbol(store.trumpSuit)} | 庄: ${store.dealerId.slice(0, 8)}</span>
            <span>抓分: ${store.catcherScore} | 💰${store.coins}</span>
        `;
        this.container.appendChild(topBar);

        // 牌桌区（其他玩家）
        const table = document.createElement('div');
        table.style.cssText = `
            flex: 1; position: relative; min-height: 300px;
        `;
        this.renderOtherPlayers(table);
        this.renderPlayedCards(table);
        this.container.appendChild(table);

        // 操作面板
        const panel = document.createElement('div');
        panel.style.cssText = `
            padding: 12px; background: #0a250a; border-top: 2px solid #1a5a1a;
        `;
        this.renderActionPanel(panel);
        this.container.appendChild(panel);

        // 手牌区
        const handArea = document.createElement('div');
        handArea.style.cssText = `
            padding: 12px; background: #062806; display: flex; flex-wrap: wrap;
            justify-content: center; gap: 4px;
        `;
        this.renderHand(handArea);
        this.container.appendChild(handArea);
    }

    private renderOtherPlayers(table: HTMLElement): void {
        const store = GameStore.instance;
        const mySeat = store.mySeatIdx;

        // 五边形布局位置（相对位置）
        const positions = [
            { top: '50%', left: '10%' },   // 左
            { top: '5%', left: '25%' },    // 左上
            { top: '5%', left: '65%' },    // 右上
            { top: '50%', left: '85%' },   // 右
        ];

        let posIdx = 0;
        for (let offset = 1; offset < 5; offset++) {
            const seatIdx = (mySeat + offset) % 5;
            const player = store.players.find(p => p.seat_idx === seatIdx);
            if (!player || posIdx >= positions.length) continue;

            const pos = positions[posIdx++];
            const el = document.createElement('div');
            el.style.cssText = `
                position: absolute; top: ${pos.top}; left: ${pos.left};
                transform: translate(-50%, -50%);
                display: flex; flex-direction: column; align-items: center;
            `;

            const isTurn = store.currentTurnId === player.user_id;
            el.innerHTML = `
                <div style="width:48px;height:48px;border-radius:50%;
                    background:${SEAT_COLORS[seatIdx]};
                    border:3px solid ${isTurn ? '#ffd700' : 'transparent'};
                "></div>
                <div style="font-size:12px;margin-top:4px;">${player.nickname || player.user_id.slice(0, 8)}</div>
                <div style="font-size:11px;color:#aaa;">座位${seatIdx + 1}</div>
            `;
            table.appendChild(el);
        }
    }

    private renderPlayedCards(table: HTMLElement): void {
        const store = GameStore.instance;
        if (store.currentRoundPlays.length === 0) return;

        const playArea = document.createElement('div');
        playArea.style.cssText = `
            position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
            display: flex; gap: 12px; background: #0002; padding: 12px; border-radius: 8px;
        `;

        store.currentRoundPlays.forEach(play => {
            const card = document.createElement('div');
            const isRed = play.card.suit === 2 || play.card.suit === 3;
            card.style.cssText = `
                padding: 8px 12px; background: #fff; border-radius: 4px;
                color: ${isRed ? '#e94560' : '#333'}; font-size: 16px; font-weight: bold;
            `;
            const player = store.getPlayer(play.player_id);
            card.innerHTML = `
                <div style="font-size:10px;color:#888;text-align:center;">${player?.nickname?.slice(0, 4) || '?'}</div>
                <div style="text-align:center;">${cardToString(play.card)}</div>
            `;
            playArea.appendChild(card);
        });
        table.appendChild(playArea);
    }

    private renderActionPanel(panel: HTMLElement): void {
        const store = GameStore.instance;

        switch (store.phase) {
            case 'bidding':
                this.renderBidPanel(panel);
                break;
            case 'bottom':
                if (store.isDealer) this.renderBottomPanel(panel);
                else panel.innerHTML = '<p style="text-align:center;color:#aaa;">等待庄家扣底...</p>';
                break;
            case 'calling':
                if (store.isDealer) this.renderCallPanel(panel);
                else panel.innerHTML = '<p style="text-align:center;color:#aaa;">等待庄家叫搭档...</p>';
                break;
            case 'playing':
                this.renderPlayPanel(panel);
                break;
            default:
                panel.innerHTML = `<p style="text-align:center;color:#aaa;">阶段: ${store.phase}</p>`;
        }
    }

    private renderBidPanel(panel: HTMLElement): void {
        const store = GameStore.instance;
        panel.innerHTML = '';

        const label = document.createElement('div');
        label.style.cssText = 'text-align: center; margin-bottom: 8px; font-size: 14px; color: #ccc;';
        label.textContent = store.isMyTurn ? '轮到你叫分' : `等待 ${store.currentTurnId.slice(0, 8)} 叫分...`;
        panel.appendChild(label);

        if (!store.isMyTurn) return;

        const row = document.createElement('div');
        row.style.cssText = 'display: flex; justify-content: center; gap: 8px; flex-wrap: wrap;';

        // 分值按钮
        [75, 80, 85, 90, 95, 100].forEach(score => {
            const btn = this.createBtn(`${score}分`, () => {
                // 简化：默认选黑桃
                NetworkManager.instance.sendMsg(MSG_C2S_BID, { score, suit: 1 });
            }, '#0f3460');
            row.appendChild(btn);
        });

        // 不叫
        row.appendChild(this.createBtn('不叫', () => {
            NetworkManager.instance.sendMsg(MSG_C2S_PASS_BID);
        }, '#666'));

        panel.appendChild(row);
    }

    private renderBottomPanel(panel: HTMLElement): void {
        const store = GameStore.instance;
        panel.innerHTML = '';

        const label = document.createElement('div');
        label.style.cssText = 'text-align: center; margin-bottom: 8px; font-size: 14px;';
        label.textContent = `选择 4 张牌扣底 (已选 ${store.selectedCards.size}/4)`;
        panel.appendChild(label);

        const btn = this.createBtn('确认扣底', () => {
            if (store.selectedCards.size !== 4) {
                alert('请选择恰好 4 张牌');
                return;
            }
            const cards: CardData[] = [];
            store.selectedCards.forEach(idx => cards.push(store.myHand[idx]));
            NetworkManager.instance.sendMsg(MSG_C2S_SET_BOTTOM, { cards });
        }, '#16c79a');
        panel.appendChild(btn);
    }

    private renderCallPanel(panel: HTMLElement): void {
        const store = GameStore.instance;
        panel.innerHTML = '';

        const label = document.createElement('div');
        label.style.cssText = 'text-align: center; margin-bottom: 8px; font-size: 14px;';
        label.textContent = '选择一张牌作为搭档牌（点击手牌选择后确认）';
        panel.appendChild(label);

        const btn = this.createBtn('确认叫搭档', () => {
            if (store.selectedCards.size !== 1) {
                alert('请选择恰好 1 张牌');
                return;
            }
            const idx = Array.from(store.selectedCards)[0];
            const card = store.myHand[idx];
            NetworkManager.instance.sendMsg(MSG_C2S_CALL_PARTNER, { card });
        }, '#533483');
        panel.appendChild(btn);
    }

    private renderPlayPanel(panel: HTMLElement): void {
        const store = GameStore.instance;
        panel.innerHTML = '';

        const label = document.createElement('div');
        label.style.cssText = 'text-align: center; margin-bottom: 8px; font-size: 14px; color: #ccc;';
        label.textContent = store.isMyTurn ? '轮到你出牌' : `等待 ${store.currentTurnId.slice(0, 8)} 出牌...`;
        panel.appendChild(label);

        if (!store.isMyTurn) return;

        const row = document.createElement('div');
        row.style.cssText = 'display: flex; justify-content: center; gap: 12px;';

        row.appendChild(this.createBtn('出牌', () => {
            if (store.selectedCards.size !== 1) {
                alert('请选择 1 张牌出牌');
                return;
            }
            const idx = Array.from(store.selectedCards)[0];
            const card = store.myHand[idx];
            NetworkManager.instance.sendMsg(MSG_C2S_PLAY_CARD, { card });
        }, '#e94560'));

        panel.appendChild(row);
    }

    private renderHand(handArea: HTMLElement): void {
        const store = GameStore.instance;

        store.myHand.forEach((card, idx) => {
            const el = document.createElement('div');
            const isSelected = store.selectedCards.has(idx);
            const isRed = card.suit === 2 || card.suit === 3;

            el.style.cssText = `
                width: 50px; height: 72px; background: ${isSelected ? '#ffd700' : '#fff'};
                border-radius: 4px; display: flex; align-items: center; justify-content: center;
                color: ${isRed ? '#e94560' : '#333'}; font-size: 14px; font-weight: bold;
                cursor: pointer; border: 2px solid ${isSelected ? '#e94560' : '#ccc'};
                transform: translateY(${isSelected ? '-8px' : '0'});
                transition: transform 0.15s;
            `;
            el.textContent = cardToString(card);
            el.onclick = () => {
                if (store.selectedCards.has(idx)) {
                    store.selectedCards.delete(idx);
                } else {
                    // 出牌阶段只选 1 张，叫搭档只选 1 张
                    if (store.phase === 'playing' || store.phase === 'calling') {
                        store.selectedCards.clear();
                    }
                    store.selectedCards.add(idx);
                }
                this.refresh();
            };
            handArea.appendChild(el);
        });
    }

    private createBtn(text: string, onClick: () => void, bg: string): HTMLButtonElement {
        const btn = document.createElement('button');
        btn.textContent = text;
        btn.style.cssText = `
            padding: 10px 20px; font-size: 14px; border: none; border-radius: 6px;
            background: ${bg}; color: #fff; cursor: pointer;
        `;
        btn.onclick = onClick;
        return btn;
    }
}

function suitSymbol(suit: number): string {
    const map: Record<number, string> = { 1: '♠', 2: '♥', 3: '♦', 4: '♣' };
    return map[suit] || '-';
}

/**
 * GameView.ts - 游戏牌桌页
 * 正式牌桌视觉、动态布局、正式牌面组件
 */

import { AudioManager } from '../core/AudioManager';
import { EventManager } from '../core/EventManager';
import { LayoutManager } from '../core/LayoutManager';
import { NetworkManager } from '../network/NetworkManager';
import {
    MSG_C2S_BID,
    MSG_C2S_CALL_PARTNER,
    MSG_C2S_PASS_BID,
    MSG_C2S_PLAY_CARD,
    MSG_C2S_SET_BOTTOM,
} from '../protocol/MsgType';
import { CardData, cardToString, GameStore, PlayerData } from '../stores/GameStore';
import { CardNode } from '../ui/CardNode';
import { createButton, createScreenRoot, getScreenShell } from '../ui/Theme';

const SEAT_COLORS = ['#d76c5b', '#4c72aa', '#6b5db8', '#3ba177', '#d69a42'];

export class GameView {
    private container: HTMLDivElement | null = null;
    private countdownTimer: number | null = null;
    private selectedBidSuit = 1;

    show(): void {
        this.render();
        if (this.container) {
            document.body.appendChild(this.container);
        }

        const events = [
            'DEAL_CARDS', 'FLIP_RESULT', 'BID_UPDATE', 'BID_RESULT',
            'BOTTOM_CARDS', 'PARTNER_CALLED', 'TURN', 'CARD_PLAYED',
            'ROUND_RESULT', 'SERVER_ERROR', 'LAYOUT_CHANGED',
        ];
        events.forEach((eventName) => EventManager.instance.on(eventName, this.refresh));
        this.startCountdownTicker();
    }

    hide(): void {
        const events = [
            'DEAL_CARDS', 'FLIP_RESULT', 'BID_UPDATE', 'BID_RESULT',
            'BOTTOM_CARDS', 'PARTNER_CALLED', 'TURN', 'CARD_PLAYED',
            'ROUND_RESULT', 'SERVER_ERROR', 'LAYOUT_CHANGED',
        ];
        events.forEach((eventName) => EventManager.instance.off(eventName, this.refresh));
        this.stopCountdownTicker();

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
        const layout = LayoutManager.instance.mode;
        const root = createScreenRoot('game-view');
        const shell = getScreenShell(root);

        const header = document.createElement('div');
        header.className = 'sk-panel sk-wood';
        header.style.cssText = `
            padding: 16px 20px;
            display:flex;
            justify-content:space-between;
            align-items:center;
            gap:12px;
            flex-wrap:wrap;
        `;

        const dealerName = store.getPlayer(store.dealerId)?.nickname || (store.dealerId ? store.dealerId.slice(0, 8) : '-');
        header.innerHTML = `
            <div>
                <div class="sk-title" style="font-size:24px;color:#ffe0b5;">牌局进行中</div>
                <div class="sk-muted" style="font-size:13px;">房间 ${store.roomId} · ${store.tier} 倍场 · ${phaseLabel(store.phase)}</div>
            </div>
            <div style="display:flex;gap:10px;flex-wrap:wrap;">
                <div class="sk-chip">叫分 ${store.bidScore || '-'}</div>
                <div class="sk-chip">主花色 ${suitSymbol(store.trumpSuit)}</div>
                <div class="sk-chip">庄家 ${dealerName}</div>
                <div class="sk-chip">抓分 ${store.catcherScore}</div>
                <div class="sk-chip sk-countdown">倒计时 ${store.remainingTurnSeconds}s</div>
            </div>
        `;
        shell.appendChild(header);

        const content = document.createElement('div');
        content.style.cssText = `
            flex:1;
            min-height:0;
            display:grid;
            grid-template-columns:${layout === 'portrait' ? '1fr' : 'minmax(0, 1fr) 330px'};
            gap:16px;
        `;

        const tablePanel = document.createElement('div');
        tablePanel.className = 'sk-panel sk-felt';
        tablePanel.style.cssText = 'position:relative;min-height:420px;overflow:hidden;';

        const tableStage = document.createElement('div');
        tableStage.style.cssText = 'position:relative;width:100%;height:100%;min-height:420px;';
        this.renderSeats(tableStage);
        this.renderCenterStage(tableStage);
        tablePanel.appendChild(tableStage);
        content.appendChild(tablePanel);

        const sidePanel = document.createElement('div');
        sidePanel.style.cssText = `
            display:flex;
            flex-direction:${layout === 'portrait' ? 'row' : 'column'};
            gap:16px;
            min-width:0;
        `;
        sidePanel.appendChild(this.renderActionPanel());
        sidePanel.appendChild(this.renderInfoPanel());
        content.appendChild(sidePanel);
        shell.appendChild(content);

        const handPanel = document.createElement('div');
        handPanel.className = 'sk-panel';
        handPanel.style.cssText = 'padding:16px 18px;display:flex;flex-direction:column;gap:12px;';

        const handHeader = document.createElement('div');
        handHeader.style.cssText = 'display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;';
        handHeader.innerHTML = `
            <div>
                <div class="sk-title" style="font-size:22px;color:#ffe0b5;">我的手牌</div>
                <div class="sk-muted" style="font-size:13px;">共 ${store.myHand.length} 张，${selectionHint(store.phase, store.selectedCards.size)}</div>
            </div>
            <div style="display:flex;gap:10px;flex-wrap:wrap;">
                ${store.partnerCard ? `<div class="sk-chip">搭档牌 ${cardToString(store.partnerCard)}</div>` : ''}
                ${store.isMyTurn ? '<div class="sk-chip">当前轮到你</div>' : ''}
            </div>
        `;
        handPanel.appendChild(handHeader);
        handPanel.appendChild(this.renderHandArea());
        shell.appendChild(handPanel);

        if (this.container) {
            this.container.replaceWith(root);
        }
        this.container = root;
    }

    private renderSeats(stage: HTMLElement): void {
        const store = GameStore.instance;

        for (let seatIdx = 0; seatIdx < 5; seatIdx++) {
            const player = store.players.find((item) => item.seat_idx === seatIdx);
            if (!player) {
                continue;
            }

            const pos = LayoutManager.instance.getGameSeatPosition(seatIdx, store.mySeatIdx);
            const seat = document.createElement('div');
            const isTurn = store.currentTurnId === player.user_id;
            const isMe = player.user_id === store.userId;
            const cardCount = store.playerCardCounts[player.user_id];

            seat.style.cssText = `
                position:absolute;
                top:${pos.top};
                left:${pos.left};
                transform:translate(-50%, -50%) scale(${pos.scale});
                width:${isMe ? '180px' : '148px'};
                padding:12px;
                box-sizing:border-box;
                border-radius:22px;
                background:linear-gradient(180deg, ${SEAT_COLORS[seatIdx]}dd, rgba(9, 18, 24, 0.86));
                border:${isTurn ? '2px solid rgba(244,184,96,0.95)' : '1px solid rgba(255,255,255,0.14)'};
                box-shadow:${isTurn ? '0 0 0 4px rgba(244,184,96,0.18)' : '0 14px 28px rgba(0,0,0,0.18)'};
                transition:top 0.28s ease,left 0.28s ease,transform 0.28s ease,border 0.18s ease;
            `;

            const badges = [
                player.user_id === store.dealerId ? '庄' : '',
                player.platform === 'ai' ? 'AI' : '',
                isTurn ? '出牌中' : '',
            ].filter(Boolean).join(' · ');

            seat.innerHTML = `
                <div style="display:flex;align-items:center;gap:10px;">
                    <div style="width:44px;height:44px;border-radius:50%;background:rgba(255,255,255,0.16);border:2px solid rgba(255,255,255,0.18);flex-shrink:0;"></div>
                    <div style="min-width:0;">
                        <div style="font-family:'Segoe UI Semibold',sans-serif;font-size:14px;color:#fff7e8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                            ${player.nickname || player.user_id.slice(0, 8)}${isMe ? ' · 我' : ''}
                        </div>
                        <div class="sk-muted" style="font-size:12px;margin-top:4px;">
                            座位${seatIdx + 1} · ${typeof cardCount === 'number' ? `剩余 ${cardCount} 张` : '牌数待同步'}
                        </div>
                    </div>
                </div>
                ${badges ? `<div class="sk-chip" style="margin-top:10px;">${badges}</div>` : ''}
            `;
            stage.appendChild(seat);
        }
    }

    private renderCenterStage(stage: HTMLElement): void {
        const store = GameStore.instance;

        const ring = document.createElement('div');
        ring.style.cssText = `
            position:absolute;
            top:50%;
            left:50%;
            transform:translate(-50%, -50%);
            width:min(58vw, 420px);
            height:min(58vw, 420px);
            border-radius:50%;
            border:1px dashed rgba(255,255,255,0.18);
            opacity:0.55;
        `;
        stage.appendChild(ring);

        const info = document.createElement('div');
        info.style.cssText = `
            position:absolute;
            top:50%;
            left:50%;
            transform:translate(-50%, -50%);
            text-align:center;
            pointer-events:none;
        `;
        info.innerHTML = `
            <div class="sk-title" style="font-size:18px;color:#f6e0b7;">${phaseLabel(store.phase)}</div>
            <div class="sk-muted" style="font-size:13px;margin-top:6px;">${store.isMyTurn ? '轮到你行动' : '等待其他玩家'}</div>
        `;
        stage.appendChild(info);

        if (store.currentRoundPlays.length === 0) {
            return;
        }

        store.currentRoundPlays.forEach((play, index) => {
            const player = store.getPlayer(play.player_id);
            const pos = LayoutManager.instance.getGameSeatPosition(player?.seat_idx ?? index, store.mySeatIdx);
            const card = CardNode.create(play.card, {
                width: 86,
                ownerLabel: player?.nickname || play.player_id.slice(0, 6),
            });
            card.style.position = 'absolute';
            card.style.top = interpolateToCenter(pos.top, 50, index * 2);
            card.style.left = interpolateToCenter(pos.left, 50, index * -3);
            card.style.transform = 'translate(-50%, -50%)';
            stage.appendChild(card);
        });
    }

    private renderActionPanel(): HTMLDivElement {
        const panel = document.createElement('div');
        panel.className = 'sk-panel';
        panel.style.cssText = 'padding:18px;display:flex;flex-direction:column;gap:14px;flex:1;';

        const store = GameStore.instance;
        const title = document.createElement('div');
        title.className = 'sk-title';
        title.style.cssText = 'font-size:22px;color:#ffe0b5;';
        title.textContent = '行动面板';
        panel.appendChild(title);

        switch (store.phase) {
            case 'bidding':
                this.renderBidPanel(panel);
                break;
            case 'bottom':
                if (store.isDealer) {
                    this.renderBottomPanel(panel);
                } else {
                    panel.appendChild(this.createNotice('等待庄家扣底...'));
                }
                break;
            case 'calling':
                if (store.isDealer) {
                    this.renderCallPanel(panel);
                } else {
                    panel.appendChild(this.createNotice('等待庄家叫搭档...'));
                }
                break;
            case 'playing':
                this.renderPlayPanel(panel);
                break;
            default:
                panel.appendChild(this.createNotice(`当前阶段：${phaseLabel(store.phase)}`));
                break;
        }

        return panel;
    }

    private renderInfoPanel(): HTMLDivElement {
        const store = GameStore.instance;
        const panel = document.createElement('div');
        panel.className = 'sk-panel';
        panel.style.cssText = 'padding:18px;display:flex;flex-direction:column;gap:12px;flex:1;';
        panel.innerHTML = `
            <div class="sk-title" style="font-size:20px;color:#ffe0b5;">牌桌状态</div>
            <div class="sk-chip">主花色 ${suitSymbol(store.trumpSuit)}</div>
            <div class="sk-chip">叫分 ${store.bidScore || '-'}</div>
            <div class="sk-chip">抓分 ${store.catcherScore}</div>
            <div class="sk-chip">当前行动 ${store.currentTurnId ? (store.getPlayer(store.currentTurnId)?.nickname || store.currentTurnId.slice(0, 8)) : '-'}</div>
            ${store.partnerCard ? `<div class="sk-chip">搭档牌 ${cardToString(store.partnerCard)}</div>` : '<div class="sk-chip">搭档牌 待公布</div>'}
        `;
        return panel;
    }

    private renderBidPanel(panel: HTMLElement): void {
        const store = GameStore.instance;

        panel.appendChild(this.createNotice(store.isMyTurn ? '轮到你叫分并选择主花色。' : `等待 ${store.currentTurnId.slice(0, 8)} 叫分...`));
        if (!store.isMyTurn) {
            return;
        }

        const suitRow = document.createElement('div');
        suitRow.style.cssText = 'display:flex;gap:10px;flex-wrap:wrap;';
        [1, 2, 3, 4].forEach((suit) => {
            const button = createButton(suitSymbol(suit), suit === this.selectedBidSuit ? 'primary' : 'ghost', () => {
                AudioManager.instance.playSfx('switch', 0.6);
                this.selectedBidSuit = suit;
                this.refresh();
            });
            button.style.minWidth = '68px';
            suitRow.appendChild(button);
        });
        panel.appendChild(suitRow);

        const scoreGrid = document.createElement('div');
        scoreGrid.style.cssText = 'display:grid;grid-template-columns:repeat(3, minmax(0, 1fr));gap:10px;';
        [75, 80, 85, 90, 95, 100].forEach((score) => {
            const button = createButton(`${score} 分`, 'secondary', () => {
                AudioManager.instance.playSfx('click');
                NetworkManager.instance.sendMsg(MSG_C2S_BID, { score, suit: this.selectedBidSuit });
            });
            scoreGrid.appendChild(button);
        });
        panel.appendChild(scoreGrid);

        panel.appendChild(createButton('不叫', 'ghost', () => {
            AudioManager.instance.playSfx('switch');
            NetworkManager.instance.sendMsg(MSG_C2S_PASS_BID);
        }));
    }

    private renderBottomPanel(panel: HTMLElement): void {
        const store = GameStore.instance;
        panel.appendChild(this.createNotice(`请选择 4 张牌扣底，当前已选 ${store.selectedCards.size}/4。`));

        panel.appendChild(createButton('确认扣底', 'success', () => {
            if (store.selectedCards.size !== 4) {
                alert('请选择恰好 4 张牌');
                return;
            }

            AudioManager.instance.playSfx('click');
            const selectedIndexes = Array.from(store.selectedCards).sort((a, b) => a - b);
            const cards: CardData[] = selectedIndexes.map((index) => store.myHand[index]);
            NetworkManager.instance.sendMsg(MSG_C2S_SET_BOTTOM, { cards });

            for (let i = selectedIndexes.length - 1; i >= 0; i--) {
                store.myHand.splice(selectedIndexes[i], 1);
            }
            store.selectedCards.clear();
            store.playerCardCounts[store.userId] = store.myHand.length;
            this.refresh();
        }));
    }

    private renderCallPanel(panel: HTMLElement): void {
        const store = GameStore.instance;
        panel.appendChild(this.createNotice('选择一张牌作为搭档牌，独庄可选择自己手里没有的高位牌。'));
        panel.appendChild(createButton('确认叫搭档', 'secondary', () => {
            if (store.selectedCards.size !== 1) {
                alert('请选择恰好 1 张牌');
                return;
            }

            AudioManager.instance.playSfx('click');
            const index = Array.from(store.selectedCards)[0];
            const card = store.myHand[index];
            NetworkManager.instance.sendMsg(MSG_C2S_CALL_PARTNER, { card });
        }));
    }

    private renderPlayPanel(panel: HTMLElement): void {
        const store = GameStore.instance;
        panel.appendChild(this.createNotice(store.isMyTurn ? '请选择 1 张牌并打出。' : `等待 ${store.currentTurnId.slice(0, 8)} 出牌...`));

        if (!store.isMyTurn) {
            return;
        }

        panel.appendChild(createButton('出牌', 'warning', () => {
            if (store.selectedCards.size !== 1) {
                alert('请选择 1 张牌出牌');
                return;
            }

            AudioManager.instance.playSfx('play');
            const index = Array.from(store.selectedCards)[0];
            const card = store.myHand[index];
            NetworkManager.instance.sendMsg(MSG_C2S_PLAY_CARD, { card });
        }));
    }

    private renderHandArea(): HTMLDivElement {
        const store = GameStore.instance;
        const wrap = document.createElement('div');
        wrap.className = 'sk-scroll';
        wrap.style.cssText = 'padding: 12px 4px 4px;';

        const row = document.createElement('div');
        row.className = 'sk-card-fan';
        row.style.justifyContent = store.myHand.length > 9 ? 'flex-start' : 'center';
        wrap.appendChild(row);

        const width = LayoutManager.instance.getHandCardWidth(store.myHand.length);
        store.myHand.forEach((card, index) => {
            const isSelected = store.selectedCards.has(index);
            const node = CardNode.create(card, {
                width,
                selected: isSelected,
                disabled: !isSelectablePhase(store.phase),
                onClick: () => this.toggleHandSelection(index),
            });
            node.style.marginLeft = index === 0 ? '0' : `-${Math.min(Math.round(width * 0.26), 24)}px`;
            row.appendChild(node);
        });

        return wrap;
    }

    private toggleHandSelection(index: number): void {
        const store = GameStore.instance;
        if (!isSelectablePhase(store.phase)) {
            return;
        }

        if (store.selectedCards.has(index)) {
            store.selectedCards.delete(index);
        } else {
            if (store.phase === 'playing' || store.phase === 'calling') {
                store.selectedCards.clear();
            }
            if (store.phase === 'bottom' && store.selectedCards.size >= 4) {
                return;
            }
            store.selectedCards.add(index);
        }

        AudioManager.instance.playSfx('switch', 0.35);
        this.refresh();
    }

    private createNotice(text: string): HTMLDivElement {
        const notice = document.createElement('div');
        notice.className = 'sk-muted';
        notice.style.cssText = 'line-height:1.8;font-size:14px;';
        notice.textContent = text;
        return notice;
    }

    private startCountdownTicker(): void {
        this.stopCountdownTicker();
        this.countdownTimer = window.setInterval(() => {
            if (GameStore.instance.phase === 'playing' || GameStore.instance.phase === 'bidding' || GameStore.instance.phase === 'bottom' || GameStore.instance.phase === 'calling') {
                if (GameStore.instance.remainingTurnSeconds <= 3 && GameStore.instance.remainingTurnSeconds > 0) {
                    AudioManager.instance.playSfx('warning', 0.18);
                }
                this.render();
            }
        }, 1000);
    }

    private stopCountdownTicker(): void {
        if (this.countdownTimer !== null) {
            clearInterval(this.countdownTimer);
            this.countdownTimer = null;
        }
    }
}

function suitSymbol(suit: number): string {
    const map: Record<number, string> = { 1: '♠', 2: '♥', 3: '♦', 4: '♣' };
    return map[suit] || '-';
}

function phaseLabel(phase: string): string {
    const map: Record<string, string> = {
        dealing: '发牌中',
        bidding: '叫分阶段',
        bottom: '扣底阶段',
        calling: '叫搭档',
        playing: '出牌阶段',
        settling: '结算中',
    };
    return map[phase] || phase;
}

function selectionHint(phase: string, count: number): string {
    if (phase === 'bottom') {
        return `扣底已选 ${count}/4`;
    }
    if (phase === 'calling') {
        return count === 1 ? '已选择搭档牌' : '请选择 1 张搭档牌';
    }
    if (phase === 'playing') {
        return count === 1 ? '已选择出牌' : '请选择 1 张要出的牌';
    }
    return count > 0 ? `已选 ${count} 张` : '等待下一步操作';
}

function isSelectablePhase(phase: string): boolean {
    return phase === 'bottom' || phase === 'calling' || phase === 'playing';
}

function interpolateToCenter(position: string, center: number, offset: number): string {
    const numeric = parseInt(position.replace('%', ''), 10);
    const next = numeric + (center - numeric) * 0.42 + offset;
    return `${next}%`;
}

function _playerLabel(player: PlayerData | undefined): string {
    return player?.nickname || player?.user_id.slice(0, 8) || '-';
}

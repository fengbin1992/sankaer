/**
 * GameStore.ts - 游戏状态管理
 * 维护当前游戏的全部状态数据
 */

import { EventManager } from '../core/EventManager';
import { MessageRouter } from '../network/MessageRouter';
import * as Msg from '../protocol/MsgType';

// === 数据类型 ===

export interface CardData {
    suit: number; // 1=黑桃 2=红心 3=方块 4=梅花 5=王
    rank: number; // 1-13, 14=小王, 15=大王
}

export interface PlayerData {
    user_id: string;
    nickname: string;
    avatar: string;
    seat_idx: number;
    is_ready: boolean;
    is_online: boolean;
    platform: string;
}

export interface SettlementData {
    player_id: string;
    role: string;
    multiplier: number;
    amount: number;
}

// === 花色/点数显示 ===

const SUIT_SYMBOLS: Record<number, string> = {
    1: '♠', 2: '♥', 3: '♦', 4: '♣', 5: '🃏',
};
const RANK_NAMES: Record<number, string> = {
    1: 'A', 2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7',
    8: '8', 9: '9', 10: '10', 11: 'J', 12: 'Q', 13: 'K',
    14: '小王', 15: '大王',
};

export function cardToString(card: CardData): string {
    if (card.rank >= 14) return RANK_NAMES[card.rank] || '?';
    return (SUIT_SYMBOLS[card.suit] || '?') + (RANK_NAMES[card.rank] || '?');
}

// === 游戏状态 ===

export type GamePhase =
    | 'login'       // 登录
    | 'lobby'       // 大厅
    | 'matching'    // 匹配中
    | 'room'        // 房间等待
    | 'flipping'    // 翻牌
    | 'dealing'     // 发牌
    | 'bidding'     // 叫分
    | 'bottom'      // 扣底
    | 'calling'     // 叫搭档
    | 'playing'     // 出牌
    | 'settling'    // 结算
    | 'result';     // 结果展示

export class GameStore {
    private static _instance: GameStore;

    // 用户
    userId: string = '';
    nickname: string = '';
    token: string = '';
    coins: number = 0;

    // 房间
    roomId: string = '';
    tier: number = 10;
    players: PlayerData[] = [];

    // 游戏
    phase: GamePhase = 'login';
    myHand: CardData[] = [];
    selectedCards: Set<number> = new Set(); // 选中的手牌索引
    trumpSuit: number = 0;
    bidScore: number = 0;
    dealerId: string = '';
    partnerCard: CardData | null = null;
    isSolo: boolean = false;
    currentTurnId: string = '';
    turnTimeout: number = 0;
    turnDeadlineAt: number = 0;
    playerCardCounts: Record<string, number> = {};
    currentRoundPlays: Array<{ player_id: string; card: CardData }> = [];
    catcherScore: number = 0;

    // 结算
    settlements: SettlementData[] = [];
    winner: string = '';

    static get instance(): GameStore {
        if (!this._instance) {
            this._instance = new GameStore();
            this._instance.registerHandlers();
        }
        return this._instance;
    }

    /** 注册所有 S2C 消息处理器 */
    private registerHandlers(): void {
        MessageRouter.register(Msg.MSG_S2C_LOGIN_RESULT, (p) => this.onLoginResult(p));
        MessageRouter.register(Msg.MSG_S2C_MATCH_UPDATE, (p) => this.onMatchUpdate(p));
        MessageRouter.register(Msg.MSG_S2C_ROOM_JOINED, (p) => this.onRoomJoined(p));
        MessageRouter.register(Msg.MSG_S2C_PLAYER_JOINED, (p) => this.onPlayerJoined(p));
        MessageRouter.register(Msg.MSG_S2C_PLAYER_LEFT, (p) => this.onPlayerLeft(p));
        MessageRouter.register(Msg.MSG_S2C_READY_UPDATE, (p) => this.onReadyUpdate(p));
        MessageRouter.register(Msg.MSG_S2C_GAME_START, (p) => this.onGameStart(p));
        MessageRouter.register(Msg.MSG_S2C_DEAL_CARDS, (p) => this.onDealCards(p));
        MessageRouter.register(Msg.MSG_S2C_FLIP_RESULT, (p) => this.onFlipResult(p));
        MessageRouter.register(Msg.MSG_S2C_BID_UPDATE, (p) => this.onBidUpdate(p));
        MessageRouter.register(Msg.MSG_S2C_BID_RESULT, (p) => this.onBidResult(p));
        MessageRouter.register(Msg.MSG_S2C_ALL_PASSED, (p) => this.onAllPassed(p));
        MessageRouter.register(Msg.MSG_S2C_BOTTOM_CARDS, (p) => this.onBottomCards(p));
        MessageRouter.register(Msg.MSG_S2C_PARTNER_CALLED, (p) => this.onPartnerCalled(p));
        MessageRouter.register(Msg.MSG_S2C_TURN, (p) => this.onTurn(p));
        MessageRouter.register(Msg.MSG_S2C_CARD_PLAYED, (p) => this.onCardPlayed(p));
        MessageRouter.register(Msg.MSG_S2C_ROUND_RESULT, (p) => this.onRoundResult(p));
        MessageRouter.register(Msg.MSG_S2C_GAME_RESULT, (p) => this.onGameResult(p));
        MessageRouter.register(Msg.MSG_S2C_ERROR, (p) => this.onError(p));
        MessageRouter.register(Msg.MSG_PONG, () => {}); // 心跳回复忽略
    }

    // === S2C 消息处理 ===

    private onLoginResult(data: any): void {
        if (data.success) {
            this.userId = data.player.user_id;
            this.nickname = data.player.nickname;
            this.token = data.token;
            this.coins = data.coins;
            this.phase = 'lobby';
        }
        EventManager.instance.emit('LOGIN_RESULT', data);
    }

    private onMatchUpdate(data: any): void {
        EventManager.instance.emit('MATCH_UPDATE', data);
    }

    private onRoomJoined(data: any): void {
        this.roomId = data.room_id;
        this.tier = data.tier;
        this.players = data.players || [];
        this.playerCardCounts = {};
        this.phase = 'room';
        EventManager.instance.emit('ROOM_JOINED', data);
    }

    private onPlayerJoined(data: any): void {
        if (data.player) {
            this.players.push(data.player);
            this.playerCardCounts[data.player.user_id] = 0;
        }
        EventManager.instance.emit('PLAYER_JOINED', data);
    }

    private onPlayerLeft(data: any): void {
        this.players = this.players.filter(p => p.user_id !== data.user_id);
        delete this.playerCardCounts[data.user_id];
        EventManager.instance.emit('PLAYER_LEFT', data);
    }

    private onReadyUpdate(data: any): void {
        const p = this.players.find(p => p.user_id === data.user_id);
        if (p) p.is_ready = data.is_ready;
        EventManager.instance.emit('READY_UPDATE', data);
    }

    private onGameStart(data: any): void {
        this.phase = 'dealing';
        this.myHand = [];
        this.selectedCards.clear();
        this.playerCardCounts = {};
        this.currentRoundPlays = [];
        this.catcherScore = 0;
        EventManager.instance.emit('GAME_START', data);
    }

    private onDealCards(data: any): void {
        this.myHand = data.cards || [];
        this.players.forEach((player) => {
            this.playerCardCounts[player.user_id] = 10;
        });
        this.playerCardCounts[this.userId] = this.myHand.length;
        this.phase = 'bidding';
        EventManager.instance.emit('DEAL_CARDS', data);
    }

    private onFlipResult(data: any): void {
        EventManager.instance.emit('FLIP_RESULT', data);
    }

    private onBidUpdate(data: any): void {
        EventManager.instance.emit('BID_UPDATE', data);
    }

    private onBidResult(data: any): void {
        this.dealerId = data.dealer_id;
        this.bidScore = data.score;
        this.trumpSuit = data.suit;
        this.phase = 'bottom';
        EventManager.instance.emit('BID_RESULT', data);
    }

    private onAllPassed(data: any): void {
        EventManager.instance.emit('ALL_PASSED', data);
    }

    private onBottomCards(data: any): void {
        // 庄家收到底牌，加入手牌
        if (data.cards) {
            this.myHand = [...this.myHand, ...data.cards];
            this.playerCardCounts[this.userId] = this.myHand.length;
        }
        EventManager.instance.emit('BOTTOM_CARDS', data);
    }

    private onPartnerCalled(data: any): void {
        this.partnerCard = data.card;
        this.isSolo = data.is_solo;
        this.phase = 'playing';
        this.currentRoundPlays = [];
        EventManager.instance.emit('PARTNER_CALLED', data);
    }

    private onTurn(data: any): void {
        this.currentTurnId = data.player_id;
        this.turnTimeout = data.timeout;
        this.turnDeadlineAt = Date.now() + Math.max(data.timeout || 0, 0) * 1000;
        EventManager.instance.emit('TURN', data);
    }

    private onCardPlayed(data: any): void {
        this.currentRoundPlays.push({
            player_id: data.player_id,
            card: data.card,
        });
        // 如果是自己出的牌，从手牌移除
        if (data.player_id === this.userId) {
            const idx = this.myHand.findIndex(
                c => c.suit === data.card.suit && c.rank === data.card.rank
            );
            if (idx >= 0) this.myHand.splice(idx, 1);
            this.selectedCards.clear();
            this.playerCardCounts[this.userId] = this.myHand.length;
        } else if (this.playerCardCounts[data.player_id] !== undefined) {
            this.playerCardCounts[data.player_id] = Math.max(this.playerCardCounts[data.player_id] - 1, 0);
        }
        EventManager.instance.emit('CARD_PLAYED', data);
    }

    private onRoundResult(data: any): void {
        this.catcherScore = data.total_catcher_score;
        this.currentRoundPlays = []; // 清空本轮
        EventManager.instance.emit('ROUND_RESULT', data);
    }

    private onGameResult(data: any): void {
        this.phase = 'result';
        this.settlements = data.settlements || [];
        this.winner = data.winner;
        EventManager.instance.emit('GAME_RESULT', data);
    }

    private onError(data: any): void {
        console.error('[GameStore] 服务端错误:', data.message);
        EventManager.instance.emit('SERVER_ERROR', data);
    }

    // === 辅助方法 ===

    /** 是否轮到自己操作 */
    get isMyTurn(): boolean {
        return this.currentTurnId === this.userId;
    }

    /** 是否是庄家 */
    get isDealer(): boolean {
        return this.dealerId === this.userId;
    }

    /** 获取指定玩家数据 */
    getPlayer(userId: string): PlayerData | undefined {
        return this.players.find(p => p.user_id === userId);
    }

    /** 获取自己的座位索引 */
    get mySeatIdx(): number {
        const me = this.players.find(p => p.user_id === this.userId);
        return me ? me.seat_idx : -1;
    }

    /** 当前剩余操作秒数 */
    get remainingTurnSeconds(): number {
        if (this.turnDeadlineAt <= 0) {
            return this.turnTimeout;
        }
        return Math.max(Math.ceil((this.turnDeadlineAt - Date.now()) / 1000), 0);
    }
}

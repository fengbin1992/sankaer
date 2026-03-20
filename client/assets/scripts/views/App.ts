/**
 * App.ts - 应用入口
 * 管理视图切换，连接 GameStore 和各 View
 */

import { EventManager } from '../core/EventManager';
import { GameStore, GamePhase } from '../stores/GameStore';
import { LoginView } from './LoginView';
import { LobbyView } from './LobbyView';
import { RoomView } from './RoomView';
import { GameView } from './GameView';
import { ResultView } from './ResultView';

export class App {
    private currentView: { hide(): void } | null = null;
    private loginView = new LoginView();
    private lobbyView = new LobbyView();
    private roomView = new RoomView();
    private gameView = new GameView();
    private resultView = new ResultView();

    start(): void {
        // 初始化 GameStore（注册消息处理器）
        GameStore.instance;

        // 监听阶段变化
        EventManager.instance.on('LOGIN_RESULT', (data: any) => {
            if (data.success) this.switchView('lobby');
        });

        EventManager.instance.on('ROOM_JOINED', () => {
            this.switchView('room');
        });

        EventManager.instance.on('GAME_START', () => {
            this.switchView('dealing');
        });

        EventManager.instance.on('DEAL_CARDS', () => {
            this.switchView('playing');
        });

        EventManager.instance.on('GAME_RESULT', () => {
            this.switchView('result');
        });

        EventManager.instance.on('PHASE_CHANGE', (phase: GamePhase) => {
            this.switchView(phase);
        });

        EventManager.instance.on('PLAYER_LEFT', () => {
            const store = GameStore.instance;
            // 如果自己被踢出或主动离开
            if (!store.players.find(p => p.user_id === store.userId)) {
                store.phase = 'lobby';
                this.switchView('lobby');
            }
        });

        // 显示登录页
        this.switchView('login');
    }

    private switchView(phase: string): void {
        // 隐藏当前视图
        if (this.currentView) {
            this.currentView.hide();
            this.currentView = null;
        }

        // 显示新视图
        switch (phase) {
            case 'login':
                this.currentView = this.loginView;
                this.loginView.show();
                break;
            case 'lobby':
                this.currentView = this.lobbyView;
                this.lobbyView.show();
                break;
            case 'room':
                this.currentView = this.roomView;
                this.roomView.show();
                break;
            case 'dealing':
            case 'bidding':
            case 'bottom':
            case 'calling':
            case 'playing':
            case 'settling':
                this.currentView = this.gameView;
                this.gameView.show();
                break;
            case 'result':
                this.currentView = this.resultView;
                this.resultView.show();
                break;
        }
    }
}

// 全局启动
export function startApp(): void {
    const app = new App();
    app.start();
}

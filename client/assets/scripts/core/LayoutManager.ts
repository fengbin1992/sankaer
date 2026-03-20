/**
 * LayoutManager.ts - 动态分辨率与座位布局管理
 * 根据屏幕宽高比切换竖屏/平板/横屏布局，并为视图提供统一坐标。
 */

import { EventManager } from './EventManager';
import { getPlatform } from '../platform/PlatformAdapter';

export type LayoutMode = 'portrait' | 'tablet' | 'landscape';

export interface LayoutMetrics {
    mode: LayoutMode;
    screenWidth: number;
    screenHeight: number;
    designWidth: number;
    designHeight: number;
    scaleMode: 'FIXED_WIDTH' | 'SHOW_ALL' | 'FIXED_HEIGHT';
}

export interface SeatPosition {
    top: string;
    left: string;
    scale: number;
}

const LAYOUT_CONFIG: Record<LayoutMode, Pick<LayoutMetrics, 'designWidth' | 'designHeight' | 'scaleMode'>> = {
    portrait: {
        designWidth: 720,
        designHeight: 1280,
        scaleMode: 'FIXED_WIDTH',
    },
    tablet: {
        designWidth: 1280,
        designHeight: 960,
        scaleMode: 'SHOW_ALL',
    },
    landscape: {
        designWidth: 1920,
        designHeight: 1080,
        scaleMode: 'FIXED_HEIGHT',
    },
};

const GAME_SEAT_LAYOUTS: Record<LayoutMode, SeatPosition[]> = {
    portrait: [
        { top: '82%', left: '50%', scale: 1 },
        { top: '58%', left: '12%', scale: 0.9 },
        { top: '17%', left: '25%', scale: 0.86 },
        { top: '17%', left: '75%', scale: 0.86 },
        { top: '58%', left: '88%', scale: 0.9 },
    ],
    tablet: [
        { top: '84%', left: '50%', scale: 1 },
        { top: '54%', left: '14%', scale: 0.92 },
        { top: '20%', left: '27%', scale: 0.88 },
        { top: '20%', left: '73%', scale: 0.88 },
        { top: '54%', left: '86%', scale: 0.92 },
    ],
    landscape: [
        { top: '82%', left: '50%', scale: 1 },
        { top: '57%', left: '16%', scale: 0.95 },
        { top: '20%', left: '31%', scale: 0.9 },
        { top: '20%', left: '69%', scale: 0.9 },
        { top: '57%', left: '84%', scale: 0.95 },
    ],
};

const ROOM_SEAT_LAYOUTS: Record<LayoutMode, SeatPosition[]> = {
    portrait: [
        { top: '78%', left: '50%', scale: 1 },
        { top: '56%', left: '16%', scale: 0.92 },
        { top: '26%', left: '28%', scale: 0.88 },
        { top: '26%', left: '72%', scale: 0.88 },
        { top: '56%', left: '84%', scale: 0.92 },
    ],
    tablet: [
        { top: '76%', left: '50%', scale: 1 },
        { top: '52%', left: '17%', scale: 0.94 },
        { top: '24%', left: '31%', scale: 0.9 },
        { top: '24%', left: '69%', scale: 0.9 },
        { top: '52%', left: '83%', scale: 0.94 },
    ],
    landscape: [
        { top: '72%', left: '50%', scale: 1 },
        { top: '50%', left: '20%', scale: 0.95 },
        { top: '22%', left: '34%', scale: 0.9 },
        { top: '22%', left: '66%', scale: 0.9 },
        { top: '50%', left: '80%', scale: 0.95 },
    ],
};

export class LayoutManager {
    private static _instance: LayoutManager;
    private _metrics: LayoutMetrics = {
        mode: 'portrait',
        screenWidth: 720,
        screenHeight: 1280,
        ...LAYOUT_CONFIG.portrait,
    };

    private _started = false;
    private readonly _resizeHandler = (): void => {
        this.refresh();
    };

    static get instance(): LayoutManager {
        if (!this._instance) {
            this._instance = new LayoutManager();
        }
        return this._instance;
    }

    init(): void {
        if (this._started) {
            this.refresh();
            return;
        }

        this._started = true;
        this.refresh();

        if (typeof window !== 'undefined') {
            window.addEventListener('resize', this._resizeHandler);
            window.addEventListener('orientationchange', this._resizeHandler);
        }
    }

    destroy(): void {
        if (!this._started || typeof window === 'undefined') {
            return;
        }
        window.removeEventListener('resize', this._resizeHandler);
        window.removeEventListener('orientationchange', this._resizeHandler);
        this._started = false;
    }

    refresh(): void {
        const platform = getPlatform();
        const systemInfo = platform.getSystemInfo();
        const nextMode = detectLayoutMode(systemInfo.screenWidth, systemInfo.screenHeight);
        const nextMetrics: LayoutMetrics = {
            mode: nextMode,
            screenWidth: systemInfo.screenWidth,
            screenHeight: systemInfo.screenHeight,
            ...LAYOUT_CONFIG[nextMode],
        };

        const changed =
            nextMetrics.mode !== this._metrics.mode ||
            nextMetrics.screenWidth !== this._metrics.screenWidth ||
            nextMetrics.screenHeight !== this._metrics.screenHeight;

        this._metrics = nextMetrics;
        this.applyCssVars();

        if (changed) {
            EventManager.instance.emit('LAYOUT_CHANGED', this._metrics);
        }
    }

    get metrics(): LayoutMetrics {
        return this._metrics;
    }

    get mode(): LayoutMode {
        return this._metrics.mode;
    }

    getGameSeatPosition(seatIdx: number, mySeatIdx: number): SeatPosition {
        return getRelativeSeatPosition(GAME_SEAT_LAYOUTS[this._metrics.mode], seatIdx, mySeatIdx);
    }

    getRoomSeatPosition(seatIdx: number): SeatPosition {
        return ROOM_SEAT_LAYOUTS[this._metrics.mode][seatIdx] || ROOM_SEAT_LAYOUTS[this._metrics.mode][0];
    }

    getHandCardWidth(cardCount: number): number {
        const base = this._metrics.mode === 'landscape' ? 94 : this._metrics.mode === 'tablet' ? 88 : 76;
        if (cardCount <= 10) return base;
        if (cardCount <= 15) return base - 8;
        return Math.max(base - 14, 52);
    }

    private applyCssVars(): void {
        if (typeof document === 'undefined') {
            return;
        }

        const root = document.documentElement;
        root.dataset.layout = this._metrics.mode;
        root.style.setProperty('--app-screen-width', `${this._metrics.screenWidth}px`);
        root.style.setProperty('--app-screen-height', `${this._metrics.screenHeight}px`);
        root.style.setProperty('--app-design-width', `${this._metrics.designWidth}px`);
        root.style.setProperty('--app-design-height', `${this._metrics.designHeight}px`);
        root.style.setProperty('--app-scale-mode', this._metrics.scaleMode);
        root.style.setProperty('--safe-gap', this._metrics.mode === 'portrait' ? '16px' : '24px');
        root.style.setProperty('--seat-scale-self', '1');
    }
}

export function detectLayoutMode(width: number, height: number): LayoutMode {
    if (height <= 0) {
        return 'portrait';
    }

    const ratio = width / height;
    if (ratio >= 1.45) {
        return 'landscape';
    }
    if (ratio >= 0.9) {
        return 'tablet';
    }
    return 'portrait';
}

function getRelativeSeatPosition(layout: SeatPosition[], seatIdx: number, mySeatIdx: number): SeatPosition {
    if (mySeatIdx < 0) {
        return layout[seatIdx] || layout[0];
    }

    const relative = (seatIdx - mySeatIdx + 5) % 5;
    return layout[relative] || layout[0];
}


/**
 * CardNode.ts - 正式牌面 DOM 组件
 */

import { CardData, cardToString } from '../stores/GameStore';
import { ensureTheme } from './Theme';

export interface CardNodeOptions {
    width?: number;
    faceDown?: boolean;
    selected?: boolean;
    disabled?: boolean;
    onClick?: () => void;
    ownerLabel?: string;
}

const CARD_STYLE_ID = 'sankaer-card-style';

export class CardNode {
    static create(card: CardData, options: CardNodeOptions = {}): HTMLDivElement {
        ensureTheme();
        ensureCardStyles();

        const width = options.width ?? 86;
        const height = Math.round(width * 1.42);
        const root = document.createElement('div');
        root.className = `sk-card sk-pop-in${options.selected ? ' is-selected' : ''}${options.disabled ? ' is-disabled' : ''}`;
        root.style.width = `${width}px`;
        root.style.height = `${height}px`;
        root.style.setProperty('--card-lift', options.selected ? '-18px' : '0px');

        if (options.onClick) {
            root.style.cursor = options.disabled ? 'default' : 'pointer';
            root.onclick = () => {
                if (!options.disabled) {
                    options.onClick?.();
                }
            };
        }

        const img = document.createElement('img');
        img.alt = cardToString(card);
        img.src = resolveCardAsset(card, options.faceDown === true);
        img.draggable = false;
        img.onerror = () => {
            img.style.display = 'none';
            fallback.style.display = 'flex';
        };
        root.appendChild(img);

        const fallback = document.createElement('div');
        fallback.className = 'sk-card-fallback';
        fallback.textContent = options.faceDown ? '牌背' : cardToString(card);
        fallback.style.display = 'none';
        root.appendChild(fallback);

        if (options.ownerLabel) {
            const label = document.createElement('div');
            label.className = 'sk-card-owner';
            label.textContent = options.ownerLabel;
            root.appendChild(label);
        }

        return root;
    }
}

function ensureCardStyles(): void {
    if (typeof document === 'undefined' || document.getElementById(CARD_STYLE_ID)) {
        return;
    }

    const style = document.createElement('style');
    style.id = CARD_STYLE_ID;
    style.textContent = `
        .sk-card {
            position: relative;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            margin: 0;
            border-radius: 16px;
            overflow: hidden;
            transform: translateY(var(--card-lift, 0px));
            transition: transform 0.18s ease, box-shadow 0.18s ease, filter 0.18s ease;
            box-shadow: 0 16px 28px rgba(0, 0, 0, 0.28);
            background: linear-gradient(180deg, rgba(255,255,255,0.92), rgba(232, 224, 214, 0.98));
            border: 1px solid rgba(82, 54, 34, 0.25);
        }

        .sk-card img,
        .sk-card-fallback {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }

        .sk-card.is-selected {
            box-shadow: 0 22px 34px rgba(0, 0, 0, 0.32), 0 0 0 3px rgba(244, 184, 96, 0.45);
        }

        .sk-card.is-disabled {
            filter: grayscale(0.14) brightness(0.92);
        }

        .sk-card-fallback {
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 8px;
            box-sizing: border-box;
            color: #24313b;
            font-family: 'Segoe UI Semibold', sans-serif;
            font-size: 16px;
            text-align: center;
            background: linear-gradient(180deg, #fff6e6, #efe4d2);
        }

        .sk-card-owner {
            position: absolute;
            left: 8px;
            right: 8px;
            bottom: 8px;
            padding: 3px 6px;
            border-radius: 999px;
            background: rgba(7, 17, 24, 0.62);
            color: #f7eee2;
            font-size: 10px;
            text-align: center;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
    `;
    document.head.appendChild(style);
}

function resolveCardAsset(card: CardData, faceDown: boolean): string {
    if (faceDown) {
        return 'assets/resources/cards/card_back.png';
    }

    if (card.rank === 14) {
        return 'assets/resources/cards/card_joker_black.png';
    }
    if (card.rank === 15) {
        return 'assets/resources/cards/card_joker_red.png';
    }

    const suit = getSuitName(card.suit);
    const rank = getRankName(card.rank);
    return `assets/resources/cards/card_${suit}_${rank}.png`;
}

function getSuitName(suit: number): string {
    const suitMap: Record<number, string> = {
        1: 'spades',
        2: 'hearts',
        3: 'diamonds',
        4: 'clubs',
    };
    return suitMap[suit] || 'spades';
}

function getRankName(rank: number): string {
    if (rank === 1) return 'A';
    if (rank === 11) return 'J';
    if (rank === 12) return 'Q';
    if (rank === 13) return 'K';
    if (rank >= 2 && rank <= 9) return `0${rank}`;
    return String(rank);
}

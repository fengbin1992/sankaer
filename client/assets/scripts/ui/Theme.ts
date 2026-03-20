/**
 * Theme.ts - 全局主题样式与常用 DOM 辅助
 */

export type ButtonVariant = 'primary' | 'secondary' | 'success' | 'warning' | 'ghost';

const THEME_STYLE_ID = 'sankaer-theme-style';

export function ensureTheme(): void {
    if (typeof document === 'undefined' || document.getElementById(THEME_STYLE_ID)) {
        return;
    }

    const style = document.createElement('style');
    style.id = THEME_STYLE_ID;
    style.textContent = `
        @font-face {
            font-family: 'SankaerDisplay';
            src: url('assets/resources/fonts/Kenney Future.ttf') format('truetype');
            font-display: swap;
        }

        :root {
            --bg-night: #08141d;
            --bg-panel: rgba(10, 28, 40, 0.74);
            --bg-panel-strong: rgba(8, 22, 31, 0.9);
            --line-soft: rgba(255, 255, 255, 0.12);
            --text-main: #f4efe6;
            --text-muted: #b9c6d1;
            --accent-gold: #f4b860;
            --accent-red: #d85a52;
            --accent-green: #55b683;
            --accent-blue: #3f6fb6;
            --shadow-strong: 0 18px 56px rgba(0, 0, 0, 0.32);
        }

        html, body {
            margin: 0;
            min-height: 100%;
            background:
                radial-gradient(circle at top, rgba(255, 205, 120, 0.16), transparent 34%),
                linear-gradient(180deg, #132532 0%, #09131b 100%);
            color: var(--text-main);
            font-family: 'Segoe UI', 'Microsoft YaHei', sans-serif;
            overflow: hidden;
        }

        body {
            position: relative;
        }

        body::before {
            content: '';
            position: fixed;
            inset: 0;
            background:
                linear-gradient(135deg, rgba(19, 59, 49, 0.24), rgba(10, 18, 26, 0.78)),
                url('assets/resources/bg/more-leaves.png') center/480px repeat;
            opacity: 0.18;
            pointer-events: none;
        }

        .sk-screen {
            position: fixed;
            inset: 0;
            box-sizing: border-box;
            padding: var(--safe-gap, 18px);
            display: flex;
            justify-content: center;
            align-items: stretch;
        }

        .sk-shell {
            width: min(100%, 1400px);
            height: 100%;
            display: flex;
            flex-direction: column;
            gap: 16px;
        }

        .sk-panel {
            box-sizing: border-box;
            background: linear-gradient(180deg, rgba(19, 45, 59, 0.82), rgba(7, 18, 26, 0.94));
            border: 1px solid var(--line-soft);
            border-radius: 24px;
            box-shadow: var(--shadow-strong);
            backdrop-filter: blur(12px);
        }

        .sk-felt {
            background:
                radial-gradient(circle at top, rgba(255, 255, 255, 0.12), transparent 32%),
                linear-gradient(180deg, rgba(24, 76, 54, 0.95), rgba(8, 36, 23, 0.98));
        }

        .sk-wood {
            background:
                linear-gradient(180deg, rgba(82, 49, 30, 0.88), rgba(30, 18, 11, 0.94)),
                linear-gradient(90deg, rgba(255,255,255,0.05), transparent 14%, rgba(0,0,0,0.12) 28%);
        }

        .sk-title {
            font-family: 'SankaerDisplay', 'Segoe UI Semibold', sans-serif;
            letter-spacing: 0.08em;
            text-transform: uppercase;
        }

        .sk-muted {
            color: var(--text-muted);
        }

        .sk-chip {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 8px 14px;
            border-radius: 999px;
            border: 1px solid rgba(255,255,255,0.12);
            background: rgba(255,255,255,0.06);
            color: var(--text-main);
            font-size: 13px;
        }

        .sk-btn {
            border: none;
            border-radius: 18px;
            padding: 14px 24px;
            font-family: 'Segoe UI Semibold', 'Microsoft YaHei', sans-serif;
            font-size: 15px;
            letter-spacing: 0.03em;
            cursor: pointer;
            color: #fff8ef;
            transition: transform 0.18s ease, filter 0.18s ease, box-shadow 0.18s ease;
            box-shadow: 0 12px 28px rgba(0, 0, 0, 0.24);
        }

        .sk-btn:hover {
            transform: translateY(-2px);
            filter: brightness(1.05);
        }

        .sk-btn:active {
            transform: translateY(1px) scale(0.99);
        }

        .sk-btn-primary { background: linear-gradient(180deg, #e4a34d, #b56d2f); }
        .sk-btn-secondary { background: linear-gradient(180deg, #5878b8, #314c7f); }
        .sk-btn-success { background: linear-gradient(180deg, #5fc08d, #2d8c61); }
        .sk-btn-warning { background: linear-gradient(180deg, #d97263, #9d4438); }
        .sk-btn-ghost {
            background: rgba(255,255,255,0.08);
            border: 1px solid rgba(255,255,255,0.12);
            box-shadow: none;
        }

        .sk-card-fan {
            display: flex;
            align-items: flex-end;
            justify-content: center;
            flex-wrap: nowrap;
        }

        .sk-scroll {
            overflow-x: auto;
            overflow-y: hidden;
            scrollbar-width: thin;
        }

        .sk-countdown {
            font-family: 'Segoe UI Semibold', sans-serif;
            color: var(--accent-gold);
        }

        .sk-pop-in {
            animation: sk-pop-in 0.28s ease;
        }

        @keyframes sk-pop-in {
            from {
                opacity: 0;
                transform: translateY(10px) scale(0.98);
            }
            to {
                opacity: 1;
                transform: translateY(0) scale(1);
            }
        }
    `;
    document.head.appendChild(style);
}

export function createScreenRoot(id: string, shellClass = ''): HTMLDivElement {
    ensureTheme();
    const root = document.createElement('div');
    root.id = id;
    root.className = 'sk-screen';

    const shell = document.createElement('div');
    shell.className = `sk-shell ${shellClass}`.trim();
    root.appendChild(shell);
    return root;
}

export function getScreenShell(root: HTMLElement): HTMLDivElement {
    return root.firstElementChild as HTMLDivElement;
}

export function createButton(text: string, variant: ButtonVariant, onClick: () => void): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `sk-btn sk-btn-${variant}`;
    button.textContent = text;
    button.onclick = onClick;
    return button;
}

/**
 * AudioManager.ts - 音频管理
 * 统一封装按钮音效、发牌音效和结果提示音。
 */

import { StorageManager } from './StorageManager';

export type SoundEffect = 'click' | 'deal' | 'play' | 'warning' | 'win' | 'lose' | 'switch';

const SFX_PATHS: Record<SoundEffect, string> = {
    click: 'assets/resources/audio/sfx/click-a.ogg',
    deal: 'assets/resources/audio/sfx/tap-a.ogg',
    play: 'assets/resources/audio/sfx/click-b.ogg',
    warning: 'assets/resources/audio/sfx/switch-b.ogg',
    win: 'assets/resources/audio/sfx/tap-b.ogg',
    lose: 'assets/resources/audio/sfx/switch-a.ogg',
    switch: 'assets/resources/audio/sfx/switch-a.ogg',
};

export class AudioManager {
    private static _instance: AudioManager;
    private _unlocked = false;
    private _initialized = false;
    private _enabled = true;

    static get instance(): AudioManager {
        if (!this._instance) {
            this._instance = new AudioManager();
        }
        return this._instance;
    }

    init(): void {
        if (this._initialized || typeof document === 'undefined') {
            return;
        }

        this._initialized = true;
        this._enabled = StorageManager.instance.get('audio_enabled') !== '0';

        const unlock = (): void => {
            this._unlocked = true;
            document.removeEventListener('pointerdown', unlock);
            document.removeEventListener('keydown', unlock);
        };

        document.addEventListener('pointerdown', unlock, { once: true });
        document.addEventListener('keydown', unlock, { once: true });
    }

    setEnabled(enabled: boolean): void {
        this._enabled = enabled;
        StorageManager.instance.set('audio_enabled', enabled ? '1' : '0');
    }

    playSfx(name: SoundEffect, volume = 0.7): void {
        if (!this._enabled || !this._unlocked || typeof Audio === 'undefined') {
            return;
        }

        const src = SFX_PATHS[name];
        const audio = new Audio(src);
        audio.volume = volume;
        void audio.play().catch(() => {
            // 浏览器未解锁音频时静默失败即可。
        });
    }
}


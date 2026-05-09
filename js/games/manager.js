// GameManager — opens the menu, starts the chosen game, manages the
// `body.game-active` flag so the gesture UI hides while playing. Esc anywhere
// exits cleanly.

import { BubblePop }    from './bubblePop.js';
import { HeartCatcher } from './heartCatcher.js';
import { MemoryMatch }  from './memoryMatch.js';

const GAME_CTORS = {
    bubble:  BubblePop,
    catcher: HeartCatcher,
    memory:  MemoryMatch,
};

export class GameManager {
    constructor({
        menuToggle,
        menu,
        menuClose,
        container,
        closeBtn,
        statsEl,
        stageEl,
        photos = [],
        // Anything with .pause() / .resume() — we silence everything that
        // would compete with the game loop for CPU/GPU while a game is up.
        // Order doesn't matter; missing methods are tolerated.
        pausables = [],
        // Per-game synthesized BGM + SFX. Started on game open, stopped on
        // exit. Passed into each game's constructor so action SFX can fire.
        gameAudio = null,
    }) {
        this.menuToggle = menuToggle;
        this.menu       = menu;
        this.menuClose  = menuClose;
        this.container  = container;
        this.closeBtn   = closeBtn;
        this.statsEl    = statsEl;
        this.stageEl    = stageEl;
        this.photos     = photos;
        this.pausables  = pausables;
        this.gameAudio  = gameAudio;
        this.activeGame = null;

        menuToggle.addEventListener('click', () => this.openMenu());
        menuClose .addEventListener('click', () => this.closeMenu());
        closeBtn  .addEventListener('click', () => this.exitGame());

        // Click outside menu modal → close.
        menu.addEventListener('click', (e) => { if (e.target === menu) this.closeMenu(); });

        // Game cards.
        menu.querySelectorAll('.gm-card').forEach((card) => {
            card.addEventListener('click', () => this.startGame(card.dataset.game));
        });

        document.addEventListener('keydown', (e) => {
            if (e.key !== 'Escape') return;
            if (this.activeGame) this.exitGame();
            else if (!this.menu.hidden) this.closeMenu();
        });
    }

    openMenu() {
        if (this.activeGame) return;
        this.menu.hidden = false;
        // Force reflow so the open class transition triggers.
        // eslint-disable-next-line no-unused-expressions
        this.menu.offsetWidth;
        this.menu.classList.add('open');
    }

    closeMenu() {
        this.menu.classList.remove('open');
        setTimeout(() => { this.menu.hidden = true; }, 350);
    }

    startGame(name) {
        const Ctor = GAME_CTORS[name];
        if (!Ctor) return;

        this.closeMenu();

        document.body.classList.add('game-active');
        this.container.hidden = false;
        // eslint-disable-next-line no-unused-expressions
        this.container.offsetWidth;
        this.container.classList.add('open');

        // Silence everything that runs in the background — MediaPipe
        // inference, the 3D scene render passes, the foreground sparkle
        // canvas, ambient events + whispers schedulers, and the iTunes
        // music player on the homepage. The game loop owns the audio
        // stage too — it gets its own synthesized BGM via gameAudio.
        this.pausables.forEach((p) => p?.pause?.());

        // Each game has its own BGM + SFX. Start the BGM loop tuned for
        // this specific game (synthesized via Web Audio, no asset deps).
        this.gameAudio?.startBGM?.(name);

        this.activeGame = new Ctor({
            stage:     this.stageEl,
            stats:     this.statsEl,
            photos:    this.photos,
            gameAudio: this.gameAudio,
        });
        this.activeGame.start();
    }

    exitGame() {
        if (this.activeGame) {
            this.activeGame.stop();
            this.activeGame = null;
        }
        this.container.classList.remove('open');
        setTimeout(() => { this.container.hidden = true; }, 350);
        document.body.classList.remove('game-active');

        // Stop the per-game BGM (fades out gracefully). The homepage music
        // player resumes on its own via the pausables resume below.
        this.gameAudio?.stopBGM?.();

        // Wake the gesture-mode systems back up.
        this.pausables.forEach((p) => p?.resume?.());
    }
}

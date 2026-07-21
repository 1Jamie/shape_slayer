/**
 * Boss Intro Sequence Controller for Shape Slayer.
 * Handles boss cutscene initialization, step updates, camera pan triggers, and stage banner overlays.
 */

const GameBossIntro = {
    startBossIntro(game, boss) {
        if (!game || !boss || !boss.isBoss) {
            console.error('startBossIntro called with invalid boss');
            return;
        }

        const currentRoomNumber = game.roomNumber || (typeof currentRoom !== 'undefined' && currentRoom ? currentRoom.number : 0);
        if (currentRoomNumber > 30) {
            boss.introComplete = true;
            console.log(`Boss intro skipped for ${boss.bossName} (room ${currentRoomNumber} > 30)`);
            return;
        }

        game.bossIntroActive = true;
        game.bossIntroData = {
            boss: boss,
            name: boss.bossName || 'BOSS',
            duration: 3.0,
            elapsedTime: 0,
            skipAvailable: false
        };

        boss.introComplete = false;
        console.log(`Boss intro started for ${boss.bossName}`);
    },

    updateBossIntro(game, deltaTime) {
        if (!game || !game.bossIntroData) return;

        game.bossIntroData.elapsedTime += deltaTime;

        if (game.bossIntroData.elapsedTime >= 2.0) {
            game.bossIntroData.skipAvailable = true;
        }

        if (game.bossIntroData.elapsedTime >= game.bossIntroData.duration) {
            this.endBossIntro(game);
        }
    },

    skipBossIntro(game) {
        if (!game || !game.bossIntroData || !game.bossIntroData.skipAvailable) return;
        this.endBossIntro(game);
    },

    endBossIntro(game) {
        if (!game || !game.bossIntroData || !game.bossIntroData.boss) return;

        game.bossIntroData.boss.introComplete = true;
        game.bossIntroCameraPan = true;
        game.bossIntroPanProgress = 0;
        game.bossIntroPanStartX = game.camera ? game.camera.x : 0;
        game.bossIntroPanStartY = game.camera ? game.camera.y : 0;

        game.bossIntroActive = false;
        game.bossIntroData = null;

        console.log('Boss intro ended, starting camera pan to player');
    },

    renderBossIntro(game, ctx) {
        if (!game || !ctx || !game.bossIntroData || !game.bossIntroData.boss) return;

        const width = game.config ? game.config.width : 1280;
        const height = game.config ? game.config.height : 720;
        const zoom = Number.isFinite(game.bossIntroZoom) ? game.bossIntroZoom : 1.3;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(0, 0, width, height);

        const elapsed = game.bossIntroData.elapsedTime;
        const nameFadeIn = Math.min(1.0, elapsed / 0.5);
        const nameScale = (typeof Engine !== 'undefined' && Engine.Utils && typeof Engine.Utils.lerp === 'function')
            ? Engine.Utils.lerp(0.5, 1.0, nameFadeIn)
            : (0.5 + (nameFadeIn * 0.5));

        ctx.save();
        const centerX = width / 2;
        const centerY = height / 2;

        ctx.translate(centerX, centerY);
        ctx.scale(zoom, zoom);
        ctx.translate(-(game.camera ? game.camera.x : 0), -(game.camera ? game.camera.y : 0));

        ctx.globalAlpha = 1.0;
        game.bossIntroData.boss.render(ctx);
        ctx.restore();

        ctx.save();
        ctx.globalAlpha = nameFadeIn;
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${48 * nameScale}px Orbitron`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const nameOffsetY = height * 0.20;
        ctx.fillText(game.bossIntroData.name, width / 2, height / 2 - nameOffsetY);
        ctx.restore();

        if (game.bossIntroData.skipAvailable) {
            const skipFade = Math.sin(Date.now() / 200);
            ctx.save();
            ctx.globalAlpha = 0.5 + skipFade * 0.5;
            ctx.fillStyle = '#ffff00';
            ctx.font = 'bold 20px Orbitron';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const skipOffsetY = height * 0.25;
            ctx.fillText('Press any key to continue', width / 2, height / 2 + skipOffsetY);
            ctx.restore();
        }
    }
};

if (typeof window !== 'undefined') {
    window.GameBossIntro = GameBossIntro;
}
if (typeof globalThis !== 'undefined') {
    globalThis.GameBossIntro = GameBossIntro;
}

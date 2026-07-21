/**
 * Room & State Transition Manager for Shape Slayer.
 * Handles room entry transitions, static room pre-baking, and Nexus asset prewarming.
 */

const GameRoomTransition = {
    beginRoomEnterTransition(game, options = {}) {
        if (!game) return;
        if (typeof RunProfiler !== 'undefined' && RunProfiler.isActive()) {
            RunProfiler.markRoomTransitionStart();
        }
        game.roomEnterTransition = {
            phase: 0,
            roomNumber: options.roomNumber != null ? options.roomNumber : game.roomNumber,
            startedAt: performance.now(),
            minMs: options.minMs != null ? options.minMs : 280,
            onComplete: typeof options.onComplete === 'function' ? options.onComplete : null
        };
        game.state = 'ENTERING_ROOM';
        game.paused = false;
    },

    updateRoomEnterTransition(game) {
        if (!game) return;
        const transition = game.roomEnterTransition;
        if (!transition) {
            this.finishRoomEnterTransition(game);
            return;
        }

        if (transition.phase === 0) {
            if (typeof currentRoom !== 'undefined' && currentRoom && typeof prepareRoomRenderData === 'function') {
                prepareRoomRenderData(currentRoom, transition.roomNumber);
            }
            if (typeof resetVoxelStaticCanvas === 'function' && typeof currentRoom !== 'undefined' && currentRoom) {
                resetVoxelStaticCanvas(currentRoom.width || 2400, currentRoom.height || 1350);
            }
            if (game.frameBudgetSamples) {
                game.frameBudgetSamples.length = 0;
            }
            if (typeof game.getBaseRenderQuality === 'function') {
                game.renderQuality = game.getBaseRenderQuality();
            }
            transition.phase = 1;
            return;
        }

        if (transition.phase === 1) {
            if (typeof currentRoom !== 'undefined' && currentRoom) {
                if (typeof bakeRoomStaticSceneCache === 'function') {
                    bakeRoomStaticSceneCache(currentRoom, transition.roomNumber);
                } else if (typeof prepareRoomRenderCaches === 'function') {
                    prepareRoomRenderCaches(currentRoom, transition.roomNumber);
                }
            }
            transition.phase = 2;
            return;
        }

        if (transition.phase === 2 && performance.now() - transition.startedAt >= transition.minMs) {
            this.finishRoomEnterTransition(game);
        }
    },

    finishRoomEnterTransition(game) {
        if (!game) return;
        const onComplete = game.roomEnterTransition && game.roomEnterTransition.onComplete;
        const roomNumber = game.roomEnterTransition ? game.roomEnterTransition.roomNumber : game.roomNumber;
        game.roomEnterTransition = null;
        game.state = 'PLAYING';

        if (typeof RunProfiler !== 'undefined' && RunProfiler.isActive()) {
            RunProfiler.markRoomTransitionEnd(roomNumber);
            const roomType = (typeof currentRoom !== 'undefined' && currentRoom && currentRoom.type) ? currentRoom.type : 'normal';
            const biomeId = (typeof currentRoom !== 'undefined' && currentRoom && currentRoom.biomeId) ? currentRoom.biomeId : null;
            RunProfiler.markRoomEnter(roomNumber, roomType, biomeId);
        }
        if (typeof game.initializeCamera === 'function') {
            game.initializeCamera();
        }
        if (typeof onComplete === 'function') {
            onComplete();
        }
    },

    maybeStartBossIntroForCurrentRoom(game) {
        if (!game) return;
        if (typeof currentRoom === 'undefined' || !currentRoom || currentRoom.type !== 'boss') {
            return;
        }
        if (!Array.isArray(game.enemies) || game.enemies.length === 0 || !game.enemies[0].isBoss) {
            return;
        }
        const boss = game.enemies[0];
        const currentRoomNumber = game.roomNumber || (currentRoom ? currentRoom.number : 0);
        if (currentRoomNumber <= 50) {
            if (typeof game.startBossIntro === 'function') {
                game.startBossIntro(boss);
            }
        } else {
            boss.introComplete = true;
        }
    },

    tickNexusPrewarm(game) {
        if (!game || game.state !== 'NEXUS' || game.nexusPrewarmComplete) {
            return;
        }
        if (!game.selectedClass) {
            return;
        }

        if (!game.nexusPrewarm) {
            if (typeof generateRoom === 'undefined') {
                return;
            }
            game.nexusPrewarm = {
                phase: 0,
                room: generateRoom(1),
                roomNumber: 1
            };
        }

        const prewarm = game.nexusPrewarm;
        if (prewarm.phase === 0) {
            if (typeof prepareRoomRenderData === 'function') {
                prepareRoomRenderData(prewarm.room, prewarm.roomNumber);
            }
            prewarm.phase = 1;
            return;
        }

        if (prewarm.phase === 1) {
            if (typeof bakeRoomStaticSceneCache === 'function') {
                bakeRoomStaticSceneCache(prewarm.room, prewarm.roomNumber);
            } else if (typeof prepareRoomRenderCaches === 'function') {
                prepareRoomRenderCaches(prewarm.room, prewarm.roomNumber);
            }
            if (typeof releaseRoomRenderCaches === 'function') {
                releaseRoomRenderCaches(prewarm.room);
            }
            game.nexusPrewarm = null;
            game.nexusPrewarmComplete = true;
        }
    },

    renderRoomEnterScreen(game, ctx) {
        if (!game) return;
        const logicalWidth = game.config ? game.config.width : 1280;
        const logicalHeight = game.config ? game.config.height : 720;
        const biome = typeof getBiomeForRoom !== 'undefined'
            ? getBiomeForRoom(game.roomNumber)
            : { baseColor: '#1a1a2e', accentColor: '#6699ff' };

        if (typeof Engine !== 'undefined' && Engine.Renderer && typeof Engine.Renderer.clear === 'function') {
            Engine.Renderer.clear(ctx, logicalWidth, logicalHeight, biome.baseColor);
        } else {
            ctx.fillStyle = biome.baseColor;
            ctx.fillRect(0, 0, logicalWidth, logicalHeight);
        }

        if (game.roomEnterTransition && game.roomEnterTransition.phase >= 1 &&
            typeof currentRoom !== 'undefined' && currentRoom &&
            typeof renderCachedRoomStaticLayer === 'function') {
            ctx.save();
            ctx.globalAlpha = 0.35;
            renderCachedRoomStaticLayer(ctx, game.roomNumber);
            ctx.restore();
        }

        ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
        ctx.fillRect(0, 0, logicalWidth, logicalHeight);
    }
};

if (typeof window !== 'undefined') {
    window.GameRoomTransition = GameRoomTransition;
}
if (typeof globalThis !== 'undefined') {
    globalThis.GameRoomTransition = GameRoomTransition;
}

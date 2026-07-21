/* Shape Slayer service worker
 * Bump CACHE_VERSION when releasing (keep in sync with GameVersion.VERSION in src/game/content/version.js).
 * A trailing ".N" suffix (e.g. 0.8.2.1) forces a cache refresh without changing the
 * user-facing game version.
 * Shell is precached on install. Audio warms in the background so playback can start ASAP
 * while the library fills for full offline use.
 */
const CACHE_VERSION = '0.8.2.45';
const SHELL_CACHE = `shape-slayer-shell-v${CACHE_VERSION}`;
const RUNTIME_CACHE = `shape-slayer-runtime-v${CACHE_VERSION}`;
const AUDIO_WARM_CONCURRENCY = 2;

const PRECACHE_URLS = [
  './',
  './index.html',
  './privacy.html',
  './manifest.json',
  './assets/gamecontrollerdb.txt',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-512-maskable.png',
  './assets/icons/apple-touch-icon.png',
  './assets/fonts/orbitron/Orbitron-VariableFont_wght.ttf',
  './assets/fonts/orbitron/OFL.txt',
  './src/css/base.css',
  './src/css/mobile-controls.css',
  './assets/audio/music-config.json',
  './src/game/ui/components/pauseButton.js',
  './src/game/ui/components/featureTutorialSkip.js',
  './src/game/ui/components/characterSheetButton.js',
  './src/game/ui/components/pauseMenu.js',
  './src/game/ui/components/privacyModal.js',
  './src/game/ui/components/updateModal.js',
  './src/game/ui/components/launchModal.js',
  './src/game/ui/components/multiplayerMenu.js',
  './src/game/ui/components/characterSheet.js',
  './src/game/ui/components/indexMachine.js',
  './src/game/ui/components/shardDisplay.js',
  './src/game/ui/components/titleScreen.js',
  './src/game/ui/components/hud.js',
  './src/game/ui/components/gearUpgradeMenu.js',
  './src/game/ui/components/safeRoomMenu.js',
  './src/game/ui/components/interactionButton.js',
  './src/game/ui/components/audioMenu.js',
  './src/game/ui/components/deathOverlay.js',
  './src/game/ui/components/roomInfo.js',
  './src/game/ui/components/roomAndLevel.js',
  './src/game/ui/components/otherPlayersHealth.js',
  './src/game/ui/components/mobileCooldowns.js',
  './src/game/content/mobile-control-layout.js',
  './src/game/ui/components/mobileControls.js',
  './src/game/ui/components/mobileControlEditor.js',
  './src/game/ui/components/spectatorIndicator.js',
  './src/game/ui/components/hostPausedIndicator.js',
  './src/game/presentation/text-renderer.js',
  './src/game/presentation/easter-egg-ps2.js',
  './src/game/presentation/render-quality.js',
  './src/game/presentation/display-manager.js',
  './src/game/presentation/screen-effects.js',
  './src/game/presentation/game-camera.js',
  './src/game/presentation/title-transition.js',
  './src/game/presentation/boss-intro.js',
  './src/game/simulation/player-stats.js',
  './src/game/simulation/room-transition.js',
  './src/game/simulation/run-rewards.js',
  './src/game/simulation/split-session.js',
  './src/game/simulation/door-controller.js',
  './src/game/simulation/loot-interaction.js',
  './src/game/ui/core/modal-controller.js',
  './src/engine/audio.js',
  './src/engine/music.js',
  './src/game/audio/game-music.js',
  './src/game/audio/game-audio.js',
  './src/engine/utils.js',
  './src/engine/save.js',
  './src/engine/physics.js',
  './src/engine/proc.js',
  './src/engine/proc-worker.js',
  './src/engine/graphics.js',
  './src/engine/fx.js',
  './src/engine/ui/bus.js',
  './src/engine/ui/root.js',
  './src/engine/ui/modal-stack.js',
  './src/engine/ui/toast.js',
  './src/engine/ui/boot-cinematic.js',
  './src/engine/ui/boot-screen.js',
  './src/engine/boot.js',
  './src/game/ui/core/modal-adapter.js',
  './src/engine/render-host.js',
  './src/engine/render-pipeline.js',
  './src/engine/camera.js',
  './src/engine/touch.js',
  './src/engine/net.js',
  './src/engine/shell.js',
  './src/engine/loop.js',
  './src/engine/renderer.js',
  './src/engine/profiler.js',
  './src/engine/debug.js',
  './src/game/content/biomes.js',
  './src/game/simulation/room-layout-generator.js',
  './src/game/entities/projectiles-util.js',
  './src/game/presentation/render-adapters.js',
  './src/game/presentation/render-pipeline.js',
  './src/engine/system.js',
  './src/engine/sdl-gamecontrollerdb.js',
  './src/engine/input.js',
  './src/engine/split.js',
  './src/game/input-map.js',
  './src/game/ui/core/controllerNavigation.js',
  './src/game/content/gear.js',
  './src/game/content/loot-selection.js',
  './src/game/ui/components/gearTooltip.js',
  './src/game/entities/items/item-definitions.js',
  './src/game/entities/items/item-manager.js',
  './src/game/entities/items/item-ground.js',
  './src/game/entities/items/item-pylon.js',
  './src/game/entities/items/item-effects.js',
  './src/game/entities/items/item-visuals.js',
  './src/game/entities/players/player-base.js',
  './src/game/entities/players/player-warrior.js',
  './src/game/entities/players/player-rogue.js',
  './src/game/entities/players/player-tank.js',
  './src/game/entities/players/player-mage.js',
  './src/game/entities/enemies/telegraph/telegraph-manager.js',
  './src/game/presentation/voxel-fracture.js',
  './src/game/entities/enemies/enemy-base.js',
  './src/game/entities/enemies/biome-enemy-mods.js',
  './src/game/entities/enemies/elite-enemy-affixes.js',
  './src/game/entities/enemies/enemy-index-catalog.js',
  './src/game/entities/enemies/enemy-basic.js',
  './src/game/entities/enemies/enemy-star.js',
  './src/game/entities/enemies/enemy-diamond.js',
  './src/game/entities/enemies/enemy-rectangle.js',
  './src/game/entities/enemies/enemy-octagon.js',
  './src/game/entities/bosses/hazards.js',
  './src/game/entities/bosses/boss-base.js',
  './src/game/simulation/combat-scaling.js',
  './src/game/simulation/combat-economy.js',
  './src/game/entities/bosses/boss-scaling.js',
  './src/game/entities/bosses/pheromone-polyline.js',
  './src/game/entities/bosses/boss-swarmking.js',
  './src/game/entities/bosses/boss-twinprism.js',
  './src/game/entities/bosses/boss-fortress.js',
  './src/game/entities/bosses/boss-fractalcore.js',
  './src/game/entities/bosses/boss-vortex.js',
  './src/game/simulation/level.js',
  './src/game/simulation/combat.js',
  './src/game/presentation/ui.js',
  './src/game/run-profiler.js',
  './src/game/simulation/debug.js',
  './src/game/content/save.js',
  './src/game/content/feats-registry.js',
  './src/game/simulation/ledger-manager.js',
  './src/game/content/run-checkpoint.js',
  './src/game/content/coach-transition.js',
  './src/game/content/onboarding.js',
  './src/game/content/feature-tutorials.js',
  './src/game/content/room0-tutorial.js',
  './src/game/content/version.js',
  './src/game/networking/mp-config.js',
  './src/game/networking/telemetry.js',
  './src/game/networking/interpolation.js',
  './src/game/simulation/nexus.js',
  './src/game/simulation/title-attract.js',
  './src/game/main.js',
];
const PRECACHE_HREFS = new Set(
  PRECACHE_URLS.map((url) => new URL(url, self.registration.scope).href)
);

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(PRECACHE_URLS))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          // Never delete another application's caches on a shared origin.
          .filter((key) => key.startsWith('shape-slayer-'))
          .filter((key) => key !== SHELL_CACHE && key !== RUNTIME_CACHE)
          .map((key) => caches.delete(key))
      )
    ).then(() => {
      // Fire-and-forget: do not block activation on the audio library.
      warmAudioLibraryFromConfig();
    })
  );
});

const audioWarmState = {
  queue: [],
  queued: new Set(),
  inFlight: 0,
  done: new Set()
};

function normalizeAudioUrl(url) {
  try {
    return new URL(url, self.location.href).href;
  } catch (error) {
    return null;
  }
}

function collectTrackUrlsFromConfig(config) {
  const names = new Set();
  const addTracks = (tracks) => {
    if (!Array.isArray(tracks)) {
      return;
    }
    tracks.forEach((track) => {
      if (typeof track === 'string' && track) {
        names.add(track);
      }
    });
  };

  if (Array.isArray(config.roomSets)) {
    config.roomSets.forEach((set) => addTracks(set && set.tracks));
  }

  if (Array.isArray(config.bosses)) {
    config.bosses.forEach((boss) => {
      const phases = boss && boss.phases;
      if (!phases || typeof phases !== 'object') {
        return;
      }
      Object.keys(phases).forEach((phaseKey) => {
        addTracks(phases[phaseKey] && phases[phaseKey].tracks);
      });
    });
  }

  if (config.pauseMenu) {
    addTracks(config.pauseMenu.tracks);
  }

  if (config.special && typeof config.special === 'object') {
    Object.keys(config.special).forEach((key) => {
      addTracks(config.special[key] && config.special[key].tracks);
    });
  }

  const basePath = (config.settings && config.settings.basePath) || 'assets/audio/';
  const prefix = basePath.endsWith('/') ? basePath : `${basePath}/`;
  return Array.from(names).map((name) => normalizeAudioUrl(`./${prefix}${name}`)).filter(Boolean);
}

function enqueueAudioUrls(urls, prioritize) {
  if (!Array.isArray(urls) || urls.length === 0) {
    return;
  }

  const normalized = [];
  urls.forEach((url) => {
    const href = normalizeAudioUrl(url);
    if (!href || audioWarmState.done.has(href) || audioWarmState.queued.has(href)) {
      return;
    }
    audioWarmState.queued.add(href);
    normalized.push(href);
  });

  if (normalized.length === 0) {
    return;
  }

  if (prioritize) {
    audioWarmState.queue = normalized.concat(audioWarmState.queue);
  } else {
    audioWarmState.queue = audioWarmState.queue.concat(normalized);
  }

  pumpAudioWarm();
}

async function cacheAudioUrl(href) {
  const cache = await caches.open(RUNTIME_CACHE);
  const request = new Request(href, { credentials: 'same-origin' });
  const existing = await cache.match(request);
  if (existing) {
    audioWarmState.done.add(href);
    return;
  }

  const response = await fetch(request);
  if (response && response.ok) {
    await cache.put(request, response.clone());
    audioWarmState.done.add(href);
  }
}

function pumpAudioWarm() {
  while (audioWarmState.inFlight < AUDIO_WARM_CONCURRENCY && audioWarmState.queue.length > 0) {
    const href = audioWarmState.queue.shift();
    audioWarmState.queued.delete(href);
    audioWarmState.inFlight += 1;

    cacheAudioUrl(href)
      .catch(() => {
        // Leave out of done so a later prioritize pass can retry.
      })
      .finally(() => {
        audioWarmState.inFlight -= 1;
        pumpAudioWarm();
      });
  }
}

async function warmAudioLibraryFromConfig() {
  try {
    const response = await fetch('./assets/audio/music-config.json', { credentials: 'same-origin' });
    if (!response.ok) {
      return;
    }
    const config = await response.json();
    enqueueAudioUrls(collectTrackUrlsFromConfig(config), false);
  } catch (error) {
    // Ignore - page-side MusicManager will also request a warm.
  }
}

self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || typeof data !== 'object') {
    return;
  }

  if (data.type === 'WARM_AUDIO_LIBRARY') {
    if (Array.isArray(data.urls) && data.urls.length > 0) {
      enqueueAudioUrls(data.urls, false);
    } else {
      warmAudioLibraryFromConfig();
    }
    return;
  }

  if (data.type === 'PRIORITIZE_AUDIO' && Array.isArray(data.urls)) {
    enqueueAudioUrls(data.urls, true);
  }
});

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

function isNavigationRequest(request) {
  return request.mode === 'navigate' ||
    (request.method === 'GET' && request.headers.get('accept') &&
      request.headers.get('accept').includes('text/html'));
}

function isRuntimeCacheable(url) {
  if (!isSameOrigin(url)) {
    return false;
  }
  const path = url.pathname;
  return path.includes('/audio/') ||
    path.endsWith('.mp3') ||
    path.endsWith('.ogg') ||
    path.endsWith('.wav') ||
    path.endsWith('.woff') ||
    path.endsWith('.woff2') ||
    path.endsWith('.ttf');
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') {
    return;
  }

  let url;
  try {
    url = new URL(request.url);
  } catch (error) {
    return;
  }

  // Cross-origin (fonts, analytics, etc.): network only - let browser handle.
  if (!isSameOrigin(url)) {
    return;
  }

  if (isNavigationRequest(request)) {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (isRuntimeCacheable(url)) {
    event.respondWith(cacheFirstRuntime(request));
    return;
  }

  if (PRECACHE_HREFS.has(url.href)) {
    event.respondWith(cacheFirstShell(request));
  }
  // Unknown same-origin GETs stay network-managed. This avoids accidentally
  // freezing future JSON/API endpoints behind shell cache-first behavior.
});

async function networkFirstNavigation(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.ok) {
      const cache = await caches.open(SHELL_CACHE);
      // Cache each navigation under its own URL. Never let privacy.html or an
      // error page replace the offline game shell.
      await cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    const cached = await caches.match(request) ||
      await caches.match('./index.html') ||
      await caches.match('./');
    if (cached) {
      return cached;
    }
    throw error;
  }
}

async function cacheFirstShell(request) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }
  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.ok) {
      const cache = await caches.open(SHELL_CACHE);
      await cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    // Do not return HTML for a missing JS/CSS/image request. That masks the
    // real offline failure as a misleading MIME or syntax error.
    throw error;
  }
}

async function cacheFirstRuntime(request) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }
  const networkResponse = await fetch(request);
  if (networkResponse && networkResponse.ok) {
    const cache = await caches.open(RUNTIME_CACHE);
    await cache.put(request, networkResponse.clone());
  }
  return networkResponse;
}

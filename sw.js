/* Shape Slayer service worker
 * Bump CACHE_VERSION when releasing (keep in sync with GameVersion.VERSION in src/js/version.js).
 * A trailing ".N" suffix (e.g. 0.8.2.1) forces a cache refresh without changing the
 * user-facing game version.
 * Shell is precached on install. Audio warms in the background so playback can start ASAP
 * while the library fills for full offline use.
 */
const CACHE_VERSION = '0.8.2.8';
const SHELL_CACHE = `shape-slayer-shell-v${CACHE_VERSION}`;
const RUNTIME_CACHE = `shape-slayer-runtime-v${CACHE_VERSION}`;
const AUDIO_WARM_CONCURRENCY = 2;

const PRECACHE_URLS = [
  './',
  './index.html',
  './privacy.html',
  './manifest.json',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-512-maskable.png',
  './assets/icons/apple-touch-icon.png',
  './assets/fonts/orbitron/Orbitron-VariableFont_wght.ttf',
  './assets/fonts/orbitron/OFL.txt',
  './src/css/base.css',
  './src/css/mobile-controls.css',
  './assets/audio/music-config.json',
  './src/ui/core/eventBus.js',
  './src/ui/core/domRoot.js',
  './src/ui/components/pauseButton.js',
  './src/ui/components/featureTutorialSkip.js',
  './src/ui/components/characterSheetButton.js',
  './src/ui/components/pauseMenu.js',
  './src/ui/components/privacyModal.js',
  './src/ui/components/updateModal.js',
  './src/ui/components/launchModal.js',
  './src/ui/components/multiplayerMenu.js',
  './src/ui/components/characterSheet.js',
  './src/ui/components/indexMachine.js',
  './src/ui/components/shardDisplay.js',
  './src/ui/components/titleScreen.js',
  './src/ui/components/hud.js',
  './src/ui/components/gearUpgradeMenu.js',
  './src/ui/components/safeRoomMenu.js',
  './src/ui/components/interactionButton.js',
  './src/ui/components/audioMenu.js',
  './src/ui/components/deathOverlay.js',
  './src/ui/components/roomInfo.js',
  './src/ui/components/roomAndLevel.js',
  './src/ui/components/otherPlayersHealth.js',
  './src/ui/components/mobileCooldowns.js',
  './src/js/mobile-control-layout.js',
  './src/ui/components/mobileControls.js',
  './src/ui/components/mobileControlEditor.js',
  './src/ui/components/spectatorIndicator.js',
  './src/ui/components/toast.js',
  './src/engine/audio.js',
  './src/engine/music.js',
  './src/engine/utils.js',
  './src/engine/proc.js',
  './src/engine/graphics.js',
  './src/engine/fx.js',
  './src/engine/render-host.js',
  './src/engine/camera.js',
  './src/engine/touch.js',
  './src/engine/net.js',
  './src/engine/shell.js',
  './src/engine/loop.js',
  './src/engine/renderer.js',
  './src/engine/profiler.js',
  './src/js/biomes.js',
  './src/js/room-layout-generator.js',
  './src/js/projectiles-util.js',
  './src/game/presentation/render-adapters.js',
  './src/engine/system.js',
  './src/engine/input.js',
  './src/game/input-map.js',
  './src/ui/core/controllerNavigation.js',
  './src/js/gear.js',
  './src/js/loot-selection.js',
  './src/ui/components/gearTooltip.js',
  './src/js/items/item-definitions.js',
  './src/js/items/item-manager.js',
  './src/js/items/item-ground.js',
  './src/js/items/item-pylon.js',
  './src/js/items/item-effects.js',
  './src/js/items/item-visuals.js',
  './src/engine/physics.js',
  './src/js/players/player-base.js',
  './src/js/players/player-warrior.js',
  './src/js/players/player-rogue.js',
  './src/js/players/player-tank.js',
  './src/js/players/player-mage.js',
  './src/js/enemies/telegraph/telegraph-manager.js',
  './src/js/voxel-fracture.js',
  './src/js/enemies/enemy-base.js',
  './src/js/enemies/biome-enemy-mods.js',
  './src/js/enemies/elite-enemy-affixes.js',
  './src/js/enemies/enemy-index-catalog.js',
  './src/js/enemies/enemy-basic.js',
  './src/js/enemies/enemy-star.js',
  './src/js/enemies/enemy-diamond.js',
  './src/js/enemies/enemy-rectangle.js',
  './src/js/enemies/enemy-octagon.js',
  './src/js/bosses/hazards.js',
  './src/js/bosses/boss-base.js',
  './src/js/combat-scaling.js',
  './src/js/combat-economy.js',
  './src/js/bosses/boss-scaling.js',
  './src/js/bosses/pheromone-polyline.js',
  './src/js/bosses/boss-swarmking.js',
  './src/js/bosses/boss-twinprism.js',
  './src/js/bosses/boss-fortress.js',
  './src/js/bosses/boss-fractalcore.js',
  './src/js/bosses/boss-vortex.js',
  './src/js/level.js',
  './src/js/combat.js',
  './src/js/ui.js',
  './src/game/run-profiler.js',
  './src/js/debug.js',
  './src/js/save.js',
  './src/js/feats-registry.js',
  './src/js/ledger-manager.js',
  './src/js/run-checkpoint.js',
  './src/js/coach-transition.js',
  './src/js/onboarding.js',
  './src/js/feature-tutorials.js',
  './src/js/room0-tutorial.js',
  './src/js/version.js',
  './src/js/mp-config.js',
  './src/js/telemetry.js',
  './src/js/interpolation.js',
  './src/js/nexus.js',
  './src/js/title-attract.js',
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

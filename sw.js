/* Shape Slayer service worker
 * Bump CACHE_VERSION when releasing (keep in sync with GameVersion.VERSION in js/version.js).
 * Shell is precached on install. Audio warms in the background so playback can start ASAP
 * while the library fills for full offline use.
 */
const CACHE_VERSION = '0.8.2';
const SHELL_CACHE = `shape-slayer-shell-v${CACHE_VERSION}`;
const RUNTIME_CACHE = `shape-slayer-runtime-v${CACHE_VERSION}`;
const AUDIO_WARM_CONCURRENCY = 2;

const PRECACHE_URLS = [
  './',
  './index.html',
  './privacy.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png',
  './icons/apple-touch-icon.png',
  './css/ui/base.css',
  './audio/music-config.json',
  './js/prevent-back-navigation.js',
  './ui/core/eventBus.js',
  './ui/core/domRoot.js',
  './js/ui-dom-flag.js',
  './ui/components/pauseButton.js',
  './ui/components/featureTutorialSkip.js',
  './ui/components/characterSheetButton.js',
  './ui/components/pauseMenu.js',
  './ui/components/privacyModal.js',
  './ui/components/updateModal.js',
  './ui/components/launchModal.js',
  './ui/components/multiplayerMenu.js',
  './ui/components/characterSheet.js',
  './ui/components/indexMachine.js',
  './ui/components/shardDisplay.js',
  './ui/components/hud.js',
  './ui/components/gearUpgradeMenu.js',
  './ui/components/safeRoomMenu.js',
  './ui/components/interactionButton.js',
  './ui/components/audioMenu.js',
  './ui/components/deathOverlay.js',
  './ui/components/roomInfo.js',
  './ui/components/roomAndLevel.js',
  './ui/components/otherPlayersHealth.js',
  './ui/components/mobileCooldowns.js',
  './ui/components/spectatorIndicator.js',
  './ui/components/toast.js',
  './js/audio.js',
  './js/music-manager.js',
  './js/utils.js',
  './js/biomes.js',
  './js/room-layout-generator.js',
  './js/projectiles-util.js',
  './js/render.js',
  './js/touch-controls.js',
  './js/device-detection.js',
  './js/input.js',
  './ui/core/controllerNavigation.js',
  './js/gear.js',
  './js/loot-selection.js',
  './ui/components/gearTooltip.js',
  './js/items/item-definitions.js',
  './js/items/item-manager.js',
  './js/items/item-ground.js',
  './js/items/item-pylon.js',
  './js/items/item-effects.js',
  './js/items/item-visuals.js',
  './js/impulse-physics.js',
  './js/players/player-base.js',
  './js/players/player-warrior.js',
  './js/players/player-rogue.js',
  './js/players/player-tank.js',
  './js/players/player-mage.js',
  './js/enemies/telegraph/telegraph-manager.js',
  './js/voxel-fracture.js',
  './js/enemies/enemy-base.js',
  './js/enemies/biome-enemy-mods.js',
  './js/enemies/elite-enemy-affixes.js',
  './js/enemies/enemy-index-catalog.js',
  './js/enemies/enemy-basic.js',
  './js/enemies/enemy-star.js',
  './js/enemies/enemy-diamond.js',
  './js/enemies/enemy-rectangle.js',
  './js/enemies/enemy-octagon.js',
  './js/bosses/hazards.js',
  './js/bosses/boss-base.js',
  './js/combat-scaling.js',
  './js/combat-economy.js',
  './js/bosses/boss-scaling.js',
  './js/bosses/pheromone-polyline.js',
  './js/bosses/boss-swarmking.js',
  './js/bosses/boss-twinprism.js',
  './js/bosses/boss-fortress.js',
  './js/bosses/boss-fractalcore.js',
  './js/bosses/boss-vortex.js',
  './js/level.js',
  './js/combat.js',
  './js/ui.js',
  './js/run-profiler.js',
  './js/debug.js',
  './js/save.js',
  './js/feats-registry.js',
  './js/ledger-manager.js',
  './js/run-checkpoint.js',
  './js/coach-transition.js',
  './js/onboarding.js',
  './js/feature-tutorials.js',
  './js/room0-tutorial.js',
  './js/version.js',
  './js/mp-config.js',
  './js/telemetry.js',
  './js/interpolation.js',
  './js/nexus.js',
  './js/main.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== SHELL_CACHE && key !== RUNTIME_CACHE)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim()).then(() => {
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

  const basePath = (config.settings && config.settings.basePath) || 'audio/';
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
    const response = await fetch('./audio/music-config.json', { credentials: 'same-origin' });
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

  event.respondWith(cacheFirstShell(request));
});

async function networkFirstNavigation(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.ok) {
      const cache = await caches.open(SHELL_CACHE);
      cache.put('./index.html', networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    const cached = await caches.match('./index.html') || await caches.match('./');
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
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    return caches.match('./index.html');
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
    cache.put(request, networkResponse.clone());
  }
  return networkResponse;
}

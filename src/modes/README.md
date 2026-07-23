# Game modes (Creative Islands)

Modes consume Shape Slayer packages from [`src/game/`](../game/). They do not reimplement engine primitives or invent a second render loop.

```text
browser APIs  <-  src/engine  <-  src/game (HOW)  <-  src/modes/<id> (WHY)
```

## Island = packages + ModeProfile + Rules

```js
Modes['surge-arena'] = {
  id: 'surge-arena',
  packages: [/* GamePackages ids */],
  Rules: SurgeArenaRules,  // GameBus listeners (teardown via PlayingHost)
  createSession() { /* takeover + PlayingHost.begin(profile, rules) */ }
};
```

| Layer | Responsibility |
| --- | --- |
| Packages | Emit discrete facts; expose verbs (grant XP, open doors, regenerate room) |
| Profile | Config flags (`hud: 'gear'`, `room.advance: false`) |
| Rules | Decide meaning of events (Gear XP + door advance vs sandbox respawn + endSession) |

[`GameBus`](../game/game-bus.js) is synchronous and discrete-only — never emit per-frame damage ticks. `Rules.attach(bus)` must return a teardown; [`PlayingHost`](../game/playing-host.js) enforces it on Island end.

## Host

[`src/app/host.js`](../app/host.js) boots the **roguelike shell**. Other Islands use `AppHost.launchSession(id)`. `sandbox.html` redirects to `index.html?mode=sandbox`.

## Modes

| Id | Island meaning |
| --- | --- |
| `roguelike` | Full Gear run — XP/loot, doors, room advance, Nexus return |
| `surge-arena` | Arena waves on a persistent complex layout; XP/time spawn budgets + kill combo volatility; clear → waiting-for-trigger pylon; every 5th wave is a hard surge (hordes then boss(es)); upgrade machines unlock only in post-surge downtime behind `GameBarriers` |
| `sandbox` | Blank-slate mechanical test bed (not Nexus-selectable); no arena pacing |

Reusable game-layer pieces for arenas: [`barriers.js`](../game/simulation/barriers.js) (conditional solid gates), [`wave-director.js`](../game/simulation/wave-director.js) (spend Modes-supplied spawn budget), [`arena-mode.js`](../game/simulation/arena-mode.js) (stadium layout, wave spawn, hard surges).

Add a mode: `src/modes/<id>/{mode,rules}.js`, register on `Modes` + `GameModeCatalog`, list scripts in `index.html` / `sw.js`.

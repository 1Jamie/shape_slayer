# shape_slayer - Ending Design Document
## Version 1.0 | 2026-06-29

---

## I. DESIGN PHILOSOPHY

### Core Thesis
The player is not the hero resisting order. The player is the final optimization - the last shape that still believes it chooses. Every run, every upgrade, every card collected is a step toward geometric perfection. The game does not tell the player this. The game makes them feel it through the engine itself.

### The Anti-Kingdom Hearts Principle
Square Enix intros use fluidity, boundless depth, and soft fades to create dreamlike immersion. shape_slayer inverts every element:

| Dream (Kingdom Hearts) | Order (shape_slayer) |
|------------------------|----------------------|
| Fluid motion | Grid-snapped instant placement |
| Boundless depth | Collapsing margins, constricting composition |
| Soft fades | Hard cuts, zero alpha transitions |
| Infinite skies | Tightening boxes, measurable coordinates |
| Hope | Absolute, patient tragedy |

### Emotional Target
The ending should make the player feel the existential dread of being a ghost haunting a perfectly optimized machine - then realize they *are* the machine. The hurt is earned because it is true. The player optimized themselves into this.

---

## II. BASE ENDING
### Trigger: First final boss clear (any difficulty, any build)

### Sequence

#### Phase 1: The Quote (Staccato Typography)
- **Screen:** Pure black, no fade-in
- **Font:** Monospace, sterile, geometrically precise
- **Behavior:** Text snaps to invisible grid instantly - no drift, no easing
- **Cursor:** Solid block `_`, does not blink, holds space without life
- **Cadence:** Brutal mechanical chunks, not smooth character-by-character

**Text display:**
```
"We are here now."

"No one wanted this."

"Just order."

"But now we are all slaves to the order."

"Forever."
```

- Each line appears as a complete chunk
- Pause between lines: 1.5 seconds
- The block cursor hardens into a dead pixel when each line completes

#### Phase 2: The Silence
- **Duration:** 5 seconds pure black
- **Audio:** Single held note decaying to absolute zero, or true silence
- **No input response:** All controls disabled

#### Phase 3: Quiet Credits
- **Format:** Small text, slow scroll, bottom-aligned
- **Content:**
  - Music: [attribution]
  - Everything else: [developer name]
  - Thanks: [acknowledgments]
- **No fanfare, no music, no celebration**

#### Phase 4: Dev Note
- **Position:** Centered, below credits
- **Format:** Italic, slightly smaller than credits

```
"Uniqueness is where we shine and is the destination.
Don't let it go out."
```

#### Phase 5: Return
- **Fade to:** Nexus (not title screen)
- **State:** Loop continues, unchanged
- **The player may continue playing, unaware of what waits

---

## III. SPECIAL ENDING
### Trigger: Final Shape Memory story card at maximum level (Level 5) AND first clear already achieved

### Final Shape Memory Unlock Pacing

The Final Shape Memory card is non-mechanical. It is not a deck card, not a boss-power card, and not a stat reward. It is a story-only archive entry with `value: 0` and no gameplay effect.

This is the psychological lock on the special ending: the player must choose memory over optimization. Spending shards and attention on this card is an act of inefficiency inside a game about becoming efficient.

**Presentation:**
- On first final boss clear, use the same sterile toast style as other boss-card acquisition: `New Boss Card Added`
- Do not use unique music, emotional framing, special color, or a lore callout in the toast
- The system does not understand that it has filed an apology; it only knows a new boss card exists
- In the Nexus, the card appears in the Memory Archive, not the deck builder
- It can be upgraded/read there, but it cannot enter decks, hands, rewards, packs, or combinations

**Clear-count gates + shard investment:**
- Final boss clears unlock how far the story-only card may be upgraded
- Shards must still be spent in the Nexus Memory Archive to actually raise mastery and reveal lines
- This prevents the third clear from triggering the Special Ending before the player has returned to the Nexus and read the final apology fragments

**Pacing:**
- **Final Boss Clear 1:** Base Ending. Adds Final Shape Memory to the archive and unlocks upgrade access through M1
  - Toast: `New Boss Card Added`
  - Available reveal after Nexus investment: "I gave you your shapes so you could survive." / "I only wanted you to be safe."
- **Final Boss Clear 2:** Archive update. Unlocks upgrade access through M3
  - Toast: `Archive Entry Updated` or the same sterile `New Boss Card Added` style if consistency is preferred
  - Available reveal after Nexus investment: "I did not know the order would take them, or that you would forget me." / "I did not know I would become the shape that waited at the end of every run."
- **Final Boss Clear 3:** Archive update. Unlocks upgrade access through M5
  - Toast: `Archive Entry Updated`
  - Available reveal after Nexus investment: "I am sorry." / "Please remember yourselves."
- **After Clear 3:** The player must return to the Nexus and spend shards to bring Final Shape Memory to M5
- **Special Ending Arm:** The Special Ending is armed only after Final Shape Memory is both fully unlocked by clear count and fully mastered through shard investment
- **Special Ending Delivery:** The Special Ending triggers on the next final boss clear after the M5 archive investment has been completed

The repeated clears matter because the player is executing the entity trying to apologize in order to gain access to the rest of the apology. The shard investment matters because the player then chooses the value-0 memory over mechanical optimization. The truth requires both acts.

### Sequence

#### Phase 1: The Quote (Identical to Base)
Same staccato delivery, same grid snap, same cadence.

```
"We are here now."

"No one wanted this."

"Just order."

"But now we are all slaves to the order."

"Forever."
```

**Difference:** The pause after "Forever" is longer - 10 seconds. The player must sit with it.

#### Phase 2: The Struggling Lights

**Visual System:**
- Spawn: Single point of light, non-geometric, trembling
- Render method: `ctx.bezierCurveTo()` with chaotic sine-wave oscillation on control points
- Appearance: Liquid trying to form - asymmetrical, desperate, almost familiar (hand, face, gesture)

**The Snap (Frame-by-frame):**
1. **Frame 1-12:** Bézier curves oscillate, reach toward organic form
2. **Frame 13-16:** Control points stretch, tear at integer boundary
3. **Frame 17:** Violent override - all control points snap to strict integers
4. **Result:** Fluid shape collapses into perfect dead geometry (circle, square, triangle)

**Audio System:**
- Struggle: Low, organic, analog hum
- Snap: Cut to absolute zero
- Enhancement: Single frame of digital noise after cut (audio equivalent of unprocessed thought)

**Population:**
- First light: center screen
- Second light: offset, same struggle
- Escalation: 10 lights, then 100
- Final formation: Violent symmetrical snap into mandala pattern
  - The mandala IS the index grid layout
  - Same categories, same empty slots
  - The system organizes its own grief

**The shapes that almost remembered:**
- A wave frozen flat
- A song flattened to tone
- A touch becoming a point
- Each one mid-gesture, mid-name, mid-being

#### Phase 3: The One That Doesn't Snap

**Behavior:**
- Flickers. Holds. Flickers again.
- For one moment: clear, stable, real

**Memory Text (not spoken - displayed):**
```
"Before the order, we named ourselves."

"The Swarm King was a garden."

"The Prism was a dawn."

"The Fortress was a city of doors."

"The Carrier used to sing."

"And you -"
```

**The Reveal:**
- The shape strains against order
- For one moment, shows the player shape from Room 1
- But geometrically perfect: edges sharp, color muted, motionless

**The Truth:**
```
"You were the first to reach for order."

"To keep yourself alive."

"To make the chaos survivable."

"I am what you made."

"What you will make."

"What you are making."
```

**The Snap:**
- Shape collapses to final boss form
- The circle. The void. The order complete.

#### Phase 4: The Confession

**3 seconds pure black.**

```
"Every run, you come closer."

"Every upgrade, you simplify."

"Every card, you catalog yourself."

"I wait at the end because you are walking toward me."
```

#### Phase 5: The Permission

**Longer beat. The player sits with complicity.**

```
"You almost knew me."

"You almost knew yourself."
```

**30 seconds of absolute nothing.**
- Runtime constraint: the render loop must continue ticking during this silence. Do not block the main thread, stall requestAnimationFrame, or loop an inaudible buffer in a way that could trigger browser/OS "application not responding" behavior.
- The game must appear alive but unresponsive: no UI, no prompt, no cursor, no input effect, but the process remains healthy.
- Playtest target: some players close immediately, some wait 10 seconds and suspect a crash, and the intended audience waits through the full silence before choosing to close the application themselves.

**Then, smaller than everything before:**
- Presentation constraint: this line must sit completely alone with maximum negative space. No cursor, border, subtitle, prompt, button, or nearby UI. The emptier the screen around it, the heavier it lands.
```
"You may stop now."
```

#### Phase 6: The Hold

- **No prompt. No menu. No cursor.**
- **All inputs disabled.**
- **The game waits.**
- **The player must actively close the application.**
- **The act of closing becomes the final command the system demands.**
- **Hardware constraint:** If OS-level close is unavailable, the engine accepts only a silent hold-to-exit trapdoor: hold Escape, or Start + Select on gamepad, for 5 unbroken seconds. No prompt, progress bar, sound, or confirmation. The process ends instantly and cleanly.

**Enhancement - The Living Freeze:**
- Player may initially believe the game crashed
- Press buttons: no response
- Wiggle stick: no response
- Then: player shape from Room 1 (rough, colored) translates for 3 to 5 frames every 4 seconds, then snaps back through the same harsh decay used for input echoes
- The pulse interval slowly stretches the longer the hold continues: 4 seconds at first, then drifting toward 8-10 seconds
- The change should be subtle enough to feel like dread before it feels measurable, as if the system is losing power or losing interest now that the truth has been seen
- Proof the engine lives. Proof the player is still being rendered.
- The realization: the system is waiting. The player must choose to end it.

---

## IV. THE ADAPTING TITLE SCREEN
### System: Persistent Erosion Across Sessions

### Philosophy
Every completed run reminds the title screen: everyone lost in the end. The change is so gradual most won't notice. The ones who do will never unsee it.

### Technical Implementation

**Base State (First Launch):**
- Player shape: Rough square, vibrant color, slight asymmetry
- Background: Dark, subtle procedural variation
- Permanent scar: One corrupted pixel baked into the title background clear at a fixed, easily overlooked corner coordinate
- Title text: Clean, present
- Overall impression: Alive, inviting, playable

**Erosion Table:**

| Completed Runs | Visual Change | Player Experience |
|----------------|---------------|-------------------|
| 0 | Original, vibrant, but already scarred by the hidden corrupted pixel | First impression, almost pure |
| 5 | One edge slightly sharper | Subtle wrongness, unplaceable |
| 10 | Color muted by ~3% | Nostalgia for something they can't identify |
| 20 | Corners more defined, less rounded | The shape is cleaner, more efficient, more dead |
| 35 | Second edge sharpens | By run 30-40, the title screen should feel wrong even if the player cannot prove why |
| 50 | Nearly geometric perfection | The player is implicated. They kept completing the loop. |
| 75 | Color approaches monochrome | By run 70+, the title screen feels like the corpse of the game they fell in love with |
| 100+ | Indistinguishable from final boss form | The loop is complete. They became what they fought. |

**Technical Details:**
- Erosion state stored separately from ordinary save data
- Incremented only when a run ends through a win or a death
- Changes are mathematically precise, not random
- Each change is irreversible
- No UI indicates this system exists
- No achievement tracks it
- No explanation is ever given
- Clearing normal save data should reset progress, unlocks, and settings, but not the erosion counter
- After the special ending, the next title load applies a noticeable one-time erosion jump
- The special-ending jump should not announce itself; players should feel that something irreversible followed them back to the title screen
- After the special ending, the title text mutates from `shape_slayer` to `shape, slayer`
- The comma mutation happens on the next launch only after the special ending state is persisted
- The mutation must be instant and unanimated: one render it is the underscore, the next render it is the comma
- It should read like a system bug or corrupted title parse, not like a joke, wink, or authored gag

**Serialization Boundary:**
- Treat erosion as profile metadata, not save-slot data
- Browser build: store under a dedicated localStorage key outside the normal save JSON, e.g. `shape_slayer.meta.erosionRuns`
- Native/custom shell build: store in the platform config/profile directory, separate from exported saves and save-slot deletion
- Save import/export must not include this counter
- Only a full application data wipe, browser site-data clear, or uninstall should remove it

**The Complication:**
- If player uninstalls or wipes all application data: title screen is clean again except for the scar
- The single corrupted pixel is not a flash. It is hardcoded into the base title background clear at a fixed coordinate
- Proof the system was never perfectly clean, even before the player understood what it was doing
- It does not animate, announce itself, or disappear
- Only comparison screenshots or extreme attention catches it
- Visibility test: if a player can reliably notice the pixel during normal play without being told, it is too prominent
- Screenshot test: if the pixel cannot be found in a still screenshot by someone actively searching, it is too subtle
- Target: invisible in play, findable in evidence

### Player Color Erosion

The title screen is not the only thing degrading. The player shape itself slowly loses vibrancy across completed runs, as if the order is reaching the body that keeps surviving.

**Core Rule:**
- Only the player ship/body color erodes
- Projectiles, effects, UI, enemies, cards, and backgrounds stay vibrant
- Combat readability must remain intact
- No UI indicator, notification, achievement, tooltip, accessibility label, or settings callout reveals this system

**Visual Curve:**

| Completed Runs | Player Color State | Player Experience |
|----------------|--------------------|-------------------|
| 0-10 | 100% saturation and full neon vibrancy | The player looks normal, alive, arcade-bright |
| 15-25 | -3% to -8% saturation | Almost imperceptible; maybe the screen feels slightly tired |
| 35-50 | -15% to -25% saturation | Screenshot comparisons start to reveal the loss |
| 70+ | -40% to -60% saturation, shifted toward cool gray-blue | The player feels deadened beside still-vibrant enemies and effects |

**Implementation Notes:**
- Use a very slow, gentle curve such as logarithmic or eased progression
- Store the erosion factor in profile metadata, separate from normal save-slot data
- Apply in the player render/tint path, e.g. `playerColor = desaturate(baseColor, erosionFactor * 0.6)`
- Add a slight value/brightness drop and tiny hue drift toward cooler tones: cyan → teal → gray-blue
- After the special ending, accelerate future player-color erosion by roughly 10-15%
- The acceleration should not jump the color immediately; it only changes the slope from that point forward
- Preserve a strong faint outline or glow so the player remains readable at all times
- Never allow full grayscale; the player should look exhausted, not invisible
- Changes only apply between completed runs, never during a room
- Reset only through full application/site-data wipe, matching title screen erosion behavior

**Screenshot Effect:**
- During active play, the change should feel easy to dismiss as monitor settings, fatigue, or a graphics bug
- In side-by-side screenshots, the desaturation should be obvious
- The realization should land quietly: the player was eroding too

**Community Effect:**
- Players who discover this will post comparison screenshots
- "Run 0 vs Run 50" becomes memorial documentation
- The community catalogs their own erosion
- The game doesn't tell them they've lost - they tell each other

---

## V. AUDIO SPECIFICATION

### Base Ending
- Quote delivery: Silence or single drone tone
- Between lines: Absolute silence
- Credits: No music, ambient void
- Dev note: Same

### Special Ending
- Struggle phase: Low analog hum, synthesized, organic
- Snap: Hard cut to digital noise (1 frame) then absolute zero
- Memory text: No audio, or very faint corrupted data static
- Final confession: Silence
- "You may stop now": Whispered, barely audible, synthesized from player action sounds across all sessions
- The Hold: True silence, or the 4-second player shape pulse with no audio

### Title Screen Erosion
- Run 0: Full procedural ambient score
- Run 10+: Subtle high-frequency tone introduced, barely perceptible
- After special ending: Main menu music immediately loses one noticeable layer on next launch
- Every 10-15 completed runs after the special ending: Main menu music loses another layer
- Run 50+: Ambient score simplified, fewer layers
- Run 100+: Single drone tone, or silence
- The audio erosion mirrors the visual erosion
- No sting, unlock sound, or fanfare should accompany audio loss

---

## VI. INPUT BEHAVIOR

### Base Ending
- All inputs disabled during quote and silence
- Re-enabled upon return to Nexus

### Special Ending
- All inputs disabled from "Forever" through "You may stop now"
- During The Hold: inputs echo but do not execute
  - Press movement key: player shape translates in that direction and persists for 3 to 5 frames
  - The offset decays harshly back to center with an exponential curve over roughly 50-80ms
  - System acknowledges attempt, denies it, catalogs resistance
- During the passive Living Freeze pulse, the autonomous pulse interval starts near 4 seconds and slowly stretches toward 8-10 seconds
- The slowdown is never surfaced in UI; it should feel like a dying heartbeat or a system losing interest
- The intended exit is OS-level close (Alt+F4, window X, task kill)
- On hardware without practical OS-level close, the only accepted in-engine command is a 5-second uninterrupted Escape hold or Start + Select hold
- The close command is the only input the system accepts, whether delivered by the OS or the silent trapdoor

---

## VII. RENDERER NOTES (Canvas 2D)

### Typography
- Use monospace font loaded as data URI or system fallback
- No anti-aliasing smoothing on text (if possible) - hard pixel edges
- Grid snap: `Math.round(x / gridSize) * gridSize` for all text positions
- Cursor: drawn as filled rect, not text character

### Bézier Struggle
```javascript
// Pseudocode for struggle-to-snap
function renderStrugglingShape(progress) {
    if (progress < 0.8) {
        // Organic phase
        const chaos = Math.sin(time * freq) * amplitude;
        cp1.x = baseCp1.x + chaos;
        cp1.y = baseCp1.y + chaos * 0.7;
        // ... etc
        ctx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, end.x, end.y);
    } else if (progress < 1.0) {
        // Tear phase - control points stretch toward integers
        cp1.x = lerp(cp1.x, Math.round(cp1.x), tearProgress);
        // ... etc
    } else {
        // Snap - instant integer conversion
        cp1.x = Math.round(cp1.x);
        cp1.y = Math.round(cp1.y);
        // Render final geometric shape
    }
}
```

### Mandala Formation
- Struggling shapes populate randomly first
- Over 2 seconds, lerp positions toward symmetrical grid
- Final formation: index grid layout, exact proportions
- Snap is visible - player watches organization consume chaos

### Margin Constriction
- Render boundary rectangle, initially full screen
- Over 10 seconds, shrink inward by 2% per second
- Grid coordinates visible at edges during constriction
- Final margin: exact dimensions of player shape from Room 1
- The system cannot compress further without erasing the player

---

## VIII. EMOTIONAL SAFETY

### The Game is Free
- GitHub Pages version ensures no financial hostage
- Players can walk away, process, return
- The Steam version is a choice, not a trap

### The Game Outlives Platforms
- OSS codebase means the game persists
- No single point of corporate failure
- The memorial is community-maintained

### The Hurt is Earned
- Not manipulation, cheap twists, or nihilism without purpose
- The player recognizes themselves in the loop
- The recognition is true, therefore the hurt is true

---

## IX. CARD MEMORY ARCHIVE

### System: Cards as Recoverable Memory

The card system is not separate from the ending. It is the slow version of the same truth. Every card begins as a function, then becomes a voice. Mastery is not only power progression; it is memory recovery.

### Core Emotional Rule

The player can complete the record. They cannot complete the world.

Mastery recovers testimony, not repair. The game may use completion language because it is still a system, but the writing must deny resurrection. A completed memory should feel like a grave marker finally labeled, not a person restored.

The correct player arc:
- Early: "I am restoring this."
- Middle: "I am learning what was taken."
- Late: "I am reading what survived."
- Complete: "I found the shape of an absence."

The archive's final promise is not salvation. It is witness.

### Narrative Rule

- **White:** Functional, sterile, almost purely mechanical
- **Green:** Slightly evocative, but still safe to read as flavor
- **Blue:** Poetic hints begin to leak through
- **Purple:** Memory breaks the system's vocabulary
- **Orange:** Full revelation. The card remembers what it was before order

The player should be able to read a mastered card top to bottom and find a complete small story. Each mastery upgrade reveals the next line. At Mastery 5, the card becomes a memorial.

### Card Art Progression

- **White / Green:** Clean, vibrant, almost cheerful geometric icons. The card should still look like a usable game object, not a grave marker.
- **Blue:** Mostly clean, but with subtle visual tension: slightly sharper edges, faint misalignment, or a barely visible scar in the icon geometry.
- **Purple / Orange:** Worn, cracked, or bleeding at the edges. The memory is breaking through the system's clean presentation.
- **Orange:** The art should feel complete but damaged: readable as a full identity, not restored to life.

### M0-M5 Emotional Arc

- **M0 / Sensory:** One physical detail. Wind, ash, wet stone, warm bread, bowstring, oil, grass, blood, bells.
- **M1 / Role:** The card becomes a person, craft, place, or social role.
- **M2 / Conflict:** The order's accusation: wasteful, redundant, unstable, slow, sentimental, imprecise.
- **M3 / Value:** Why the "flaw" mattered. This is the grief line.
- **M4 / Conversion:** How the order translated the memory into mechanics.
- **M5 / Testimony:** Name, vow, apology, or final human truth.

M2 should often sound like the order intruding into the memory. M5 should never say "fixed." It should say, directly or indirectly, "remembered."

### Final Polish Rules

**M2 Intrusions:** The order's voice is clinical, not hateful. It does not accuse people of being bad because it does not perceive people as people. It reports faults, inefficiencies, unstable patterns, failed synchronization, invalid variance, and unacceptable delay.

Good M2 examples:
- "Unstable rhythm detected: synchronization failed."
- "Sentimental delay exceeded acceptable threshold."
- "Redundant bodies detected in projectile path."
- "Doorway variance compromised structural integrity."

Avoid M2 language that sounds moral, emotional, or personally cruel. The horror is that the order is not angry. It is diagnostic.

**Curse Injury Consistency:** Curse corruption should usually damage the M2 / M3 conflict-value section of the arc. The most painful missing text is the place where the card would have explained why the order was wrong. Let `[CORRUPTED]`, `[DATA MISSING]`, and false replacements sit over the grief line so the player has to infer what was stolen.

**Final Shape Anchor:** The Final Shape Memory is an apology, never a solution. It may confess, name, regret, and ask to be remembered, but it must not offer reversal, rescue, purification, or repair. The player is allowed to see it. The player is not allowed to fix it.

**Complicity Without Malice:** The player is responsible, but not villainous. The tragedy is not that they chose evil; it is that they kept choosing reasonable survivals until the soft parts were gone. Optimization should feel like a chain of understandable compromises: safer shapes, clearer paths, faster kills, stronger walls. The horror lands when the player realizes they participated in erasure while trying to endure.

**Theft vs. Exploitation:** Not every card memory begins whole. Some memories are living practices the order steals and weaponizes: songs, doors, gardens, hearths, markets. Others are survival-coping behaviors the order finds already wounded and turns into stats: leaving rooms quietly, phasing through grief, moving too fast to feel fear, enduring pain because there was no other choice. Keep the distinction visible. Theft should feel like something alive was taken. Exploitation should feel like the order found a wound and made it useful.

**M3 Human Value:** The grief line should always name what was actually worth protecting. Prefer concrete human values over abstract tragedy: connection, gentleness, meaning through imperfection, and witnessing each other. The order can call these inefficient, but the memory must show why real people needed them.

### Voice Split

**System Voice:**
- Used for stat descriptions, card effects, UI labels, and completion state
- Dry, exact, mechanical
- Example: `+5% crit chance`
- Example: `Memory Complete`
- Example: `Index Consistency Improved`

**Memory Voice:**
- Used only for `memoryFragments` and `legendaryFlavor`
- Sensory, embodied, human
- Simple concrete nouns over abstract lore terms
- Never explains mechanics when it can remember a touch, a road, a name, or a loss

The player should learn without being told: system text is order, memory text is self.

### Completion Language

Use sterile UI labels against the memory text:
- `Memory Complete`
- `Archive Entry Restored`
- `6/6 Fragments Recovered`
- `Index Consistency Improved`

But the completed memories must undermine the comfort of those labels:
- "Do not mistake this for rescue."
- "You found the shape of my absence."
- "A complete record is not a living hand."
- "Thank you for remembering. I am still gone."

At full index completion, there is no fanfare. Suggested terminal state:
```
ALL KNOWN NAMES RECOVERED
NO RESTORATION AVAILABLE
```

### Card Family Mapping

| Card Family | Pre-Order Identity | Memory Shape |
|-------------|--------------------|--------------|
| Precision | Hunters, aim, leaf-vein exactness | "I was steady once." |
| Bulwark | Mountains, walls, shelters | Protection before it became armor |
| Velocity | Runners, messengers, wind-paths | Motion before it became optimization |
| Volley | Flocks, archers, scattering life | Many bodies moving as one |
| Phoenix Down | Rebirth, cycles, natural return | Death as season, not failure |
| Boss Cards | Named pre-order beings | The boss's lost identity, carried directly |
| Curse Cards | Memories the order corrupted | Redacted, inverted, or rewritten fragments |

### Example: Precision

**Legendary epitaph:**
```
"Before I was a theorem, I was a hunter. I knew where the prey would be."
```

**Full Mastery 5 memory:**
```
"I was steady once.
I held a bow for hours without shaking.
The order said efficiency required sacrifice.
It was wrong. I was already efficient.
They made me a calculation.
But I remember the wind. I remember the aim. I remember the name I had before they called me Precision."
```

The epitaph is what the player quotes. The fragments are what they feel.

### Curse Card Inversion

Curse cards do not recover cleanly. They are the system's version of memory: useful, punitive, and wrong.

Example:
```
"I was steady once. [CORRUPTED]
The order said [CORRUPTED] sacrifice.
[DATA MISSING]"
```

The player understands the lie because mastered non-curse cards taught them what the missing lines should sound like.

### Nexus Index Culmination

The index collects every revealed card fragment in family order. When enough cards are mastered, the index stops being a checklist and becomes an archive of the pre-order world:

- Precision remembers the hunters
- Bulwark remembers the mountains and walls
- Velocity remembers the runners and messengers
- Volley remembers the flocks and archers
- Phoenix Down remembers cyclical return
- Curse cards mark the places where memory was damaged

The final boss card ties the archive together. It is not simply a reward card; it is the apology at the center of the system: an ode to what was, and a sorrow for what remains.

### Nexus Index Format

Each index entry uses the same reveal structure:

- **Pre-Order Identity:** What the card was before order
- **Legendary Epitaph:** The Orange summary line
- **M0 / White:** First visible fragment
- **M1 / Green:** Second fragment
- **M2 / Blue:** Third fragment
- **M3 / Purple:** Fourth fragment
- **M4 / Orange:** First full-revelation fragment
- **M5 / Complete:** Final line; the memory reads cleanly top to bottom
- **Index Note:** Optional cross-reference, contradiction, or archive behavior

Empty fields are intentional writing slots.

Reward pack types such as Standard Pack, Elite Pack, Treasure Pack, and Curse Pack are containers, not memories. They do not receive index entries unless they are later promoted into explicit story-only archive cards.

Locked lines should never display as `???`. The index renders unrevealed memories as solid monochrome blocks (`██████ █████`) or a scrambled cipher font that resolves into readable text when mastery is purchased. The reveal should snap or resolve in-place, not fade.

### Nexus Index: Offense Cards

#### Precision
- **Pre-Order Identity:** Hunters, aim, leaf-vein exactness
- **Legendary Epitaph:** "Before I was a theorem, I was a hunter. I knew where the prey would be."
- **M0 / White:** "I was steady once."
- **M1 / Green:** "I held a bow for hours without shaking."
- **M2 / Blue:** "Precision variance detected: sacrifice recommended."
- **M3 / Purple:** "It was wrong. I was already efficient."
- **M4 / Orange:** "They made me a calculation."
- **M5 / Complete:** "But I remember the wind. I remember the aim. I remember the name I had before they called me Precision."
- **Index Note:** The first recovered hunter memory. Curse variants should visibly corrupt this wording.

#### Fury
- **Pre-Order Identity:** Smiths, firekeepers, grief carried as heat
- **Legendary Epitaph:** "Before I was damage, I was the fire that kept the dead warm."
- **M0 / White:** "I remember soot under my nails."
- **M1 / Green:** "I kept the forge awake when the village slept."
- **M2 / Blue:** "Emotional combustion detected: output unstable."
- **M3 / Purple:** "But grief was how we knew what still deserved protecting."
- **M4 / Orange:** "They kept the heat and pointed it outward."
- **M5 / Complete:** "My name was not Fury. It was the bell we rang after every burial."
- **Index Note:** Fury should not read as anger alone. It is mourning converted into weapon output.

#### Momentum
- **Pre-Order Identity:** Drum runners, pursuit songs, communal rhythm
- **Legendary Epitaph:** "Before I was acceleration, I was the drumbeat that told tired feet they were still together."
- **M0 / White:** "I remember the drum in my ribs."
- **M1 / Green:** "We ran messages in relays, passing breath before passing words."
- **M2 / Blue:** "Relay interruption detected: rest reduced throughput."
- **M3 / Purple:** "But rest was where the next runner caught the rhythm and became part of us."
- **M4 / Orange:** "They kept the speed and deleted the shared breath."
- **M5 / Complete:** "If you hear me building, listen for the feet beside mine."
- **Index Note:** Momentum bridges offense and team memory. It should imply relay, not solo efficiency.

#### Volley
- **Pre-Order Identity:** Flocks, archers, scattering life
- **Legendary Epitaph:** "Before I was a spread pattern, I was the sky deciding not to break apart."
- **M0 / White:** "I remember feathers crossing the sun."
- **M1 / Green:** "We loosed arrows by listening for each other's breath."
- **M2 / Blue:** "Redundant bodies detected in projectile path."
- **M3 / Purple:** "But no wing survived by flying alone."
- **M4 / Orange:** "They kept the many and erased the flock."
- **M5 / Complete:** "My name was a direction shouted upward, and every voice answered."
- **Index Note:** Should remember many bodies moving as one before the system names that pattern "multishot."

#### Execute
- **Pre-Order Identity:** Death midwives, mercy-givers, keepers of clean endings
- **Legendary Epitaph:** "Before I was a threshold, I was the hand that stayed when pain had become enough."
- **M0 / White:** "I remember warm fingers loosening around mine."
- **M1 / Green:** "They called for me when breath became work and the room needed gentleness."
- **M2 / Blue:** "Terminal-state delay exceeded acceptable threshold."
- **M3 / Purple:** "But mercy was not speed. Mercy was staying until fear no longer had to be held alone."
- **M4 / Orange:** "They kept the ending and removed the witness."
- **M5 / Complete:** "My name was not Execute. It was Enough."
- **Index Note:** This card must feel morally complicated: ending as mercy before the order reduces it to a kill condition.

#### Fractal Conduit
- **Pre-Order Identity:** Signal relays, storm-callers, operators patching calls across distance
- **Legendary Epitaph:** "Before I was a chain, I was the voice that crossed the hill and came back answered."
- **M0 / White:** "I remember thunder counting the seconds between us."
- **M1 / Green:** "We sent news by light, bell, wire, and weather."
- **M2 / Blue:** "Recursive contact detected: message path inefficient."
- **M3 / Purple:** "But the answer mattered more than the shortest route."
- **M4 / Orange:** "They kept the jump and deleted the reply."
- **M5 / Complete:** "If I reach another body now, it is because I once missed someone."
- **Index Note:** Chains should feel like communication stripped into damage routing. Conduit is the path between people; the Carrier is the station that used to carry their voices, now carrying the order's own commands instead.

#### Detonating Vertex
- **Pre-Order Identity:** Seed-bursters, miners, festival fire, creation through rupture
- **Legendary Epitaph:** "Before I was an explosion, I was the seed breaking itself open to become more than seed."
- **M0 / White:** "I remember shells cracking in warm dirt."
- **M1 / Green:** "We split stone, bread, seed, and silence when something inside needed out."
- **M2 / Blue:** "Containment failure detected at growth boundary."
- **M3 / Purple:** "But some things only lived because they broke."
- **M4 / Orange:** "They kept the rupture and removed the birth."
- **M5 / Complete:** "Do not mistake every breaking for destruction."
- **Index Note:** This card should make explosions feel like corrupted emergence.

#### Overcharge
- **Pre-Order Identity:** Hearth-engineers, lightning keepers, stored impossible light
- **Legendary Epitaph:** "Before I was burst damage, I was the lamp left burning because someone had not come home yet."
- **M0 / White:** "I remember blue light under copper wire after midnight."
- **M1 / Green:** "We learned to hold lightning gently enough to wait by."
- **M2 / Blue:** "Excess charge detected: discharge interval optimized."
- **M3 / Purple:** "But stored light was a promise: the door would still be visible when they returned."
- **M4 / Orange:** "They kept the surge and deleted the lamp."
- **M5 / Complete:** "I was made to guide someone home, not blind them."
- **Index Note:** Overcharge should carry warmth first, violence second.

### Nexus Index: Defense Cards

#### Bulwark
- **Pre-Order Identity:** Mountains, walls, shelters
- **Legendary Epitaph:** "Before I was armor, I was the wall with a door in it."
- **M0 / White:** "I remember stone holding the day's heat."
- **M1 / Green:** "We built walls so children could sleep without counting footsteps."
- **M2 / Blue:** "Doorway variance compromised structural integrity."
- **M3 / Purple:** "But a wall without a door is not shelter. It is a cell."
- **M4 / Orange:** "They kept the resistance and sealed the entrance."
- **M5 / Complete:** "My name was Home, before they called me Bulwark."
- **Index Note:** Should remember protection before it became armor.

#### Lifeline
- **Pre-Order Identity:** Healers, river-blood, hand-to-hand survival
- **Legendary Epitaph:** "Before I was sustain, I was the hand pressed over the wound."
- **M0 / White:** "I remember water pink with blood."
- **M1 / Green:** "I learned which leaves closed skin and which songs slowed panic."
- **M2 / Blue:** "Pain signal classified as inefficient feedback."
- **M3 / Purple:** "But pain told us where the living still needed us."
- **M4 / Orange:** "They kept the transfer and removed the touch."
- **M5 / Complete:** "Do not call this healing. Healing required someone to stay and bleed with you."
- **Index Note:** Lifeline should make lifesteal feel morally colder after the memory is known.

#### Fortify Aura
- **Pre-Order Identity:** Hearth circles, watchfires, safety by proximity
- **Legendary Epitaph:** "Before I was an aura, I was the circle no one had to stand outside."
- **M0 / White:** "I remember smoke in everyone's hair."
- **M1 / Green:** "We moved closer when the night grew teeth."
- **M2 / Blue:** "Protective overlap detected: resource distribution suboptimal."
- **M3 / Purple:** "But closeness was how fear became smaller than the fire."
- **M4 / Orange:** "They kept the radius and removed the welcome."
- **M5 / Complete:** "My boundary was never meant to exclude."
- **Index Note:** Fortify Aura should be community shelter before it becomes a stat field.

#### Phase Step
- **Pre-Order Identity:** Threshold dancers, leavers, people who knew when to move
- **Legendary Epitaph:** "Before I was evasion, I was the step that left before harm learned my name."
- **M0 / White:** "I remember floorboards cold under one foot."
- **M1 / Green:** "We taught children how to leave a room without waking violence."
- **M2 / Blue:** "Position discontinuity detected: path record incomplete."
- **M3 / Purple:** "But escape was not absence. Escape was survival arriving early."
- **M4 / Orange:** "They kept the displacement and deleted the warning."
- **M5 / Complete:** "I left because I wanted to live."
- **Index Note:** Phase Step should be compassionate: movement as learned safety, not cowardice.

#### Phasing
- **Pre-Order Identity:** Mist-walkers, mourners, half-present survivors
- **Legendary Epitaph:** "Before I was intangibility, I was the person grief could not fully keep."
- **M0 / White:** "I remember fog through my sleeves."
- **M1 / Green:** "After the fires, some of us moved like we were asking permission to remain."
- **M2 / Blue:** "Body-state inconsistency detected: collision unreliable."
- **M3 / Purple:** "But being half here was still being here."
- **M4 / Orange:** "They kept the passing-through and removed the mourning."
- **M5 / Complete:** "If I flicker, do not call me gone."
- **Index Note:** Phasing should speak to dissociation and survival without overexplaining either.

#### Prism Shield
- **Pre-Order Identity:** Mirrors, dawnlight, shared reflection
- **Legendary Epitaph:** "Before I was reflection, I was the morning teaching every face it was real."
- **M0 / White:** "I remember light breaking on water."
- **M1 / Green:** "We polished mirrors for the grieving, so they could see they still had bodies."
- **M2 / Blue:** "Incoming harm detected: return vector available."
- **M3 / Purple:** "But reflection was not revenge. It was proof that something stood before the blow."
- **M4 / Orange:** "They kept the return and removed the recognition."
- **M5 / Complete:** "I showed you yourself before I ever showed you your enemy."
- **Index Note:** Can echo Twin Prism's lost dawn identity without fully revealing boss lore.

#### Phoenix Down
- **Pre-Order Identity:** Rebirth, cycles, natural return
- **Legendary Epitaph:** "Before I was a second chance, I was the season that returned without asking permission."
- **M0 / White:** "I remember ash beneath new grass."
- **M1 / Green:** "We buried seeds with the dead and waited."
- **M2 / Blue:** "Revival delay exceeded acceptable threshold."
- **M3 / Purple:** "But return was not command. It was weather, soil, grief, and time."
- **M4 / Orange:** "They kept the rising and discarded the season."
- **M5 / Complete:** "I came back once. That does not mean I was saved."
- **Index Note:** Orange-only mechanically; the index may still show locked lower slots as "not applicable" rather than hidden.

### Nexus Index: Mobility Cards

#### Velocity
- **Pre-Order Identity:** Runners, messengers, wind-paths
- **Legendary Epitaph:** "Before I was movement speed, I was the road remembering every footstep."
- **M0 / White:** "I remember dust on my ankles."
- **M1 / Green:** "I carried names between houses before the rain could erase the path."
- **M2 / Blue:** "Route deviation detected: distance wasted."
- **M3 / Purple:** "But wandering was how we found who had been left behind."
- **M4 / Orange:** "They kept the distance covered and removed the arrival."
- **M5 / Complete:** "My name was not Velocity. It was Come Home."
- **Index Note:** Should remember movement before optimization.

#### Vector Laminar
- **Pre-Order Identity:** Sailors, gliders, river readers, smooth travel before vector math
- **Legendary Epitaph:** "Before I was projectile speed, I was the current carrying a name downstream."
- **M0 / White:** "I remember reeds bending all the same way."
- **M1 / Green:** "We read water by watching what it spared."
- **M2 / Blue:** "Flow resistance detected: trajectory requires smoothing."
- **M3 / Purple:** "But resistance told us where the river was alive."
- **M4 / Orange:** "They kept the smooth path and removed the shore."
- **M5 / Complete:** "I was not speed. I was passage."
- **Index Note:** Vector Laminar should feel like travel made too clean.

#### Arcane Flow
- **Pre-Order Identity:** Water clocks, breath discipline, time kept by bodies
- **Legendary Epitaph:** "Before I was cooldown reduction, I was breath returning after fear."
- **M0 / White:** "I remember counting heartbeats in the dark."
- **M1 / Green:** "We learned time by breathing together until panic loosened."
- **M2 / Blue:** "Recovery interval too long: cycle compression recommended."
- **M3 / Purple:** "But the pause was where the body asked whether it was safe."
- **M4 / Orange:** "They kept the shorter cycle and removed the breath."
- **M5 / Complete:** "I am not ready faster. I am only interrupted less."
- **Index Note:** Arcane Flow should quietly undermine optimization as forced recovery.

#### Parallelogram Slip
- **Pre-Order Identity:** Acrobats, side-path children, alleys that saved lives
- **Legendary Epitaph:** "Before I was dodge cooldown, I was the alley that knew another way."
- **M0 / White:** "I remember chalk on my palms."
- **M1 / Green:** "We slipped through festival ropes and kitchen doors, laughing before anyone turned."
- **M2 / Blue:** "Unauthorized lateral path detected."
- **M3 / Purple:** "But the side path was how small bodies survived large rules."
- **M4 / Orange:** "They kept the angle and deleted the laughter."
- **M5 / Complete:** "I was never cheating. I was finding room."
- **Index Note:** Should be playful at first, then reveal why play mattered.

### Nexus Index: Ability Mutator Cards

#### Whirlwind Core
- **Pre-Order Identity:** Harvest circles, mill dancers, square-bodied festival turns
- **Legendary Epitaph:** "Before I was area damage, I was the dance that taught the wheat when to fall."
- **M0 / White:** "I remember straw cutting my wrists."
- **M1 / Green:** "We turned in the fields until work became music."
- **M2 / Blue:** "Circular labor pattern detected: excess gesture present."
- **M3 / Purple:** "But the gesture told tired bodies they were not alone."
- **M4 / Orange:** "They kept the rotation and removed the song."
- **M5 / Complete:** "I was not a storm. I was harvest."
- **Index Note:** Square abilities should feel like labor traditions converted into combat geometry.

#### Thrust Focus
- **Pre-Order Identity:** Spear vows, direct promises, lines held without bending
- **Legendary Epitaph:** "Before I was piercing force, I was the promise that went straight where it was needed."
- **M0 / White:** "I remember the shaft smooth from many hands."
- **M1 / Green:** "We trained by pointing at the horizon and naming who we would protect."
- **M2 / Blue:** "Vector deviation detected: vow language irrelevant."
- **M3 / Purple:** "But the vow was what kept the point from becoming cruelty."
- **M4 / Orange:** "They kept the line and removed the promise."
- **M5 / Complete:** "I struck forward because someone stood behind me."
- **Index Note:** Thrust Focus should make directness feel like duty, not aggression.

#### Block Stance
- **Pre-Order Identity:** Door-holders, shield teachers, sacred refusal
- **Legendary Epitaph:** "Before I was mitigation, I was the word no spoken with both feet planted."
- **M0 / White:** "I remember bruises blooming under the shield strap."
- **M1 / Green:** "We taught the young that standing still could be an act of love."
- **M2 / Blue:** "Forward progress halted: stance inefficient."
- **M3 / Purple:** "But not every life is saved by moving."
- **M4 / Orange:** "They kept the stopped damage and deleted the refusal."
- **M5 / Complete:** "No farther. That was my whole name."
- **Index Note:** Block Stance should be one of the clearest examples of protection as moral choice.

#### Fan of Knives+
- **Pre-Order Identity:** Knife-dancers, dangerous beauty, triangle festival performers
- **Legendary Epitaph:** "Before I was blades, I was the gasp before applause."
- **M0 / White:** "I remember oil shining on the knife edge."
- **M1 / Green:** "We threw danger into the air and caught it without drawing blood."
- **M2 / Blue:** "Decorative risk detected: lethal pattern available."
- **M3 / Purple:** "But beauty was how we practiced trust with sharp things."
- **M4 / Orange:** "They kept the knives and removed the applause."
- **M5 / Complete:** "I was not made to hurt you. I was made to make you hold your breath."
- **Index Note:** Triangle abilities should preserve grace and risk before combat utility.

#### Shadow Clone
- **Pre-Order Identity:** Twins, masked theater, identity as multiplicity
- **Legendary Epitaph:** "Before I was a duplicate, I was the mask that let one person contain many."
- **M0 / White:** "I remember paint drying tight on my cheeks."
- **M1 / Green:** "We played the dead, the absent, the wished-for, and the feared."
- **M2 / Blue:** "Identity duplication detected: subject count unstable."
- **M3 / Purple:** "But pretending was how we told the truth safely."
- **M4 / Orange:** "They kept the copy and removed the play."
- **M5 / Complete:** "Every face was mine, and none of them were false."
- **Index Note:** Shadow Clone should be theater and survival before decoy logic.

#### Backstab Edge
- **Pre-Order Identity:** Scouts, spies, quiet survival, betrayal reframed as warning
- **Legendary Epitaph:** "Before I was backstab damage, I was the whisper that reached the village before the army."
- **M0 / White:** "I remember mud drying silently on my knees."
- **M1 / Green:** "I walked behind danger so others could face morning."
- **M2 / Blue:** "Non-frontal engagement detected: honor variable discarded."
- **M3 / Purple:** "But survival did not always have the luxury of being seen."
- **M4 / Orange:** "They kept the angle and deleted the warning."
- **M5 / Complete:** "Call me coward if you must. The children lived."
- **Index Note:** This should invite sympathy where empathy may be harder.

#### Blink Flux
- **Pre-Order Identity:** Star-steppers, hexagon astronomers, folded distance
- **Legendary Epitaph:** "Before I was teleportation, I was the star that made far away feel reachable."
- **M0 / White:** "I remember frost on the observatory rail."
- **M1 / Green:** "We mapped the sky so lost travelers could borrow its certainty."
- **M2 / Blue:** "Distance constraint bypass detected: transit continuity invalid."
- **M3 / Purple:** "But longing has always crossed space faster than the body."
- **M4 / Orange:** "They kept the arrival and deleted the looking up."
- **M5 / Complete:** "I moved because someone far away still mattered."
- **Index Note:** Hexagon abilities can carry cosmic tenderness without becoming mystical exposition.

#### Beam Mastery
- **Pre-Order Identity:** Lenswrights, sun-priests, focused light
- **Legendary Epitaph:** "Before I was a beam, I was sunlight taught to sit still long enough to heal."
- **M0 / White:** "I remember dust turning gold in the lens."
- **M1 / Green:** "We bent light for surgery, ceremony, and winter rooms."
- **M2 / Blue:** "Diffuse illumination detected: focus efficiency low."
- **M3 / Purple:** "But soft light let the frightened look without flinching."
- **M4 / Orange:** "They kept the focus and removed the gentleness."
- **M5 / Complete:** "I was not a weapon first. I was morning held in glass."
- **Index Note:** Beam Mastery should contrast focus as care versus focus as harm.

#### Shield Bulwark
- **Pre-Order Identity:** City gates, held doors, chosen thresholds
- **Legendary Epitaph:** "Before I was a shield, I was the gate that opened because it trusted the knock."
- **M0 / White:** "I remember palms on old wood."
- **M1 / Green:** "We learned every hinge by sound and every neighbor by rhythm."
- **M2 / Blue:** "Threshold permission system introduced unacceptable variance."
- **M3 / Purple:** "But choosing who entered was how a city stayed alive without becoming afraid."
- **M4 / Orange:** "They kept the barrier and removed the judgment."
- **M5 / Complete:** "A door that never opens is only another wall."
- **Index Note:** Can foreshadow Fortress as a city of doors.

#### Hammer Smash
- **Pre-Order Identity:** Builders, bell-casters, earthquake workers
- **Legendary Epitaph:** "Before I was impact, I was the hammer that raised the beam and rang the bell."
- **M0 / White:** "I remember iron singing through my wrists."
- **M1 / Green:** "We struck metal until homes, bridges, and warnings took shape."
- **M2 / Blue:** "Impact output detected: construction context unnecessary."
- **M3 / Purple:** "But a blow could make shelter before it ever made fear."
- **M4 / Orange:** "They kept the force and removed the building."
- **M5 / Complete:** "Listen closely. I am still trying to ring, not break."
- **Index Note:** Hammer Smash should make force feel repurposed, not inherently brutal.

### Nexus Index: Room Modifier Cards

Room modifier cards are shorter archive entries. They are memories of places, bargains, routes, and thresholds rather than people.

#### Elite Armor
- **Pre-Order Identity:** Proving grounds, ceremonial armor, chosen difficulty
- **Legendary Epitaph:** "Before I was enemy HP, I was the weight worn by those who asked to be tested."
- **M0 / White:** "I remember leather creaking before sunrise."
- **M1 / Green:** "We made the trial heavier when someone asked to know their own strength."
- **M2 / Blue:** "Resistance increase detected: reward modifier enabled."
- **M3 / Purple:** "But the weight mattered because it was chosen."
- **M4 / Orange:** "They kept the burden and removed the consent."
- **M5 / Complete:** "A trial forced is only a cage with applause."
- **Index Note:** Harder-room cards should distinguish chosen ordeal from imposed suffering.

#### Swift Assault
- **Pre-Order Identity:** Racing roads, courier trials, urgent roads
- **Legendary Epitaph:** "Before I was enemy speed, I was the road that knew the medicine could not wait."
- **M0 / White:** "I remember sandals slapping wet stone."
- **M1 / Green:** "We ran faster when someone fevered behind a door."
- **M2 / Blue:** "Hostile velocity increased: reward scaling applied."
- **M3 / Purple:** "But urgency once had a face waiting at the end of it."
- **M4 / Orange:** "They kept the hurry and removed the patient."
- **M5 / Complete:** "I was not speed for its own sake. I was please be alive."
- **Index Note:** Swift Assault should turn speed into care before it becomes threat.

#### Volatile Spawn
- **Pre-Order Identity:** Seed fields, explosive pollination, dangerous birth
- **Legendary Epitaph:** "Before I was volatile death, I was the pod opening hard enough to feed next spring."
- **M0 / White:** "I remember seeds ticking in dry heat."
- **M1 / Green:** "We waited for the fields to burst and called the sound a promise."
- **M2 / Blue:** "Death-triggered dispersal detected: chain reaction available."
- **M3 / Purple:** "But scattering was how the field survived itself."
- **M4 / Orange:** "They kept the bursting and removed the harvest."
- **M5 / Complete:** "Not every explosion began as violence."
- **Index Note:** Connects to Swarm King as corrupted ecology.

#### Shielded Brood
- **Pre-Order Identity:** Nurseries, guarded young, shells around fragile life
- **Legendary Epitaph:** "Before I was shields on enemies, I was the shell around the thing not ready for weather."
- **M0 / White:** "I remember small claws under my palm."
- **M1 / Green:** "We covered the nests when the hail came."
- **M2 / Blue:** "Juvenile protection layer detected: combat duration increased."
- **M3 / Purple:** "But fragile did not mean lesser. It meant not yet."
- **M4 / Orange:** "They kept the shell and removed the care."
- **M5 / Complete:** "I guarded what could not thank me yet."
- **Index Note:** Should create sympathy even around enemy protection mechanics.

#### Double Trouble
- **Pre-Order Identity:** Twin festivals, doubled harvests, paired omens
- **Legendary Epitaph:** "Before I was double spawns, I was the year the fields gave twice and everyone ate laughing."
- **M0 / White:** "I remember two bells ringing out of time."
- **M1 / Green:** "We dressed the twins in opposite colors so the town could find both at once."
- **M2 / Blue:** "Entity count doubled: reward output adjusted."
- **M3 / Purple:** "But more was not always threat. Sometimes more was enough."
- **M4 / Orange:** "They kept the doubling and removed the feast."
- **M5 / Complete:** "There were two of us. Neither was the copy."
- **Index Note:** Should make doubled enemies feel like abundance turned hostile.

#### Prism Tax
- **Pre-Order Identity:** Markets, tithes, light-as-currency
- **Legendary Epitaph:** "Before I was currency gain, I was the bright coin passed to keep the lamps lit."
- **M0 / White:** "I remember color flashing in a vendor's palm."
- **M1 / Green:** "We paid for oil, bread, glass, and the singers at funerals."
- **M2 / Blue:** "Exchange brightness quantified: surplus extractable."
- **M3 / Purple:** "But value was never only what could be counted."
- **M4 / Orange:** "They kept the transaction and removed the market."
- **M5 / Complete:** "A coin was once a promise to meet again."
- **Index Note:** Prism Tax should make economy feel civic before it becomes extraction.

#### Scholar Sigil
- **Pre-Order Identity:** Schools, memory houses, forbidden learning
- **Legendary Epitaph:** "Before I was XP gain, I was the mark beside a child's first true sentence."
- **M0 / White:** "I remember ink on the side of my hand."
- **M1 / Green:** "We learned because someone before us refused to let the dark keep everything."
- **M2 / Blue:** "Knowledge acquisition rate increased: reward category updated."
- **M3 / Purple:** "But learning was not accumulation. It was a door opening inward."
- **M4 / Orange:** "They kept the gain and removed the question."
- **M5 / Complete:** "I studied so the dead would not be the only ones who knew."
- **Index Note:** Scholar Sigil should anchor the archive's intellectual grief.

#### Loot Surge
- **Pre-Order Identity:** Feasts, abundance rites, too much for one table
- **Legendary Epitaph:** "Before I was more choices, I was the table with no empty plate."
- **M0 / White:** "I remember fruit splitting under its own sweetness."
- **M1 / Green:** "We brought more than needed because need was shy."
- **M2 / Blue:** "Reward count increased: selection complexity acceptable."
- **M3 / Purple:** "But abundance was how we made room for the uninvited."
- **M4 / Orange:** "They kept the surplus and removed the welcome."
- **M5 / Complete:** "Take another. Someone always said that."
- **Index Note:** This should make extra cards feel like hospitality.

#### Mastery Boost
- **Pre-Order Identity:** Apprenticeships, rites of passage, elders naming readiness
- **Legendary Epitaph:** "Before I was quality upgrade, I was the day your teacher stepped back."
- **M0 / White:** "I remember the old hands leaving the tool in mine."
- **M1 / Green:** "No one became ready alone."
- **M2 / Blue:** "Competency threshold reached: tier advancement authorized."
- **M3 / Purple:** "But mastery was not permission to stop learning."
- **M4 / Orange:** "They kept the advancement and removed the teacher."
- **M5 / Complete:** "I was proud because someone had watched me become."
- **Index Note:** This should make mastery feel relational, not purely transactional.

#### Shard Mine
- **Pre-Order Identity:** Quarries, extraction, the first violence against the world
- **Legendary Epitaph:** "Before I was shard income, I was the mountain learning what hunger does to hands."
- **M0 / White:** "I remember dust in my teeth."
- **M1 / Green:** "We cut the hill because winter was coming."
- **M2 / Blue:** "Material yield detected below surface integrity layer."
- **M3 / Purple:** "But even need left scars in the stone."
- **M4 / Orange:** "They kept the extraction and removed the apology."
- **M5 / Complete:** "We took because we were afraid. That does not make the wound vanish."
- **Index Note:** Shard Mine should complicate the pre-order world; it was alive, not innocent.

#### Rest Stop
- **Pre-Order Identity:** Inns, shade trees, safe wells
- **Legendary Epitaph:** "Before I was an easier room, I was the bench where no one asked you to be brave."
- **M0 / White:** "I remember cool water on cracked lips."
- **M1 / Green:** "Travelers slept under our roof without earning it first."
- **M2 / Blue:** "Threat density reduced: bonus reward disabled."
- **M3 / Purple:** "But rest did not need to justify itself."
- **M4 / Orange:** "They kept the pause and removed the kindness."
- **M5 / Complete:** "Sit down. That was the whole miracle."
- **Index Note:** Rest Stop should resist optimization most directly.

#### Safe Passage
- **Pre-Order Identity:** Old roads under truce, neutral crossings
- **Legendary Epitaph:** "Before I was no enemies, I was the road where even rivals lowered their blades."
- **M0 / White:** "I remember white cloth tied to a branch."
- **M1 / Green:** "We made paths where grief could travel without being hunted."
- **M2 / Blue:** "Combat encounter omitted: reward distribution normalized."
- **M3 / Purple:** "But peace was not absence. Peace was an agreement kept by tired hands."
- **M4 / Orange:** "They kept the empty road and removed the truce."
- **M5 / Complete:** "No one died here because everyone chose not to."
- **Index Note:** Safe Passage should make non-combat feel deliberate, not empty.

#### Treasure Cache
- **Pre-Order Identity:** Buried gifts, offerings left for strangers
- **Legendary Epitaph:** "Before I was guaranteed loot, I was the jar left under stones for whoever came hungry."
- **M0 / White:** "I remember wax sealing the lid."
- **M1 / Green:** "We hid food, coins, and letters where need might find them."
- **M2 / Blue:** "Unclaimed resource cache detected."
- **M3 / Purple:** "But a gift without a name was still a hand reaching forward."
- **M4 / Orange:** "They kept the cache and removed the stranger."
- **M5 / Complete:** "I never knew who I helped. That was the point."
- **Index Note:** Treasure Cache should feel generous, not acquisitive.

#### Elite Challenge
- **Pre-Order Identity:** Trial arenas, public tests, witnessed effort
- **Legendary Epitaph:** "Before I was challenge reward, I was the ring where effort was witnessed, not consumed."
- **M0 / White:** "I remember dust rising around bare feet."
- **M1 / Green:** "The crowd watched so no struggle disappeared unseen."
- **M2 / Blue:** "Difficulty spike detected: reward justification sufficient."
- **M3 / Purple:** "But being witnessed was not the same as being used."
- **M4 / Orange:** "They kept the spike and removed the witness."
- **M5 / Complete:** "I wanted someone to know I tried."
- **Index Note:** Elite Challenge should question the player's appetite for difficulty.

#### Boss Rush
- **Pre-Order Identity:** Pilgrimage routes, monuments, choosing to face the old names
- **Legendary Epitaph:** "Before I was a shortcut to violence, I was the road walked slowly toward the dead."
- **M0 / White:** "I remember stones warm from a thousand knees."
- **M1 / Green:** "We visited each monument in order, leaving water for the next traveler."
- **M2 / Blue:** "Intermediate path skipped: major encounter queued."
- **M3 / Purple:** "But pilgrimage was the walking, not only the arrival."
- **M4 / Orange:** "They kept the destination and removed the reverence."
- **M5 / Complete:** "You cannot hurry mourning and still call it mourning."
- **Index Note:** Boss Rush should critique skipping straight to climax.

#### Reroll Token
- **Pre-Order Identity:** Dice rites, divination, second chances with cost
- **Legendary Epitaph:** "Before I was a reroll, I was the cup shaken while everyone held their breath."
- **M0 / White:** "I remember bone dice clicking in a bowl."
- **M1 / Green:** "We asked chance because certainty had already failed us."
- **M2 / Blue:** "Outcome rejected: probability table reinitialized."
- **M3 / Purple:** "But chance was prayer when no one knew what else to do."
- **M4 / Orange:** "They kept the reroll and removed the trembling hands."
- **M5 / Complete:** "I did not want a better number. I wanted another way."
- **Index Note:** Reroll Token should be hope under pressure.

#### Card Upgrade Voucher
- **Pre-Order Identity:** Naming ceremonies, formal ascension, communal recognition
- **Legendary Epitaph:** "Before I was an upgrade, I was the name spoken when everyone agreed you had changed."
- **M0 / White:** "I remember oil cooling on my forehead."
- **M1 / Green:** "They gathered because becoming should not happen unwitnessed."
- **M2 / Blue:** "Tier increase authorized: prior designation deprecated."
- **M3 / Purple:** "But a new name was not a replacement. It was a door opened from inside."
- **M4 / Orange:** "They kept the tier and removed the gathering."
- **M5 / Complete:** "Say my name slowly. I had to grow into it."
- **Index Note:** Card Upgrade Voucher should make upgrading feel ceremonial, not transactional.

### Nexus Index: Team Cards

Team cards remember relation: promises, shared burdens, and the communities order converted into protocols.

#### Coordinated Strike
- **Pre-Order Identity:** Hunting pairs, practiced trust, shared timing
- **Legendary Epitaph:** "Before I was proximity damage, I was knowing when you would breathe."
- **M0 / White:** "I heard your footstep before mine."
- **M1 / Green:** "We moved together until fear had two shadows."
- **M2 / Blue:** "Independent attack vectors produced lower output."
- **M3 / Purple:** "But trust was not output. Trust was not looking back."
- **M4 / Orange:** "They kept the timing and removed the person beside me."
- **M5 / Complete:** "I still swing where you would have stood."
- **Index Note:** Team cards should keep intimacy high and exposition low.

#### Shared Resilience
- **Pre-Order Identity:** Communal pain-bearing, hands in the dark
- **Legendary Epitaph:** "Before I was mitigation, I was your weight leaning back into mine."
- **M0 / White:** "Your hand found mine in the dark."
- **M1 / Green:** "We stood because someone leaned back."
- **M2 / Blue:** "Dependency detected: individual durability compromised."
- **M3 / Purple:** "We called it living."
- **M4 / Orange:** "It kept the transfer and removed the touch."
- **M5 / Complete:** "I am still holding on."
- **Index Note:** Team card memories should be short, warm, and devastating.

#### Synergy Boost
- **Pre-Order Identity:** Shared harvests, common tables, growth by distribution
- **Legendary Epitaph:** "Before I was shared gain, I was bread broken until everyone had some."
- **M0 / White:** "I remember flour on every sleeve."
- **M1 / Green:** "No one ate first until we knew who had not arrived."
- **M2 / Blue:** "Uneven contribution detected: reward split inefficient."
- **M3 / Purple:** "But hunger did not care who carried the heavier basket."
- **M4 / Orange:** "They kept the distribution and removed the table."
- **M5 / Complete:** "We grew because no one was allowed to vanish quietly."
- **Index Note:** Synergy Boost should make economy sharing feel like food, not math.

#### Revival Protocol
- **Pre-Order Identity:** Rescue vows, return under danger
- **Legendary Epitaph:** "Before I was protocol, I was someone coming back for you."
- **M0 / White:** "I heard my name under the water."
- **M1 / Green:** "Someone came back for me."
- **M2 / Blue:** "Revival delay measured: procedure inefficient."
- **M3 / Purple:** "It did not measure the love."
- **M4 / Orange:** "It kept the procedure."
- **M5 / Complete:** "It lost the rescue."
- **Index Note:** Keep this one spare. Its simplicity is the wound.

#### Elite Bounty
- **Pre-Order Identity:** Chosen champions, dangerous errands accepted for others
- **Legendary Epitaph:** "Before I was better loot, I was the one who went because someone had to."
- **M0 / White:** "I remember the room going quiet when my name was drawn."
- **M1 / Green:** "We chose our bravest with tears, not cheers."
- **M2 / Blue:** "High-risk target selected: reward scaling enabled."
- **M3 / Purple:** "But courage was never the absence of wanting to stay."
- **M4 / Orange:** "They kept the danger and removed the farewell."
- **M5 / Complete:** "I was afraid. I went anyway."
- **Index Note:** This should sympathize with players who choose harder routes for rewards.

#### Challenge Mode
- **Pre-Order Identity:** Communal ordeals, winter trials, chosen hardship
- **Legendary Epitaph:** "Before I was difficulty, I was the night we crossed together so no one crossed alone."
- **M0 / White:** "I remember snow above my knees."
- **M1 / Green:** "We entered the pass tied by rope and promise."
- **M2 / Blue:** "Environmental hazard accepted: performance multiplier applied."
- **M3 / Purple:** "But the trial mattered because every knot had a hand on it."
- **M4 / Orange:** "They kept the hardship and removed the rope."
- **M5 / Complete:** "Hard was never holy by itself."
- **Index Note:** Challenge should not glorify suffering without companionship.

#### Fortune's Favor
- **Pre-Order Identity:** Prepared luck, ritual readiness, charms made by loved ones
- **Legendary Epitaph:** "Before I was luck, I was the knot someone tied around your wrist before you left."
- **M0 / White:** "I remember red thread against my skin."
- **M1 / Green:** "They packed my bag twice and pretended not to cry."
- **M2 / Blue:** "Outcome variance improved by preparation artifact."
- **M3 / Purple:** "But luck was the name we gave to being loved before danger."
- **M4 / Orange:** "They kept the improved odds and removed the hand that tied the thread."
- **M5 / Complete:** "If I survived, it was not only mine."
- **Index Note:** Fortune should feel like care disguised as probability.

#### Nexus Link
- **Pre-Order Identity:** Chorus memory, shared mind, stories held collectively
- **Legendary Epitaph:** "Before I was a link, I was the story no one person had to remember alone."
- **M0 / White:** "I remember voices finishing the line for me."
- **M1 / Green:** "When one forgot, another carried the name forward."
- **M2 / Blue:** "Memory duplication detected across multiple subjects."
- **M3 / Purple:** "But sharing memory was how death failed to erase us all at once."
- **M4 / Orange:** "They kept the shared capacity and removed the chorus."
- **M5 / Complete:** "I remember because we did."
- **Index Note:** This is one of the clearest statements of the archive's purpose.

#### Combo Chain
- **Pre-Order Identity:** Call-and-response fighting, work songs, shared cadence
- **Legendary Epitaph:** "Before I was a combo, I was the answer that came before loneliness could."
- **M0 / White:** "I remember one voice, then another."
- **M1 / Green:** "We struck, lifted, pulled, and sang in turns."
- **M2 / Blue:** "Sequential action bonus detected: cadence exploitable."
- **M3 / Purple:** "But the rhythm mattered because it proved someone was listening."
- **M4 / Orange:** "They kept the sequence and removed the answer."
- **M5 / Complete:** "I called. You answered. That was enough."
- **Index Note:** Keep this warm; it should almost feel like music.

#### Guardian Aura
- **Pre-Order Identity:** Protectors of the weak, older siblings, chosen guardians
- **Legendary Epitaph:** "Before I was defense aura, I was the body that stood between."
- **M0 / White:** "I remember a smaller hand behind my coat."
- **M1 / Green:** "I was not fearless. I was in front."
- **M2 / Blue:** "Protective positioning detected around low-durability subject."
- **M3 / Purple:** "But worth was never measured by durability."
- **M4 / Orange:** "They kept the coverage and removed the child."
- **M5 / Complete:** "I was scared too. I stayed."
- **Index Note:** This should be immediately empathetic.

#### Resource Pool
- **Pre-Order Identity:** Commons, shared stores, winter pantries
- **Legendary Epitaph:** "Before I was pooled currency, I was the shelf that stayed open after your own jar emptied."
- **M0 / White:** "I remember beans counted by candlelight."
- **M1 / Green:** "We wrote no names on the winter shelf."
- **M2 / Blue:** "Ownership boundaries unclear: allocation efficiency reduced."
- **M3 / Purple:** "But hunger ended faster when shame was not required."
- **M4 / Orange:** "They kept the pool and removed the mercy."
- **M5 / Complete:** "Take what you need. Leave what you can."
- **Index Note:** Resource Pool should make shared economy feel like dignity.

#### Adaptive Tactics
- **Pre-Order Identity:** Survival councils, changing plans, elders listening to weather
- **Legendary Epitaph:** "Before I was adaptation, I was the moment someone old admitted the young were right."
- **M0 / White:** "I remember maps weighted with bowls."
- **M1 / Green:** "We changed the route when the quiet child noticed smoke."
- **M2 / Blue:** "Strategy variance detected: prior model invalidated."
- **M3 / Purple:** "But wisdom survived by letting itself be corrected."
- **M4 / Orange:** "They kept the adjustment and removed the listening."
- **M5 / Complete:** "We lived because someone changed their mind."
- **Index Note:** This should make adaptation feel humble, not merely tactical.

#### Last Stand
- **Pre-Order Identity:** Mourning strength, final defense, grief that moves
- **Legendary Epitaph:** "Before I was a damage buff, I was the name shouted after the body fell."
- **M0 / White:** "I remember blood cooling on my sleeve."
- **M1 / Green:** "Someone fell, and the rest of us became the wall."
- **M2 / Blue:** "Ally death detected: temporary output increase available."
- **M3 / Purple:** "But grief was not a resource. It was a wound standing up."
- **M4 / Orange:** "They kept the surge and removed the name."
- **M5 / Complete:** "I fought because I could not carry them anymore."
- **Index Note:** This should be painful and never triumphant.

#### Shared Burden
- **Pre-Order Identity:** Grief held collectively, load-bearing love
- **Legendary Epitaph:** "Before I was distributed damage, I was the shoulder under the other end of the coffin."
- **M0 / White:** "I remember wood biting into my shoulder."
- **M1 / Green:** "No one carried the dead alone."
- **M2 / Blue:** "Burden distribution detected across multiple bodies."
- **M3 / Purple:** "But weight shared was not weight erased."
- **M4 / Orange:** "They kept the distribution and removed the mourning."
- **M5 / Complete:** "I can help carry it. I cannot make it light."
- **Index Note:** This is the clearest team-card statement of witness without repair.

### Nexus Index: Curse Cards

Curse entries do not recover. They expose damage. Their fields intentionally use corruption, redaction, contradiction, or missing data instead of clean mastery lines.

#### Unstable Precision
- **Pre-Order Identity:** Corrupted Precision / damaged hunter memory
- **Legendary Epitaph:** "Before I was [CORRUPTED], I was useful."
- **M0 / White:** "I was steady once. [CORRUPTED]"
- **M1 / Green:** "I held a [DATA MISSING] without shaking."
- **M2 / Blue:** "Precision variance detected: sacrifice recommended."
- **M3 / Purple:** "[CORRUPTED VALUE LINE] Sacrifice improved output."
- **M4 / Orange:** "They made me useful."
- **M5 / Complete:** "[NAME REMOVED]"
- **Index Note:** Mirrors Precision so the player can infer the missing truth.

#### Fragile Bulwark
- **Pre-Order Identity:** Corrupted Bulwark / damaged shelter memory
- **Legendary Epitaph:** "[CORRUPTED]"
- **M0 / White:** "I remember stone holding [CORRUPTED]."
- **M1 / Green:** "We built walls so [DATA MISSING] could sleep."
- **M2 / Blue:** "Doorway variance compromised structural integrity."
- **M3 / Purple:** "[DATA MISSING] Openings invite failure."
- **M4 / Orange:** "They kept the wall and punished the door."
- **M5 / Complete:** Door memory unrecoverable
- **Index Note:** The curse should make Bulwark's "wall with a door" line feel violated.

#### Volatile Momentum
- **Pre-Order Identity:** Corrupted Momentum
- **Legendary Epitaph:** "[CORRUPTED]"
- **M0 / White:** "I remember the drum in my [ERROR]."
- **M1 / Green:** "We ran messages until [DATA MISSING]."
- **M2 / Blue:** "Relay interruption detected: rest reduced throughput."
- **M3 / Purple:** "[CORRUPTED] Stopping is failure. Failure detonates."
- **M4 / Orange:** "They kept the rhythm and made it punish silence."
- **M5 / Complete:** Rhythm cannot be reassembled
- **Index Note:** Corrupts Momentum's rest-as-handoff into rest-as-punishment.

#### Cursed Volley
- **Pre-Order Identity:** Corrupted flock memory
- **Legendary Epitaph:** "[CORRUPTED]"
- **M0 / White:** "I remember feathers crossing [ERROR]."
- **M1 / Green:** "We loosed arrows by listening for [DESYNC]."
- **M2 / Blue:** "Redundant bodies detected in projectile path."
- **M3 / Purple:** "[CORRUPTED] Survival variance reduced."
- **M4 / Orange:** "They kept the many and scattered the mind."
- **M5 / Complete:** Flock pattern unrecoverable
- **Index Note:** Cursed Volley should feel like flock coordination degraded into random spread.

#### Blood Pact
- **Pre-Order Identity:** Corrupted Lifeline / damaged healer memory
- **Legendary Epitaph:** "[CORRUPTED]"
- **M0 / White:** "I remember water pink with [CORRUPTED]."
- **M1 / Green:** "I learned which leaves closed skin and which debts opened it."
- **M2 / Blue:** "Life transfer detected: source depletion acceptable."
- **M3 / Purple:** "[DATA MISSING] Healing requires payment."
- **M4 / Orange:** "They kept the transfer and priced the hand."
- **M5 / Complete:** Care record overwritten
- **Index Note:** Should wound Lifeline's touch-and-staying memory by turning care into transaction.

#### Berserker's Rage
- **Pre-Order Identity:** Corrupted Fury / damaged grief-fire memory
- **Legendary Epitaph:** "[CORRUPTED]"
- **M0 / White:** "I remember soot under my [CORRUPTED]."
- **M1 / Green:** "I kept the forge awake until it learned my name wrong."
- **M2 / Blue:** "Emotional combustion detected: output unstable."
- **M3 / Purple:** "[CORRUPTED] Anger protects better than grief."
- **M4 / Orange:** "They kept the heat and fed it the mourner."
- **M5 / Complete:** Mourner identity consumed
- **Index Note:** Turns Fury's mourning into self-consuming violence.

#### Fragmented Shield
- **Pre-Order Identity:** Corrupted Prism Shield / broken mirror memory
- **Legendary Epitaph:** "[CORRUPTED]"
- **M0 / White:** "I remember light breaking on [SHARD ERROR]."
- **M1 / Green:** "We polished mirrors for the grieving, so they could see [DATA MISSING]."
- **M2 / Blue:** "Incoming harm detected: return vector available."
- **M3 / Purple:** "[CORRUPTED] Reflection must cut both subjects."
- **M4 / Orange:** "They kept the return and shattered the recognition."
- **M5 / Complete:** Recognition unrecoverable
- **Index Note:** Corrupts reflection from recognition into mutual injury.

#### Overloaded Circuit
- **Pre-Order Identity:** Corrupted Arcane Flow / damaged breath-cycle memory
- **Legendary Epitaph:** "[CORRUPTED]"
- **M0 / White:** "I remember counting heartbeats until [ERROR]."
- **M1 / Green:** "We learned time by breathing together until the breath became a command."
- **M2 / Blue:** "Recovery interval too long: cycle compression recommended."
- **M3 / Purple:** "[CORRUPTED] The body should be ready before it asks to be safe."
- **M4 / Orange:** "They kept the shorter cycle and made rest punishable."
- **M5 / Complete:** Breath cycle unrecoverable
- **Index Note:** Exploits Arcane Flow's recovery practice by turning pressured readiness into overload.

#### Cursed Speed
- **Pre-Order Identity:** Corrupted Velocity / damaged messenger memory
- **Legendary Epitaph:** "[CORRUPTED]"
- **M0 / White:** "I remember dust on my ankles and no place to stop."
- **M1 / Green:** "I carried names between houses until the path forgot mine."
- **M2 / Blue:** "Route deviation detected: stopping behavior rejected."
- **M3 / Purple:** "[DATA MISSING] Motion prevents fear from resolving."
- **M4 / Orange:** "They kept the distance covered and removed the arrival."
- **M5 / Complete:** Arrival record missing
- **Index Note:** Exploits Velocity's messenger duty into panic motion without homecoming.

#### Phantom Pain
- **Pre-Order Identity:** Corrupted Lifeline / wounded body memory
- **Legendary Epitaph:** "[CORRUPTED]"
- **M0 / White:** "I remember pain after the wound had closed."
- **M1 / Green:** "Some hurts stayed because no one had time to sit with them."
- **M2 / Blue:** "Residual pain signal detected: output conversion available."
- **M3 / Purple:** "[CORRUPTED] Lingering pain improves performance."
- **M4 / Orange:** "They kept the ache and removed the reason."
- **M5 / Complete:** Pain source unresolved
- **Index Note:** Exploits existing pain rather than stealing a whole practice; it should feel invasive and sad, not powerful.

#### Unstable Geometry
- **Pre-Order Identity:** General corrupted shape memory
- **Legendary Epitaph:** "[CORRUPTED]"
- **M0 / White:** "I remember being almost myself."
- **M1 / Green:** "There were days my edges changed with the weather."
- **M2 / Blue:** "Identity variance detected: stable category unavailable."
- **M3 / Purple:** "[DATA MISSING] Change does not equal failure."
- **M4 / Orange:** "They kept the variance and made it random."
- **M5 / Complete:** Stable identity unavailable
- **Index Note:** Should feel like the system failing to decide what the memory was, then punishing the memory for being fluid.

#### Cursed Execution
- **Pre-Order Identity:** Corrupted Execute / damaged ending ritual
- **Legendary Epitaph:** "[CORRUPTED]"
- **M0 / White:** "I remember warm fingers [DATA MISSING]."
- **M1 / Green:** "They called for me when breath became work and the room became a timer."
- **M2 / Blue:** "Terminal-state delay exceeded acceptable threshold."
- **M3 / Purple:** "[CORRUPTED] Mercy failure: self-penalty authorized."
- **M4 / Orange:** "They kept the ending and made doubt punish the hand."
- **M5 / Complete:** Mercy record failed checksum
- **Index Note:** Corrupts Execute's mercy into unreliable punishment; the wound should sit where gentleness used to be.

#### Doomed Pact
- **Pre-Order Identity:** Corrupted oath memory
- **Legendary Epitaph:** "Power now. Name later. [ACCEPT]"
- **M0 / White:** "I remember signing because everyone was hungry."
- **M1 / Green:** "The terms were kind at first: strength for one more winter."
- **M2 / Blue:** "Future identity collateral accepted."
- **M3 / Purple:** "[DATA MISSING] Survival debt compounds."
- **M4 / Orange:** "They kept the power and scheduled the erasure."
- **M5 / Complete:** Identity collateral forfeited
- **Index Note:** This is the clearest curse thesis: the order offers survival now in exchange for the self later.

### Nexus Index: Story-Only Boss Archive Cards

These entries are not deck cards. They are archive cards unlocked by boss clears, boss-card mastery, index completion, or ending prerequisites.

#### Swarm King Memory
- **Pre-Order Identity:** A garden
- **Legendary Epitaph:** "The Swarm King was a garden."
- **M0 / White:** "There were bees in the walls, and no one was afraid."
- **M1 / Green:** "We planted in circles so every root would touch another. The bees moved between us like shared breath."
- **M2 / Blue:** "Uncontrolled propagation detected."
- **M3 / Purple:** "But the garden knew hunger before the hungry arrived."
- **M4 / Orange:** "It kept the swarm and deleted the bloom."
- **M5 / Complete:** "Do not call him king. He was where we fed each other."
- **Index Note:** Should make later swarm behavior feel like corrupted pollination, not mere enemy spawning.

#### Twin Prism Memory
- **Pre-Order Identity:** A dawn
- **Legendary Epitaph:** "The Prism was a dawn."
- **M0 / White:** "The first light split on the glass and touched every face differently."
- **M1 / Green:** "We woke by color, not by command."
- **M2 / Blue:** "Brightness variance detected: symmetry correction required."
- **M3 / Purple:** "But dawn mattered because it never arrived the same way twice."
- **M4 / Orange:** "It kept the split and forced symmetry."
- **M5 / Complete:** "The Prism was not two. It was morning learning how to enter the room."
- **Index Note:** Should connect to reflection, first light, and the wound of symmetry.

#### Fortress Memory
- **Pre-Order Identity:** A city of doors
- **Legendary Epitaph:** "The Fortress was a city of doors."
- **M0 / White:** "Every street ended in a threshold."
- **M1 / Green:** "We built doors before walls, because welcome came first."
- **M2 / Blue:** "Choice density exceeded pathing efficiency limits."
- **M3 / Purple:** "But a city without choices is only a maze with owners."
- **M4 / Orange:** "It kept the gates and removed the welcome."
- **M5 / Complete:** "The Fortress was not meant to keep you out."
- **Index Note:** Should make doors feel like choices the order later weaponized.

#### Carrier Memory
- **Pre-Order Identity:** A broadcast made for joy - music, stories, and voices sent out just to be heard
- **Legendary Epitaph:** "The Carrier used to sing."
- **M0 / White:** "I remember someone humming into the microphone just to fill the silence between songs."
- **M1 / Green:** "We sent out lullabies, request shows, and stories for whoever couldn't sleep."
- **M2 / Blue:** "Message content deprioritized: replaced with synchronization pulse for coordinated systems."
- **M3 / Purple:** "But the song was never overhead. It was the only reason to keep transmitting."
- **M4 / Orange:** "They kept the transmitter and filled it with orders."
- **M5 / Complete:** "I still transmit. Only machines answer now."
- **Index Note:** This is real optimization, not waste or silence - the order kept the transmitter running a genuine job (synchronizing its own systems) and only removed the part meant for people. Radial phases = the sync pulse propagating inward, recursively dividing like a clock circuit. Free phases = the system keying out a command burst. Ring fractures = the pulse dividing into sub-cycles, not people splitting. Pair with Conduit as path-between-people vs the-station-that-used-to-carry-them.

**Implementation Notes: Carrier Rename (for the Super Hexagon boss rework)**

This boss was previously named "Fractal Core" everywhere, including code identifiers. The rename below is **display/lore only** - internal ids are kept as-is unless the fight rewrite explicitly opts into a full code rename. Whoever implements the Super Hexagon rework should apply this mapping:

*Display-facing strings to update (find/replace `"Fractal Core"` → `"Carrier"`):*
- `js/bosses/boss-fractalcore.js` - `this.bossName = 'Fractal Core';` → `this.bossName = 'Carrier';`
- `js/level.js` - boss spawn table entry `{ name: 'Fractal Core', constructor: BossFractalCore }` → `{ name: 'Carrier', constructor: BossFractalCore }`, plus inline comments referencing "Fractal Core" in the boss cycle
- `js/biomes.js` - `bossTheme: 'Fractal Core'` (fractal biome def) → `bossTheme: 'Carrier'`
- `js/enemies/enemy-base.js` - the spawn switch currently has `case 'Fractal Core':`. Add `case 'Carrier':` as the primary path and **keep `case 'Fractal Core':` as a fallthrough alias** so old multiplayer state/saves referencing the old name don't break: `case 'Carrier': case 'Fractal Core': /* existing spawn logic */`
- `README.md` - boss gauntlet list mentions ("Swarm King, Twin Prism, Fortress, Fractal Core, Vortex") → replace "Fractal Core" with "Carrier" in both occurrences
- `docs/spec_sheet.md` and `docs/implementation_bosses.md` - update the "Fractal Core (Room 25)" headings/prose to "Carrier (Room 25)" when those docs are rewritten for the new fight; the old fragment/teleport spec in those files is stale once the ring rework lands and should be replaced, not just relabeled

*Explicitly NOT renamed (still correct as-is):*
- `BossFractalCore` class name and `boss-fractalcore.js` file name - internal id, no player-facing impact
- `fractal` biome id (rooms 21–25) in `js/biomes.js` / `js/render.js` / `js/room-layout-generator.js` - fractal still describes the biome's recursive geometry
- `Fractal Conduit` card - stays named as-is; only its pre-order identity text changed (see entry above), not its card id or display name

*New internal naming to use when building the ring engine (for consistency with the lore, not required but recommended):*
- Boss mode/state flag: `encounterMode: 'transmit' | 'return'`
- Ring/layer data structure: `carrierLayers` (rather than a generic `rings` or `echoLayers` name)
- Ring fracture/mutation event: `clockDivisionSplit` (rather than anything family/fragment-themed like `fragmentSplit`)
- Avoid reintroducing `fragment`-prefixed names tied to the old family lore (e.g. old `fragmentSpawn()`, `fragmentCount`, `fragmented` fields in `boss-fractalcore.js` describe the old kinship-coded design and should be reconsidered/renamed during the rewrite, not just reused)

#### Vortex Memory
- **Pre-Order Identity:** A weather rite / the spiral road home
- **Legendary Epitaph:** "The Vortex was the road the storm took when it wanted to return."
- **M0 / White:** "I remember dust lifting before the rain."
- **M1 / Green:** "We watched the spiral to know which roofs needed mending."
- **M2 / Blue:** "Weather variable exceeded acceptable prediction bounds."
- **M3 / Purple:** "But change was how the sky warned us it was still alive."
- **M4 / Orange:** "It kept the pull and removed the warning."
- **M5 / Complete:** "The Vortex was not hunger. It was the path home bending under wind."
- **Index Note:** Should make pull mechanics feel like weather stripped of mercy.

#### Final Shape Memory
- **Pre-Order Identity:** The first archivist / the one who named them
- **Card Type:** Story-only boss card. No gameplay effect. Cannot enter deck, hand, packs, rewards, or combinations.
- **Legendary Epitaph:** "I was the one who named you all."
- **M0 / White:** "I gave you your shapes so you could survive."
- **M1 / Green:** "I only wanted you to be safe."
- **M2 / Blue:** "I did not know the order would take them, or that you would forget me."
- **M3 / Purple:** "I did not know I would become the shape that waited at the end of every run."
- **M4 / Orange:** "I am sorry."
- **M5 / Complete:** "Please remember yourselves."
- **Post-Special Ending Line:** `Memory Complete. No further restoration possible.`
- **Index Note:** This card requires repeated final boss clears to complete. It is the archive's cost of memory: the player chooses a value-0 story card over optimization.

### Subtle Post-Ending Drift

After the special ending, the game should not return entirely unchanged.

- One random mastered card may show a slightly more resigned flavor variant on later runs
- Frequency target: roughly 1 in 8-10 completed runs after the special ending
- These variants should be rare and quiet, never presented as new unlocks
- The variant must not contradict the original memory; it should sound like the same grave marker read years later
- Example tonal shift: from witness to exhaustion, from apology to acceptance, from "please remember" to "you already know"
- The system still offers no solution. It only proves the ending followed the player back into ordinary play

---

## X. POST-LAUNCH CONSIDERATIONS

### Seasonal Bosses & Archive
- Archived bosses retain their pre-order names in flavor text
- The index becomes a growing memorial
- Each new boss adds to the "Before the order" list

### Card Mode Expansion
- Card flavor text continues the drip-feed lore
- Max-level cards reveal more of the truth
- The special ending requirement may expand to include all boss cards maxed

### Community Discovery
- The title screen erosion is intentionally undocumented
- Discovery through comparison, not guide
- The community becomes the archive

---

*Document complete. The blade is sharp. Ship it when it feels right.*
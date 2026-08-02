/**
 * Surge Arena combo meter — DMC-style Style Engine (D/C/B/A/S).
 * Dual lines: player buffs + enemy pressure. Recovery / Crash / Variety / Apex floaters.
 */
(function () {
	'use strict';

	const RANKS = Object.freeze({
		0: {
			letter: 'D',
			name: 'DUST',
			color: '#7a8ba3',
			glow: 'rgba(122,139,163,0.3)',
			border: 'rgba(90,105,130,0.4)',
			borderWidth: '1px',
			bg: 'linear-gradient(165deg, rgba(18,22,30,0.85), rgba(10,12,18,0.9))',
			panelGlow: '0 0 0px transparent',
			timerBg: 'linear-gradient(90deg, #485566, #7a8ba3)',
			timerGlow: 'none',
			countSize: '36px',
			countColor: '#9ab0cc',
			countShadow: 'none',
			rankSize: '11px',
			rankShadow: 'none',
			corners: 'none',
			anim: 'none',
			bonus: '',
			foe: ''
		},
		1: {
			letter: 'C',
			name: 'SLAYER',
			color: '#00e5ff',
			glow: 'rgba(0,229,255,0.75)',
			border: 'rgba(0,229,255,0.65)',
			borderWidth: '1.5px',
			bg: 'linear-gradient(165deg, rgba(16,36,52,0.92), rgba(8,18,28,0.94))',
			panelGlow: '0 0 12px rgba(0,229,255,0.35), inset 0 0 8px rgba(0,229,255,0.15)',
			timerBg: 'linear-gradient(90deg, #0088cc, #00e5ff, #ffffff)',
			timerGlow: '0 0 10px rgba(0,229,255,0.75)',
			countSize: '40px',
			countColor: '#e0f7ff',
			countShadow: '0 0 10px rgba(0,229,255,0.7), 2px 2px 0 #000',
			rankSize: '12px',
			rankShadow: '0 0 12px rgba(0,229,255,0.8), 1px 1px 0 #000',
			corners: '2-cyan',
			anim: 'none',
			bonus: 'You: +10% move · +10% CDR',
			foe: 'Foes: +5% move'
		},
		2: {
			letter: 'B',
			name: 'RAMPAGE',
			color: '#00ff88',
			glow: 'rgba(0,255,136,0.85)',
			border: 'rgba(0,255,136,0.85)',
			borderWidth: '2px',
			bg: 'linear-gradient(165deg, rgba(8,38,24,0.94), rgba(4,18,12,0.96))',
			panelGlow: '0 0 20px rgba(0,255,136,0.45), inset 0 0 12px rgba(0,255,136,0.2)',
			timerBg: 'linear-gradient(90deg, #00b359, #00ff88, #b3ffda)',
			timerGlow: '0 0 12px rgba(0,255,136,0.85)',
			countSize: '44px',
			countColor: '#e6fffa',
			countShadow: '0 0 14px rgba(0,255,136,0.85), 0 0 24px rgba(0,255,136,0.4), 2px 2px 0 #000',
			rankSize: '13px',
			rankShadow: '0 0 14px rgba(0,255,136,0.9), 1px 1px 0 #000',
			corners: '2-emerald',
			anim: 'none',
			bonus: 'You: ×1.5 credits · +15% CDR · +10% crit',
			foe: 'Foes: aggressive (faster windups · flank)'
		},
		3: {
			letter: 'A',
			name: 'APEX',
			color: '#ff007f',
			glow: 'rgba(255,0,127,0.95)',
			border: 'rgba(255,0,127,0.95)',
			borderWidth: '2px',
			bg: 'linear-gradient(165deg, rgba(48,10,36,0.95), rgba(20,4,16,0.96))',
			panelGlow: '0 0 28px rgba(255,0,127,0.65), 0 0 45px rgba(255,0,127,0.3), inset 0 0 16px rgba(255,0,127,0.25)',
			timerBg: 'linear-gradient(90deg, #d500f9, #ff007f, #ff80ab)',
			timerGlow: '0 0 14px rgba(255,0,127,0.9)',
			countSize: '48px',
			countColor: '#ffe6f2',
			countShadow: '0 0 18px rgba(255,0,127,0.9), 0 0 32px rgba(255,0,127,0.5), 2px 2px 0 #000',
			rankSize: '14px',
			rankShadow: '0 0 18px rgba(255,0,127,1), 0 0 30px rgba(255,0,127,0.6), 1px 1px 0 #000',
			corners: '4-magenta',
			anim: 'comboMeterApexPulse 1.2s ease-in-out infinite',
			bonus: 'You: ×2 credits · +25% CDR · longer dash i-frames',
			foe: 'Foes: frenzied (+20% move · elite affix)'
		},
		4: {
			letter: 'S',
			name: 'APOCALYPSE',
			color: '#ffcc00',
			glow: 'rgba(255,204,0,1)',
			border: '#ffcc00',
			borderWidth: '2.5px',
			bg: 'linear-gradient(165deg, rgba(54,12,18,0.98), rgba(24,6,8,0.98), rgba(42,22,0,0.95))',
			panelGlow: '0 0 35px rgba(255,204,0,0.8), 0 0 65px rgba(255,23,68,0.6), inset 0 0 24px rgba(255,204,0,0.35)',
			timerBg: 'linear-gradient(90deg, #ff1744, #ffaa00, #ffff55, #ffffff)',
			timerGlow: '0 0 16px rgba(255,204,0,0.95), 0 0 28px rgba(255,23,68,0.7)',
			countSize: '52px',
			countColor: '#ffffff',
			countShadow: '0 0 22px #ffcc00, 0 0 45px #ff1744, 0 0 70px #ffcc00, 2px 2px 0 #000',
			rankSize: '15px',
			rankShadow: '0 0 20px #ffcc00, 0 0 35px #ff1744, 1px 1px 0 #000',
			corners: '4-gold-crown',
			anim: 'comboMeterApocalypseCrown 0.9s ease-in-out infinite alternate',
			bonus: 'You: ×3 credits · +40% CDR · lifesteal 10% · shatter',
			foe: 'Arena: spawn storm (hit = Style Crash)'
		},
		5: {
			letter: 'S+',
			name: 'CALAMITY',
			color: '#ff5500',
			glow: 'rgba(255,85,0,0.95)',
			border: 'rgba(255,85,0,0.95)',
			borderWidth: '3px',
			bg: 'linear-gradient(165deg, rgba(64,15,5,0.98), rgba(30,5,2,0.98))',
			panelGlow: '0 0 45px rgba(255,85,0,0.85), 0 0 80px rgba(255,0,0,0.65), inset 0 0 28px rgba(255,85,0,0.4)',
			timerBg: 'linear-gradient(90deg, #ff0000, #ff5500, #ffcc00, #ffffff)',
			timerGlow: '0 0 20px rgba(255,85,0,0.95)',
			countSize: '56px',
			countColor: '#ffffff',
			countShadow: '0 0 28px #ff5500, 0 0 55px #ff0000, 2px 2px 0 #000',
			rankSize: '16px',
			rankShadow: '0 0 25px #ff5500, 0 0 40px #ff0000, 1px 1px 0 #000',
			corners: '4-calamity',
			anim: 'comboMeterCalamityPulse 0.7s ease-in-out infinite alternate',
			bonus: 'You: ×4.5 credits · +60% CDR · lifesteal 15% · dash +150ms',
			foe: 'Foes: calamity speed (+10% move · spawn overload)'
		},
		6: {
			letter: 'S++',
			name: 'ARMAGEDDON',
			color: '#ff003c',
			glow: 'rgba(255,0,60,1)',
			border: '#ff003c',
			borderWidth: '3.5px',
			bg: 'linear-gradient(165deg, rgba(72,0,10,0.99), rgba(28,0,4,0.99), rgba(10,10,10,0.95))',
			panelGlow: '0 0 60px rgba(255,0,60,0.95), 0 0 110px rgba(255,204,0,0.85), inset 0 0 35px rgba(255,0,60,0.5)',
			timerBg: 'linear-gradient(90deg, #ff003c, #ffcc00, #ffffff, #ff003c)',
			timerGlow: '0 0 25px rgba(255,0,60,0.95)',
			countSize: '60px',
			countColor: '#ffffff',
			countShadow: '0 0 35px #ff003c, 0 0 75px #ffcc00, 0 0 120px #ffffff, 2px 2px 0 #000',
			rankSize: '17px',
			rankShadow: '0 0 30px #ff003c, 0 0 50px #ffcc00, 1px 1px 0 #000',
			corners: '4-armageddon',
			anim: 'comboMeterArmageddonSpin 0.5s linear infinite alternate',
			bonus: 'You: ×6.0 credits · +80% CDR · lifesteal 25% · dash +200ms',
			foe: 'Foes: armageddon speed (+20% move · spawn storm)'
		}
	});

	const playerMeters = {};
	let busTeardown = null;
	let rafId = 0;

	function isSurgeArenaActive() {
		const game = typeof Game !== 'undefined' ? Game : null;
		if (!game) return false;
		if (game.activeSessionId === 'surge-arena') return true;
		if (game.modeId === 'surge-arena') return true;
		const profile = game.modeProfile
			|| (typeof PlayingHost !== 'undefined' && PlayingHost.getActiveProfile && PlayingHost.getActiveProfile());
		if (profile && profile.id === 'surge-arena') return true;
		if (typeof PlayingHost !== 'undefined' && PlayingHost.getActiveRules) {
			const rules = PlayingHost.getActiveRules();
			if (rules && rules.id === 'surge-arena') return true;
		}
		return !!(game.arenaPhase && typeof SurgeArenaRules !== 'undefined');
	}

	function isHudAllowed() {
		if (typeof window !== 'undefined' && window.USE_DOM_UI === false) return false;
		const game = typeof Game !== 'undefined' ? Game : null;
		if (!game || game.state !== 'PLAYING') return false;
		if (game.player && game.player.dead) return false;
		if (typeof GameModeTakeover !== 'undefined' && GameModeTakeover.isGameplayHudVisible) {
			return !!GameModeTakeover.isGameplayHudVisible(game);
		}
		return true;
	}

	function getComboState(playerId) {
		if (typeof SurgeArenaRules !== 'undefined' && SurgeArenaRules.getComboState) {
			const state = SurgeArenaRules.getComboState(playerId);
			if (state) return state;
		}
		const game = typeof Game !== 'undefined' ? Game : null;
		if (game && typeof game.comboCount === 'number' && (!playerId || playerId === (game.getLocalPlayerId ? game.getLocalPlayerId() : 'local'))) {
			return {
				comboCount: game.comboCount || 0,
				comboTier: game.comboTier || 0,
				comboTimer: game.comboTimer || 0
			};
		}
		return null;
	}

	function getComboTimerMax() {
		if (typeof SurgeArenaRules !== 'undefined' && SurgeArenaRules.COMBO_TIMER) {
			return SurgeArenaRules.COMBO_TIMER;
		}
		return 5.5;
	}

	function ensurePlayerMeter(playerId) {
		if (playerMeters[playerId]) return playerMeters[playerId];

		const isP2 = (typeof Game !== 'undefined' && Game.localSplitEnabled && playerId === Game.localSplitPlayerId);
		
		const rootEl = document.createElement('div');
		rootEl.id = 'combo-meter-' + playerId;
		rootEl.className = 'combo-meter';
		rootEl.setAttribute('aria-hidden', 'true');
		
		// Style position based on P1 vs P2 in split screen
		const rightPos = (typeof Game !== 'undefined' && Game.localSplitEnabled)
			? (isP2 ? '22px' : 'calc(50% + 22px)')
			: '22px';
			
		rootEl.style.cssText = [
			'position:fixed',
			`right:${rightPos}`,
			'top:72px',
			'z-index:3200',
			'pointer-events:none',
			'user-select:none',
			'font-family:Orbitron,sans-serif',
			'opacity:0',
			'transform:translateX(28px)',
			'transition:opacity 0.2s ease, transform 0.2s ease, right 0.2s ease',
			'display:none'
		].join(';');

		const panelEl = document.createElement('div');
		panelEl.className = 'combo-meter__panel';
		panelEl.style.cssText = [
			'position:relative',
			'min-width:156px',
			'max-width:196px',
			'padding:9px 12px 8px',
			'text-align:right',
			'background:linear-gradient(165deg, rgba(30,30,55,0.94), rgba(12,12,28,0.92))',
			'border:2px solid rgba(120,160,255,0.65)',
			'border-radius:4px',
			'box-shadow:0 0 14px rgba(102,102,255,0.45), inset 0 0 0 1px rgba(150,180,255,0.22)',
			'transform:skewX(-6deg)',
			'overflow:hidden'
		].join(';');

		// Inner un-skew so glyphs stay readable while the chassis stays angled.
		const inner = document.createElement('div');
		inner.className = 'combo-meter__inner';
		inner.style.cssText = 'transform:skewX(6deg); position:relative;';

		const hitFlashEl = document.createElement('div');
		hitFlashEl.className = 'combo-meter__flash';
		hitFlashEl.style.cssText = [
			'position:absolute',
			'inset:0',
			'pointer-events:none',
			'opacity:0',
			'background:linear-gradient(90deg, transparent, rgba(255,255,255,0.28))',
			'z-index:2'
		].join(';');

		const cornerTL = document.createElement('div');
		cornerTL.style.cssText = [
			'position:absolute',
			'top:3px',
			'left:3px',
			'width:12px',
			'height:12px',
			'border-top:2px solid #88ccff',
			'border-left:2px solid #88ccff',
			'opacity:0',
			'z-index:3',
			'transition:border-color 0.2s ease, opacity 0.2s ease'
		].join(';');

		const cornerTR = document.createElement('div');
		cornerTR.style.cssText = [
			'position:absolute',
			'top:3px',
			'right:3px',
			'width:12px',
			'height:12px',
			'border-top:2px solid #88ccff',
			'border-right:2px solid #88ccff',
			'opacity:0',
			'z-index:3',
			'transition:border-color 0.2s ease, opacity 0.2s ease'
		].join(';');

		const cornerBL = document.createElement('div');
		cornerBL.style.cssText = [
			'position:absolute',
			'bottom:3px',
			'left:3px',
			'width:12px',
			'height:12px',
			'border-bottom:2px solid #88ccff',
			'border-left:2px solid #88ccff',
			'opacity:0',
			'z-index:3',
			'transition:border-color 0.2s ease, opacity 0.2s ease'
		].join(';');

		const cornerBR = document.createElement('div');
		cornerBR.style.cssText = [
			'position:absolute',
			'bottom:3px',
			'right:3px',
			'width:12px',
			'height:12px',
			'border-bottom:2px solid #88ccff',
			'border-right:2px solid #88ccff',
			'opacity:0',
			'z-index:3',
			'transition:border-color 0.2s ease, opacity 0.2s ease'
		].join(';');

		const label = document.createElement('div');
		label.className = 'combo-meter__label';
		label.textContent = isP2 ? 'P2 STYLE' : 'STYLE';
		label.style.cssText = [
			'font-size:8px',
			'font-weight:700',
			'letter-spacing:0.28em',
			'color:rgba(170,190,255,0.75)',
			'margin-bottom:1px',
			'text-transform:uppercase'
		].join(';');

		const countEl = document.createElement('div');
		countEl.className = 'combo-meter__count';
		countEl.style.cssText = [
			'font-size:42px',
			'font-weight:900',
			'line-height:0.9',
			'letter-spacing:-1px',
			'color:#ffffff',
			'text-shadow:0 0 10px rgba(120,200,255,0.85), 0 0 22px rgba(100,150,255,0.55), 2px 2px 0 #000',
			'transform-origin:right center'
		].join(';');
		countEl.textContent = '0';

		const rankEl = document.createElement('div');
		rankEl.className = 'combo-meter__rank';
		rankEl.style.cssText = [
			'font-size:12px',
			'font-weight:800',
			'letter-spacing:0.16em',
			'margin-top:1px',
			'margin-right:-0.16em',
			'color:#88ccff',
			'text-shadow:0 0 12px rgba(100,180,255,0.85), 1px 1px 0 #000'
		].join(';');
		rankEl.textContent = 'D · DUST';

		const bonusEl = document.createElement('div');
		bonusEl.className = 'combo-meter__bonus';
		bonusEl.style.cssText = [
			'font-size:10px',
			'font-weight:700',
			'letter-spacing:0.03em',
			'margin-top:5px',
			'min-height:0',
			'line-height:1.2',
			'color:#ffd76a',
			'text-shadow:0 0 8px rgba(255,200,80,0.7), 1px 1px 0 #000',
			'opacity:0',
			'display:none',
			'transition:opacity 0.18s ease'
		].join(';');
		bonusEl.textContent = '';

		const foeEl = document.createElement('div');
		foeEl.className = 'combo-meter__foe';
		foeEl.style.cssText = [
			'font-size:9px',
			'font-weight:700',
			'letter-spacing:0.04em',
			'margin-top:2px',
			'min-height:0',
			'line-height:1.2',
			'color:#ff6688',
			'text-shadow:0 0 8px rgba(255,80,100,0.7), 1px 1px 0 #000',
			'opacity:0',
			'display:none',
			'transition:opacity 0.18s ease'
		].join(';');
		foeEl.textContent = '';

		const toastEl = document.createElement('div');
		toastEl.className = 'combo-meter__toast';
		toastEl.style.cssText = [
			'margin-top:6px',
			'padding:5px 7px',
			'min-height:0',
			'border-radius:3px',
			'background:rgba(0,0,0,0.55)',
			'border:1px solid rgba(180,200,255,0.35)',
			'opacity:0',
			'display:none',
			'transform:translateY(4px)',
			'transition:opacity 0.2s ease, transform 0.2s ease',
			'text-align:right'
		].join(';');

		const toastTitleEl = document.createElement('div');
		toastTitleEl.style.cssText = [
			'font-size:11px',
			'font-weight:800',
			'letter-spacing:0.06em',
			'line-height:1.15',
			'color:#ffffff',
			'text-shadow:1px 1px 0 #000'
		].join(';');

		const toastDetailEl = document.createElement('div');
		toastDetailEl.style.cssText = [
			'font-size:9px',
			'font-weight:600',
			'letter-spacing:0.02em',
			'line-height:1.25',
			'margin-top:2px',
			'color:rgba(220,230,255,0.92)',
			'text-shadow:1px 1px 0 #000'
		].join(';');
		toastEl.appendChild(toastTitleEl);
		toastEl.appendChild(toastDetailEl);

		const recoverEl = document.createElement('div');
		recoverEl.className = 'combo-meter__recover';
		recoverEl.style.cssText = [
			'font-size:10px',
			'font-weight:800',
			'letter-spacing:0.08em',
			'margin-top:4px',
			'padding:4px 6px',
			'border-radius:3px',
			'background:rgba(0,40,35,0.7)',
			'border:1px solid rgba(80,255,200,0.55)',
			'color:#66ffcc',
			'text-shadow:0 0 10px rgba(80,255,200,0.85), 1px 1px 0 #000',
			'opacity:0',
			'display:none',
			'transition:opacity 0.12s ease'
		].join(';');
		recoverEl.textContent = 'RECOVER — dash through or heavy hit';

		const timerTrack = document.createElement('div');
		timerTrack.className = 'combo-meter__timer-track';
		timerTrack.style.cssText = [
			'margin-top:6px',
			'margin-left:auto',
			'width:100%',
			'height:5px',
			'background:rgba(0,0,0,0.55)',
			'border:1px solid rgba(120,160,255,0.4)',
			'border-radius:2px',
			'overflow:hidden',
			'box-shadow:inset 0 0 6px rgba(0,0,0,0.6)'
		].join(';');

		const timerFill = document.createElement('div');
		timerFill.className = 'combo-meter__timer-fill';
		timerFill.style.cssText = [
			'height:100%',
			'width:100%',
			'background:linear-gradient(90deg, #3a6cff, #88ccff, #e8f4ff)',
			'box-shadow:0 0 10px rgba(100,180,255,0.85)',
			'transform-origin:right center',
			'transition:background 0.15s ease, box-shadow 0.15s ease'
		].join(';');
		timerTrack.appendChild(timerFill);

		inner.appendChild(hitFlashEl);
		inner.appendChild(label);
		inner.appendChild(countEl);
		inner.appendChild(rankEl);
		inner.appendChild(bonusEl);
		inner.appendChild(foeEl);
		inner.appendChild(toastEl);
		inner.appendChild(recoverEl);
		inner.appendChild(timerTrack);
		panelEl.appendChild(cornerTL);
		panelEl.appendChild(cornerTR);
		panelEl.appendChild(cornerBL);
		panelEl.appendChild(cornerBR);
		panelEl.appendChild(inner);
		rootEl.appendChild(panelEl);
		document.body.appendChild(rootEl);

		// Create screen border overlay element
		const borderEl = document.createElement('div');
		borderEl.id = 'combo-border-' + playerId;
		borderEl.className = 'combo-border-overlay';
		borderEl.style.cssText = [
			'position:fixed',
			'top:0',
			'bottom:0',
			'z-index:3100',
			'pointer-events:none',
			'opacity:0',
			'transition:opacity 0.3s ease, box-shadow 0.3s ease',
			'display:none'
		].join(';');
		document.body.appendChild(borderEl);

		if (!document.getElementById('combo-meter-keyframes')) {
			const style = document.createElement('style');
			style.id = 'combo-meter-keyframes';
			style.textContent = [
				'@keyframes comboMeterPunch {',
				'  0% { transform: scale(1.45); filter: brightness(1.35); }',
				'  55% { transform: scale(0.94); }',
				'  100% { transform: scale(1); filter: brightness(1); }',
				'}',
				'@keyframes comboMeterRankIn {',
				'  0% { transform: translateX(28px) scale(1.25); opacity:0; letter-spacing:0.5em; }',
				'  100% { transform: translateX(0) scale(1); opacity:1; letter-spacing:0.22em; }',
				'}',
				'@keyframes comboMeterFlash {',
				'  0% { opacity:0.85; }',
				'  100% { opacity:0; }',
				'}',
				'@keyframes comboMeterBorderPulse {',
				'  0%, 100% { filter: brightness(1); }',
				'  50% { filter: brightness(1.25); }',
				'}',
				'@keyframes comboMeterApexPulse {',
				'  0%, 100% { filter: brightness(1) drop-shadow(0 0 10px rgba(255,0,127,0.5)); }',
				'  50% { filter: brightness(1.35) drop-shadow(0 0 22px rgba(255,0,127,0.85)); }',
				'}',
				'@keyframes comboMeterApocalypseCrown {',
				'  0% { filter: brightness(1.1) drop-shadow(0 0 18px rgba(255,204,0,0.75)); transform: skewX(-6deg) scale(1); }',
				'  100% { filter: brightness(1.45) drop-shadow(0 0 36px rgba(255,23,68,0.95)); transform: skewX(-6deg) scale(1.02); }',
				'}',
				'@keyframes comboMeterCalamityPulse {',
				'  0% { filter: brightness(1.1) drop-shadow(0 0 22px rgba(255,85,0,0.75)); transform: skewX(-6deg) scale(1); }',
				'  100% { filter: brightness(1.5) drop-shadow(0 0 45px rgba(255,0,0,0.95)); transform: skewX(-6deg) scale(1.04); }',
				'}',
				'@keyframes comboMeterArmageddonSpin {',
				'  0% { filter: brightness(1.2) drop-shadow(0 0 30px rgba(255,0,60,0.85)); transform: skewX(-6deg) scale(1.02) rotate(-0.5deg); }',
				'  100% { filter: brightness(1.7) drop-shadow(0 0 60px rgba(255,204,0,1)); transform: skewX(-6deg) scale(1.06) rotate(0.5deg); }',
				'}',
				'@keyframes comboBorderPulseSPlus {',
				'  0% { box-shadow: inset 0 0 20px rgba(255, 0, 127, 0.4); opacity: 0.85; }',
				'  100% { box-shadow: inset 0 0 32px rgba(255, 0, 127, 0.65); opacity: 1; }',
				'}',
				'@keyframes comboBorderFlickerSDoublePlus {',
				'  0% { box-shadow: inset 0 0 30px rgba(255, 23, 68, 0.5), inset 0 0 10px rgba(255, 204, 0, 0.3); opacity: 0.9; }',
				'  25% { box-shadow: inset 0 0 45px rgba(255, 23, 68, 0.7), inset 0 0 20px rgba(255, 204, 0, 0.5); opacity: 1; }',
				'  50% { box-shadow: inset 0 0 35px rgba(255, 23, 68, 0.55), inset 0 0 15px rgba(255, 204, 0, 0.35); opacity: 0.92; }',
				'  75% { box-shadow: inset 0 0 50px rgba(255, 23, 68, 0.85), inset 0 0 25px rgba(255, 204, 0, 0.6); opacity: 1; }',
				'  100% { box-shadow: inset 0 0 40px rgba(255, 23, 68, 0.65), inset 0 0 18px rgba(255, 204, 0, 0.45); opacity: 0.95; }',
				'}',
				'@media (max-width: 768px) {',
				'  .combo-meter { right:10px !important; top:56px !important; }',
				'  .combo-meter__panel { min-width:110px !important; max-width:160px !important; padding:8px 10px 6px !important; }',
				'  .combo-meter__count { font-size:32px !important; }',
				'  .combo-meter__rank { font-size:10px !important; letter-spacing:0.12em !important; }',
				'  .combo-meter__label { font-size:7px !important; }',
				'  .combo-meter__bonus { font-size:8px !important; }',
				'}'
			].join('\n');
			document.head.appendChild(style);
		}

		playerMeters[playerId] = {
			rootEl,
			panelEl,
			countEl,
			rankEl,
			bonusEl,
			foeEl,
			toastEl,
			toastTitleEl,
			toastDetailEl,
			recoverEl,
			timerTrack,
			timerFill,
			hitFlashEl,
			cornerTL,
			cornerTR,
			cornerBL,
			cornerBR,
			borderEl,
			visible: false,
			lastShownCount: -1,
			lastTier: -1,
			lastAnnouncedTier: 0,
			punchUntil: 0,
			toastClearTimer: 0,
			lastVarietyToastAt: 0
		};
		return playerMeters[playerId];
	}

	function getMeterScaleAndPosition() {
		const isMobileUi = (typeof Engine !== 'undefined' && Engine.Input && Engine.Input.isMobileUiMode)
			? Engine.Input.isMobileUiMode()
			: (typeof window !== 'undefined' && window.innerWidth <= 900);

		const isDomTouchActive = (typeof MobileControlsDOM !== 'undefined' && MobileControlsDOM.layer && !MobileControlsDOM.layer.hidden);

		let scale = 1.0;
		let topPos = '72px';

		if (isMobileUi) {
			if (isDomTouchActive) {
				scale = 0.7; // Compact scale when virtual touch controls are active on screen
				topPos = '56px'; // Position right below top HUD chrome
			} else {
				scale = 0.82; // Moderate scale on mobile with Gamepad/Controller
				topPos = '60px';
			}
		} else {
			scale = 0.88; // Compact desktop scale — clears gear compare panel
			topPos = '72px';
		}

		return { scale, topPos, isMobileUi, isDomTouchActive };
	}

	function setVisible(meter, next) {
		const { scale, topPos } = getMeterScaleAndPosition();
		meter.rootEl.style.transformOrigin = 'top right';

		if (next === meter.visible) {
			if (next) {
				meter.rootEl.style.display = 'block';
				meter.rootEl.style.opacity = '1';
				meter.rootEl.style.top = topPos;
				meter.rootEl.style.transform = `scale(${scale}) translateX(0px)`;
			}
			return;
		}
		meter.visible = next;
		if (next) {
			meter.rootEl.style.display = 'block';
			void meter.rootEl.offsetWidth;
			meter.rootEl.style.opacity = '1';
			meter.rootEl.style.top = topPos;
			meter.rootEl.style.transform = `scale(${scale}) translateX(0px)`;
			meter.rootEl.setAttribute('aria-hidden', 'false');
		} else {
			meter.rootEl.style.opacity = '0';
			meter.rootEl.style.transform = `scale(${scale}) translateX(28px)`;
			meter.rootEl.setAttribute('aria-hidden', 'true');
			if (meter.borderEl) {
				meter.borderEl.style.opacity = '0';
				meter.borderEl.style.animation = 'none';
			}
			window.setTimeout(() => {
				if (!meter.visible) {
					if (meter.rootEl) meter.rootEl.style.display = 'none';
					if (meter.borderEl) meter.borderEl.style.display = 'none';
				}
			}, 200);
		}
	}

	function rankFor(tier, count) {
		if (tier >= 6 || count >= 120) return RANKS[6];
		if (tier >= 5 || count >= 80) return RANKS[5];
		if (tier >= 4 || count >= 50) return RANKS[4];
		if (tier >= 3 || count >= 30) return RANKS[3];
		if (tier >= 2 || count >= 15) return RANKS[2];
		if (tier >= 1 || count >= 5) return RANKS[1];
		return RANKS[0];
	}

	function applyRankStyle(meter, tier, count) {
		const rank = rankFor(tier, count);
		const label = rank.letter ? `${rank.letter} · ${rank.name}` : rank.name;
		meter.rankEl.textContent = label;
		meter.rankEl.style.fontSize = rank.rankSize || '12px';
		meter.rankEl.style.color = rank.color;
		meter.rankEl.style.textShadow = rank.rankShadow || `0 0 14px ${rank.glow}, 1px 1px 0 #000`;

		meter.countEl.style.fontSize = rank.countSize || '42px';
		meter.countEl.style.color = rank.countColor || '#ffffff';
		meter.countEl.style.textShadow = rank.countShadow || `0 0 12px ${rank.glow}, 2px 2px 0 #000`;

		meter.timerFill.style.background = rank.timerBg || `linear-gradient(90deg, ${rank.color}, #ffffff)`;
		meter.timerFill.style.boxShadow = rank.timerGlow || `0 0 12px ${rank.glow}`;

		if (meter.bonusEl) {
			const hasBonus = !!(rank.bonus && tier >= 1);
			meter.bonusEl.textContent = hasBonus ? rank.bonus : '';
			meter.bonusEl.style.display = hasBonus ? 'block' : 'none';
			meter.bonusEl.style.opacity = hasBonus ? '1' : '0';
			meter.bonusEl.style.color = tier >= 4 ? '#ffd76a' : (tier === 2 ? '#a3ffcc' : (tier === 3 ? '#ffa6d5' : 'rgba(170,200,255,0.85)'));
			meter.bonusEl.style.textShadow = tier >= 4
				? '0 0 10px rgba(255,200,80,0.85), 1px 1px 0 #000'
				: (tier === 2
					? '0 0 10px rgba(0,255,136,0.75), 1px 1px 0 #000'
					: (tier === 3
						? '0 0 10px rgba(255,0,127,0.75), 1px 1px 0 #000'
						: '0 0 8px rgba(120,180,255,0.55), 1px 1px 0 #000'));
		}
		if (meter.foeEl) {
			const hasFoe = !!(rank.foe && tier >= 1);
			meter.foeEl.textContent = hasFoe ? rank.foe : '';
			meter.foeEl.style.display = hasFoe ? 'block' : 'none';
			meter.foeEl.style.opacity = hasFoe ? '1' : '0';
		}
		if (meter.panelEl) {
			meter.panelEl.style.background = rank.bg;
			meter.panelEl.style.borderColor = rank.border;
			meter.panelEl.style.borderWidth = rank.borderWidth || '2px';
			meter.panelEl.style.boxShadow = rank.panelGlow;
			meter.panelEl.style.animation = rank.anim || 'none';
		}
		if (meter.timerTrack) {
			meter.timerTrack.style.borderColor = rank.border;
		}

		// Apply border effect
		if (meter.borderEl) {
			if (tier >= 4) {
				meter.borderEl.style.display = 'block';
				void meter.borderEl.offsetWidth;
				meter.borderEl.style.opacity = '1';
				if (tier === 4) { // S
					meter.borderEl.style.boxShadow = 'inset 0 0 20px rgba(255, 204, 0, 0.45)';
					meter.borderEl.style.background = 'linear-gradient(to right, rgba(255,204,0,0.06), transparent 8%, transparent 92%, rgba(255,204,0,0.06))';
					meter.borderEl.style.animation = 'none';
				} else if (tier === 5) { // S+
					meter.borderEl.style.boxShadow = 'inset 0 0 30px rgba(255, 0, 127, 0.55)';
					meter.borderEl.style.background = 'linear-gradient(to right, rgba(255,0,127,0.12), transparent 12%, transparent 88%, rgba(255,0,127,0.12))';
					meter.borderEl.style.animation = 'comboBorderPulseSPlus 2.0s infinite alternate';
				} else if (tier >= 6) { // S++
					meter.borderEl.style.boxShadow = 'inset 0 0 45px rgba(255, 23, 68, 0.7), inset 0 0 15px rgba(255, 204, 0, 0.4)';
					meter.borderEl.style.background = 'linear-gradient(to right, rgba(255,23,68,0.22), transparent 16%, transparent 84%, rgba(255,23,68,0.22))';
					meter.borderEl.style.animation = 'comboBorderFlickerSDoublePlus 1.2s infinite alternate';
				}
			} else {
				meter.borderEl.style.opacity = '0';
				meter.borderEl.style.animation = 'none';
				window.setTimeout(() => {
					if (meter.borderEl && meter.lastTier < 4) {
						meter.borderEl.style.display = 'none';
					}
				}, 300);
			}
		}

		const cMode = rank.corners || 'none';
		const corners = [meter.cornerTL, meter.cornerTR, meter.cornerBL, meter.cornerBR];
		corners.forEach(c => { if (c) c.style.opacity = '0'; });

		if (cMode === '2-cyan') {
			if (meter.cornerTL) { meter.cornerTL.style.opacity = '0.8'; meter.cornerTL.style.borderColor = rank.color; meter.cornerTL.style.boxShadow = 'none'; }
			if (meter.cornerBR) { meter.cornerBR.style.opacity = '0.8'; meter.cornerBR.style.borderColor = rank.color; meter.cornerBR.style.boxShadow = 'none'; }
		} else if (cMode === '2-orange' || cMode === '2-emerald' || cMode === '2-green') {
			if (meter.cornerTL) { meter.cornerTL.style.opacity = '0.9'; meter.cornerTL.style.borderColor = rank.color; meter.cornerTL.style.boxShadow = `0 0 6px ${rank.glow}`; }
			if (meter.cornerBR) { meter.cornerBR.style.opacity = '0.9'; meter.cornerBR.style.borderColor = rank.color; meter.cornerBR.style.boxShadow = `0 0 6px ${rank.glow}`; }
		} else if (cMode === '4-magenta') {
			corners.forEach(c => {
				if (c) {
					c.style.opacity = '1';
					c.style.borderColor = rank.color;
					c.style.boxShadow = `0 0 8px ${rank.glow}`;
				}
			});
		} else if (cMode === '4-gold-crown') {
			corners.forEach(c => {
				if (c) {
					c.style.opacity = '1';
					c.style.borderColor = '#ffcc00';
					c.style.boxShadow = '0 0 12px #ffcc00, 0 0 20px #ff1744';
				}
			});
		} else if (cMode === '4-calamity') {
			corners.forEach(c => {
				if (c) {
					c.style.opacity = '1';
					c.style.borderColor = '#ff5500';
					c.style.boxShadow = '0 0 16px #ff5500, 0 0 28px #ff0000';
				}
			});
		} else if (cMode === '4-armageddon') {
			corners.forEach(c => {
				if (c) {
					c.style.opacity = '1';
					c.style.borderColor = '#ff003c';
					c.style.boxShadow = '0 0 25px #ff003c, 0 0 45px #ffcc00, inset 0 0 10px #ffffff';
				}
			});
		}
	}

	function showMeterToast(meter, title, detail, options) {
		if (!meter.toastEl || !meter.toastTitleEl) return;
		const opts = options || {};
		const holdMs = opts.holdMs != null ? opts.holdMs : 3200;
		const color = opts.color || '#ffffff';
		const detailColor = opts.detailColor || 'rgba(220,230,255,0.92)';

		meter.toastTitleEl.textContent = title || '';
		meter.toastTitleEl.style.color = color;
		meter.toastDetailEl.textContent = detail || '';
		meter.toastDetailEl.style.color = detailColor;
		meter.toastDetailEl.style.display = detail ? 'block' : 'none';
		meter.toastDetailEl.style.whiteSpace = detail && detail.indexOf('\n') >= 0 ? 'pre-line' : 'normal';

		meter.toastEl.style.display = 'block';
		meter.toastEl.style.opacity = '1';
		meter.toastEl.style.transform = 'translateY(0)';
		meter.toastEl.style.borderColor = opts.border || 'rgba(180,200,255,0.45)';

		if (meter.toastClearTimer) window.clearTimeout(meter.toastClearTimer);
		meter.toastClearTimer = window.setTimeout(() => {
			if (!meter.toastEl) return;
			meter.toastEl.style.opacity = '0';
			meter.toastEl.style.transform = 'translateY(4px)';
			meter.toastEl.style.display = 'none';
			meter.toastClearTimer = 0;
		}, holdMs);
	}

	function announceTierChange(meter, prevTier, nextTier) {
		const prev = prevTier | 0;
		const next = nextTier | 0;
		if (prev === next) return;

		if (next > prev) {
			const rank = RANKS[next];
			if (rank && next >= 1) {
				const detail = [rank.bonus, rank.foe].filter(Boolean).join('\n');
				showMeterToast(
					meter,
					`${rank.letter} · ${rank.name}`,
					detail,
					{ color: rank.color, holdMs: 3500, border: rank.border }
				);
			}
			meter.lastAnnouncedTier = next;
			return;
		}

		const lost = RANKS[prev];
		const still = RANKS[next];
		let detail = '';
		if (next >= 1 && still) {
			detail = `Now: ${[still.bonus, still.foe].filter(Boolean).join('  ·  ')}`;
		} else {
			detail = 'Style buffs cleared';
		}
		showMeterToast(
			meter,
			lost && lost.letter ? `${lost.letter} lost` : 'Style drop',
			detail,
			{ color: '#ff8866', detailColor: '#ffd0c0', holdMs: 3500, border: 'rgba(255,100,80,0.55)' }
		);
		meter.lastAnnouncedTier = next;
	}

	function punchCount(meter) {
		if (!meter.countEl) return;
		meter.countEl.style.animation = 'none';
		void meter.countEl.offsetWidth;
		meter.countEl.style.animation = 'comboMeterPunch 0.28s cubic-bezier(0.2, 0.9, 0.3, 1)';
		if (meter.hitFlashEl) {
			meter.hitFlashEl.style.animation = 'none';
			void meter.hitFlashEl.offsetWidth;
			meter.hitFlashEl.style.animation = 'comboMeterFlash 0.35s ease-out';
		}
		meter.punchUntil = performance.now() + 280;
	}

	function punchRank(meter) {
		if (!meter.rankEl) return;
		meter.rankEl.style.animation = 'none';
		void meter.rankEl.offsetWidth;
		meter.rankEl.style.animation = 'comboMeterRankIn 0.4s cubic-bezier(0.15, 0.85, 0.25, 1)';
	}

	function refreshFromState(meter, state, options) {
		const opts = options || {};
		if (!state) return;
		const tier = state.comboTier | 0;
		const count = state.comboCount | 0;
		const show = count >= 1;

		if (!show) {
			if (meter.lastTier >= 1) {
				announceTierChange(meter, meter.lastTier, 0);
			}
			setVisible(meter, false);
			meter.lastTier = 0;
			meter.lastShownCount = 0;
			meter.lastAnnouncedTier = 0;
			return;
		}

		setVisible(meter, true);
		applyRankStyle(meter, tier, count);
		meter.countEl.textContent = String(count);

		if (tier !== meter.lastTier) {
			punchRank(meter);
			announceTierChange(meter, meter.lastTier, tier);
		}
		if (opts.punchCount || count > meter.lastShownCount) punchCount(meter);
		else if (opts.punchRank && tier === meter.lastTier) punchRank(meter);

		meter.lastTier = tier;
		meter.lastShownCount = count;

		const maxT = getComboTimerMax();
		const ratio = maxT > 0 ? Math.max(0, Math.min(1, (state.comboTimer || 0) / maxT)) : 0;
		meter.timerFill.style.transform = `scaleX(${ratio})`;
	}

	function onTierChanged(detail) {
		if (!isSurgeArenaActive() || !isHudAllowed()) return;
		const playerId = detail && detail.playerId || (typeof Game !== 'undefined' && Game.getLocalPlayerId ? Game.getLocalPlayerId() : 'local');
		const meter = ensurePlayerMeter(playerId);
		refreshFromState(meter, {
			comboTier: detail && detail.tier,
			comboCount: detail && detail.comboCount,
			comboTimer: getComboTimerMax()
		}, { punchRank: true, punchCount: true });
	}

	// Dynamic positioning helper
	function updateMeterViewportPosition(playerId, meter) {
		if (typeof Game === 'undefined' || !Game) return;
		const isP2 = (playerId === Game.localSplitPlayerId);
		const rightPos = Game.localSplitEnabled
			? (isP2 ? '22px' : 'calc(50% + 22px)')
			: '22px';
		if (meter.rootEl.style.right !== rightPos) {
			meter.rootEl.style.right = rightPos;
		}

		if (meter.borderEl) {
			if (Game.localSplitEnabled) {
				meter.borderEl.style.width = '50%';
				meter.borderEl.style.left = isP2 ? '50%' : '0';
				meter.borderEl.style.display = 'block';
			} else {
				if (isP2) {
					meter.borderEl.style.display = 'none';
				} else {
					meter.borderEl.style.width = '100%';
					meter.borderEl.style.left = '0';
					meter.borderEl.style.display = 'block';
				}
			}
		}
	}

	function onCountChanged(detail) {
		if (!isSurgeArenaActive() || !isHudAllowed()) return;
		const playerId = detail && detail.playerId || (typeof Game !== 'undefined' && Game.getLocalPlayerId ? Game.getLocalPlayerId() : 'local');
		const meter = ensurePlayerMeter(playerId);
		updateMeterViewportPosition(playerId, meter);
		refreshFromState(meter, {
			comboTier: detail && detail.tier,
			comboCount: detail && detail.comboCount,
			comboTimer: detail && detail.comboTimer
		}, { punchCount: true });
	}

	function onBleedApplied(detail) {
		if (!isSurgeArenaActive() || !isHudAllowed()) return;
		const playerId = detail && detail.playerId || (typeof Game !== 'undefined' && Game.getLocalPlayerId ? Game.getLocalPlayerId() : 'local');
		const meter = ensurePlayerMeter(playerId);
		updateMeterViewportPosition(playerId, meter);
		const lost = detail && detail.amountLost | 0;
		const count = detail && detail.comboCount | 0;
		let tier = 0;
		if (detail && typeof detail.tier === 'number') {
			tier = detail.tier | 0;
		} else {
			const state = getComboState(playerId);
			tier = state ? (state.comboTier | 0) : 0;
		}
		if (lost > 0) {
			showMeterToast(
				meter,
				`Hit −${lost}`,
				'Recover: dash through an enemy or land a heavy',
				{ color: '#ff6644', detailColor: '#ffccbb', holdMs: 3000, border: 'rgba(255,80,60,0.55)' }
			);
		}
		if (meter.countEl) {
			meter.countEl.textContent = String(count);
			meter.countEl.style.color = '#ff6644';
			window.setTimeout(() => {
				if (meter.countEl) meter.countEl.style.color = '#ffffff';
			}, 180);
		}
		if (meter.recoverEl && detail && detail.recoveryWindow > 0) {
			meter.recoverEl.style.display = 'block';
			meter.recoverEl.style.opacity = '1';
		}
		if (count < 1) {
			setVisible(meter, false);
			meter.lastTier = 0;
			meter.lastShownCount = 0;
			meter.lastAnnouncedTier = 0;
			return;
		}
		applyRankStyle(meter, tier, count);
		meter.lastShownCount = count;
		meter.lastTier = tier;
	}

	function onStyleRecovered(detail) {
		if (!isSurgeArenaActive() || !isHudAllowed()) return;
		const playerId = detail && detail.playerId || (typeof Game !== 'undefined' && Game.getLocalPlayerId ? Game.getLocalPlayerId() : 'local');
		const meter = ensurePlayerMeter(playerId);
		updateMeterViewportPosition(playerId, meter);
		showMeterToast(
			meter,
			'Style Recovery',
			`+${(detail && detail.restored) || 0} combo restored`,
			{ color: '#66ffcc', detailColor: '#b8ffe8', holdMs: 2800, border: 'rgba(80,255,200,0.55)' }
		);
		if (meter.recoverEl) {
			meter.recoverEl.style.opacity = '0';
			meter.recoverEl.style.display = 'none';
		}
		if (detail) {
			refreshFromState(meter, {
				comboTier: detail.tier,
				comboCount: detail.comboCount,
				comboTimer: getComboTimerMax()
			}, { punchCount: true, punchRank: true });
		}
	}

	function onStyleCrashed(detail) {
		if (!isSurgeArenaActive() || !isHudAllowed()) return;
		const playerId = detail && detail.playerId || (typeof Game !== 'undefined' && Game.getLocalPlayerId ? Game.getLocalPlayerId() : 'local');
		const meter = ensurePlayerMeter(playerId);
		updateMeterViewportPosition(playerId, meter);
		const to = detail && detail.toTier;
		const still = RANKS[to | 0];
		showMeterToast(
			meter,
			'S-Rank Crash',
			still && still.letter
				? `Dropped to ${still.letter} · ${still.name} — pick up ejected credits`
				: 'Dropped two ranks — pick up ejected credits',
			{ color: '#ff3355', detailColor: '#ffb0b8', holdMs: 4000, border: 'rgba(255,50,70,0.6)' }
		);
		if (detail) {
			refreshFromState(meter, {
				comboTier: detail.toTier,
				comboCount: detail.comboCount,
				comboTimer: getComboTimerMax()
			}, { punchRank: true });
		}
	}

	function onVarietyBonus(detail) {
		if (!isSurgeArenaActive() || !isHudAllowed()) return;
		if (!detail || !(detail.bonus > 0)) return;
		const playerId = detail && detail.playerId || (typeof Game !== 'undefined' && Game.getLocalPlayerId ? Game.getLocalPlayerId() : 'local');
		const meter = ensurePlayerMeter(playerId);
		// Throttle — mixing every kill shouldn't flood the meter toast.
		const now = performance.now();
		if (now - meter.lastVarietyToastAt < 4500) {
			punchCount(meter);
			return;
		}
		meter.lastVarietyToastAt = now;
		showMeterToast(
			meter,
			'Mixed attacks +1',
			'Keep cycling primary / special / heavy / dash',
			{ color: '#ffe066', detailColor: '#fff0b0', holdMs: 2400, border: 'rgba(255,220,80,0.45)' }
		);
	}

	function onApexPulse(detail) {
		if (!isSurgeArenaActive() || !isHudAllowed()) return;
		const playerId = detail && detail.playerId || (typeof Game !== 'undefined' && Game.getLocalPlayerId ? Game.getLocalPlayerId() : 'local');
		const meter = ensurePlayerMeter(playerId);
		showMeterToast(
			meter,
			'Apex EMP',
			'Nearby enemy projectiles cleared',
			{ color: '#66e0ff', detailColor: '#c8f4ff', holdMs: 3000, border: 'rgba(80,220,255,0.55)' }
		);
	}

	function bindBus() {
		if (busTeardown) return;
		if (typeof GameBus === 'undefined' || !GameBus.subscribe) return;
		busTeardown = GameBus.subscribe({
			'combo:tierChanged': onTierChanged,
			'combo:countChanged': onCountChanged,
			'combo:bleedApplied': onBleedApplied,
			'combo:styleRecovered': onStyleRecovered,
			'combo:styleCrashed': onStyleCrashed,
			'combo:varietyBonus': onVarietyBonus,
			'combo:apexPulse': onApexPulse
		});
	}

	function tick() {
		rafId = window.requestAnimationFrame(tick);
		bindBus();

		if (!isSurgeArenaActive() || !isHudAllowed()) {
			Object.keys(playerMeters).forEach(playerId => {
				const meter = playerMeters[playerId];
				if (meter.visible) setVisible(meter, false);
			});
			return;
		}

		// Find active local players (works for singleplayer, local co-op, and remote clients)
		const activeIds = [];
		if (typeof Game !== 'undefined' && Game) {
			const localId = (typeof Game.getLocalPlayerId === 'function')
				? Game.getLocalPlayerId()
				: ((typeof multiplayerManager !== 'undefined' && multiplayerManager && multiplayerManager.playerId) ? multiplayerManager.playerId : 'local');
			if (localId) activeIds.push(localId);

			if (Game.localSplitEnabled && Game.localSplitPlayerId) {
				activeIds.push(Game.localSplitPlayerId);
			}
		}

		// Hide any meters of players that are no longer active
		Object.keys(playerMeters).forEach(playerId => {
			if (activeIds.indexOf(playerId) < 0) {
				const meter = playerMeters[playerId];
				if (meter.visible) setVisible(meter, false);
			}
		});

		// Update active player meters
		activeIds.forEach(playerId => {
			const meter = ensurePlayerMeter(playerId);
			updateMeterViewportPosition(playerId, meter);

			const state = getComboState(playerId);
			if (!state || !(state.comboCount > 0)) {
				if (meter.visible && meter.lastTier >= 1) {
					announceTierChange(meter, meter.lastTier, 0);
				}
				if (meter.visible) setVisible(meter, false);
				meter.lastShownCount = 0;
				meter.lastTier = 0;
				meter.lastAnnouncedTier = 0;
				return;
			}

			const tier = state.comboTier | 0;
			const count = state.comboCount | 0;
			setVisible(meter, true);
			if (tier !== meter.lastTier || count !== meter.lastShownCount) {
				applyRankStyle(meter, tier, count);
				meter.countEl.textContent = String(count);
				if (count > meter.lastShownCount) punchCount(meter);
				if (tier !== meter.lastTier) {
					punchRank(meter);
					announceTierChange(meter, meter.lastTier, tier);
				}
				meter.lastTier = tier;
				meter.lastShownCount = count;
			}

			const maxT = getComboTimerMax();
			const ratio = maxT > 0 ? Math.max(0, Math.min(1, (state.comboTimer || 0) / maxT)) : 0;
			meter.timerFill.style.transform = `scaleX(${ratio})`;

			if (meter.recoverEl) {
				const recovering = state.recoveryWindow > 0;
				meter.recoverEl.style.display = recovering ? 'block' : 'none';
				meter.recoverEl.style.opacity = recovering ? '1' : '0';
			}

			if (tier >= 3 && performance.now() > meter.punchUntil) {
				const pulse = 1 + Math.sin(performance.now() / 180) * 0.03;
				meter.countEl.style.transform = `scale(${pulse})`;
			} else if (performance.now() > meter.punchUntil) {
				meter.countEl.style.transform = 'scale(1)';
			}
		});
	}

	function init() {
		if (typeof Game !== 'undefined' && Game) {
			const p1 = Game.getLocalPlayerId ? Game.getLocalPlayerId() : 'local';
			ensurePlayerMeter(p1);
		}
		bindBus();
		if (!rafId) rafId = window.requestAnimationFrame(tick);
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init);
	} else {
		init();
	}

	window.ComboMeterUI = {
		init,
		RANKS
	};
})();

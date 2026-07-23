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
			countSize: '48px',
			countColor: '#9ab0cc',
			countShadow: 'none',
			rankSize: '13px',
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
			countSize: '54px',
			countColor: '#e0f7ff',
			countShadow: '0 0 10px rgba(0,229,255,0.7), 2px 2px 0 #000',
			rankSize: '15px',
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
			countSize: '60px',
			countColor: '#e6fffa',
			countShadow: '0 0 14px rgba(0,255,136,0.85), 0 0 24px rgba(0,255,136,0.4), 2px 2px 0 #000',
			rankSize: '16px',
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
			countSize: '66px',
			countColor: '#ffe6f2',
			countShadow: '0 0 18px rgba(255,0,127,0.9), 0 0 32px rgba(255,0,127,0.5), 2px 2px 0 #000',
			rankSize: '18px',
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
			countSize: '74px',
			countColor: '#ffffff',
			countShadow: '0 0 22px #ffcc00, 0 0 45px #ff1744, 0 0 70px #ffcc00, 2px 2px 0 #000',
			rankSize: '20px',
			rankShadow: '0 0 20px #ffcc00, 0 0 35px #ff1744, 1px 1px 0 #000',
			corners: '4-gold-crown',
			anim: 'comboMeterApocalypseCrown 0.9s ease-in-out infinite alternate',
			bonus: 'You: ×3 credits · +40% CDR · lifesteal · shatter',
			foe: 'Arena: spawn storm (hit = Style Crash)'
		}
	});

	let rootEl = null;
	let panelEl = null;
	let countEl = null;
	let rankEl = null;
	let bonusEl = null;
	let foeEl = null;
	let toastEl = null;
	let toastTitleEl = null;
	let toastDetailEl = null;
	let recoverEl = null;
	let timerFill = null;
	let timerTrack = null;
	let hitFlashEl = null;
	let cornerTL = null;
	let cornerTR = null;
	let cornerBL = null;
	let cornerBR = null;
	let busTeardown = null;
	let lastShownCount = -1;
	let lastTier = -1;
	let lastAnnouncedTier = 0;
	let punchUntil = 0;
	let toastClearTimer = 0;
	let lastVarietyToastAt = 0;
	let visible = false;
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

	function getComboState() {
		if (typeof SurgeArenaRules !== 'undefined' && SurgeArenaRules.getComboState) {
			const state = SurgeArenaRules.getComboState();
			if (state) return state;
		}
		const game = typeof Game !== 'undefined' ? Game : null;
		if (game && typeof game.comboCount === 'number') {
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

	function ensureDom() {
		if (rootEl) return;
		const mount = document.body;

		rootEl = document.createElement('div');
		rootEl.id = 'combo-meter';
		rootEl.className = 'combo-meter';
		rootEl.setAttribute('aria-hidden', 'true');
		rootEl.style.cssText = [
			'position:fixed',
			'right:22px',
			'top:18%',
			'z-index:3200',
			'pointer-events:none',
			'user-select:none',
			'font-family:Orbitron,sans-serif',
			'opacity:0',
			'transform:translateX(28px)',
			'transition:opacity 0.2s ease, transform 0.2s ease',
			'display:none'
		].join(';');

		panelEl = document.createElement('div');
		panelEl.className = 'combo-meter__panel';
		panelEl.style.cssText = [
			'position:relative',
			'min-width:210px',
			'max-width:260px',
			'padding:14px 18px 12px',
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

		hitFlashEl = document.createElement('div');
		hitFlashEl.className = 'combo-meter__flash';
		hitFlashEl.style.cssText = [
			'position:absolute',
			'inset:0',
			'pointer-events:none',
			'opacity:0',
			'background:linear-gradient(90deg, transparent, rgba(255,255,255,0.28))',
			'z-index:2'
		].join(';');

		cornerTL = document.createElement('div');
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

		cornerTR = document.createElement('div');
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

		cornerBL = document.createElement('div');
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

		cornerBR = document.createElement('div');
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
		label.textContent = 'STYLE';
		label.style.cssText = [
			'font-size:10px',
			'font-weight:700',
			'letter-spacing:0.35em',
			'color:rgba(170,190,255,0.75)',
			'margin-bottom:2px',
			'text-transform:uppercase'
		].join(';');

		countEl = document.createElement('div');
		countEl.id = 'combo-meter-count';
		countEl.className = 'combo-meter__count';
		countEl.style.cssText = [
			'font-size:64px',
			'font-weight:900',
			'line-height:0.92',
			'letter-spacing:-1px',
			'color:#ffffff',
			'text-shadow:0 0 10px rgba(120,200,255,0.85), 0 0 22px rgba(100,150,255,0.55), 2px 2px 0 #000',
			'transform-origin:right center'
		].join(';');
		countEl.textContent = '0';

		rankEl = document.createElement('div');
		rankEl.id = 'combo-meter-rank';
		rankEl.className = 'combo-meter__rank';
		rankEl.style.cssText = [
			'font-size:16px',
			'font-weight:800',
			'letter-spacing:0.22em',
			'margin-top:2px',
			'margin-right:-0.22em',
			'color:#88ccff',
			'text-shadow:0 0 12px rgba(100,180,255,0.85), 1px 1px 0 #000'
		].join(';');
		rankEl.textContent = 'D · DUST';

		bonusEl = document.createElement('div');
		bonusEl.id = 'combo-meter-bonus';
		bonusEl.className = 'combo-meter__bonus';
		bonusEl.style.cssText = [
			'font-size:12px',
			'font-weight:700',
			'letter-spacing:0.04em',
			'margin-top:8px',
			'min-height:16px',
			'line-height:1.25',
			'color:#ffd76a',
			'text-shadow:0 0 8px rgba(255,200,80,0.7), 1px 1px 0 #000',
			'opacity:0',
			'transition:opacity 0.18s ease'
		].join(';');
		bonusEl.textContent = '';

		foeEl = document.createElement('div');
		foeEl.id = 'combo-meter-foe';
		foeEl.className = 'combo-meter__foe';
		foeEl.style.cssText = [
			'font-size:11px',
			'font-weight:700',
			'letter-spacing:0.06em',
			'margin-top:4px',
			'min-height:14px',
			'line-height:1.25',
			'color:#ff6688',
			'text-shadow:0 0 8px rgba(255,80,100,0.7), 1px 1px 0 #000',
			'opacity:0',
			'transition:opacity 0.18s ease'
		].join(';');
		foeEl.textContent = '';

		toastEl = document.createElement('div');
		toastEl.id = 'combo-meter-toast';
		toastEl.className = 'combo-meter__toast';
		toastEl.style.cssText = [
			'margin-top:10px',
			'padding:8px 10px',
			'min-height:42px',
			'border-radius:3px',
			'background:rgba(0,0,0,0.55)',
			'border:1px solid rgba(180,200,255,0.35)',
			'opacity:0',
			'transform:translateY(4px)',
			'transition:opacity 0.2s ease, transform 0.2s ease',
			'text-align:right'
		].join(';');

		toastTitleEl = document.createElement('div');
		toastTitleEl.style.cssText = [
			'font-size:13px',
			'font-weight:800',
			'letter-spacing:0.08em',
			'line-height:1.2',
			'color:#ffffff',
			'text-shadow:1px 1px 0 #000'
		].join(';');

		toastDetailEl = document.createElement('div');
		toastDetailEl.style.cssText = [
			'font-size:11px',
			'font-weight:600',
			'letter-spacing:0.03em',
			'line-height:1.3',
			'margin-top:3px',
			'color:rgba(220,230,255,0.92)',
			'text-shadow:1px 1px 0 #000'
		].join(';');
		toastEl.appendChild(toastTitleEl);
		toastEl.appendChild(toastDetailEl);

		recoverEl = document.createElement('div');
		recoverEl.id = 'combo-meter-recover';
		recoverEl.className = 'combo-meter__recover';
		recoverEl.style.cssText = [
			'font-size:12px',
			'font-weight:800',
			'letter-spacing:0.1em',
			'margin-top:6px',
			'padding:6px 8px',
			'border-radius:3px',
			'background:rgba(0,40,35,0.7)',
			'border:1px solid rgba(80,255,200,0.55)',
			'color:#66ffcc',
			'text-shadow:0 0 10px rgba(80,255,200,0.85), 1px 1px 0 #000',
			'opacity:0',
			'transition:opacity 0.12s ease'
		].join(';');
		recoverEl.textContent = 'RECOVER — dash through or heavy hit';

		timerTrack = document.createElement('div');
		timerTrack.className = 'combo-meter__timer-track';
		timerTrack.style.cssText = [
			'margin-top:10px',
			'margin-left:auto',
			'width:100%',
			'height:7px',
			'background:rgba(0,0,0,0.55)',
			'border:1px solid rgba(120,160,255,0.4)',
			'border-radius:2px',
			'overflow:hidden',
			'box-shadow:inset 0 0 6px rgba(0,0,0,0.6)'
		].join(';');

		timerFill = document.createElement('div');
		timerFill.id = 'combo-meter-timer';
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
		mount.appendChild(rootEl);

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
				'@media (max-width: 768px) {',
				'  #combo-meter { right:10px !important; top:16% !important; }',
				'  .combo-meter__panel { min-width:110px !important; padding:10px 12px 8px !important; }',
				'  #combo-meter-count { font-size:42px !important; }',
				'  #combo-meter-rank { font-size:12px !important; letter-spacing:0.14em !important; }',
				'  .combo-meter__label { font-size:8px !important; }',
				'  .combo-meter__bonus { font-size:8px !important; }',
				'}'
			].join('\n');
			document.head.appendChild(style);
		}
	}

	function setVisible(next) {
		ensureDom();
		if (next === visible) {
			if (next) {
				rootEl.style.display = 'block';
				rootEl.style.opacity = '1';
				rootEl.style.transform = 'translateX(0)';
			}
			return;
		}
		visible = next;
		if (next) {
			rootEl.style.display = 'block';
			void rootEl.offsetWidth;
			rootEl.style.opacity = '1';
			rootEl.style.transform = 'translateX(0)';
			rootEl.setAttribute('aria-hidden', 'false');
		} else {
			rootEl.style.opacity = '0';
			rootEl.style.transform = 'translateX(28px)';
			rootEl.setAttribute('aria-hidden', 'true');
			window.setTimeout(() => {
				if (!visible && rootEl) rootEl.style.display = 'none';
			}, 200);
		}
	}

	function rankFor(tier, count) {
		if (tier >= 4 || count >= 50) return RANKS[4];
		if (tier >= 3 || count >= 30) return RANKS[3];
		if (tier >= 2 || count >= 15) return RANKS[2];
		if (tier >= 1 || count >= 5) return RANKS[1];
		return RANKS[0];
	}

	function applyRankStyle(tier, count) {
		const rank = rankFor(tier, count);
		const label = rank.letter ? `${rank.letter} · ${rank.name}` : rank.name;
		rankEl.textContent = label;
		rankEl.style.fontSize = rank.rankSize || '16px';
		rankEl.style.color = rank.color;
		rankEl.style.textShadow = rank.rankShadow || `0 0 14px ${rank.glow}, 1px 1px 0 #000`;

		countEl.style.fontSize = rank.countSize || '64px';
		countEl.style.color = rank.countColor || '#ffffff';
		countEl.style.textShadow = rank.countShadow || `0 0 12px ${rank.glow}, 2px 2px 0 #000`;

		timerFill.style.background = rank.timerBg || `linear-gradient(90deg, ${rank.color}, #ffffff)`;
		timerFill.style.boxShadow = rank.timerGlow || `0 0 12px ${rank.glow}`;

		if (bonusEl) {
			const hasBonus = !!(rank.bonus && tier >= 1);
			bonusEl.textContent = hasBonus ? rank.bonus : '';
			bonusEl.style.opacity = hasBonus ? '1' : '0';
			bonusEl.style.color = tier >= 4 ? '#ffd76a' : (tier === 2 ? '#a3ffcc' : (tier === 3 ? '#ffa6d5' : 'rgba(170,200,255,0.85)'));
			bonusEl.style.textShadow = tier >= 4
				? '0 0 10px rgba(255,200,80,0.85), 1px 1px 0 #000'
				: (tier === 2
					? '0 0 10px rgba(0,255,136,0.75), 1px 1px 0 #000'
					: (tier === 3
						? '0 0 10px rgba(255,0,127,0.75), 1px 1px 0 #000'
						: '0 0 8px rgba(120,180,255,0.55), 1px 1px 0 #000'));
		}
		if (foeEl) {
			const hasFoe = !!(rank.foe && tier >= 1);
			foeEl.textContent = hasFoe ? rank.foe : '';
			foeEl.style.opacity = hasFoe ? '1' : '0';
		}
		if (panelEl) {
			panelEl.style.background = rank.bg;
			panelEl.style.borderColor = rank.border;
			panelEl.style.borderWidth = rank.borderWidth || '2px';
			panelEl.style.boxShadow = rank.panelGlow;
			panelEl.style.animation = rank.anim || 'none';
		}
		if (timerTrack) {
			timerTrack.style.borderColor = rank.border;
		}

		const cMode = rank.corners || 'none';
		const corners = [cornerTL, cornerTR, cornerBL, cornerBR];
		corners.forEach(c => { if (c) c.style.opacity = '0'; });

		if (cMode === '2-cyan') {
			if (cornerTL) { cornerTL.style.opacity = '0.8'; cornerTL.style.borderColor = rank.color; cornerTL.style.boxShadow = 'none'; }
			if (cornerBR) { cornerBR.style.opacity = '0.8'; cornerBR.style.borderColor = rank.color; cornerBR.style.boxShadow = 'none'; }
		} else if (cMode === '2-orange' || cMode === '2-emerald' || cMode === '2-green') {
			if (cornerTL) { cornerTL.style.opacity = '0.9'; cornerTL.style.borderColor = rank.color; cornerTL.style.boxShadow = `0 0 6px ${rank.glow}`; }
			if (cornerBR) { cornerBR.style.opacity = '0.9'; cornerBR.style.borderColor = rank.color; cornerBR.style.boxShadow = `0 0 6px ${rank.glow}`; }
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
		}
	}

	/**
	 * Fixed-screen toast on the meter (never world-space floaters).
	 * One headline + one optional detail, readable and long enough to parse.
	 */
	function showMeterToast(title, detail, options) {
		ensureDom();
		if (!toastEl || !toastTitleEl) return;
		const opts = options || {};
		const holdMs = opts.holdMs != null ? opts.holdMs : 3200;
		const color = opts.color || '#ffffff';
		const detailColor = opts.detailColor || 'rgba(220,230,255,0.92)';

		toastTitleEl.textContent = title || '';
		toastTitleEl.style.color = color;
		toastDetailEl.textContent = detail || '';
		toastDetailEl.style.color = detailColor;
		toastDetailEl.style.display = detail ? 'block' : 'none';
		toastDetailEl.style.whiteSpace = detail && detail.indexOf('\n') >= 0 ? 'pre-line' : 'normal';

		toastEl.style.opacity = '1';
		toastEl.style.transform = 'translateY(0)';
		toastEl.style.borderColor = opts.border || 'rgba(180,200,255,0.45)';

		if (toastClearTimer) window.clearTimeout(toastClearTimer);
		toastClearTimer = window.setTimeout(() => {
			if (!toastEl) return;
			toastEl.style.opacity = '0';
			toastEl.style.transform = 'translateY(4px)';
			toastClearTimer = 0;
		}, holdMs);
	}

	/**
	 * Announce tier changes on the meter toast — not above the player.
	 */
	function announceTierChange(prevTier, nextTier) {
		const prev = prevTier | 0;
		const next = nextTier | 0;
		if (prev === next) return;

		if (next > prev) {
			const rank = RANKS[next];
			if (rank && next >= 1) {
				const detail = [rank.bonus, rank.foe].filter(Boolean).join('\n');
				showMeterToast(
					`${rank.letter} · ${rank.name}`,
					detail,
					{ color: rank.color, holdMs: 3500, border: rank.border }
				);
			}
			lastAnnouncedTier = next;
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
			lost && lost.letter ? `${lost.letter} lost` : 'Style drop',
			detail,
			{ color: '#ff8866', detailColor: '#ffd0c0', holdMs: 3500, border: 'rgba(255,100,80,0.55)' }
		);
		lastAnnouncedTier = next;
	}

	function punchCount() {
		if (!countEl) return;
		countEl.style.animation = 'none';
		void countEl.offsetWidth;
		countEl.style.animation = 'comboMeterPunch 0.28s cubic-bezier(0.2, 0.9, 0.3, 1)';
		if (hitFlashEl) {
			hitFlashEl.style.animation = 'none';
			void hitFlashEl.offsetWidth;
			hitFlashEl.style.animation = 'comboMeterFlash 0.35s ease-out';
		}
		punchUntil = performance.now() + 280;
	}

	function punchRank() {
		if (!rankEl) return;
		rankEl.style.animation = 'none';
		void rankEl.offsetWidth;
		rankEl.style.animation = 'comboMeterRankIn 0.4s cubic-bezier(0.15, 0.85, 0.25, 1)';
	}

	function refreshFromState(state, options) {
		const opts = options || {};
		if (!state) return;
		const tier = state.comboTier | 0;
		const count = state.comboCount | 0;
		const show = count >= 1;

		if (!show) {
			if (lastTier >= 1) {
				announceTierChange(lastTier, 0);
			}
			setVisible(false);
			lastTier = 0;
			lastShownCount = 0;
			lastAnnouncedTier = 0;
			return;
		}

		setVisible(true);
		applyRankStyle(tier, count);
		countEl.textContent = String(count);

		if (tier !== lastTier) {
			punchRank();
			announceTierChange(lastTier, tier);
		}
		if (opts.punchCount || count > lastShownCount) punchCount();
		else if (opts.punchRank && tier === lastTier) punchRank();

		lastTier = tier;
		lastShownCount = count;

		const maxT = getComboTimerMax();
		const ratio = maxT > 0 ? Math.max(0, Math.min(1, (state.comboTimer || 0) / maxT)) : 0;
		timerFill.style.transform = `scaleX(${ratio})`;
	}

	function onTierChanged(detail) {
		if (!isSurgeArenaActive() || !isHudAllowed()) return;
		ensureDom();
		refreshFromState({
			comboTier: detail && detail.tier,
			comboCount: detail && detail.comboCount,
			comboTimer: getComboTimerMax()
		}, { punchRank: true, punchCount: true });
	}

	function onCountChanged(detail) {
		if (!isSurgeArenaActive() || !isHudAllowed()) return;
		ensureDom();
		refreshFromState({
			comboTier: detail && detail.tier,
			comboCount: detail && detail.comboCount,
			comboTimer: detail && detail.comboTimer
		}, { punchCount: true });
	}

	function onBleedApplied(detail) {
		if (!isSurgeArenaActive() || !isHudAllowed()) return;
		ensureDom();
		const lost = detail && detail.amountLost | 0;
		const count = detail && detail.comboCount | 0;
		let tier = 0;
		if (detail && typeof detail.tier === 'number') {
			tier = detail.tier | 0;
		} else {
			const state = getComboState();
			tier = state ? (state.comboTier | 0) : 0;
		}
		if (lost > 0) {
			showMeterToast(
				`Hit −${lost}`,
				'Recover: dash through an enemy or land a heavy',
				{ color: '#ff6644', detailColor: '#ffccbb', holdMs: 3000, border: 'rgba(255,80,60,0.55)' }
			);
		}
		if (countEl) {
			countEl.textContent = String(count);
			countEl.style.color = '#ff6644';
			window.setTimeout(() => {
				if (countEl) countEl.style.color = '#ffffff';
			}, 180);
		}
		if (recoverEl && detail && detail.recoveryWindow > 0) {
			recoverEl.style.opacity = '1';
		}
		if (count < 1) {
			setVisible(false);
			lastTier = 0;
			lastShownCount = 0;
			lastAnnouncedTier = 0;
			return;
		}
		applyRankStyle(tier, count);
		lastShownCount = count;
		lastTier = tier;
	}

	function onStyleRecovered(detail) {
		if (!isSurgeArenaActive() || !isHudAllowed()) return;
		ensureDom();
		showMeterToast(
			'Style Recovery',
			`+${(detail && detail.restored) || 0} combo restored`,
			{ color: '#66ffcc', detailColor: '#b8ffe8', holdMs: 2800, border: 'rgba(80,255,200,0.55)' }
		);
		if (recoverEl) recoverEl.style.opacity = '0';
		if (detail) {
			refreshFromState({
				comboTier: detail.tier,
				comboCount: detail.comboCount,
				comboTimer: getComboTimerMax()
			}, { punchCount: true, punchRank: true });
		}
	}

	function onStyleCrashed(detail) {
		if (!isSurgeArenaActive() || !isHudAllowed()) return;
		ensureDom();
		const to = detail && detail.toTier;
		const still = RANKS[to | 0];
		showMeterToast(
			'S-Rank Crash',
			still && still.letter
				? `Dropped to ${still.letter} · ${still.name} — pick up ejected credits`
				: 'Dropped two ranks — pick up ejected credits',
			{ color: '#ff3355', detailColor: '#ffb0b8', holdMs: 4000, border: 'rgba(255,50,70,0.6)' }
		);
		if (detail) {
			refreshFromState({
				comboTier: detail.toTier,
				comboCount: detail.comboCount,
				comboTimer: getComboTimerMax()
			}, { punchRank: true });
		}
	}

	function onVarietyBonus(detail) {
		if (!isSurgeArenaActive() || !isHudAllowed()) return;
		if (!detail || !(detail.bonus > 0)) return;
		ensureDom();
		// Throttle — mixing every kill shouldn't flood the meter toast.
		const now = performance.now();
		if (now - lastVarietyToastAt < 4500) {
			punchCount();
			return;
		}
		lastVarietyToastAt = now;
		showMeterToast(
			'Mixed attacks +1',
			'Keep cycling primary / special / heavy / dash',
			{ color: '#ffe066', detailColor: '#fff0b0', holdMs: 2400, border: 'rgba(255,220,80,0.45)' }
		);
	}

	function onApexPulse() {
		if (!isSurgeArenaActive() || !isHudAllowed()) return;
		ensureDom();
		showMeterToast(
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
			if (visible) setVisible(false);
			return;
		}

		ensureDom();
		const state = getComboState();
		if (!state || !(state.comboCount > 0)) {
			if (visible && lastTier >= 1) {
				announceTierChange(lastTier, 0);
			}
			if (visible) setVisible(false);
			lastShownCount = 0;
			lastTier = 0;
			lastAnnouncedTier = 0;
			return;
		}

		const tier = state.comboTier | 0;
		const count = state.comboCount | 0;
		setVisible(true);
		if (tier !== lastTier || count !== lastShownCount) {
			applyRankStyle(tier, count);
			countEl.textContent = String(count);
			if (count > lastShownCount) punchCount();
			if (tier !== lastTier) {
				punchRank();
				announceTierChange(lastTier, tier);
			}
			lastTier = tier;
			lastShownCount = count;
		}

		const maxT = getComboTimerMax();
		const ratio = maxT > 0 ? Math.max(0, Math.min(1, (state.comboTimer || 0) / maxT)) : 0;
		timerFill.style.transform = `scaleX(${ratio})`;

		if (recoverEl) {
			recoverEl.style.opacity = (state.recoveryWindow > 0) ? '1' : '0';
		}

		if (tier >= 3 && performance.now() > punchUntil) {
			const pulse = 1 + Math.sin(performance.now() / 180) * 0.03;
			countEl.style.transform = `scale(${pulse})`;
		} else if (performance.now() > punchUntil) {
			countEl.style.transform = 'scale(1)';
		}
	}

	function init() {
		ensureDom();
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

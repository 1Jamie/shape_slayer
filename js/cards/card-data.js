// Card catalog aggregator and schema (global, non-module)
// Aggregates across player, curse, room-modifier, and team cards

// Schema reference (JS Doc style for maintainers)
/**
 * @typedef {Object} QualityBand
 * @property {number} value
 * @property {string} description
 * @property {string} flavorText
 * @property {Object=} bonus
 * @property {string=} legendaryFlavor
 */
/**
 * @typedef {Object} Card
 * @property {string} id
 * @property {string} family
 * @property {string} name
 * @property {string} category // Offense, Defense, Mobility, Ability, Economy, Enemy, Room, Team, Curse
 * @property {{white: QualityBand, green: QualityBand, blue: QualityBand, purple: QualityBand, orange: QualityBand}=} qualityBands
 * @property {string} effectType
 * @property {string} effectTarget
 * @property {string} application // passive, active, conditional, trigger
 * @property {string} duration // persistent, room, encounter, one_time
 * @property {Object=} unlockCondition
 * @property {Object=} tradeOffs
 * @property {boolean=} isCombined
 * @property {[string, string]=} combinedFrom
 * @property {boolean=} nonStacking
 * @property {boolean=} isCurse
 * @property {number=} maxCopies // Maximum copies allowed in deck (1-4)
 */

(function () {
	// Expect globals defined by other files:
	// window.PLAYER_CARDS, window.CURSE_CARDS, window.ROOM_MODIFIER_CARDS, window.TEAM_CARDS
	const player = Array.isArray(window.PLAYER_CARDS) ? window.PLAYER_CARDS : [];
	const curses = Array.isArray(window.CURSE_CARDS) ? window.CURSE_CARDS : [];
	const roomMods = Array.isArray(window.ROOM_MODIFIER_CARDS) ? window.ROOM_MODIFIER_CARDS : [];
	const teams = Array.isArray(window.TEAM_CARDS) ? window.TEAM_CARDS : [];

	const ALL = player.concat(curses, roomMods, teams);

	function getById(cardId) {
		return ALL.find(c => c.id === cardId);
	}
	function getByFamily(family) {
		return ALL.filter(c => c.family === family);
	}
	function getByCategory(category) {
		return ALL.filter(c => c.category === category);
	}
	function getAll() {
		return ALL.slice();
	}

	window.CardCatalog = {
		getAll,
		getById,
		getByFamily,
		getByCategory
	};
})();



// PlayerStats class for tracking individual player statistics

class PlayerStats {
    constructor(playerId) {
        this.playerId = playerId;
        this.damageDealt = 0;
        this.kills = 0;
        this.damageTaken = 0;
        this.roomsCleared = 0;
        this.highestCombo = 0;

        // Time tracking - only counts time while alive (NOT total run time)
        this.timeAlive = 0; // Accumulated alive time in seconds
        this.lastAliveTimestamp = null; // When player last became alive (null = timer not started)
        this.isAlive = true;
        this.timerStarted = false; // Whether the timer has been started (game must start first)
        this.timerStopped = false; // Whether the timer is frozen (game ended)
    }

    // Start the timer - called when game actually begins
    startTimer() {
        if (!this.timerStarted && !this.timerStopped) {
            this.lastAliveTimestamp = Date.now();
            this.timerStarted = true;
            this.isAlive = true;
        }
    }

    // Stop the timer - freeze the value (game ended)
    stopTimer() {
        if (this.timerStarted && !this.timerStopped) {
            // Accumulate any remaining time before stopping
            if (this.isAlive && this.lastAliveTimestamp) {
                this.timeAlive += (Date.now() - this.lastAliveTimestamp) / 1000;
            }
            this.timerStopped = true;
            this.lastAliveTimestamp = null;
        }
    }

    // Called when player dies - accumulate time from this life
    onDeath() {
        if (this.isAlive && this.timerStarted && !this.timerStopped) {
            this.timeAlive += (Date.now() - this.lastAliveTimestamp) / 1000;
            this.isAlive = false;
            this.lastAliveTimestamp = null;
        }
    }

    // Called when player revives - start new life timer
    onRevive() {
        if (!this.isAlive && this.timerStarted && !this.timerStopped) {
            this.lastAliveTimestamp = Date.now();
            this.isAlive = true;
        }
    }

    // Get total time alive (includes current life if still alive, but frozen if timer stopped)
    getTimeAlive() {
        // If timer is stopped, return frozen value
        if (this.timerStopped) {
            return this.timeAlive;
        }
        // If timer hasn't started yet, return 0
        if (!this.timerStarted) {
            return 0;
        }
        // If alive and timer is running, calculate current time
        if (this.isAlive && this.lastAliveTimestamp) {
            return this.timeAlive + (Date.now() - this.lastAliveTimestamp) / 1000;
        }
        // Otherwise return accumulated time
        return this.timeAlive;
    }

    // Add to a stat (for modular stat additions)
    addStat(statName, value) {
        if (this.hasOwnProperty(statName)) {
            this[statName] += value;
        }
    }

    // Reset stats (for new game)
    reset() {
        this.damageDealt = 0;
        this.kills = 0;
        this.damageTaken = 0;
        this.roomsCleared = 0;
        this.highestCombo = 0;
        this.timeAlive = 0;
        this.lastAliveTimestamp = null;
        this.isAlive = true;
        this.timerStarted = false;
        this.timerStopped = false;
    }
}

if (typeof window !== 'undefined') {
    window.PlayerStats = PlayerStats;
}
if (typeof globalThis !== 'undefined') {
    globalThis.PlayerStats = PlayerStats;
}

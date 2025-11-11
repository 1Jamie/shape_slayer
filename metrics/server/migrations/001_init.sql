CREATE TABLE IF NOT EXISTS runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id TEXT NOT NULL UNIQUE,
    game_version TEXT,
    mode TEXT NOT NULL,
    host_player_id TEXT NOT NULL,
    started_at TEXT NOT NULL,
    ended_at TEXT,
    duration_ms INTEGER NOT NULL,
    result TEXT NOT NULL,
    seed TEXT,
    difficulty TEXT,
    metadata TEXT,
    submitted_at TEXT NOT NULL,
    client_version TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS run_players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id TEXT NOT NULL,
    player_id TEXT NOT NULL,
    class TEXT,
    deck TEXT,
    affixes TEXT,
    gear TEXT,
    total_damage_dealt REAL DEFAULT 0,
    total_damage_taken REAL DEFAULT 0,
    hits_taken INTEGER DEFAULT 0,
    rooms_cleared INTEGER DEFAULT 0,
    deaths INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (run_id) REFERENCES runs(run_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_run_players_run ON run_players (run_id);
CREATE INDEX IF NOT EXISTS idx_run_players_player ON run_players (player_id);

CREATE TABLE IF NOT EXISTS rooms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id TEXT NOT NULL,
    room_id TEXT NOT NULL,
    room_number INTEGER NOT NULL,
    type TEXT,
    entered_at TEXT,
    cleared_at TEXT,
    duration_ms INTEGER,
    damage_dealt_by_player TEXT,
    damage_taken_by_player TEXT,
    hits_taken_by_player TEXT,
    player_stats_start TEXT,
    player_stats_end TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (run_id) REFERENCES runs(run_id) ON DELETE CASCADE,
    UNIQUE (run_id, room_id)
);

CREATE INDEX IF NOT EXISTS idx_rooms_run ON rooms (run_id);
CREATE INDEX IF NOT EXISTS idx_rooms_number ON rooms (room_number);

CREATE TABLE IF NOT EXISTS room_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id TEXT NOT NULL,
    room_id TEXT NOT NULL,
    timestamp TEXT,
    event_type TEXT NOT NULL,
    player_id TEXT,
    target_id TEXT,
    value REAL,
    metadata TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (run_id) REFERENCES runs(run_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_room_events_run ON room_events (run_id);
CREATE INDEX IF NOT EXISTS idx_room_events_room ON room_events (room_id);
CREATE INDEX IF NOT EXISTS idx_room_events_type ON room_events (event_type);

CREATE TABLE IF NOT EXISTS boss_encounters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id TEXT NOT NULL,
    boss_id TEXT NOT NULL,
    started_at TEXT,
    ended_at TEXT,
    duration_ms INTEGER,
    damage_by_player TEXT,
    damage_to_players TEXT,
    hits_taken_by_players TEXT,
    phases TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (run_id) REFERENCES runs(run_id) ON DELETE CASCADE,
    UNIQUE (run_id, boss_id, started_at)
);

CREATE INDEX IF NOT EXISTS idx_boss_encounters_run ON boss_encounters (run_id);

CREATE TABLE IF NOT EXISTS affix_pool (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id TEXT NOT NULL,
    affix_id TEXT NOT NULL,
    source TEXT,
    min_value REAL,
    max_value REAL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (run_id) REFERENCES runs(run_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_affix_pool_run ON affix_pool (run_id);


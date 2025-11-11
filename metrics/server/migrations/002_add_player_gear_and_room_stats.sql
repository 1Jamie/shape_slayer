ALTER TABLE run_players
    ADD COLUMN gear TEXT;

ALTER TABLE rooms
    ADD COLUMN player_stats_start TEXT;

ALTER TABLE rooms
    ADD COLUMN player_stats_end TEXT;



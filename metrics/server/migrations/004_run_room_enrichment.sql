-- Gear/MP telemetry enrichment columns (safe to re-run via db.js duplicate-column handling).
ALTER TABLE runs ADD COLUMN player_count INTEGER;
ALTER TABLE rooms ADD COLUMN biome_id TEXT;
ALTER TABLE rooms ADD COLUMN archetype TEXT;

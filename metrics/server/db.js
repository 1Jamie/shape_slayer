const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const CUSTOM_DB_PATH = process.env.METRICS_DB_PATH ? path.resolve(process.env.METRICS_DB_PATH) : null;
const DB_FILE = CUSTOM_DB_PATH || path.join(__dirname, 'data', 'metrics.sqlite');
const DB_DIR = path.dirname(DB_FILE);
const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
}

const db = new Database(DB_FILE);

function isDuplicateColumnError(error) {
    const message = error && error.message ? error.message : '';
    return message.includes('duplicate column name');
}

function runMigrations() {
    db.exec('PRAGMA journal_mode = WAL;');
    db.exec('PRAGMA foreign_keys = ON;');
    db.exec(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
    `);

    if (!fs.existsSync(MIGRATIONS_DIR)) {
        return;
    }

    const applied = new Set(
        db.prepare('SELECT name FROM schema_migrations').all().map(row => row.name)
    );

    const migrationFiles = fs
        .readdirSync(MIGRATIONS_DIR)
        .filter(file => file.endsWith('.sql'))
        .sort();

    const insertMigration = db.prepare('INSERT INTO schema_migrations (name) VALUES (?)');

    migrationFiles.forEach(file => {
        if (applied.has(file)) {
            return;
        }

        const filePath = path.join(MIGRATIONS_DIR, file);
        const sql = fs.readFileSync(filePath, 'utf-8');
        if (!sql.trim()) {
            insertMigration.run(file);
            console.log(`[metrics-db] Skipped empty migration ${file}`);
            return;
        }

        const statements = sql
            .split(';')
            .map(statement => statement.trim())
            .filter(Boolean);

        const transaction = db.transaction(() => {
            statements.forEach(statement => {
                try {
                    db.exec(`${statement};`);
                } catch (error) {
                    if (!isDuplicateColumnError(error)) {
                        throw error;
                    }
                    console.log(`[metrics-db] Migration ${file} skipped existing column (${error.message})`);
                }
            });
            insertMigration.run(file);
        });

        transaction();
        console.log(`[metrics-db] Applied migration ${file}`);
    });
}

runMigrations();

module.exports = db;

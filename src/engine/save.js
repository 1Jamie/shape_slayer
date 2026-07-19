(function(root) {
    const Engine = root.Engine = root.Engine || {};

    const memoryValues = new Map();
    const memoryStorage = {
        getItem(key) {
            return memoryValues.has(key) ? memoryValues.get(key) : null;
        },
        setItem(key, value) {
            memoryValues.set(key, String(value));
        },
        removeItem(key) {
            memoryValues.delete(key);
        }
    };

    function clone(value) {
        if (value === undefined) return undefined;
        if (typeof structuredClone === 'function') return structuredClone(value);
        return JSON.parse(JSON.stringify(value));
    }

    function mergeDefaults(defaults, value) {
        if (!defaults || typeof defaults !== 'object' || Array.isArray(defaults)) {
            return value === undefined ? clone(defaults) : value;
        }
        const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
        const result = {};
        for (const key of Object.keys(defaults)) {
            result[key] = mergeDefaults(defaults[key], source[key]);
        }
        for (const key of Object.keys(source)) {
            if (!(key in result)) result[key] = source[key];
        }
        return result;
    }

    class Store {
        constructor(key, options = {}) {
            if (typeof key !== 'string' || !key) throw new TypeError('Save key must be a non-empty string.');
            this.key = key;
            this.schemaVersion = Math.max(0, Math.floor(options.schemaVersion ?? options.version ?? 0));
            this.legacyVersion = Math.max(0, Math.floor(options.legacyVersion ?? 0));
            this.defaults = options.defaults || {};
            this.migrations = options.migrations || {};
            this.storage = options.storage || Save.storage();
        }

        _migrationFor(targetVersion) {
            if (Array.isArray(this.migrations)) return this.migrations[targetVersion];
            return this.migrations[targetVersion] || this.migrations[String(targetVersion)];
        }

        migrate(data, fromVersion = 0) {
            let version = Math.max(0, Math.floor(fromVersion));
            let value = clone(data);
            while (version < this.schemaVersion) {
                const targetVersion = version + 1;
                const migration = this._migrationFor(targetVersion);
                if (typeof migration !== 'function') {
                    throw new Error(`Missing save migration for schema ${targetVersion}.`);
                }
                value = migration(value, {
                    key: this.key,
                    fromVersion: version,
                    toVersion: targetVersion
                });
                version = targetVersion;
            }
            return { version, data: value };
        }

        load() {
            let raw;
            try {
                raw = this.storage.getItem(this.key);
            } catch (error) {
                return mergeDefaults(this.defaults, undefined);
            }
            if (raw === null || raw === undefined) return mergeDefaults(this.defaults, undefined);
            let parsed;
            try {
                parsed = JSON.parse(raw);
            } catch (error) {
                return mergeDefaults(this.defaults, undefined);
            }
            const isEnvelope = parsed && typeof parsed === 'object'
                && Number.isFinite(parsed.schemaVersion)
                && Object.prototype.hasOwnProperty.call(parsed, 'data');
            const fromVersion = isEnvelope ? parsed.schemaVersion : this.legacyVersion;
            const source = isEnvelope ? parsed.data : parsed;
            const migrated = fromVersion < this.schemaVersion
                ? this.migrate(source, fromVersion)
                : { version: fromVersion, data: source };
            // Persist upgrades without filling defaults so "key absence" checks
            // (e.g. grandfather flags) still see the raw stored shape.
            if (migrated.version !== fromVersion) {
                this.storage.setItem(this.key, JSON.stringify({
                    schemaVersion: this.schemaVersion,
                    data: clone(migrated.data)
                }));
            }
            return mergeDefaults(this.defaults, migrated.data);
        }

        save(data) {
            const value = mergeDefaults(this.defaults, clone(data));
            this.storage.setItem(this.key, JSON.stringify({
                schemaVersion: this.schemaVersion,
                data: value
            }));
            return value;
        }

        get(name, fallback) {
            const data = this.load();
            return Object.prototype.hasOwnProperty.call(data, name) ? data[name] : fallback;
        }

        set(name, value) {
            const data = this.load();
            data[name] = value;
            this.save(data);
            return value;
        }

        update(updater) {
            if (typeof updater !== 'function') throw new TypeError('Save update requires a callback.');
            const current = this.load();
            const result = updater(current);
            return this.save(result === undefined ? current : result);
        }

        remove(name) {
            const data = this.load();
            const existed = Object.prototype.hasOwnProperty.call(data, name);
            delete data[name];
            this.save(data);
            return existed;
        }

        clear() {
            this.storage.removeItem(this.key);
        }
    }

    const stores = new Map();
    const Save = {
        Store,
        _storage: null,

        configure(options = {}) {
            if (options.storage) this._storage = options.storage;
            return this;
        },

        storage() {
            if (this._storage) return this._storage;
            try {
                if (root.localStorage) return root.localStorage;
            } catch (error) {
                // Storage can be denied by browser privacy policy.
            }
            return memoryStorage;
        },

        create(key, options = {}) {
            const store = new Store(key, options);
            stores.set(key, store);
            return store;
        },

        open(key) {
            return stores.get(key) || null;
        },

        release(key) {
            return stores.delete(key);
        }
    };

    Engine.Save = Save;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = Save;
    }
})(typeof window !== 'undefined' ? window : globalThis);

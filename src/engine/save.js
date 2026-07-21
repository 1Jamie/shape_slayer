(function(root) {
    const Engine = root.Engine = root.Engine || {};

    /**
     * @typedef {Object} StorageAdapter
     * @property {function(string): (string|null)} getItem
     * @property {function(string, string): void} setItem
     * @property {function(string): void} removeItem
     */

    /**
     * @typedef {Object} SaveEnvelope
     * @property {number} schemaVersion
     * @property {any} data
     */

    /**
     * @typedef {function(any, MigrationMeta): any} MigrationFunction
     *
     * @typedef {Object} MigrationMeta
     * @property {string} key Store storage key
     * @property {number} fromVersion Starting schema version
     * @property {number} toVersion Target schema version
     */

    /**
     * @typedef {Object} StoreOptions
     * @property {number} [schemaVersion] Current schema version (defaults to 0)
     * @property {number} [version] Alias for schemaVersion
     * @property {number} [legacyVersion] Legacy un-enveloped version (defaults to 0)
     * @property {Object} [defaults] Default values to merge on load
     * @property {Record<number|string, MigrationFunction>|Array<MigrationFunction>} [migrations] Migration handlers
     * @property {StorageAdapter} [storage] Storage adapter instance
     */

    /** @type {Map<string, string>} */
    const memoryValues = new Map();
    /** @type {StorageAdapter} */
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

    /**
     * Deep clone a JSON-serializable value.
     * @template T
     * @param {T} value
     * @returns {T}
     */
    function clone(value) {
        if (value === undefined) return undefined;
        if (typeof structuredClone === 'function') return structuredClone(value);
        return JSON.parse(JSON.stringify(value));
    }

    /**
     * Recursively merge default fields into target value without overwriting existing non-null properties.
     * @param {any} defaults
     * @param {any} value
     * @returns {any}
     */
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

    /**
     * Versioned storage container supporting migrations and default merging.
     */
    class Store {
        /**
         * @param {string} key
         * @param {StoreOptions} [options]
         */
        constructor(key, options = {}) {
            if (typeof key !== 'string' || !key) throw new TypeError('Save key must be a non-empty string.');
            this.key = key;
            this.schemaVersion = Math.max(0, Math.floor(options.schemaVersion ?? options.version ?? 0));
            this.legacyVersion = Math.max(0, Math.floor(options.legacyVersion ?? 0));
            this.defaults = options.defaults || {};
            this.migrations = options.migrations || {};
            this.storage = options.storage || Save.storage();
        }

        /**
         * @private
         * @param {number} targetVersion
         * @returns {MigrationFunction|undefined}
         */
        _migrationFor(targetVersion) {
            if (Array.isArray(this.migrations)) return this.migrations[targetVersion];
            return this.migrations[targetVersion] || this.migrations[String(targetVersion)];
        }

        /**
         * Run schema migrations step-by-step from fromVersion to schemaVersion.
         * @param {any} data
         * @param {number} [fromVersion=0]
         * @returns {{version: number, data: any}}
         */
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

        /**
         * Load and migrate stored save data, merging defaults.
         * @returns {any}
         */
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

        /**
         * Save data to storage wrapped in a versioned envelope.
         * @param {any} data
         * @returns {any}
         */
        save(data) {
            const value = mergeDefaults(this.defaults, clone(data));
            this.storage.setItem(this.key, JSON.stringify({
                schemaVersion: this.schemaVersion,
                data: value
            }));
            return value;
        }

        /**
         * Get a single top-level field from loaded save data.
         * @template T
         * @param {string} name
         * @param {T} [fallback]
         * @returns {T}
         */
        get(name, fallback) {
            const data = this.load();
            return Object.prototype.hasOwnProperty.call(data, name) ? data[name] : fallback;
        }

        /**
         * Set a single top-level field and persist.
         * @template T
         * @param {string} name
         * @param {T} value
         * @returns {T}
         */
        set(name, value) {
            const data = this.load();
            data[name] = value;
            this.save(data);
            return value;
        }

        /**
         * Mutate stored save data via callback function.
         * @param {function(any): any} updater
         * @returns {any}
         */
        update(updater) {
            if (typeof updater !== 'function') throw new TypeError('Save update requires a callback.');
            const current = this.load();
            const result = updater(current);
            return this.save(result === undefined ? current : result);
        }

        /**
         * Remove a single top-level field from saved data.
         * @param {string} name
         * @returns {boolean} True if field existed before deletion.
         */
        remove(name) {
            const data = this.load();
            const existed = Object.prototype.hasOwnProperty.call(data, name);
            delete data[name];
            this.save(data);
            return existed;
        }

        /**
         * Delete this store's entry from underlying storage.
         */
        clear() {
            this.storage.removeItem(this.key);
        }
    }

    /** @type {Map<string, Store>} */
    const stores = new Map();

    /**
     * Global Save manager facade.
     */
    const Save = {
        Store,
        /** @type {StorageAdapter|null} */
        _storage: null,

        /**
         * Configure default storage backend adapter.
         * @param {{storage?: StorageAdapter}} [options]
         * @returns {Save}
         */
        configure(options = {}) {
            if (options.storage) this._storage = options.storage;
            return this;
        },

        /**
         * Get current active storage backend (localStorage or memory fallback).
         * @returns {StorageAdapter}
         */
        storage() {
            if (this._storage) return this._storage;
            try {
                if (root.localStorage) return root.localStorage;
            } catch (error) {
                // Storage can be denied by browser privacy policy.
            }
            return memoryStorage;
        },

        /**
         * Create and register a versioned Store instance.
         * @param {string} key
         * @param {StoreOptions} [options]
         * @returns {Store}
         */
        create(key, options = {}) {
            const store = new Store(key, options);
            stores.set(key, store);
            return store;
        },

        /**
         * Get registered store by key.
         * @param {string} key
         * @returns {Store|null}
         */
        open(key) {
            return stores.get(key) || null;
        },

        /**
         * Release a registered store key.
         * @param {string} key
         * @returns {boolean}
         */
        release(key) {
            return stores.delete(key);
        }
    };

    Engine.Save = Save;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = Save;
    }
})(typeof window !== 'undefined' ? window : globalThis);

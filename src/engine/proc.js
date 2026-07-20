(function(root) {
    const Engine = root.Engine = root.Engine || {};
    const Proc = Engine.Proc = Engine.Proc || {};

    function hashSeed(seed) {
        const text = String(seed);
        let hash = 2166136261;
        for (let index = 0; index < text.length; index++) {
            hash ^= text.charCodeAt(index);
            hash = Math.imul(hash, 16777619);
        }
        hash += hash << 13;
        hash ^= hash >>> 7;
        hash += hash << 3;
        hash ^= hash >>> 17;
        hash += hash << 5;
        return hash >>> 0;
    }

    class Rng {
        constructor(seed) {
            this.seed = seed;
            this.state = hashSeed(seed);
        }

        static fromSeed(seed) {
            return new Rng(seed);
        }

        next() {
            this.state = (this.state + 0x6D2B79F5) >>> 0;
            let value = this.state;
            value = Math.imul(value ^ value >>> 15, value | 1);
            value ^= value + Math.imul(value ^ value >>> 7, value | 61);
            return ((value ^ value >>> 14) >>> 0) / 4294967296;
        }

        float(min = 0, max = 1) {
            return min + (max - min) * this.next();
        }

        int(min, max) {
            const low = Math.ceil(Math.min(min, max));
            const high = Math.floor(Math.max(min, max));
            return low + Math.floor(this.next() * (high - low + 1));
        }

        bool(probability = 0.5) {
            return this.next() < probability;
        }

        pick(values) {
            return values && values.length ? values[this.int(0, values.length - 1)] : undefined;
        }

        fork(label) {
            return Rng.fromSeed(`${this.seed}:${String(label)}`);
        }
    }

    const SIMPLEX_GRADIENTS = Object.freeze([
        [1, 1], [-1, 1], [1, -1], [-1, -1],
        [1, 0], [-1, 0], [0, 1], [0, -1]
    ]);

    class Noise {
        constructor(seed = 0, options = {}) {
            const rng = Rng.fromSeed(seed);
            const permutation = Array.from({ length: 256 }, (_, index) => index);
            for (let index = permutation.length - 1; index > 0; index--) {
                const swapIndex = rng.int(0, index);
                [permutation[index], permutation[swapIndex]] = [permutation[swapIndex], permutation[index]];
            }
            this.permutation = new Uint16Array(512);
            for (let index = 0; index < 512; index++) {
                this.permutation[index] = permutation[index & 255];
            }
            this.octaves = Math.max(1, Math.floor(options.octaves || 4));
            this.lacunarity = Number.isFinite(options.lacunarity) ? options.lacunarity : 2;
            this.gain = Number.isFinite(options.gain) ? options.gain : 0.5;
            this.frequency = Number.isFinite(options.frequency) ? options.frequency : 1;
        }

        static fromSeed(seed, options) {
            return new Noise(seed, options);
        }

        simplex2(x, y) {
            const skew = 0.5 * (Math.sqrt(3) - 1);
            const unskew = (3 - Math.sqrt(3)) / 6;
            const skewed = (x + y) * skew;
            const cellX = Math.floor(x + skewed);
            const cellY = Math.floor(y + skewed);
            const origin = (cellX + cellY) * unskew;
            const localX = x - (cellX - origin);
            const localY = y - (cellY - origin);
            const stepX = localX > localY ? 1 : 0;
            const stepY = localX > localY ? 0 : 1;
            const x1 = localX - stepX + unskew;
            const y1 = localY - stepY + unskew;
            const x2 = localX - 1 + 2 * unskew;
            const y2 = localY - 1 + 2 * unskew;
            const ii = cellX & 255;
            const jj = cellY & 255;
            const gradients = [
                this.permutation[ii + this.permutation[jj]] & 7,
                this.permutation[ii + stepX + this.permutation[jj + stepY]] & 7,
                this.permutation[ii + 1 + this.permutation[jj + 1]] & 7
            ];
            const contributions = [
                this._simplexContribution(gradients[0], localX, localY),
                this._simplexContribution(gradients[1], x1, y1),
                this._simplexContribution(gradients[2], x2, y2)
            ];
            return 70 * (contributions[0] + contributions[1] + contributions[2]);
        }

        _simplexContribution(gradientIndex, x, y) {
            let attenuation = 0.5 - x * x - y * y;
            if (attenuation <= 0) return 0;
            attenuation *= attenuation;
            const gradient = SIMPLEX_GRADIENTS[gradientIndex];
            return attenuation * attenuation * (gradient[0] * x + gradient[1] * y);
        }

        fbm2(x, y, options = {}) {
            const octaves = Math.max(1, Math.floor(options.octaves || this.octaves));
            const lacunarity = Number.isFinite(options.lacunarity) ? options.lacunarity : this.lacunarity;
            const gain = Number.isFinite(options.gain) ? options.gain : this.gain;
            let frequency = Number.isFinite(options.frequency) ? options.frequency : this.frequency;
            let amplitude = 1;
            let value = 0;
            let amplitudeSum = 0;
            for (let octave = 0; octave < octaves; octave++) {
                value += this.simplex2(x * frequency, y * frequency) * amplitude;
                amplitudeSum += amplitude;
                frequency *= lacunarity;
                amplitude *= gain;
            }
            return amplitudeSum > 0 ? value / amplitudeSum : 0;
        }
    }

    const Cell = Object.freeze({
        WALKABLE: 0,
        BLOCKED: 1
    });

    function readRandom(rng) {
        if (rng && typeof rng.next === 'function') return rng.next();
        if (typeof rng === 'function') return rng();
        return Math.random();
    }

    class MinHeap {
        constructor(initialCapacity = 1024) {
            this.capacity = initialCapacity;
            this.stride = 4; // score, index, x, y
            this.data = new Float64Array(initialCapacity * this.stride);
            this.length = 0; // count of items
            this._popScratch = { score: 0, index: 0, x: 0, y: 0 };
        }

        _grow() {
            const newCap = this.capacity * 2;
            const newData = new Float64Array(newCap * this.stride);
            newData.set(this.data);
            this.capacity = newCap;
            this.data = newData;
        }

        push(scoreOrObj, index, x, y) {
            let scoreVal, idxVal, xVal, yVal;
            if (scoreOrObj && typeof scoreOrObj === 'object') {
                scoreVal = Number(scoreOrObj.score) || 0;
                idxVal = Number(scoreOrObj.index) || 0;
                xVal = Number(scoreOrObj.x) || 0;
                yVal = Number(scoreOrObj.y) || 0;
            } else {
                scoreVal = Number(scoreOrObj) || 0;
                idxVal = Number(index) || 0;
                xVal = Number(x) || 0;
                yVal = Number(y) || 0;
            }

            if (this.length >= this.capacity) {
                this._grow();
            }

            const data = this.data;
            const stride = this.stride;
            let i = this.length;
            this.length++;

            while (i > 0) {
                const parent = (i - 1) >> 1;
                const parentScore = data[parent * stride];
                if (parentScore <= scoreVal) break;

                const pOffset = parent * stride;
                const iOffset = i * stride;
                data[iOffset] = data[pOffset];
                data[iOffset + 1] = data[pOffset + 1];
                data[iOffset + 2] = data[pOffset + 2];
                data[iOffset + 3] = data[pOffset + 3];
                i = parent;
            }

            const offset = i * stride;
            data[offset] = scoreVal;
            data[offset + 1] = idxVal;
            data[offset + 2] = xVal;
            data[offset + 3] = yVal;
        }

        pop(outObj = null) {
            if (this.length === 0) return null;
            const data = this.data;
            const stride = this.stride;

            const rootScore = data[0];
            const rootIndex = data[1];
            const rootX = data[2];
            const rootY = data[3];

            this.length--;
            const count = this.length;

            if (count > 0) {
                const tailOffset = count * stride;
                const tailScore = data[tailOffset];
                const tailIndex = data[tailOffset + 1];
                const tailX = data[tailOffset + 2];
                const tailY = data[tailOffset + 3];

                let i = 0;
                while (true) {
                    const left = (i << 1) + 1;
                    const right = left + 1;
                    if (left >= count) break;

                    let child = left;
                    if (right < count && data[right * stride] < data[left * stride]) {
                        child = right;
                    }

                    if (data[child * stride] >= tailScore) break;

                    const cOffset = child * stride;
                    const iOffset = i * stride;
                    data[iOffset] = data[cOffset];
                    data[iOffset + 1] = data[cOffset + 1];
                    data[iOffset + 2] = data[cOffset + 2];
                    data[iOffset + 3] = data[cOffset + 3];
                    i = child;
                }

                const finalOffset = i * stride;
                data[finalOffset] = tailScore;
                data[finalOffset + 1] = tailIndex;
                data[finalOffset + 2] = tailX;
                data[finalOffset + 3] = tailY;
            }

            const res = outObj && typeof outObj === 'object' ? outObj : { score: 0, index: 0, x: 0, y: 0 };
            res.score = rootScore;
            res.index = rootIndex;
            res.x = rootX;
            res.y = rootY;
            return res;
        }

        get items() {
            // For backward compatibility checking length
            return { length: this.length };
        }

        clear() {
            this.length = 0;
        }
    }

    class Grid {
        constructor(width, height, options = {}) {
            this.width = Math.max(1, Math.floor(width || 1));
            this.height = Math.max(1, Math.floor(height || 1));
            this.cellSize = Math.max(0.0001, Number(options.cellSize) || 1);
            this.originX = Number(options.originX) || 0;
            this.originY = Number(options.originY) || 0;
            this.outside = options.outside ?? Cell.BLOCKED;
            const size = this.width * this.height;
            this.data = new Uint8Array(size);
            if (options.data) this.data.set(Array.from(options.data).slice(0, size));
            else if (options.fill !== undefined) this.data.fill(options.fill);
        }

        index(x, y) {
            return y * this.width + x;
        }

        inBounds(x, y) {
            return x >= 0 && y >= 0 && x < this.width && y < this.height;
        }

        get(x, y) {
            return this.inBounds(x, y) ? this.data[this.index(x, y)] : this.outside;
        }

        set(x, y, value) {
            if (this.inBounds(x, y)) this.data[this.index(x, y)] = value;
            return this;
        }

        clone() {
            return new Grid(this.width, this.height, {
                data: this.data,
                cellSize: this.cellSize,
                originX: this.originX,
                originY: this.originY,
                outside: this.outside
            });
        }

        fill(value) {
            this.data.fill(value);
            return this;
        }

        fillRandom(density, rng) {
            const chance = Math.max(0, Math.min(1, Number(density) || 0));
            for (let index = 0; index < this.data.length; index++) {
                this.data[index] = readRandom(rng) < chance ? Cell.BLOCKED : Cell.WALKABLE;
            }
            return this;
        }

        _countNeighbors(x, y, value, diagonal = true, outsideValue = this.outside) {
            let count = 0;
            for (let offsetY = -1; offsetY <= 1; offsetY++) {
                for (let offsetX = -1; offsetX <= 1; offsetX++) {
                    if (offsetX === 0 && offsetY === 0) continue;
                    if (!diagonal && offsetX !== 0 && offsetY !== 0) continue;
                    const nextX = x + offsetX;
                    const nextY = y + offsetY;
                    const neighbor = this.inBounds(nextX, nextY) ? this.get(nextX, nextY) : outsideValue;
                    if (neighbor === value) count++;
                }
            }
            return count;
        }

        smooth(options = {}) {
            const iterations = Math.max(0, Math.floor(options.iterations ?? 1));
            const birthLimit = Number.isFinite(options.birthLimit) ? options.birthLimit : 4;
            const deathLimit = Number.isFinite(options.deathLimit) ? options.deathLimit : 3;
            for (let iteration = 0; iteration < iterations; iteration++) {
                const next = new Uint8Array(this.data.length);
                for (let y = 0; y < this.height; y++) {
                    for (let x = 0; x < this.width; x++) {
                        const index = this.index(x, y);
                        const neighbors = this._countNeighbors(x, y, Cell.BLOCKED);
                        if (this.data[index] === Cell.BLOCKED) {
                            next[index] = neighbors < deathLimit ? Cell.WALKABLE : Cell.BLOCKED;
                        } else {
                            next[index] = neighbors > birthLimit ? Cell.BLOCKED : Cell.WALKABLE;
                        }
                    }
                }
                this.data = next;
            }
            return this;
        }

        removeIsolatedRegions(options = {}) {
            if (typeof options === 'number') options = { minSize: options };
            const target = options.cell ?? Cell.WALKABLE;
            const replacement = options.replacement ?? (target === Cell.BLOCKED ? Cell.WALKABLE : Cell.BLOCKED);
            const minSize = Math.max(0, Math.floor(options.minSize ?? 0));
            const keepLargest = options.keepLargest === true;
            const visited = new Uint8Array(this.data.length);
            const regions = [];
            const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]];

            for (let y = 0; y < this.height; y++) {
                for (let x = 0; x < this.width; x++) {
                    const startIndex = this.index(x, y);
                    if (visited[startIndex] || this.data[startIndex] !== target) continue;
                    const region = [];
                    const queue = [[x, y]];
                    visited[startIndex] = 1;
                    for (let cursor = 0; cursor < queue.length; cursor++) {
                        const [currentX, currentY] = queue[cursor];
                        const currentIndex = this.index(currentX, currentY);
                        region.push(currentIndex);
                        for (const [offsetX, offsetY] of directions) {
                            const nextX = currentX + offsetX;
                            const nextY = currentY + offsetY;
                            if (!this.inBounds(nextX, nextY)) continue;
                            const nextIndex = this.index(nextX, nextY);
                            if (!visited[nextIndex] && this.data[nextIndex] === target) {
                                visited[nextIndex] = 1;
                                queue.push([nextX, nextY]);
                            }
                        }
                    }
                    regions.push(region);
                }
            }

            let largest = null;
            if (keepLargest && regions.length) {
                largest = regions.reduce((best, region) => region.length > best.length ? region : best);
            }
            for (const region of regions) {
                if ((keepLargest && region !== largest) || region.length < minSize) {
                    for (const index of region) this.data[index] = replacement;
                }
            }
            return this;
        }

        _morph(operation, options) {
            if (typeof options === 'number') options = { iterations: options };
            options = options || {};
            const iterations = Math.max(0, Math.floor(options.iterations ?? 1));
            const target = options.cell ?? Cell.BLOCKED;
            const replacement = options.replacement ?? (target === Cell.BLOCKED ? Cell.WALKABLE : Cell.BLOCKED);
            const diagonal = options.diagonal !== false;
            const outsideValue = options.outside ?? replacement;
            for (let iteration = 0; iteration < iterations; iteration++) {
                const next = this.data.slice();
                for (let y = 0; y < this.height; y++) {
                    for (let x = 0; x < this.width; x++) {
                        const index = this.index(x, y);
                        const neighborCount = this._countNeighbors(x, y, target, diagonal, outsideValue);
                        if (operation === 'dilate' && this.data[index] !== target && neighborCount > 0) {
                            next[index] = target;
                        } else if (operation === 'erode' && this.data[index] === target) {
                            const maximum = diagonal ? 8 : 4;
                            if (neighborCount < maximum) next[index] = replacement;
                        }
                    }
                }
                this.data = next;
            }
            return this;
        }

        dilate(options = {}) {
            return this._morph('dilate', options);
        }

        erode(options = {}) {
            return this._morph('erode', options);
        }

        findPath(start, goal, options = {}) {
            const startX = Math.floor(start.x);
            const startY = Math.floor(start.y);
            const goalX = Math.floor(goal.x);
            const goalY = Math.floor(goal.y);
            const passable = typeof options.passable === 'function'
                ? options.passable
                : (value => value !== (options.blocked ?? Cell.BLOCKED));
            if (!this.inBounds(startX, startY) || !this.inBounds(goalX, goalY)) return [];
            if (!passable(this.get(startX, startY), startX, startY)
                || !passable(this.get(goalX, goalY), goalX, goalY)) return [];

            const diagonal = options.diagonal === true;
            const directions = diagonal
                ? [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
                    [1, 1, Math.SQRT2], [1, -1, Math.SQRT2],
                    [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]]
                : [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1]];
            const size = this.data.length;
            const costs = new Float64Array(size);
            costs.fill(Infinity);
            const parents = new Int32Array(size);
            parents.fill(-1);
            const closed = new Uint8Array(size);
            const startIndex = this.index(startX, startY);
            const goalIndex = this.index(goalX, goalY);
            const heap = new MinHeap();
            costs[startIndex] = 0;
            heap.push({ index: startIndex, x: startX, y: startY, score: 0 });

            while (heap.items.length) {
                const current = heap.pop();
                if (closed[current.index]) continue;
                if (current.index === goalIndex) break;
                closed[current.index] = 1;
                for (const [offsetX, offsetY, baseCost] of directions) {
                    const nextX = current.x + offsetX;
                    const nextY = current.y + offsetY;
                    if (!this.inBounds(nextX, nextY)) continue;
                    if (!passable(this.get(nextX, nextY), nextX, nextY)) continue;
                    if (diagonal && offsetX !== 0 && offsetY !== 0 && options.cutCorners !== true) {
                        if (!passable(this.get(current.x + offsetX, current.y), current.x + offsetX, current.y)
                            || !passable(this.get(current.x, current.y + offsetY), current.x, current.y + offsetY)) {
                            continue;
                        }
                    }
                    const nextIndex = this.index(nextX, nextY);
                    if (closed[nextIndex]) continue;
                    const extraCost = typeof options.cost === 'function'
                        ? Number(options.cost(nextX, nextY, this.get(nextX, nextY))) || 1
                        : 1;
                    const nextCost = costs[current.index] + baseCost * Math.max(0, extraCost);
                    if (nextCost >= costs[nextIndex]) continue;
                    costs[nextIndex] = nextCost;
                    parents[nextIndex] = current.index;
                    const dx = Math.abs(goalX - nextX);
                    const dy = Math.abs(goalY - nextY);
                    const heuristic = diagonal ? Math.max(dx, dy) : dx + dy;
                    heap.push({ index: nextIndex, x: nextX, y: nextY, score: nextCost + heuristic });
                }
            }

            if (startIndex !== goalIndex && parents[goalIndex] === -1) return [];
            const path = [];
            let cursor = goalIndex;
            while (cursor !== -1) {
                path.push({ x: cursor % this.width, y: Math.floor(cursor / this.width) });
                if (cursor === startIndex) break;
                cursor = parents[cursor];
            }
            path.reverse();
            return path;
        }

        resolveCircle(circleOrX, yOrOptions, radiusValue, maybeOptions = {}) {
            let x;
            let y;
            let radius;
            let options;
            if (typeof circleOrX === 'object') {
                x = Number(circleOrX.x) || 0;
                y = Number(circleOrX.y) || 0;
                radius = Math.max(0, Number(circleOrX.radius) || 0);
                options = yOrOptions || {};
            } else {
                x = Number(circleOrX) || 0;
                y = Number(yOrOptions) || 0;
                radius = Math.max(0, Number(radiusValue) || 0);
                options = maybeOptions;
            }
            const blocked = options.blocked ?? Cell.BLOCKED;
            const iterations = Math.max(1, Math.floor(options.iterations || 4));
            let collided = false;

            for (let iteration = 0; iteration < iterations; iteration++) {
                let moved = false;
                const minCellX = Math.floor((x - radius - this.originX) / this.cellSize);
                const maxCellX = Math.floor((x + radius - this.originX) / this.cellSize);
                const minCellY = Math.floor((y - radius - this.originY) / this.cellSize);
                const maxCellY = Math.floor((y + radius - this.originY) / this.cellSize);
                for (let cellY = minCellY; cellY <= maxCellY; cellY++) {
                    for (let cellX = minCellX; cellX <= maxCellX; cellX++) {
                        if (this.get(cellX, cellY) !== blocked) continue;
                        const left = this.originX + cellX * this.cellSize;
                        const top = this.originY + cellY * this.cellSize;
                        const right = left + this.cellSize;
                        const bottom = top + this.cellSize;
                        const closestX = Math.max(left, Math.min(x, right));
                        const closestY = Math.max(top, Math.min(y, bottom));
                        let dx = x - closestX;
                        let dy = y - closestY;
                        let distanceSquared = dx * dx + dy * dy;
                        if (distanceSquared >= radius * radius) continue;

                        if (distanceSquared < 1e-12) {
                            const distances = [
                                { dx: left - x - radius, dy: 0, amount: x - left },
                                { dx: right - x + radius, dy: 0, amount: right - x },
                                { dx: 0, dy: top - y - radius, amount: y - top },
                                { dx: 0, dy: bottom - y + radius, amount: bottom - y }
                            ];
                            distances.sort((a, b) => a.amount - b.amount);
                            x += distances[0].dx;
                            y += distances[0].dy;
                        } else {
                            const distance = Math.sqrt(distanceSquared);
                            const penetration = radius - distance;
                            dx /= distance;
                            dy /= distance;
                            x += dx * penetration;
                            y += dy * penetration;
                        }
                        collided = true;
                        moved = true;
                    }
                }
                if (!moved) break;
            }
            return { x, y, collided };
        }
    }

    const MARCHING_CASES = Object.freeze({
        0: [],
        1: [['left', 'bottom']],
        2: [['bottom', 'right']],
        3: [['left', 'right']],
        4: [['top', 'right']],
        5: [['top', 'left'], ['bottom', 'right']],
        6: [['top', 'bottom']],
        7: [['top', 'left']],
        8: [['left', 'top']],
        9: [['top', 'bottom']],
        10: [['left', 'bottom'], ['top', 'right']],
        11: [['top', 'right']],
        12: [['left', 'right']],
        13: [['bottom', 'right']],
        14: [['left', 'bottom']],
        15: []
    });

    function pointKey(point) {
        return `${Math.round(point.x * 1e6)},${Math.round(point.y * 1e6)}`;
    }

    function stitchSegments(segments) {
        const connections = new Map();
        segments.forEach((segment, index) => {
            for (const point of [segment.a, segment.b]) {
                const key = pointKey(point);
                if (!connections.has(key)) connections.set(key, []);
                connections.get(key).push(index);
            }
        });
        const used = new Uint8Array(segments.length);
        const polygons = [];

        for (let startIndex = 0; startIndex < segments.length; startIndex++) {
            if (used[startIndex]) continue;
            used[startIndex] = 1;
            const start = segments[startIndex];
            const points = [{ ...start.a }, { ...start.b }];
            const startKey = pointKey(start.a);
            let currentKey = pointKey(start.b);
            while (currentKey !== startKey) {
                const candidates = connections.get(currentKey) || [];
                const nextIndex = candidates.find(index => !used[index]);
                if (nextIndex === undefined) break;
                used[nextIndex] = 1;
                const next = segments[nextIndex];
                const nextPoint = pointKey(next.a) === currentKey ? next.b : next.a;
                points.push({ ...nextPoint });
                currentKey = pointKey(nextPoint);
            }
            if (points.length > 2 && currentKey === startKey) {
                points.pop();
                polygons.push(points);
            }
        }
        return polygons;
    }

    const MarchingSquares = {
        getPolygons(grid, options = {}) {
            if (!grid || !Number.isFinite(grid.width) || !Number.isFinite(grid.height)) {
                throw new TypeError('MarchingSquares requires a grid with width and height.');
            }
            const cellSize = Math.max(0.0001, Number(options.cellSize || grid.cellSize) || 1);
            const originX = Number(options.originX ?? grid.originX) || 0;
            const originY = Number(options.originY ?? grid.originY) || 0;
            const blockedValue = options.blocked ?? Cell.BLOCKED;
            const sample = typeof options.sample === 'function'
                ? options.sample
                : ((x, y) => {
                    if (x < 0 || y < 0 || x >= grid.width || y >= grid.height) return false;
                    const value = typeof grid.get === 'function'
                        ? grid.get(x, y)
                        : grid.data[y * grid.width + x];
                    return value === blockedValue;
                });
            const segments = [];

            for (let y = -1; y < grid.height; y++) {
                for (let x = -1; x < grid.width; x++) {
                    const mask = (sample(x, y) ? 8 : 0)
                        | (sample(x + 1, y) ? 4 : 0)
                        | (sample(x + 1, y + 1) ? 2 : 0)
                        | (sample(x, y + 1) ? 1 : 0);
                    const edgePairs = MARCHING_CASES[mask];
                    if (!edgePairs.length) continue;
                    const centerX = originX + (x + 1) * cellSize;
                    const centerY = originY + (y + 1) * cellSize;
                    const half = cellSize / 2;
                    const edgePoints = {
                        top: { x: centerX, y: centerY - half },
                        right: { x: centerX + half, y: centerY },
                        bottom: { x: centerX, y: centerY + half },
                        left: { x: centerX - half, y: centerY }
                    };
                    for (const [edgeA, edgeB] of edgePairs) {
                        const a = { ...edgePoints[edgeA] };
                        const b = { ...edgePoints[edgeB] };
                        segments.push({
                            a,
                            b,
                            x1: a.x,
                            y1: a.y,
                            x2: b.x,
                            y2: b.y
                        });
                    }
                }
            }

            const polygons = stitchSegments(segments);
            return {
                polygons,
                getSegments() {
                    return segments.map(segment => ({
                        a: { ...segment.a },
                        b: { ...segment.b },
                        x1: segment.x1,
                        y1: segment.y1,
                        x2: segment.x2,
                        y2: segment.y2
                    }));
                }
            };
        }
    };

    function getGeometry() {
        return Engine.Physics && Engine.Physics.Geometry ? Engine.Physics.Geometry : null;
    }

    function normalizePolylinePoints(points) {
        if (!Array.isArray(points) || points.length < 2) return [];
        return points.map(point => ({ x: point.x, y: point.y }));
    }

    function projectPointOnSegment(px, py, ax, ay, bx, by, out = null) {
        const geometry = getGeometry();
        if (geometry && typeof geometry.projectPointOnSegment === 'function') {
            return geometry.projectPointOnSegment(px, py, ax, ay, bx, by);
        }
        const dx = bx - ax;
        const dy = by - ay;
        const lengthSq = dx * dx + dy * dy;
        let projX = ax, projY = ay, t = 0, distSq = 0;
        if (lengthSq <= 0) {
            const dist = Math.hypot(px - ax, py - ay);
            projX = ax;
            projY = ay;
            t = 0;
            distSq = dist * dist;
        } else {
            t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSq));
            projX = ax + dx * t;
            projY = ay + dy * t;
            const distX = px - projX;
            const distY = py - projY;
            distSq = distX * distX + distY * distY;
        }
        if (out && typeof out === 'object') {
            out.x = projX;
            out.y = projY;
            out.t = t;
            out.distSq = distSq;
            return out;
        }
        return { x: projX, y: projY, t, distSq };
    }

    const Polyline = {
        segmentBounds(points, outArray = null) {
            if (!Array.isArray(points) || points.length < 2) {
                if (outArray) { outArray.length = 0; outArray.push(0); return outArray; }
                return [0];
            }
            const bounds = outArray || [];
            bounds.length = points.length;
            bounds[0] = 0;
            let cumulative = 0;
            for (let i = 1; i < points.length; i++) {
                const prev = points[i - 1];
                const curr = points[i];
                const px = prev ? Number(prev.x) || 0 : 0;
                const py = prev ? Number(prev.y) || 0 : 0;
                const cx = curr ? Number(curr.x) || 0 : 0;
                const cy = curr ? Number(curr.y) || 0 : 0;
                cumulative += Math.hypot(cx - px, cy - py);
                bounds[i] = cumulative;
            }
            return bounds;
        },

        routeLength(points) {
            if (!Array.isArray(points) || points.length < 2) return 0;
            let cumulative = 0;
            for (let i = 1; i < points.length; i++) {
                const prev = points[i - 1];
                const curr = points[i];
                const px = prev ? Number(prev.x) || 0 : 0;
                const py = prev ? Number(prev.y) || 0 : 0;
                const cx = curr ? Number(curr.x) || 0 : 0;
                const cy = curr ? Number(curr.y) || 0 : 0;
                cumulative += Math.hypot(cx - px, cy - py);
            }
            return cumulative;
        },

        pointAtArc(points, arc, out = null) {
            const res = out && typeof out === 'object' ? out : { x: 0, y: 0, segmentIndex: 0, tangent: 0 };
            if (!Array.isArray(points) || points.length === 0) {
                res.x = 0; res.y = 0; res.segmentIndex = 0; res.tangent = 0;
                return res;
            }
            if (points.length === 1) {
                const p0 = points[0];
                res.x = p0 ? Number(p0.x) || 0 : 0;
                res.y = p0 ? Number(p0.y) || 0 : 0;
                res.segmentIndex = 0;
                res.tangent = 0;
                return res;
            }

            const bounds = this.segmentBounds(points);
            const routeLength = bounds[bounds.length - 1] || 0;
            const clampedArc = Math.max(0, Math.min(routeLength, Number(arc) || 0));

            const p0 = points[0];
            const p1 = points[1];
            const p0x = p0 ? Number(p0.x) || 0 : 0;
            const p0y = p0 ? Number(p0.y) || 0 : 0;
            const p1x = p1 ? Number(p1.x) || 0 : 0;
            const p1y = p1 ? Number(p1.y) || 0 : 0;

            if (clampedArc <= 0) {
                res.x = p0x; res.y = p0y; res.segmentIndex = 0; res.tangent = Math.atan2(p1y - p0y, p1x - p0x);
                return res;
            }
            if (clampedArc >= routeLength) {
                const last = points.length - 1;
                const pLast = points[last];
                const pPrev = points[last - 1];
                const plx = pLast ? Number(pLast.x) || 0 : 0;
                const ply = pLast ? Number(pLast.y) || 0 : 0;
                const ppx = pPrev ? Number(pPrev.x) || 0 : 0;
                const ppy = pPrev ? Number(pPrev.y) || 0 : 0;
                res.x = plx; res.y = ply; res.segmentIndex = last - 1; res.tangent = Math.atan2(ply - ppy, plx - ppx);
                return res;
            }

            for (let i = 1; i < bounds.length; i++) {
                if (clampedArc <= bounds[i]) {
                    const segStart = bounds[i - 1];
                    const segLen = bounds[i] - segStart;
                    const t = segLen > 0 ? (clampedArc - segStart) / segLen : 0;
                    const from = points[i - 1];
                    const to = points[i];
                    const fx = from ? Number(from.x) || 0 : 0;
                    const fy = from ? Number(from.y) || 0 : 0;
                    const tx = to ? Number(to.x) || 0 : 0;
                    const ty = to ? Number(to.y) || 0 : 0;
                    const dx = tx - fx;
                    const dy = ty - fy;
                    res.x = fx + dx * t;
                    res.y = fy + dy * t;
                    res.segmentIndex = i - 1;
                    res.tangent = Math.atan2(dy, dx);
                    return res;
                }
            }

            const fallback = points[points.length - 1];
            res.x = fallback ? Number(fallback.x) || 0 : 0;
            res.y = fallback ? Number(fallback.y) || 0 : 0;
            res.segmentIndex = Math.max(0, points.length - 2);
            res.tangent = 0;
            return res;
        },

        arcAtPoint(points, x, y) {
            const pts = normalizePolylinePoints(points);
            const bounds = this.segmentBounds(pts);
            const routeLength = bounds[bounds.length - 1] || 0;
            if (pts.length < 2 || routeLength <= 0) return 0;

            let bestArc = 0;
            let bestDistSq = Infinity;
            for (let i = 1; i < pts.length; i++) {
                const from = pts[i - 1];
                const to = pts[i];
                const proj = projectPointOnSegment(x, y, from.x, from.y, to.x, to.y);
                if (proj.distSq < bestDistSq) {
                    bestDistSq = proj.distSq;
                    const segStart = bounds[i - 1];
                    const segLen = bounds[i] - segStart;
                    bestArc = segStart + proj.t * segLen;
                }
            }
            return Math.max(0, Math.min(routeLength, bestArc));
        },

        validateCoverage(assignments, routeLength, gapTolerance = 0) {
            if (!Array.isArray(assignments) || assignments.length === 0) return false;
            if (routeLength <= 0) return true;

            const spans = assignments
                .map(assignment => ({
                    start: Math.max(0, assignment.startArc),
                    end: Math.min(routeLength, assignment.endArc)
                }))
                .filter(span => span.end > span.start)
                .sort((a, b) => a.start - b.start);

            if (spans.length === 0) return false;
            if (spans[0].start > gapTolerance) return false;

            let covered = spans[0].end;
            for (let i = 1; i < spans.length; i++) {
                if (spans[i].start > covered + gapTolerance) return false;
                covered = Math.max(covered, spans[i].end);
            }
            return covered >= routeLength - gapTolerance;
        }
    };

    Proc.dispatchWorkerTask = function(taskType, payload = {}, callback) {
        if (typeof Worker !== 'undefined' && typeof window !== 'undefined') {
            try {
                const worker = new Worker('src/engine/proc-worker.js');
                worker.onmessage = function(e) {
                    if (typeof callback === 'function') callback(e.data);
                    worker.terminate();
                };
                worker.postMessage({ type: taskType, ...payload });
                return true;
            } catch (_) {}
        }
        // Synchronous fallback
        if (taskType === 'GENERATE_GRID') {
            const grid = new Grid(payload.width || 32, payload.height || 32);
            grid.fillRandom(payload.density || 0.4, payload.seed || 12345);
            grid.smooth(payload.iterations || 4);
            if (typeof callback === 'function') {
                callback({ type: 'GRID_GENERATED', width: grid.width, height: grid.height, data: grid.data.buffer, grid });
            }
        }
        return false;
    };

    Proc.Rng = Rng;
    Proc.Noise = Noise;
    Proc.Cell = Cell;
    Proc.Grid = Grid;
    Proc.MarchingSquares = MarchingSquares;
    Proc.Polyline = Polyline;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = Proc;
    }
})(typeof window !== 'undefined' ? window : globalThis);

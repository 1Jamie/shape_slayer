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

            if (!this._pathClosed || this._pathClosed.length !== size) {
                this._pathClosed = new Uint32Array(size);
                this._pathCosts = new Float64Array(size);
                this._pathCostSearchIds = new Uint32Array(size);
                this._pathParents = new Int32Array(size);
                this._pathParentSearchIds = new Uint32Array(size);
                this._pathHeap = new MinHeap();
                this._pathSearchId = 0;
            }
            this._pathSearchId++;
            if (this._pathSearchId === 0xFFFFFFFF) {
                this._pathClosed.fill(0);
                this._pathCostSearchIds.fill(0);
                this._pathParentSearchIds.fill(0);
                this._pathSearchId = 1;
            }

            const closed = this._pathClosed;
            const costs = this._pathCosts;
            const costSearchIds = this._pathCostSearchIds;
            const parents = this._pathParents;
            const parentSearchIds = this._pathParentSearchIds;
            const heap = this._pathHeap;
            const searchId = this._pathSearchId;

            heap.clear();

            const startIndex = this.index(startX, startY);
            const goalIndex = this.index(goalX, goalY);

            costs[startIndex] = 0;
            costSearchIds[startIndex] = searchId;
            heap.push(0, startIndex, startX, startY);

            const scratchPop = heap._popScratch;

            while (heap.length > 0) {
                heap.pop(scratchPop);
                const currentIdx = (scratchPop.index) | 0;
                const currentX = (scratchPop.x) | 0;
                const currentY = (scratchPop.y) | 0;

                if (closed[currentIdx] === searchId) continue;
                if (currentIdx === goalIndex) break;
                closed[currentIdx] = searchId;

                for (let d = 0; d < directions.length; d++) {
                    const dir = directions[d];
                    const offsetX = dir[0];
                    const offsetY = dir[1];
                    const baseCost = dir[2];
                    const nextX = currentX + offsetX;
                    const nextY = currentY + offsetY;

                    if (!this.inBounds(nextX, nextY)) continue;
                    if (!passable(this.get(nextX, nextY), nextX, nextY)) continue;
                    if (diagonal && offsetX !== 0 && offsetY !== 0 && options.cutCorners !== true) {
                        if (!passable(this.get(currentX + offsetX, currentY), currentX + offsetX, currentY)
                            || !passable(this.get(currentX, currentY + offsetY), currentX, currentY + offsetY)) {
                            continue;
                        }
                    }
                    const nextIndex = this.index(nextX, nextY);
                    if (closed[nextIndex] === searchId) continue;

                    const extraCost = typeof options.cost === 'function'
                        ? Number(options.cost(nextX, nextY, this.get(nextX, nextY))) || 1
                        : 1;
                    const currentCost = costSearchIds[currentIdx] === searchId ? costs[currentIdx] : Infinity;
                    const nextCost = currentCost + baseCost * Math.max(0, extraCost);

                    const existingNextCost = costSearchIds[nextIndex] === searchId ? costs[nextIndex] : Infinity;
                    if (nextCost >= existingNextCost) continue;

                    costs[nextIndex] = nextCost;
                    costSearchIds[nextIndex] = searchId;
                    parents[nextIndex] = currentIdx;
                    parentSearchIds[nextIndex] = searchId;

                    const dx = Math.abs(goalX - nextX);
                    const dy = Math.abs(goalY - nextY);
                    const heuristic = diagonal ? Math.max(dx, dy) : dx + dy;
                    heap.push(nextCost + heuristic, nextIndex, nextX, nextY);
                }
            }

            if (startIndex !== goalIndex && (parentSearchIds[goalIndex] !== searchId || parents[goalIndex] === -1)) return [];
            const path = [];
            let cursor = goalIndex;
            while (cursor !== -1) {
                const cy = (cursor / this.width) | 0;
                const cx = cursor - cy * this.width;
                path.push({ x: cx, y: cy });
                if (cursor === startIndex) break;
                cursor = parentSearchIds[cursor] === searchId ? parents[cursor] : -1;
            }
            path.reverse();
            return path;
        }

        findPathAsync(start, goal, options = {}) {
            const self = this;
            return new Promise((resolve) => {
                const payload = {
                    width: self.width,
                    height: self.height,
                    data: self.data.slice().buffer,
                    start: start,
                    goal: goal,
                    options: {
                        diagonal: options.diagonal === true,
                        blocked: options.blocked ?? Cell.BLOCKED,
                        cutCorners: options.cutCorners === true
                    }
                };

                const dispatched = Proc.dispatchWorkerTask('FIND_PATH', payload, (res) => {
                    resolve(res && res.path ? res.path : []);
                });

                if (!dispatched) {
                    resolve(self.findPath(start, goal, options));
                }
            });
        }

        resolveCircle(circleOrX, yOrOptions, radiusValue, maybeOptions = {}, outObj = null) {
            let x;
            let y;
            let radius;
            let options;
            let targetOut = outObj;
            if (circleOrX && typeof circleOrX === 'object') {
                x = Number(circleOrX.x) || 0;
                y = Number(circleOrX.y) || 0;
                radius = Math.max(0, Number(circleOrX.radius) || 0);
                options = yOrOptions || {};
                targetOut = radiusValue;
            } else {
                x = Number(circleOrX) || 0;
                y = Number(yOrOptions) || 0;
                radius = Math.max(0, Number(radiusValue) || 0);
                options = maybeOptions || {};
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
            const res = targetOut && typeof targetOut === 'object' ? targetOut : { x: 0, y: 0, collided: false };
            res.x = x;
            res.y = y;
            res.collided = collided;
            return res;
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
            return true;
        } else if (taskType === 'FIND_PATH') {
            const grid = new Grid(payload.width, payload.height);
            grid.data = new Uint8Array(payload.data);
            const path = grid.findPath(payload.start, payload.goal, payload.options);
            if (typeof callback === 'function') {
                callback({ type: 'PATH_FOUND', path });
            }
            return true;
        }
        return false;
    };

    const Voronoi = {
        _clipInputBuf: new Float32Array(128),
        _clipOutputBuf: new Float32Array(128),

        resolveDamageCategory(archetype) {
            const arch = String(archetype || 'slash').toLowerCase();
            if (arch === 'pierce' || arch === 'knife' || arch === 'arrow' || arch === 'dagger' || arch === 'shot' || arch === 'bullet') return 'LINE_PIERCE';
            if (arch === 'blast' || arch === 'explosion' || arch === 'shout' || arch === 'crit' || arch === 'aoe' || arch === 'bomb') return 'RADIAL_BLAST';
            if (arch === 'magic' || arch === 'beam' || arch === 'laser' || arch === 'burn' || arch === 'fire' || arch === 'lightning' || arch === 'plasma') return 'THERMAL_BEAM';
            if (arch === 'crush' || arch === 'hammer' || arch === 'smash' || arch === 'blunt' || arch === 'shield_crush' || arch === 'heavy') return 'HEAVY_CRUSH';
            if (arch === 'bleed' || arch === 'poison' || arch === 'dot' || arch === 'acid' || arch === 'erosion' || arch === 'tick') return 'SURFACE_ERODE';
            return 'ARC_SLASH';
        },

        generateSites(hitLx, hitLy, width, height, numSites, seed, category = 'ARC_SLASH', dirX = 1, dirY = 0) {
            const rng = Rng.fromSeed(seed || 12345);
            const sites = [];
            sites.push({ x: hitLx, y: hitLy });

            const maxRadius = Math.hypot(width, height) * 0.75;
            const len = Math.hypot(dirX, dirY) || 1;
            const dx = dirX / len;
            const dy = dirY / len;

            if (category === 'ARC_SLASH') {
                const nx = -dy;
                const ny = dx;
                for (let i = 1; i < numSites; i++) {
                    const along = (rng.next() - 0.5) * maxRadius * 1.6;
                    const perp = (rng.next() - 0.5) * maxRadius * 0.22;
                    sites.push({
                        x: hitLx + dx * along + nx * perp,
                        y: hitLy + dy * along + ny * perp
                    });
                }
            } else if (category === 'LINE_PIERCE') {
                const nx = -dy;
                const ny = dx;
                for (let i = 1; i < numSites; i++) {
                    const depth = rng.next() * maxRadius * 1.8;
                    const scatter = (rng.next() - 0.5) * maxRadius * 0.18;
                    sites.push({
                        x: hitLx + dx * depth + nx * scatter,
                        y: hitLy + dy * depth + ny * scatter
                    });
                }
            } else if (category === 'HEAVY_CRUSH') {
                const step = maxRadius * 0.45;
                for (let i = 1; i < numSites; i++) {
                    const rx = (rng.next() - 0.5) * maxRadius * 1.5;
                    const ry = (rng.next() - 0.5) * maxRadius * 1.5;
                    sites.push({
                        x: hitLx + Math.round(rx / step) * step + (rng.next() - 0.5) * 4,
                        y: hitLy + Math.round(ry / step) * step + (rng.next() - 0.5) * 4
                    });
                }
            } else {
                for (let i = 1; i < numSites; i++) {
                    const dist = Math.pow(rng.next(), 1.5) * maxRadius;
                    const angle = rng.next() * Math.PI * 2;
                    sites.push({
                        x: hitLx + Math.cos(angle) * dist,
                        y: hitLy + Math.sin(angle) * dist
                    });
                }
            }
            return sites;
        },

        clipPolygonAgainstHalfPlane(inBuf, inCount, px, py, nx, ny, outBuf) {
            let outCount = 0;
            if (inCount === 0) return 0;

            let prevX = inBuf[(inCount - 1) * 2];
            let prevY = inBuf[(inCount - 1) * 2 + 1];
            let prevDot = (prevX - px) * nx + (prevY - py) * ny;

            for (let i = 0; i < inCount; i++) {
                const currX = inBuf[i * 2];
                const currY = inBuf[i * 2 + 1];
                const currDot = (currX - px) * nx + (currY - py) * ny;

                if (currDot <= 0) {
                    if (prevDot > 0) {
                        const t = prevDot / (prevDot - currDot || 1e-6);
                        outBuf[outCount * 2] = prevX + (currX - prevX) * t;
                        outBuf[outCount * 2 + 1] = prevY + (currY - prevY) * t;
                        outCount++;
                    }
                    outBuf[outCount * 2] = currX;
                    outBuf[outCount * 2 + 1] = currY;
                    outCount++;
                } else if (prevDot <= 0) {
                    const t = prevDot / (prevDot - currDot || 1e-6);
                    outBuf[outCount * 2] = prevX + (currX - prevX) * t;
                    outBuf[outCount * 2 + 1] = prevY + (currY - prevY) * t;
                    outCount++;
                }
                prevX = currX;
                prevY = currY;
                prevDot = currDot;
            }
            return outCount;
        },

        clipCellToShapeDef(inBuf, inCount, shapeDef, outBuf) {
            const shape = shapeDef.shape || 'circle';
            const size = shapeDef.size || 20;
            const w = (shapeDef.width !== undefined ? shapeDef.width : size) * 0.8;
            const h = (shapeDef.height !== undefined ? shapeDef.height : size) * 0.8;

            if (shape === 'rectangle') {
                let c = this.clipPolygonAgainstHalfPlane(inBuf, inCount, -w, 0, -1, 0, outBuf);
                if (c < 3) return 0;
                for (let k = 0; k < c * 2; k++) inBuf[k] = outBuf[k];

                c = this.clipPolygonAgainstHalfPlane(inBuf, c, w, 0, 1, 0, outBuf);
                if (c < 3) return 0;
                for (let k = 0; k < c * 2; k++) inBuf[k] = outBuf[k];

                c = this.clipPolygonAgainstHalfPlane(inBuf, c, 0, -h, 0, -1, outBuf);
                if (c < 3) return 0;
                for (let k = 0; k < c * 2; k++) inBuf[k] = outBuf[k];

                return this.clipPolygonAgainstHalfPlane(inBuf, c, 0, h, 0, 1, outBuf);
            } else if (shape === 'diamond') {
                const d = size * 1.13;
                const n = 0.7071;
                let c = this.clipPolygonAgainstHalfPlane(inBuf, inCount, d * n, 0, n, n, outBuf);
                if (c < 3) return 0;
                for (let k = 0; k < c * 2; k++) inBuf[k] = outBuf[k];

                c = this.clipPolygonAgainstHalfPlane(inBuf, c, d * n, 0, n, -n, outBuf);
                if (c < 3) return 0;
                for (let k = 0; k < c * 2; k++) inBuf[k] = outBuf[k];

                c = this.clipPolygonAgainstHalfPlane(inBuf, c, -d * n, 0, -n, n, outBuf);
                if (c < 3) return 0;
                for (let k = 0; k < c * 2; k++) inBuf[k] = outBuf[k];

                return this.clipPolygonAgainstHalfPlane(inBuf, c, -d * n, 0, -n, -n, outBuf);
            } else {
                const r = size * 0.98;
                let c = inCount;
                for (let i = 0; i < 8; i++) {
                    const a = (Math.PI / 4) * i;
                    const nx = Math.cos(a), ny = Math.sin(a);
                    c = this.clipPolygonAgainstHalfPlane(inBuf, c, nx * r, ny * r, nx, ny, outBuf);
                    if (c < 3) return 0;
                    for (let k = 0; k < c * 2; k++) inBuf[k] = outBuf[k];
                }
                return c;
            }
        },

        computeShatterWeb(hitLx, hitLy, shapeDef, options = {}) {
            const numSites = options.numSites || 24;
            const seed = options.seed || Math.floor(Math.random() * 100000);
            const archetype = options.archetype || 'slash';
            const category = this.resolveDamageCategory(archetype);
            const dirX = options.dirX !== undefined ? options.dirX : 1;
            const dirY = options.dirY !== undefined ? options.dirY : 0;

            const w = shapeDef.width || shapeDef.size || 30;
            const h = shapeDef.height || shapeDef.size || 30;
            const sites = this.generateSites(hitLx, hitLy, w, h, numSites, seed, category, dirX, dirY);

            const shards = [];
            const boundR = Math.max(w, h) * 1.5;

            for (let i = 0; i < sites.length; i++) {
                const s1 = sites[i];
                let count = 4;
                const inBuf = this._clipInputBuf;
                const outBuf = this._clipOutputBuf;

                inBuf[0] = -boundR; inBuf[1] = -boundR;
                inBuf[2] =  boundR; inBuf[3] = -boundR;
                inBuf[4] =  boundR; inBuf[5] =  boundR;
                inBuf[6] = -boundR; inBuf[7] =  boundR;

                for (let j = 0; j < sites.length; j++) {
                    if (i === j) continue;
                    const s2 = sites[j];
                    const mx = (s1.x + s2.x) * 0.5;
                    const my = (s1.y + s2.y) * 0.5;
                    const nx = s2.x - s1.x;
                    const ny = s2.y - s1.y;
                    const len = Math.hypot(nx, ny);
                    if (len < 0.001) continue;

                    count = this.clipPolygonAgainstHalfPlane(inBuf, count, mx, my, nx / len, ny / len, outBuf);
                    if (count < 3) break;

                    for (let k = 0; k < count * 2; k++) inBuf[k] = outBuf[k];
                }

                if (count < 3) continue;

                count = this.clipCellToShapeDef(inBuf, count, shapeDef, outBuf);
                if (count < 3) continue;

                let area = 0, cx = 0, cy = 0;
                for (let k = 0; k < count; k++) {
                    const x0 = outBuf[k * 2], y0 = outBuf[k * 2 + 1];
                    const x1 = outBuf[((k + 1) % count) * 2], y1 = outBuf[((k + 1) % count) * 2 + 1];
                    const cross = (x0 * y1 - x1 * y0);
                    area += cross;
                    cx += (x0 + x1) * cross;
                    cy += (y0 + y1) * cross;
                }
                area = Math.abs(area * 0.5);
                if (area < 0.5) continue;

                cx /= (6 * (area * (cx < 0 ? -1 : 1) || 1));
                const pts = new Float32Array(count * 2);
                for (let k = 0; k < count * 2; k++) pts[k] = outBuf[k];

                shards.push({
                    centroidX: s1.x,
                    centroidY: s1.y,
                    area,
                    points: pts,
                    vertCount: count
                });
            }
            return shards;
        }
    };

    const VoxelIslands = {
        _bfsQueue: new Int32Array(2304),
        _visited: new Uint8Array(2304),

        extractConnectedIslands(destroyedMask, cols, rows, newlyDestroyedList) {
            const total = cols * rows;
            if (this._visited.length < total) {
                this._visited = new Uint8Array(total);
                this._bfsQueue = new Int32Array(total);
            }
            this._visited.fill(0);

            const islands = [];

            for (let k = 0; k < newlyDestroyedList.length; k++) {
                const startIdx = newlyDestroyedList[k];
                if (startIdx < 0 || startIdx >= total) continue;
                if (destroyedMask[startIdx] !== 1 || this._visited[startIdx] === 1) continue;

                let head = 0, tail = 0;
                this._bfsQueue[tail++] = startIdx;
                this._visited[startIdx] = 1;

                const cells = [];

                while (head < tail) {
                    const idx = this._bfsQueue[head++];
                    cells.push(idx);

                    const r = Math.floor(idx / cols);
                    const c = idx % cols;

                    const neighbors = [
                        r > 0 ? (r - 1) * cols + c : -1,
                        r < rows - 1 ? (r + 1) * cols + c : -1,
                        c > 0 ? r * cols + (c - 1) : -1,
                        c < cols - 1 ? r * cols + (c + 1) : -1
                    ];

                    for (let n = 0; n < 4; n++) {
                        const nIdx = neighbors[n];
                        if (nIdx !== -1 && destroyedMask[nIdx] === 1 && this._visited[nIdx] === 0) {
                            this._visited[nIdx] = 1;
                            this._bfsQueue[tail++] = nIdx;
                        }
                    }
                }

                if (cells.length > 0) {
                    islands.push(cells);
                }
            }
            return islands;
        },

        traceIslandBoundary(cells, cols, rows, voxelW, voxelH, originX, originY) {
            if (!cells || cells.length === 0) return null;

            let sumC = 0, sumR = 0;
            const set = new Set(cells);

            for (let i = 0; i < cells.length; i++) {
                const idx = cells[i];
                sumC += idx % cols;
                sumR += Math.floor(idx / cols);
            }

            const avgC = sumC / cells.length;
            const avgR = sumR / cells.length;

            const centroidX = originX + (avgC + 0.5) * voxelW;
            const centroidY = originY + (avgR + 0.5) * voxelH;

            const edges = [];
            for (let i = 0; i < cells.length; i++) {
                const idx = cells[i];
                const r = Math.floor(idx / cols);
                const c = idx % cols;

                const lx = (c - avgC) * voxelW;
                const rx = (c + 1 - avgC) * voxelW;
                const ty = (r - avgR) * voxelH;
                const by = (r + 1 - avgR) * voxelH;

                if (r === 0 || !set.has((r - 1) * cols + c)) edges.push(lx, ty, rx, ty);
                if (c === cols - 1 || !set.has(r * cols + (c + 1))) edges.push(rx, ty, rx, by);
                if (r === rows - 1 || !set.has((r + 1) * cols + c)) edges.push(rx, by, lx, by);
                if (c === 0 || !set.has(r * cols + (c - 1))) edges.push(lx, by, lx, ty);
            }

            if (edges.length === 0) return null;

            const rawVerts = [];
            let currX = edges[0], currY = edges[1];
            rawVerts.push(currX, currY);

            const used = new Uint8Array(edges.length / 4);
            used[0] = 1;
            currX = edges[2];
            currY = edges[3];

            for (let iter = 1; iter < edges.length / 4; iter++) {
                rawVerts.push(currX, currY);
                let found = false;
                for (let e = 0; e < edges.length / 4; e++) {
                    if (used[e]) continue;
                    const x1 = edges[e * 4], y1 = edges[e * 4 + 1];
                    const x2 = edges[e * 4 + 2], y2 = edges[e * 4 + 3];
                    if (Math.hypot(x1 - currX, y1 - currY) < 1e-3) {
                        used[e] = 1;
                        currX = x2;
                        currY = y2;
                        found = true;
                        break;
                    }
                }
                if (!found) break;
            }

            const poly = [];
            const count = rawVerts.length / 2;
            if (count < 3) return null;

            for (let i = 0; i < count; i++) {
                const px = rawVerts[i * 2];
                const py = rawVerts[i * 2 + 1];
                const prevI = (i - 1 + count) % count;
                const nextI = (i + 1) % count;

                const pX = rawVerts[prevI * 2], pY = rawVerts[prevI * 2 + 1];
                const nX = rawVerts[nextI * 2], nY = rawVerts[nextI * 2 + 1];

                const cross = (px - pX) * (nY - py) - (py - pY) * (nX - px);
                if (Math.abs(cross) > 1e-4) {
                    poly.push(px, py);
                }
            }

            if (poly.length < 6) return null;

            return {
                centroidX,
                centroidY,
                cellCount: cells.length,
                points: new Float32Array(poly),
                vertCount: poly.length / 2
            };
        }
    };

    // God-Tier Multi-Variable Voxel Disintegration Engine
    let _bfsQueue = null;
    let _bfsVisited = null;
    let _partitionRng = null;

    const VoxelDisintegration = {
        buildShapeMaskWithCore(g, enemy) {
            const shape = (enemy.shape || 'circle').toLowerCase();
            const cols = g.cols;
            const rows = g.rows;
            const total = cols * rows;
            const mask = new Uint8Array(total);

            const size = enemy.size || 20;
            const halfW = g.cols * g.voxelW * 0.5;
            const halfH = g.rows * g.voxelH * 0.5;
            const mult = enemy.sizeMultiplier || 1.0;
            const effSize = size * mult;

            const w = (enemy.width !== undefined ? enemy.width : size) * mult * 0.8;
            const h = (enemy.height !== undefined ? enemy.height : size) * mult * 0.8;

            const coreRatio = 0.40;

            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    const idx = r * cols + c;
                    const lx = -halfW + c * g.voxelW + g.voxelW * 0.5;
                    const ly = -halfH + r * g.voxelH + g.voxelH * 0.5;

                    let inside = false;
                    let isCore = false;

                    if (shape === 'rectangle') {
                        inside = Math.abs(lx) <= w && Math.abs(ly) <= h;
                        isCore = inside && (Math.abs(lx) <= w * coreRatio && Math.abs(ly) <= h * coreRatio);
                    } else if (shape === 'diamond') {
                        const d = effSize * 1.13;
                        inside = (Math.abs(lx) + Math.abs(ly)) <= d;
                        isCore = inside && ((Math.abs(lx) + Math.abs(ly)) <= d * coreRatio);
                    } else if (shape === 'star') {
                        const rOuter = effSize * 1.15;
                        const dist = Math.hypot(lx, ly);
                        const angle = Math.atan2(ly, lx);
                        const starR = rOuter * (0.65 + 0.35 * Math.cos(angle * 5));
                        inside = dist <= starR;
                        isCore = inside && (dist <= starR * coreRatio);
                    } else if (shape === 'octagon') {
                        const rOct = effSize * 1.05;
                        const dist = Math.hypot(lx, ly);
                        inside = dist <= rOct && (Math.abs(lx) <= rOct * 0.92) && (Math.abs(ly) <= rOct * 0.92);
                        isCore = inside && (dist <= rOct * coreRatio);
                    } else {
                        const dist = Math.hypot(lx, ly);
                        const rCircle = effSize * 0.98;
                        inside = dist <= rCircle;
                        isCore = inside && (dist <= rCircle * coreRatio);
                    }

                    if (inside) {
                        mask[idx] = isCore ? 2 : 1;
                    } else {
                        mask[idx] = 0;
                    }
                }
            }
            return mask;
        },

        isSurfaceExposedCell(g, mask, destroyedArray, r, c) {
            const cols = g.cols;
            const rows = g.rows;

            if (r === 0 || r === rows - 1 || c === 0 || c === cols - 1) return true;

            const up    = (r - 1) * cols + c;
            const down  = (r + 1) * cols + c;
            const left  = r * cols + (c - 1);
            const right = r * cols + (c + 1);

            return (mask[up] === 0 || destroyedArray[up] === 1) ||
                   (mask[down] === 0 || destroyedArray[down] === 1) ||
                   (mask[left] === 0 || destroyedArray[left] === 1) ||
                   (mask[right] === 0 || destroyedArray[right] === 1);
        },

        computeStressScore(hitPos, enemy, damage, archetype) {
            const arch = String(archetype || 'slash').toLowerCase();
            let baseCategoryScore = 0.65;
            if (arch === 'blast' || arch === 'explosion' || arch === 'shout' || arch === 'crit' || arch === 'magic' || arch === 'beam') baseCategoryScore = 0.85;
            else if (arch === 'crush' || arch === 'hammer' || arch === 'smash') baseCategoryScore = 0.35;
            else if (arch === 'bleed' || arch === 'poison' || arch === 'dot' || arch === 'acid') baseCategoryScore = 0.45;

            const maxHp = Math.max(1, (enemy && enemy.maxHp) || 100);
            const dmgRatio = Math.min(2.0, (damage || 20) / maxHp);
            const severityMult = 0.5 + dmgRatio;

            let locationFactor = 0.70;
            if (enemy && hitPos) {
                const hx = hitPos.x !== undefined ? hitPos.x : (hitPos.hitX || enemy.x);
                const hy = hitPos.y !== undefined ? hitPos.y : (hitPos.hitY || enemy.y);
                const distToCenter = Math.hypot(hx - enemy.x, hy - enemy.y);
                const enemySize = enemy.size || 30;
                if (distToCenter / enemySize < 0.35) {
                    locationFactor = 1.35;
                }
            }

            const shape = (enemy && enemy.shape) || 'circle';
            let materialModifier = 1.0;
            if (shape === 'rectangle') materialModifier = 0.60;
            else if (shape === 'diamond') materialModifier = 1.25;
            else if (shape === 'star' || shape === 'octagon' || (enemy && enemy.isBoss)) materialModifier = 0.85;

            return baseCategoryScore * severityMult * locationFactor * materialModifier;
        },

        partitionVoxelMass(destroyedCells, g, stressScore, archetype, options) {
            if (!destroyedCells || destroyedCells.length === 0) return [];
            options = options || {};
            const deathShatter = !!options.deathShatter;
            if (!_partitionRng) {
                _partitionRng = Rng.fromSeed(`voxel-partition:${Date.now() & 0xfffffff}`);
            }
            const rng = options.rng || _partitionRng;
            const rand = () => readRandom(rng);
            const particles = [];
            const cols = g.cols;
            const rows = g.rows;
            const vw = g.voxelW;
            const vh = g.voxelH;
            const totalCells = cols * rows;
            const originX = -vw * cols * 0.5;
            const originY = -vh * rows * 0.5;

            if (!_bfsQueue || _bfsQueue.length < totalCells) {
                _bfsQueue = new Int32Array(Math.max(512, totalCells));
                _bfsVisited = new Uint8Array(Math.max(512, totalCells));
            } else {
                _bfsVisited.fill(0, 0, totalCells);
            }

            const inSet = new Uint8Array(totalCells);
            let setCount = 0;
            for (let i = 0; i < destroyedCells.length; i++) {
                const cell = destroyedCells[i];
                const idx = typeof cell === 'number' ? cell : cell.idx;
                if (idx >= 0 && idx < totalCells && !inSet[idx]) {
                    inSet[idx] = 1;
                    setCount++;
                }
            }

            // Stress drives breakup ladder: rare slab → large → medium → small → crumbs.
            // Bias toward fewer, larger plates (not sand) so rigid sim stays accurate.
            // maxChunkSize caps ordinary plates; slabs use maxSlabSize and a hard rarity cap.
            let maxChunkSize = 9;
            let maxSlabSize = 15;
            let preferSingle = 0.08;
            let preferSmall = 0.18;
            let maxSlabs = 1;
            let preferSlab = 0.07;
            if (deathShatter) {
                maxChunkSize = Math.min(11, Math.max(8, Math.floor(Math.sqrt(setCount) * 1.6)));
                maxSlabSize = Math.min(16, Math.max(13, Math.floor(Math.sqrt(setCount) * 2.4)));
                preferSingle = 0.06;
                preferSmall = 0.12;
                maxSlabs = 2;
                preferSlab = 0.11;
            } else if (stressScore > 1.1) {
                maxChunkSize = 5;
                preferSingle = 0.22;
                preferSmall = 0.26;
                maxSlabs = 0;
                preferSlab = 0;
            } else if (stressScore > 0.75) {
                maxChunkSize = 7;
                preferSingle = 0.14;
                preferSmall = 0.22;
                maxSlabs = 0;
                preferSlab = 0;
            } else if (stressScore < 0.5) {
                maxChunkSize = 11;
                preferSingle = 0.04;
                preferSmall = 0.12;
                maxSlabs = 1;
                preferSlab = 0.09;
            }

            const archetypeKey = String(archetype || 'slash').toLowerCase();
            if (!deathShatter) {
                if (archetypeKey === 'blast' || archetypeKey === 'magic') {
                    preferSingle = Math.min(0.35, preferSingle + 0.06);
                    maxChunkSize = Math.max(4, maxChunkSize - 1);
                    preferSlab *= 0.5;
                } else if (archetypeKey === 'crush' || archetypeKey === 'slash') {
                    maxChunkSize = Math.min(11, maxChunkSize + 1);
                    preferSingle = Math.max(0.03, preferSingle - 0.03);
                    preferSlab = Math.min(0.14, preferSlab + 0.03);
                }
            }

            function classifyTier(cellCount) {
                if (cellCount >= 12) return 'slab';
                if (cellCount >= 7) return 'large';
                if (cellCount >= 4) return 'medium';
                if (cellCount >= 2) return 'small';
                return 'voxel';
            }

            let slabsSpawned = 0;

            function pushCluster(clusterCells) {
                if (!clusterCells || clusterCells.length === 0) return;
                const tier = classifyTier(clusterCells.length);
                if (tier === 'slab') slabsSpawned++;
                const traced = VoxelIslands.traceIslandBoundary(
                    clusterCells, cols, rows, vw, vh, originX, originY
                );
                if (traced && traced.vertCount >= 3) {
                    // Clamp to ShardPool vert budget (16 verts / 32 floats).
                    let points = traced.points;
                    let vertCount = traced.vertCount;
                    if (vertCount > 16) {
                        const stepped = new Float32Array(32);
                        for (let k = 0; k < 16; k++) {
                            const src = Math.floor(k * vertCount / 16) * 2;
                            stepped[k * 2] = points[src];
                            stepped[k * 2 + 1] = points[src + 1];
                        }
                        points = stepped;
                        vertCount = 16;
                    }
                    particles.push({
                        centroidX: traced.centroidX,
                        centroidY: traced.centroidY,
                        cellCount: clusterCells.length,
                        tier,
                        points,
                        vertCount
                    });
                    return;
                }

                // Fallback: build a simple rect from cell bounds (still size-accurate).
                let minC = cols, maxC = -1, minR = rows, maxR = -1;
                let sumC = 0, sumR = 0;
                for (let k = 0; k < clusterCells.length; k++) {
                    const cIdx = clusterCells[k];
                    const c = cIdx % cols;
                    const r = Math.floor(cIdx / cols);
                    minC = Math.min(minC, c); maxC = Math.max(maxC, c);
                    minR = Math.min(minR, r); maxR = Math.max(maxR, r);
                    sumC += c; sumR += r;
                }
                const avgC = sumC / clusterCells.length;
                const avgR = sumR / clusterCells.length;
                const cx = (avgC + 0.5) * vw + originX;
                const cy = (avgR + 0.5) * vh + originY;
                const halfW = (maxC - minC + 1) * vw * 0.5;
                const halfH = (maxR - minR + 1) * vh * 0.5;
                particles.push({
                    centroidX: cx,
                    centroidY: cy,
                    cellCount: clusterCells.length,
                    tier,
                    points: new Float32Array([
                        -halfW, -halfH, halfW, -halfH, halfW, halfH, -halfW, halfH
                    ]),
                    vertCount: 4
                });
            }

            function pickDeathTargetSize(remaining) {
                // Rare oversized slabs, then plating; crumbs are seasoning.
                const roll = rand();
                if (remaining >= 12 && slabsSpawned < maxSlabs && roll < preferSlab) {
                    return Math.min(maxSlabSize, 12 + Math.floor(rand() * 4)); // slab
                }
                if (remaining >= 7 && roll < 0.48) {
                    return Math.min(maxChunkSize, 7 + Math.floor(rand() * 4)); // large
                }
                if (remaining >= 4 && roll < 0.82) {
                    return Math.min(maxChunkSize, 4 + Math.floor(rand() * 3)); // medium
                }
                if (remaining >= 2 && roll < 0.94) {
                    return 2; // small
                }
                return 1; // voxel
            }

            let remaining = setCount;
            for (let i = 0; i < destroyedCells.length; i++) {
                const cell = destroyedCells[i];
                const startIdx = typeof cell === 'number' ? cell : cell.idx;
                if (startIdx < 0 || startIdx >= totalCells || _bfsVisited[startIdx] || !inSet[startIdx]) continue;

                let targetSize;
                if (deathShatter) {
                    targetSize = pickDeathTargetSize(remaining);
                } else {
                    const roll = rand();
                    if (roll < preferSingle) {
                        _bfsVisited[startIdx] = 1;
                        pushCluster([startIdx]);
                        remaining -= 1;
                        continue;
                    }
                    targetSize = maxChunkSize;
                    if (roll < preferSingle + preferSmall) {
                        targetSize = Math.min(maxChunkSize, 2 + (rand() < 0.45 ? 0 : 1));
                    } else if (
                        remaining >= 12
                        && slabsSpawned < maxSlabs
                        && rand() < preferSlab
                    ) {
                        targetSize = Math.min(maxSlabSize, 12 + Math.floor(rand() * 4));
                    } else if (rand() < 0.42) {
                        // Medium plates; otherwise take full maxChunkSize plating.
                        targetSize = Math.min(maxChunkSize, 4 + Math.floor(rand() * 3));
                    }
                }

                let head = 0;
                let tail = 0;
                _bfsQueue[tail++] = startIdx;
                _bfsVisited[startIdx] = 1;
                const cluster = [];

                while (head < tail && cluster.length < targetSize) {
                    const curr = _bfsQueue[head++];
                    cluster.push(curr);
                    const r = Math.floor(curr / cols);
                    const c = curr % cols;
                    const nbrs = [
                        c + 1 < cols ? r * cols + (c + 1) : -1,
                        r + 1 < rows ? (r + 1) * cols + c : -1,
                        c > 0 ? r * cols + (c - 1) : -1,
                        r > 0 ? (r - 1) * cols + c : -1
                    ];
                    for (let n = 0; n < 4; n++) {
                        const nIdx = nbrs[n];
                        if (nIdx >= 0 && inSet[nIdx] && !_bfsVisited[nIdx]) {
                            _bfsVisited[nIdx] = 1;
                            _bfsQueue[tail++] = nIdx;
                            if (cluster.length + (tail - head) >= targetSize) break;
                        }
                    }
                }
                while (head < tail && cluster.length < targetSize) {
                    cluster.push(_bfsQueue[head++]);
                }
                while (head < tail) {
                    const extra = _bfsQueue[head++];
                    _bfsVisited[extra] = 0;
                }

                remaining -= cluster.length;
                pushCluster(cluster);
            }

            return particles;
        }
    };

    Proc.Voronoi = Voronoi;
    Proc.VoxelIslands = VoxelIslands;
    Proc.VoxelDisintegration = VoxelDisintegration;

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

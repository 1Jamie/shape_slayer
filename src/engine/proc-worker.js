// Engine.Proc Background Worker for Offscreen Grid Synthesis & Pathfinding
self.onmessage = function(e) {
    const data = e.data || {};
    const type = data.type;

    if (type === 'GENERATE_GRID') {
        const { width, height, density, seed, iterations } = data;
        const size = width * height;
        const gridData = new Uint8Array(size);

        // Simple PRNG
        let state = (seed || 12345) >>> 0;
        function nextRng() {
            state = (state + 0x6D2B79F5) >>> 0;
            let value = state;
            value = Math.imul(value ^ value >>> 15, value | 1);
            value ^= value + Math.imul(value ^ value >>> 7, value | 61);
            return ((value ^ value >>> 14) >>> 0) / 4294967296;
        }

        const chance = Math.max(0, Math.min(1, Number(density) || 0.4));
        for (let i = 0; i < size; i++) {
            gridData[i] = nextRng() < chance ? 1 : 0;
        }

        const steps = Math.max(1, Math.floor(iterations || 4));
        for (let step = 0; step < steps; step++) {
            const next = new Uint8Array(size);
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    let count = 0;
                    for (let dy = -1; dy <= 1; dy++) {
                        for (let dx = -1; dx <= 1; dx++) {
                            if (dx === 0 && dy === 0) continue;
                            const nx = x + dx;
                            const ny = y + dy;
                            if (nx >= 0 && ny >= 0 && nx < width && ny < height) {
                                if (gridData[ny * width + nx] === 1) count++;
                            } else {
                                count++;
                            }
                        }
                    }
                    const index = y * width + x;
                    if (gridData[index] === 1) {
                        next[index] = count < 4 ? 0 : 1;
                    } else {
                        next[index] = count > 4 ? 1 : 0;
                    }
                }
            }
            gridData.set(next);
        }

        // Return transferable Uint8Array buffer
        self.postMessage({
            type: 'GRID_GENERATED',
            width,
            height,
            data: gridData.buffer
        }, [gridData.buffer]);
    }
};

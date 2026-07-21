/**
 * OffscreenCanvas + SharedArrayBuffer Particle Rendering Worker.
 * Reads typed array buffers and renders offscreen particles off the main thread.
 *
 * @typedef {Object} InitParticleWorkerMessage
 * @property {'INIT_PARTICLE_WORKER'} type
 * @property {OffscreenCanvas} canvas
 * @property {SharedArrayBuffer} buffer
 * @property {number} particleCap
 * @property {number} [gravityX]
 * @property {number} [gravityY]
 */
self.onmessage = function(e) {
    const data = e.data || {};
    if (data.type === 'INIT_PARTICLE_WORKER') {
        const { canvas, buffer, particleCap, gravityX, gravityY } = data;
        const ctx = canvas.getContext('2d');
        const header = new Int32Array(buffer, 0, 16);
        const headerBytes = 64;
        const channelBytes = particleCap * 4;
        const offset = (idx) => headerBytes + idx * channelBytes;

        const x = new Float32Array(buffer, offset(0), particleCap);
        const y = new Float32Array(buffer, offset(1), particleCap);
        const vx = new Float32Array(buffer, offset(2), particleCap);
        const vy = new Float32Array(buffer, offset(3), particleCap);
        const size = new Float32Array(buffer, offset(4), particleCap);
        const life = new Float32Array(buffer, offset(5), particleCap);
        const maxLife = new Float32Array(buffer, offset(6), particleCap);
        const gravity = new Float32Array(buffer, offset(7), particleCap);
        const drag = new Float32Array(buffer, offset(8), particleCap);
        const bounce = new Float32Array(buffer, offset(9), particleCap);
        const cr = new Float32Array(buffer, offset(10), particleCap);
        const cg = new Float32Array(buffer, offset(11), particleCap);
        const cb = new Float32Array(buffer, offset(12), particleCap);

        let lastTime = performance.now();

        function step() {
            const now = performance.now();
            const dt = Math.min(0.1, (now - lastTime) / 1000);
            lastTime = now;

            const count = Atomics.load(header, 0);

            // Update physics & lifetime
            for (let i = count - 1; i >= 0; i--) {
                life[i] -= dt;
                if (life[i] <= 0) {
                    const last = Atomics.sub(header, 0, 1) - 1;
                    if (i < last) {
                        x[i] = x[last]; y[i] = y[last];
                        vx[i] = vx[last]; vy[i] = vy[last];
                        size[i] = size[last]; life[i] = life[last];
                        maxLife[i] = maxLife[last]; gravity[i] = gravity[last];
                        drag[i] = drag[last]; bounce[i] = bounce[last];
                        cr[i] = cr[last]; cg[i] = cg[last]; cb[i] = cb[last];
                    }
                    continue;
                }
                vx[i] += (gravityX || 0) * dt;
                vy[i] += ((gravityY || 0) + gravity[i]) * dt;
                const damping = Math.max(0, 1 - drag[i] * dt);
                vx[i] *= damping;
                vy[i] *= damping;
                x[i] += vx[i] * dt;
                y[i] += vy[i] * dt;
            }

            // Render to OffscreenCanvas
            if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.save();
                const activeCount = Atomics.load(header, 0);
                for (let i = 0; i < activeCount; i++) {
                    const r = size[i];
                    const alpha = Math.max(0, life[i] / maxLife[i]);
                    const ir = Math.round(Math.max(0, Math.min(1, cr[i])) * 255);
                    const ig = Math.round(Math.max(0, Math.min(1, cg[i])) * 255);
                    const ib = Math.round(Math.max(0, Math.min(1, cb[i])) * 255);
                    ctx.globalAlpha = alpha;
                    ctx.fillStyle = `rgb(${ir},${ig},${ib})`;
                    ctx.beginPath();
                    ctx.arc(x[i], y[i], r, 0, Math.PI * 2);
                    ctx.fill();
                }
                ctx.restore();
            }

            requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
    }
};

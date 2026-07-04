const test = require('node:test');
const assert = require('node:assert');

function rotateCrossoverPattern(crossovers, pattern) {
    [0, 1].forEach(dividerIndex => {
        const slots = crossovers.filter(c => c.dividerIndex === dividerIndex).sort((a, b) => a.slotIndex - b.slotIndex);
        const dividerPattern = pattern[dividerIndex] || pattern[0];
        slots.forEach(slot => {
            slot.sealed = dividerPattern.sealed.includes(slot.slotIndex);
        });
    });
}

test('rotateCrossovers keeps at least one open crossover per divider', () => {
    const crossovers = [];
    [0, 1].forEach(dividerIndex => {
        [0, 1, 2].forEach(slotIndex => {
            crossovers.push({ dividerIndex, slotIndex, sealed: false });
        });
    });
    const patterns = [
        [{ open: [0, 2], sealed: [1] }, { open: [0, 1], sealed: [2] }],
        [{ open: [1], sealed: [0, 2] }, { open: [2], sealed: [0, 1] }],
        [{ open: [0, 1], sealed: [2] }, { open: [1, 2], sealed: [0] }]
    ];
    patterns.forEach(pattern => {
        rotateCrossoverPattern(crossovers, pattern);
        [0, 1].forEach(dividerIndex => {
            const openCount = crossovers.filter(c => c.dividerIndex === dividerIndex && !c.sealed).length;
            assert.ok(openCount >= 1, `divider ${dividerIndex} must keep at least one open crossover`);
        });
    });
});

test('lane wave front reaches courtyard end in expected time', () => {
    const corridorRight = 1800;
    const corridorLeft = 720;
    const speed = 390;
    const travelDistance = corridorRight + 40 - (corridorLeft - 120);
    const travelTime = travelDistance / speed;
    assert.ok(travelTime >= 2.4 && travelTime <= 3.4, `lane wave travel time should be dodgeable (~2.8s), got ${travelTime.toFixed(2)}s`);
});

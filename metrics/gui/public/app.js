const state = {
    runs: [],
    selectedRunId: null,
    charts: {
        roomDamage: null
    }
};

const COLORS = [
    '#38bdf8',
    '#a855f7',
    '#f97316',
    '#22c55e',
    '#facc15',
    '#ec4899',
    '#14b8a6',
    '#f43f5e'
];

function formatNumber(value) {
    if (value === null || value === undefined) return '0';
    if (Math.abs(value) >= 1000) {
        return Intl.NumberFormat('en', { notation: 'compact' }).format(value);
    }
    return Intl.NumberFormat('en', { maximumFractionDigits: 0 }).format(value);
}

function formatDuration(ms) {
    if (!ms || ms <= 0) return '0s';
    const totalSeconds = Math.round(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (minutes === 0) return `${seconds}s`;
    return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
}

function formatTimestamp(iso) {
    if (!iso) return '—';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleString();
}

async function fetchJson(url) {
    const res = await fetch(url);
    if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(detail.error || `Request failed with ${res.status}`);
    }
    return res.json();
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatStatValue(value, { percentage = false } = {}) {
    if (!Number.isFinite(value)) {
        return '—';
    }
    if (percentage) {
        return `${(value * 100).toFixed(1)}%`;
    }
    const formatter = new Intl.NumberFormat('en', {
        maximumFractionDigits: Math.abs(value) < 10 ? 2 : 1,
        minimumFractionDigits: Math.abs(value) < 1 ? 2 : 0
    });
    return formatter.format(value);
}

function formatGearPiece(piece) {
    if (!piece) return null;
    const core = [];
    if (piece.name) core.push(escapeHtml(piece.name));
    else if (piece.id) core.push(escapeHtml(piece.id));
    if (piece.tier) core.push(`<span class="gear-tier">${escapeHtml(piece.tier)}</span>`);
    const baseLabel = core.length ? core.join(' ') : 'Unknown';
    const extras = [];
    if (piece.type) extras.push(escapeHtml(piece.type));
    if (piece.classModifier) extras.push(escapeHtml(piece.classModifier));
    if (piece.legendaryEffect) extras.push(escapeHtml(piece.legendaryEffect));
    return extras.length ? `${baseLabel} <span class="gear-extra">(${extras.join(', ')})</span>` : baseLabel;
}

function formatGearPieces(gear) {
    if (!gear) return [];
    const pieces = [];
    if (gear.weapon) {
        pieces.push(`Weapon: ${formatGearPiece(gear.weapon) ?? 'Unknown'}`);
    }
    if (gear.armor) {
        pieces.push(`Armor: ${formatGearPiece(gear.armor) ?? 'Unknown'}`);
    }
    if (gear.accessory) {
        pieces.push(`Accessory: ${formatGearPiece(gear.accessory) ?? 'Unknown'}`);
    }
    return pieces;
}

function formatGear(gear) {
    const pieces = formatGearPieces(gear);
    return pieces.length ? pieces.join('<br>') : '—';
}

function renderSnapshotTable(snapshots) {
    if (!snapshots || snapshots.length === 0) {
        return '<p class="empty">No data</p>';
    }

    const rows = snapshots.map(snapshot => {
        const stats = snapshot.stats || {};
        const gearHtml = formatGear(snapshot.gear);
        return `
            <tr>
                <td>${escapeHtml(snapshot.playerId || 'unknown')}</td>
                <td>${snapshot.level ?? '—'}</td>
                <td>${formatStatValue(stats.damage)}</td>
                <td>${formatStatValue(stats.defense, { percentage: true })}</td>
                <td>${formatStatValue(stats.moveSpeed)}</td>
                <td>${formatStatValue(stats.attackSpeedMultiplier)}</td>
                <td>${formatStatValue(stats.critChance, { percentage: true })}</td>
                <td>${formatStatValue(stats.hp)}/${formatStatValue(stats.maxHp)}</td>
                <td class="gear-cell">${gearHtml}</td>
            </tr>
        `;
    }).join('');

    return `
        <table class="mini-table">
            <thead>
                <tr>
                    <th>Player</th>
                    <th>Level</th>
                    <th>Damage</th>
                    <th>Defense</th>
                    <th>Speed</th>
                    <th>Atk Speed</th>
                    <th>Crit</th>
                    <th>HP</th>
                    <th>Gear</th>
                </tr>
            </thead>
            <tbody>
                ${rows}
            </tbody>
        </table>
    `;
}

function renderRoomStatsDetails(rooms) {
    if (!rooms || !rooms.length) return '';

    return rooms
        .map(room => {
            const hasStart = room.playerStatsStart && room.playerStatsStart.length;
            const hasEnd = room.playerStatsEnd && room.playerStatsEnd.length;
            if (!hasStart && !hasEnd) {
                return '';
            }
            const startTable = hasStart ? renderSnapshotTable(room.playerStatsStart) : '<p class="empty">No data</p>';
            const endTable = hasEnd ? renderSnapshotTable(room.playerStatsEnd) : '<p class="empty">No data</p>';
            const roomLabel = room.type ? ` (${escapeHtml(room.type)})` : '';
            return `
                <details class="room-stats-detail">
                    <summary>Room ${room.roomNumber}${roomLabel}</summary>
                    <div class="room-stats-grid">
                        <div>
                            <h4>Start</h4>
                            ${startTable}
                        </div>
                        <div>
                            <h4>End</h4>
                            ${endTable}
                        </div>
                    </div>
                </details>
            `;
        })
        .filter(Boolean)
        .join('');
}
function updateSummaryCards(summary) {
    const { totals, runResults, modeCounts, topAffixes, bossSummary } = summary;

    document.querySelector('[data-summary="runs"]').textContent = formatNumber(totals.runs);
    document.querySelector('[data-summary="avg-duration"]').textContent = formatDuration(totals.averageDurationMs);
    document.querySelector('[data-summary="avg-damage"]').textContent = formatNumber(Math.round(totals.averageDamagePerRun));
    document.querySelector('[data-summary="avg-hits"]').textContent = formatNumber(Math.round(totals.averageHitsPerRun));

    renderList('result-breakdown', runResults, item => `${item.result} — ${formatNumber(item.count)}`);
    renderList('mode-breakdown', modeCounts, item => `${item.mode} — ${formatNumber(item.count)}`);
    renderList('affix-breakdown', topAffixes, item => `${item.affix_id} — ${formatNumber(item.count)}`);
    renderList('boss-breakdown', bossSummary, item => `${item.boss_id}: ${formatDuration(item.avg_duration_ms || 0)} avg (${formatNumber(item.encounters)} encounters)`);
}

function renderList(elementId, items, format) {
    const container = document.getElementById(elementId);
    if (!items || items.length === 0) {
        container.innerHTML = '<li>No data yet.</li>';
        return;
    }
    container.innerHTML = items
        .map(item => `<li>${format(item)}</li>`)
        .join('');
}

function renderRunsTable(runs) {
    state.runs = runs;
    const tbody = document.querySelector('#runs-table tbody');

    if (!runs.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty">No runs ingested yet.</td></tr>';
        return;
    }

    tbody.innerHTML = runs.map(run => {
        const isActive = run.run_id === state.selectedRunId;
        return `
            <tr data-run-id="${run.run_id}" class="${isActive ? 'active' : ''}">
                <td>${run.run_id}</td>
                <td>${formatTimestamp(run.started_at)}</td>
                <td>${formatDuration(run.duration_ms)}</td>
                <td>${run.mode}</td>
                <td class="result-${run.result}">${run.result}</td>
                <td>${formatNumber(Math.round(run.totalDamageDealt || 0))}</td>
                <td>${formatNumber(Math.round(run.totalHitsTaken || 0))}</td>
            </tr>
        `;
    }).join('');
}

function renderRunDetail(detail) {
    const container = document.getElementById('run-detail');

    if (!detail) {
        container.innerHTML = '<p>Select a run to see detailed metrics.</p>';
        return;
    }

    const { run, players, rooms, bossEncounters, affixPool } = detail;

    const playerRows = players.map(player => `
        <tr>
            <td>${escapeHtml(player.playerId)}</td>
            <td>${escapeHtml(player.class || '—')}</td>
            <td class="gear-cell">${formatGear(player.gear)}</td>
            <td>${formatNumber(Math.round(player.totalDamageDealt || 0))}</td>
            <td>${formatNumber(Math.round(player.totalDamageTaken || 0))}</td>
            <td>${formatNumber(player.hitsTaken || 0)}</td>
            <td>${player.roomsCleared ?? 0}</td>
            <td>${player.deaths ?? 0}</td>
        </tr>
    `).join('');

    const roomRows = rooms.map(room => `
        <tr>
            <td>${room.roomNumber}</td>
            <td>${room.type || '—'}</td>
            <td>${formatDuration(room.durationMs || 0)}</td>
            <td>${formatNumber(sumValues(room.damageDealtByPlayer))}</td>
            <td>${formatNumber(sumValues(room.damageTakenByPlayer))}</td>
            <td>${formatNumber(sumValues(room.hitsTakenByPlayer))}</td>
        </tr>
    `).join('');

    const affixItems = affixPool.map(affix => `
        <li>${affix.id} (${affix.source || 'unknown'})</li>
    `).join('');

    const bossItems = bossEncounters.length
        ? bossEncounters.map(encounter => `
            <li>
                <strong>${encounter.bossId}</strong> —
                ${formatDuration(encounter.durationMs || 0)} |
                Damage dealt: ${formatNumber(sumValues(encounter.damageByPlayer))}
            </li>
        `).join('')
        : '<li>No boss encounters</li>';

    const roomStatsDetails = renderRoomStatsDetails(rooms);
    const finalSnapshots = Array.isArray(run.metadata?.finalPlayerStats)
        ? run.metadata.finalPlayerStats
        : [];
    const finalStatsHtml = finalSnapshots.length ? renderSnapshotTable(finalSnapshots) : '';

    container.innerHTML = `
        <div class="run-meta">
            <div>
                <span>Run ID</span>
                <strong>${run.run_id}</strong>
            </div>
            <div>
                <span>Started</span>
                <strong>${formatTimestamp(run.started_at)}</strong>
            </div>
            <div>
                <span>Duration</span>
                <strong>${formatDuration(run.duration_ms)}</strong>
            </div>
            <div>
                <span>Mode / Result</span>
                <strong>${run.mode} • ${run.result}</strong>
            </div>
            <div>
                <span>Players</span>
                <strong>${players.length}</strong>
            </div>
            <div>
                <span>Difficulty</span>
                <strong>${run.difficulty || 'default'}</strong>
            </div>
        </div>

        <div>
            <h3>Players</h3>
            <div class="table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th>Player</th>
                            <th>Class</th>
                            <th>Gear</th>
                            <th>Damage Dealt</th>
                            <th>Damage Taken</th>
                            <th>Hits Taken</th>
                            <th>Rooms Cleared</th>
                            <th>Deaths</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${playerRows || '<tr><td colspan="8" class="empty">No players recorded.</td></tr>'}
                    </tbody>
                </table>
            </div>
        </div>

        <div>
            <h3>Rooms</h3>
            <div class="table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Type</th>
                            <th>Duration</th>
                            <th>Damage Dealt</th>
                            <th>Damage Taken</th>
                            <th>Hits Taken</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${roomRows || '<tr><td colspan="6" class="empty">No rooms recorded.</td></tr>'}
                    </tbody>
                </table>
            </div>
        </div>

        ${roomStatsDetails ? `<div class="room-stats">${roomStatsDetails}</div>` : ''}

        <div class="columns">
            <div>
                <h3>Affix Pool</h3>
                <ul>${affixItems || '<li>No affixes recorded.</li>'}</ul>
            </div>
            <div>
                <h3>Boss Encounters</h3>
                <ul>${bossItems}</ul>
            </div>
        </div>

        ${finalStatsHtml ? `<div class="panel-subsection"><h3>Final Player Stats</h3>${finalStatsHtml}</div>` : ''}
    `;

    renderRoomDamageChart(detail);
}

function sumValues(obj) {
    if (!obj) return 0;
    return Object.values(obj).reduce((sum, value) => sum + Number(value || 0), 0);
}

function renderRoomDamageChart(detail) {
    const canvas = document.getElementById('room-damage-chart');
    if (!canvas) return;

    const rooms = detail.rooms || [];
    const players = detail.players || [];

    if (!rooms.length || !players.length) {
        if (state.charts.roomDamage) {
            state.charts.roomDamage.destroy();
            state.charts.roomDamage = null;
        }
        state.charts.roomDamage = null;
        return;
    }

    const labels = rooms.map(room => `Room ${room.roomNumber}`);

    const datasets = players.map((player, index) => {
        const color = COLORS[index % COLORS.length];
        return {
            label: player.playerId,
            data: rooms.map(room => {
                const values = room.damageDealtByPlayer || {};
                return Number(values[player.playerId] || 0);
            }),
            borderColor: color,
            backgroundColor: color,
            fill: false,
            tension: 0.3
        };
    });

    if (state.charts.roomDamage) {
        state.charts.roomDamage.data.labels = labels;
        state.charts.roomDamage.data.datasets = datasets;
        state.charts.roomDamage.update();
        return;
    }

    state.charts.roomDamage = new Chart(canvas.getContext('2d'), {
        type: 'line',
        data: {
            labels,
            datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        color: '#e6edf3'
                    }
                }
            },
            scales: {
                x: {
                    ticks: { color: '#cbd5f5' },
                    grid: { color: 'rgba(255,255,255,0.05)' }
                },
                y: {
                    ticks: { color: '#cbd5f5' },
                    grid: { color: 'rgba(255,255,255,0.05)' }
                }
            }
        }
    });
}

async function loadSummary() {
    try {
        const data = await fetchJson('/api/summary');
        updateSummaryCards(data);
    } catch (error) {
        console.error(error);
        renderList('result-breakdown', [], () => '');
        renderList('mode-breakdown', [], () => '');
        renderList('affix-breakdown', [], () => '');
        renderList('boss-breakdown', [], () => '');
    }
}

async function loadRuns(limit = 50) {
    try {
        const data = await fetchJson(`/api/runs?limit=${encodeURIComponent(limit)}`);
        renderRunsTable(data.runs || []);
    } catch (error) {
        console.error(error);
        renderRunsTable([]);
    }
}

async function handleRunSelection(runId) {
    if (!runId || runId === state.selectedRunId) return;
    state.selectedRunId = runId;

    document.querySelectorAll('#runs-table tbody tr').forEach(row => {
        row.classList.toggle('active', row.dataset.runId === runId);
    });

    renderRunDetail(null);
    try {
        const detail = await fetchJson(`/api/runs/${encodeURIComponent(runId)}`);
        renderRunDetail(detail);
    } catch (error) {
        console.error(error);
        const container = document.getElementById('run-detail');
        container.innerHTML = `<p class="error">Failed to load run: ${error.message}</p>`;
    }
}

function attachEventListeners() {
    const limitSelect = document.getElementById('runs-limit');
    limitSelect.addEventListener('change', async event => {
        const limit = Number(event.target.value) || 50;
        await loadRuns(limit);
    });

    const runsTable = document.getElementById('runs-table');
    runsTable.addEventListener('click', event => {
        const row = event.target.closest('tr[data-run-id]');
        if (!row) return;
        const runId = row.dataset.runId;
        handleRunSelection(runId);
    });
}

async function initialize() {
    attachEventListeners();
    await Promise.all([loadSummary(), loadRuns(50)]);
}

document.addEventListener('DOMContentLoaded', initialize);


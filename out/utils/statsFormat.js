"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateSessionDurationMs = calculateSessionDurationMs;
exports.formatDuration = formatDuration;
exports.aggregateStats = aggregateStats;
exports.formatTsv = formatTsv;
exports.escapeHtml = escapeHtml;
function calculateSessionDurationMs(sessionData) {
    let totalMs = sessionData.accumulatedMs || 0;
    if (sessionData.isActive && sessionData.lastStartedAt) {
        const startMs = new Date(sessionData.lastStartedAt).getTime();
        totalMs += Math.max(0, Date.now() - startMs);
    }
    return totalMs;
}
function formatDuration(ms) {
    if (ms <= 0) {
        return "0秒";
    }
    const sec = Math.floor(ms / 1000);
    const hours = Math.floor(sec / 3600);
    const minutes = Math.floor((sec % 3600) / 60);
    const seconds = sec % 60;
    const parts = [];
    if (hours > 0) {
        parts.push(`${hours}時間`);
    }
    if (minutes > 0) {
        parts.push(`${minutes}分`);
    }
    if (seconds > 0 || parts.length === 0) {
        parts.push(`${seconds}秒`);
    }
    return parts.join(" ");
}
function aggregateStats(statsByExt, filterExtensions) {
    const totalStats = {};
    const nonConsecutiveStats = {};
    let totalInputs = 0;
    let totalNonConsecutive = 0;
    const filterSet = filterExtensions ? new Set(filterExtensions) : undefined;
    for (const ext of Object.keys(statsByExt)) {
        if (filterSet && !filterSet.has(ext)) {
            continue;
        }
        const data = statsByExt[ext];
        if (!data) {
            continue;
        }
        if (data.shortcutStats) {
            for (const [key, count] of Object.entries(data.shortcutStats)) {
                totalStats[key] = (totalStats[key] || 0) + count;
                totalInputs += count;
            }
        }
        if (data.shortcutStatsNonConsecutive) {
            for (const [key, count] of Object.entries(data.shortcutStatsNonConsecutive)) {
                nonConsecutiveStats[key] = (nonConsecutiveStats[key] || 0) + count;
                totalNonConsecutive += count;
            }
        }
    }
    return {
        totalStats,
        nonConsecutiveStats,
        totalInputs,
        totalNonConsecutive,
    };
}
function formatTsv(stats) {
    const sorted = Object.entries(stats).sort((a, b) => b[1] - a[1]);
    const header = "キー\t回数\tパーセント";
    if (sorted.length === 0) {
        return header;
    }
    let total = 0;
    for (let i = 0; i < sorted.length; i++) {
        total += sorted[i][1];
    }
    const rows = new Array(sorted.length + 1);
    rows[0] = header;
    for (let i = 0; i < sorted.length; i++) {
        const [key, count] = sorted[i];
        const pct = total > 0 ? ((count / total) * 100).toFixed(1) : "0.0";
        rows[i + 1] = `${key}\t${count}\t${pct}%`;
    }
    return rows.join("\n");
}
const HTML_ESCAPE_MAP = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
};
function escapeHtml(text) {
    return text.replace(/[&<>"']/g, (ch) => HTML_ESCAPE_MAP[ch]);
}
//# sourceMappingURL=statsFormat.js.map
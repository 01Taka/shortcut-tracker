import type { SessionData, StatsByExtension } from "../types";

export interface AggregatedStats {
  totalStats: Record<string, number>;
  nonConsecutiveStats: Record<string, number>;
  sequenceStats: Record<string, number>;
  totalInputs: number;
  totalNonConsecutive: number;
  totalSequences: number;
}

export function calculateSessionDurationMs(sessionData: SessionData): number {
  let totalMs = sessionData.accumulatedMs || 0;
  if (sessionData.isActive && sessionData.lastStartedAt) {
    const startMs = new Date(sessionData.lastStartedAt).getTime();
    if (!isNaN(startMs)) {
      totalMs += Math.max(0, Date.now() - startMs);
    }
  }
  return totalMs;
}

export function formatDuration(ms: number): string {
  if (ms <= 0) {
    return "0秒";
  }
  const sec = Math.floor(ms / 1000);
  const hours = Math.floor(sec / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  const seconds = sec % 60;

  const parts: string[] = [];
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

/**
 * ローカルタイムゾーン（JST等）基準のタイムスタンプ文字列 (YYYY-MM-DD_HHmmss)
 */
export function formatLocalTimestamp(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = date.getFullYear();
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const min = pad(date.getMinutes());
  const ss = pad(date.getSeconds());
  return `${yyyy}-${mm}-${dd}_${hh}${min}${ss}`;
}

/**
 * ファイル名・ディレクトリ名に使用できない文字を安全な文字へ置換
 */
export function sanitizeFileSegment(raw: string): string {
  return raw
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
    .replace(/\s+/g, "-")
    .replace(/\.+$/g, "")
    .slice(0, 60);
}

export function aggregateStats(
  statsByExt: StatsByExtension,
  filterExtensions?: string[],
): AggregatedStats {
  const totalStats: Record<string, number> = {};
  const nonConsecutiveStats: Record<string, number> = {};
  const sequenceStats: Record<string, number> = {};
  let totalInputs = 0;
  let totalNonConsecutive = 0;
  let totalSequences = 0;

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
      for (const [key, count] of Object.entries(
        data.shortcutStatsNonConsecutive,
      )) {
        nonConsecutiveStats[key] = (nonConsecutiveStats[key] || 0) + count;
        totalNonConsecutive += count;
      }
    }
    if (data.sequenceStats) {
      for (const [seqKey, count] of Object.entries(data.sequenceStats)) {
        sequenceStats[seqKey] = (sequenceStats[seqKey] || 0) + count;
        totalSequences += count;
      }
    }
  }

  return {
    totalStats,
    nonConsecutiveStats,
    sequenceStats,
    totalInputs,
    totalNonConsecutive,
    totalSequences,
  };
}

export function formatSequenceTsv(
  sequenceStats: Record<string, number>,
): string {
  const sorted = Object.entries(sequenceStats).sort((a, b) => b[1] - a[1]);
  const header = "キーの組み合わせ\t回数\tパーセント";
  if (sorted.length === 0) {
    return header;
  }

  let total = 0;
  for (let i = 0; i < sorted.length; i++) {
    total += sorted[i][1];
  }

  const rows = new Array<string>(sorted.length + 1);
  rows[0] = header;
  for (let i = 0; i < sorted.length; i++) {
    const [key, count] = sorted[i];
    const pct = total > 0 ? ((count / total) * 100).toFixed(1) : "0.0";
    rows[i + 1] = `${key}\t${count}\t${pct}%`;
  }

  return rows.join("\n");
}

export function formatTsv(stats: Record<string, number>): string {
  const sorted = Object.entries(stats).sort((a, b) => b[1] - a[1]);
  const header = "キー\t回数\tパーセント";
  if (sorted.length === 0) {
    return header;
  }

  let total = 0;
  for (let i = 0; i < sorted.length; i++) {
    total += sorted[i][1];
  }

  const rows = new Array<string>(sorted.length + 1);
  rows[0] = header;
  for (let i = 0; i < sorted.length; i++) {
    const [key, count] = sorted[i];
    const pct = total > 0 ? ((count / total) * 100).toFixed(1) : "0.0";
    rows[i + 1] = `${key}\t${count}\t${pct}%`;
  }

  return rows.join("\n");
}

/**
 * AI分析向けの6列統合TSVフォーマットを生成
 */
export function formatUnifiedTsv(aggregated: AggregatedStats): string {
  const header = "キー\t全入力\t全入力%\t非連続\t非連続%\tリピート率";
  const allKeys = Array.from(
    new Set([
      ...Object.keys(aggregated.totalStats),
      ...Object.keys(aggregated.nonConsecutiveStats),
    ]),
  );
  if (allKeys.length === 0) {
    return header;
  }

  allKeys.sort(
    (a, b) =>
      (aggregated.totalStats[b] || 0) - (aggregated.totalStats[a] || 0) ||
      a.localeCompare(b),
  );

  const { totalInputs, totalNonConsecutive } = aggregated;
  const lines = new Array<string>(allKeys.length + 1);
  lines[0] = header;

  for (let i = 0; i < allKeys.length; i++) {
    const key = allKeys[i];
    const total = aggregated.totalStats[key] || 0;
    const nonConsec = aggregated.nonConsecutiveStats[key] || 0;
    const tPct =
      totalInputs > 0 ? ((total / totalInputs) * 100).toFixed(1) : "0.0";
    const ncPct =
      totalNonConsecutive > 0
        ? ((nonConsec / totalNonConsecutive) * 100).toFixed(1)
        : "0.0";
    const repRate =
      total > 0 ? (((total - nonConsec) / total) * 100).toFixed(1) : "0.0";
    lines[i + 1] = `${key}\t${total}\t${tPct}%\t${nonConsec}\t${ncPct}%\t${repRate}%`;
  }

  return lines.join("\n");
}

const HTML_ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#039;",
};

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (ch) => HTML_ESCAPE_MAP[ch]);
}

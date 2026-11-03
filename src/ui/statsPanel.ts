import * as vscode from "vscode";
import type { StatsStore } from "../store/statsStore";
import {
  aggregateStats,
  calculateSessionDurationMs,
  escapeHtml,
  formatDuration,
} from "../utils/statsFormat";

let currentPanel: vscode.WebviewPanel | undefined;
let cachedHtmlTemplate: string | undefined;

export function isStatsPanelOpen(): boolean {
  return currentPanel !== undefined;
}

export async function refreshStatsPanel(store: StatsStore): Promise<void> {
  if (!currentPanel) {
    return;
  }
  currentPanel.webview.html = await renderStatsHtml(store);
}

export async function openOrRevealStatsPanel(
  store: StatsStore,
  onCopyTsvFromTab: (tabType?: string) => Promise<void>,
): Promise<void> {
  if (currentPanel) {
    currentPanel.reveal(vscode.ViewColumn.One);
    await refreshStatsPanel(store);
    return;
  }

  const panel = vscode.window.createWebviewPanel(
    "shortcutStats",
    "ショートカット利用統計",
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(store.context.extensionUri, "media"),
      ],
    },
  );
  currentPanel = panel;

  const panelDisposables: vscode.Disposable[] = [];

  panel.onDidDispose(
    () => {
      if (currentPanel === panel) {
        currentPanel = undefined;
      }
      while (panelDisposables.length > 0) {
        panelDisposables.pop()?.dispose();
      }
    },
    null,
    panelDisposables,
  );

  panel.webview.onDidReceiveMessage(
    async (message) => {
      switch (message.command) {
        case "copyJson":
          await vscode.commands.executeCommand("myTracker.copyStatsJson");
          break;
        case "copyTsv":
          await onCopyTsvFromTab(message.tabType);
          break;
        case "refresh":
          await refreshStatsPanel(store);
          vscode.window.setStatusBarMessage(
            "ショートカット統計を最新に更新しました",
            2000,
          );
          break;
        case "importJson":
          await vscode.commands.executeCommand("myTracker.importStatsJson");
          break;
        case "reset":
          await vscode.commands.executeCommand("myTracker.resetStats");
          break;
        case "startSession":
          await vscode.commands.executeCommand("myTracker.startSession");
          break;
        case "stopSession":
          await vscode.commands.executeCommand("myTracker.stopSession");
          break;
        case "resetSession":
          await vscode.commands.executeCommand("myTracker.resetSession");
          break;
        case "copySessionJson":
          await vscode.commands.executeCommand("myTracker.copySessionJson");
          break;
        case "copySessionTsv":
          await vscode.commands.executeCommand("myTracker.copySessionTsv");
          break;
        case "copyKeybindingsDiffJson":
          await vscode.commands.executeCommand(
            "myTracker.copyKeybindingsDiffJson",
          );
          break;
        case "exportSessionToDirectory":
          await vscode.commands.executeCommand(
            "myTracker.exportSessionToDirectory",
          );
          break;
      }
    },
    undefined,
    panelDisposables,
  );

  panel.webview.html = await renderStatsHtml(store);
}

async function getHtmlTemplate(extensionUri: vscode.Uri): Promise<string> {
  if (cachedHtmlTemplate !== undefined) {
    return cachedHtmlTemplate;
  }
  const htmlUri = vscode.Uri.joinPath(extensionUri, "media", "stats.html");
  const bytes = await vscode.workspace.fs.readFile(htmlUri);
  cachedHtmlTemplate = new TextDecoder("utf-8").decode(bytes);
  return cachedHtmlTemplate;
}

async function renderStatsHtml(store: StatsStore): Promise<string> {
  const statsByExt = store.getStatsByExt();
  const { totalStats, nonConsecutiveStats, totalInputs, totalNonConsecutive } =
    aggregateStats(statsByExt);
  const lastKey = store.getLastTrackedKey();

  const consecutiveInputs = totalInputs - totalNonConsecutive;
  const repeatRate =
    totalInputs > 0
      ? ((consecutiveInputs / totalInputs) * 100).toFixed(1)
      : "0.0";

  // メイン統計のキー全集合
  const allKeys = Array.from(
    new Set([...Object.keys(totalStats), ...Object.keys(nonConsecutiveStats)]),
  );

  // 比較用リスト（総数降順）
  const comparisonList = allKeys
    .map((key) => ({
      key,
      totalCount: totalStats[key] || 0,
      nonConsecutiveCount: nonConsecutiveStats[key] || 0,
    }))
    .sort((a, b) => b.totalCount - a.totalCount);

  // 現行統計（全入力ランキング）
  const rawSorted = Object.entries(totalStats).sort((a, b) => b[1] - a[1]);

  // 非連続統計ランキング
  const nonConsecutiveSorted = Object.entries(nonConsecutiveStats).sort(
    (a, b) => b[1] - a[1],
  );

  const comparisonRows = comparisonList
    .map(({ key, totalCount, nonConsecutiveCount }) => {
      const totalPct =
        totalInputs > 0 ? ((totalCount / totalInputs) * 100).toFixed(1) : "0.0";
      const nonConsecutivePct =
        totalNonConsecutive > 0
          ? ((nonConsecutiveCount / totalNonConsecutive) * 100).toFixed(1)
          : "0.0";
      const rate =
        totalCount > 0
          ? (((totalCount - nonConsecutiveCount) / totalCount) * 100).toFixed(1)
          : "0.0";

      return `
        <tr>
          <td class="key-col"><code>${escapeHtml(key)}</code></td>
          <td class="num-col"><b>${totalCount.toLocaleString()}</b> <span class="sub">(${totalPct}%)</span></td>
          <td class="num-col"><b>${nonConsecutiveCount.toLocaleString()}</b> <span class="sub">(${nonConsecutivePct}%)</span></td>
          <td class="num-col">${rate}%</td>
        </tr>`;
    })
    .join("");

  const rawRows = rawSorted
    .map(([key, count]) => {
      const pct =
        totalInputs > 0 ? ((count / totalInputs) * 100).toFixed(1) : "0.0";
      return `
        <tr>
          <td class="key-col"><code>${escapeHtml(key)}</code></td>
          <td class="num-col"><b>${count.toLocaleString()}</b> 回</td>
          <td class="num-col">${pct}%</td>
        </tr>`;
    })
    .join("");

  const nonConsecutiveRows = nonConsecutiveSorted
    .map(([key, count]) => {
      const pct =
        totalNonConsecutive > 0
          ? ((count / totalNonConsecutive) * 100).toFixed(1)
          : "0.0";
      return `
        <tr>
          <td class="key-col"><code>${escapeHtml(key)}</code></td>
          <td class="num-col"><b>${count.toLocaleString()}</b> 回</td>
          <td class="num-col">${pct}%</td>
        </tr>`;
    })
    .join("");

  // --- セッション統計の計算 ---
  const sessionData = store.getSessionData();
  const sessionAggregated = aggregateStats(sessionData.statsByExt);
  const sessionTotal = sessionAggregated.totalInputs;
  const sessionNonConsecutive = sessionAggregated.totalNonConsecutive;
  const sessionConsecutive = sessionTotal - sessionNonConsecutive;
  const sessionRepeatRate =
    sessionTotal > 0
      ? ((sessionConsecutive / sessionTotal) * 100).toFixed(1)
      : "0.0";

  const sessionDurationMs = calculateSessionDurationMs(sessionData);
  const sessionDurationText = formatDuration(sessionDurationMs);
  const sessionStartedAtText = sessionData.startedAt
    ? new Date(sessionData.startedAt).toLocaleString("ja-JP")
    : "(未開始)";

  const sessionStatusBadge = sessionData.isActive
    ? '<span class="status-badge active"><span class="status-dot"></span>計測中</span>'
    : '<span class="status-badge inactive"><span class="status-dot"></span>停止中</span>';

  const sessionToggleBtn = sessionData.isActive
    ? '<button class="action-btn" onclick="stopSession()">⏸ 計測を一時停止</button>'
    : '<button class="action-btn primary-btn" onclick="startSession()">▶ 計測を開始</button>';

  const sessionSnapshotInfo = sessionData.initialKeybindingsCount
    ? `保存済み (${sessionData.initialKeybindingsCount.toLocaleString()} 件)`
    : "未保存";

  // キーバインド差分の表示生成
  let keybindingsDiffHtml = "";
  if (sessionData.keybindingsDiff) {
    const diff = sessionData.keybindingsDiff;
    if (diff.diffs.length === 0) {
      keybindingsDiffHtml = `
        <div class="diff-container empty-diff">
          <span>キーバインドの変更差分はありませんでした（開始時と同一）。</span>
        </div>`;
    } else {
      const diffRows = diff.diffs
        .map((entry) => {
          let badgeClass = "diff-badge-added";
          let badgeText = "追加";
          if (entry.type === "removed") {
            badgeClass = "diff-badge-removed";
            badgeText = "削除";
          } else if (entry.type === "modified") {
            badgeClass = "diff-badge-modified";
            badgeText = "変更";
          }

          let detailText = `コマンド: <code>${escapeHtml(entry.command)}</code>`;
          if (entry.when) {
            detailText += ` <span class="sub">(when: ${escapeHtml(entry.when)})</span>`;
          }
          if (entry.before) {
            detailText += `<div class="sub" style="margin-top: 2px;">変更前: <code>${escapeHtml(entry.before.command)}</code> ${entry.before.when ? `(when: ${escapeHtml(entry.before.when)})` : ""}</div>`;
          }

          return `
            <tr>
              <td style="width: 70px;"><span class="diff-badge ${badgeClass}">${badgeText}</span></td>
              <td class="key-col"><code>${escapeHtml(entry.key)}</code></td>
              <td>${detailText}</td>
            </tr>`;
        })
        .join("");

      keybindingsDiffHtml = `
        <div class="diff-container">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <h4 style="margin: 0; font-size: 13px;">🔑 キーバインドの変更差分 (計 ${diff.diffs.length} 件: 追加 +${diff.addedCount} / 削除 -${diff.removedCount} / 変更 ~${diff.modifiedCount})</h4>
            <button class="action-btn" onclick="copyKeybindingsDiffJson()" style="font-size: 11px; padding: 3px 8px;">📋 差分JSONコピー</button>
          </div>
          <table>
            <thead>
              <tr>
                <th>種別</th>
                <th>キー</th>
                <th>詳細</th>
              </tr>
            </thead>
            <tbody>
              ${diffRows}
            </tbody>
          </table>
        </div>`;
    }
  }

  const sessionAllKeys = Array.from(
    new Set([
      ...Object.keys(sessionAggregated.totalStats),
      ...Object.keys(sessionAggregated.nonConsecutiveStats),
    ]),
  );

  const sessionComparisonList = sessionAllKeys
    .map((key) => ({
      key,
      totalCount: sessionAggregated.totalStats[key] || 0,
      nonConsecutiveCount: sessionAggregated.nonConsecutiveStats[key] || 0,
    }))
    .sort((a, b) => b.totalCount - a.totalCount);

  const sessionRows = sessionComparisonList
    .map(({ key, totalCount, nonConsecutiveCount }) => {
      const totalPct =
        sessionTotal > 0
          ? ((totalCount / sessionTotal) * 100).toFixed(1)
          : "0.0";
      const nonConsecutivePct =
        sessionNonConsecutive > 0
          ? ((nonConsecutiveCount / sessionNonConsecutive) * 100).toFixed(1)
          : "0.0";
      const rate =
        totalCount > 0
          ? (((totalCount - nonConsecutiveCount) / totalCount) * 100).toFixed(1)
          : "0.0";

      return `
        <tr>
          <td class="key-col"><code>${escapeHtml(key)}</code></td>
          <td class="num-col"><b>${totalCount.toLocaleString()}</b> <span class="sub">(${totalPct}%)</span></td>
          <td class="num-col"><b>${nonConsecutiveCount.toLocaleString()}</b> <span class="sub">(${nonConsecutivePct}%)</span></td>
          <td class="num-col">${rate}%</td>
        </tr>`;
    })
    .join("");

  const template = await getHtmlTemplate(store.context.extensionUri);
  const replacements: Record<string, string> = {
    TOTAL_INPUTS: totalInputs.toLocaleString(),
    TOTAL_NON_CONSECUTIVE: totalNonConsecutive.toLocaleString(),
    CONSECUTIVE_INPUTS: consecutiveInputs.toLocaleString(),
    REPEAT_RATE: repeatRate,
    COMPARISON_ROWS:
      comparisonRows ||
      '<tr><td colspan="4" class="empty">まだ記録がありません</td></tr>',
    RAW_ROWS:
      rawRows ||
      '<tr><td colspan="3" class="empty">まだ記録がありません</td></tr>',
    NON_CONSECUTIVE_ROWS:
      nonConsecutiveRows ||
      '<tr><td colspan="3" class="empty">まだ記録がありません</td></tr>',
    LAST_KEY: lastKey ? escapeHtml(lastKey) : "(なし)",
    SESSION_STATUS_BADGE: sessionStatusBadge,
    SESSION_TOGGLE_BTN: sessionToggleBtn,
    SESSION_STARTED_AT: sessionStartedAtText,
    SESSION_DURATION: sessionDurationText,
    SESSION_SNAPSHOT_INFO: sessionSnapshotInfo,
    KEYBINDINGS_DIFF_SECTION: keybindingsDiffHtml,
    SESSION_TOTAL_INPUTS: sessionTotal.toLocaleString(),
    SESSION_NON_CONSECUTIVE: sessionNonConsecutive.toLocaleString(),
    SESSION_REPEAT_RATE: sessionRepeatRate,
    SESSION_ROWS:
      sessionRows ||
      '<tr><td colspan="4" class="empty">セッション中のショートカット記録はまだありません</td></tr>',
  };

  // 単一パスで全プレースホルダーを安全に置換（置換文字列中の $ 特殊文字誤解釈も防止）
  return template.replace(/\{\{([A-Z_]+)\}\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(replacements, key)
      ? replacements[key]
      : match,
  );
}

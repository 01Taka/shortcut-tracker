import * as vscode from "vscode";
import { syncSessionKeybindingsDiff } from "../services/keybindingsService";
import {
  pauseSession,
  startOrResumeSession,
} from "../services/sessionService";
import type { StatsStore } from "../store/statsStore";
import type { ExportDataV2, StatsByExtension } from "../types";
import { openOrRevealStatsPanel, refreshStatsPanel } from "../ui/statsPanel";
import {
  aggregateStats,
  calculateSessionDurationMs,
  formatSequenceTsv,
  formatTsv,
  formatUnifiedTsv,
} from "../utils/statsFormat";

export async function showStatsAction(store: StatsStore): Promise<void> {
  await openOrRevealStatsPanel(store, {
    onCopyTsvFallback: async (tabType?: string) => {
      await store.syncFromDisk();
      let targetType: "unified" | "raw" | "dedup" | "all" = "unified";
      if (tabType === "tab-raw") {
        targetType = "raw";
      } else if (tabType === "tab-dedup") {
        targetType = "dedup";
      }
      await copyTsvQuickPickAction(
        store.getStatsByExt(),
        "メイン統計",
        targetType,
      );
    },
  });
}

export async function copyStatsTsvAction(store: StatsStore): Promise<void> {
  await store.syncFromDisk();
  await copyTsvQuickPickAction(store.getStatsByExt(), "メイン統計");
}

export async function copyStatsJsonAction(store: StatsStore): Promise<void> {
  await store.syncFromDisk();
  const payload: ExportDataV2 = {
    version: 2,
    exportedAt: new Date().toISOString(),
    byExtension: store.getStatsByExt(),
  };

  const jsonStr = JSON.stringify(payload, null, 2);
  await vscode.env.clipboard.writeText(jsonStr);
  vscode.window.setStatusBarMessage(
    "ショートカット累計統計をJSON形式でコピーしました",
    3500,
  );
}

/**
 * コマンドパレット等から呼ばれた場合も Webview のインポートモーダルを直接開く
 */
export async function importStatsJsonAction(store: StatsStore): Promise<void> {
  await openOrRevealStatsPanel(store, {
    initialMode: "global",
    openModal: "importJson",
  });
}

/**
 * コマンドパレット等から呼ばれた場合も Webview の削除確認モーダルを直接開く
 */
export async function resetStatsAction(store: StatsStore): Promise<void> {
  await openOrRevealStatsPanel(store, {
    initialMode: "global",
    openModal: "resetGlobal",
  });
}

/**
 * セッション計測の開始・再開（ダイアログなしで即時開始＆初期スナップショット自動取得）
 */
export async function startSessionAction(store: StatsStore): Promise<void> {
  const res = await startOrResumeSession(store);
  await refreshStatsPanel(store);

  if (res.alreadyActive) {
    vscode.window.setStatusBarMessage("セッション計測は既に実行中です", 3000);
    return;
  }

  const msg = res.isNewSession
    ? res.snapshotCount
      ? `セッション計測を開始しました（初期キーバインド ${res.snapshotCount.toLocaleString()} 件を自動記録）`
      : "セッション計測を開始しました"
    : "セッション計測を再開しました";
  vscode.window.setStatusBarMessage(msg, 3500);
}

/**
 * セッション計測の一時停止（余計なポップアップを出さず即時停止＆差分自動更新）
 */
export async function stopSessionAction(store: StatsStore): Promise<void> {
  const paused = await pauseSession(store);
  await refreshStatsPanel(store);

  if (!paused) {
    vscode.window.setStatusBarMessage(
      "セッション計測は実行されていません",
      3000,
    );
    return;
  }

  vscode.window.setStatusBarMessage(
    "ショートカットセッション計測を一時停止しました",
    3000,
  );
}

/**
 * コマンドパレット等から呼ばれた場合も Webview のセッションリセットモーダルを直接開く
 */
export async function resetSessionAction(store: StatsStore): Promise<void> {
  await openOrRevealStatsPanel(store, {
    initialMode: "session",
    openModal: "resetSession",
  });
}

export async function copySessionJsonAction(store: StatsStore): Promise<void> {
  await store.syncFromDisk();
  await syncSessionKeybindingsDiff(store);
  const sessionData = store.getSessionData();
  const durationMs = calculateSessionDurationMs(sessionData);

  const payload: ExportDataV2 = {
    version: 2,
    exportedAt: new Date().toISOString(),
    byExtension: sessionData.statsByExt,
    session: {
      name: sessionData.name,
      startedAt: sessionData.startedAt,
      stoppedAt: sessionData.stoppedAt,
      durationMs,
      initialKeybindingsCount: sessionData.initialKeybindingsCount,
      keybindingsDiff: sessionData.keybindingsDiff,
    },
  };

  const jsonStr = JSON.stringify(payload, null, 2);
  await vscode.env.clipboard.writeText(jsonStr);
  vscode.window.setStatusBarMessage(
    "セッション統計データをJSON形式でコピーしました",
    3500,
  );
}

export async function copySessionTsvAction(store: StatsStore): Promise<void> {
  await store.syncFromDisk();
  const sessionData = store.getSessionData();
  await copyTsvQuickPickAction(sessionData.statsByExt, "セッション統計");
}

export async function copyKeybindingsDiffJsonAction(
  store: StatsStore,
): Promise<void> {
  await syncSessionKeybindingsDiff(store);
  const sessionData = store.getSessionData();
  if (!sessionData.keybindingsDiff) {
    vscode.window.setStatusBarMessage(
      "記録されたキーバインド差分データがありません",
      3000,
    );
    return;
  }
  await vscode.env.clipboard.writeText(
    JSON.stringify(sessionData.keybindingsDiff, null, 2),
  );
  vscode.window.setStatusBarMessage(
    "キーバインド差分データをクリップボードにコピーしました",
    3500,
  );
}

/**
 * コマンドパレット等から呼ばれた場合も Webview の保存設定モーダルを直接開く
 */
export async function exportSessionToDirectoryAction(
  store: StatsStore,
): Promise<void> {
  await openOrRevealStatsPanel(store, {
    initialMode: "session",
    openModal: "exportSession",
  });
}

async function copyTsvQuickPickAction(
  statsByExt: StatsByExtension,
  scopeName: string = "統計",
  targetType?: "unified" | "raw" | "dedup" | "all" | "sequence",
): Promise<void> {
  const availableExts = Object.keys(statsByExt);

  if (availableExts.length === 0) {
    vscode.window.showInformationMessage(
      `コピー対象の${scopeName}データがありません。`,
    );
    return;
  }

  const extPickItems = availableExts.map((ext) => {
    const data = statsByExt[ext];
    let count = 0;
    for (const c of Object.values(data.shortcutStats || {})) {
      count += c;
    }
    return {
      label: ext,
      description: `${count.toLocaleString()} 回の入力`,
      picked: true,
    };
  });

  const selectedItems = await vscode.window.showQuickPick(extPickItems, {
    canPickMany: true,
    placeHolder: `TSV出力に含める拡張子を選択してください（${scopeName}）`,
    title: `拡張子の選択 (${scopeName})`,
  });

  if (!selectedItems || selectedItems.length === 0) {
    return;
  }

  const selectedExts = selectedItems.map((item) => item.label);
  const aggregated = aggregateStats(statsByExt, selectedExts);

  let selectedType = targetType;
  if (!selectedType) {
    const choice = await vscode.window.showQuickPick(
      [
        {
          label: "統合形式 (AI分析向け推奨)",
          description: "キー / 全入力 / 全入力% / 非連続 / 非連続% / リピート率",
          value: "unified" as const,
        },
        {
          label: "キーの組み合わせ (遷移統計)",
          description: "キーの組み合わせ / 回数 / パーセント",
          value: "sequence" as const,
        },
        {
          label: "現行の統計 (全入力のみ)",
          description: "キー / 回数 / パーセント",
          value: "raw" as const,
        },
        {
          label: "連続除外統計 (非連続のみ)",
          description: "キー / 回数 / パーセント",
          value: "dedup" as const,
        },
        {
          label: "両方の統計を2ブロックで出力",
          description: "全入力および連続除外の2つの表を出力",
          value: "all" as const,
        },
      ],
      {
        placeHolder: `クリップボードにコピーする統計の種類を選択してください (${scopeName})`,
      },
    );
    if (!choice) {
      return;
    }
    selectedType = choice.value;
  }

  let tsv = "";
  let typeLabel = "";

  if (selectedType === "unified") {
    tsv = formatUnifiedTsv(aggregated);
    typeLabel = "統合TSV";
  } else if (selectedType === "sequence") {
    tsv = formatSequenceTsv(aggregated.sequenceStats);
    typeLabel = "キー組み合わせTSV";
  } else if (selectedType === "raw") {
    tsv = formatTsv(aggregated.totalStats);
    typeLabel = "全入力TSV";
  } else if (selectedType === "dedup") {
    tsv = formatTsv(aggregated.nonConsecutiveStats);
    typeLabel = "非連続TSV";
  } else {
    tsv = `【${scopeName} - 現行の統計 (全入力)】\n${formatTsv(aggregated.totalStats)}\n\n【${scopeName} - 連続除外統計 (非連続)】\n${formatTsv(aggregated.nonConsecutiveStats)}`;
    typeLabel = "2表TSV";
  }

  const extsLabel =
    selectedExts.length === availableExts.length
      ? "全拡張子"
      : selectedExts.join(", ");

  await vscode.env.clipboard.writeText(tsv);
  vscode.window.setStatusBarMessage(
    `[${scopeName} / ${extsLabel}] ${typeLabel} をコピーしました`,
    3500,
  );
}

import * as crypto from "crypto";
import * as vscode from "vscode";
import type { StatsStore } from "../store/statsStore";
import type { SessionExportOptions, StatsByExtension } from "../types";
import { parseJsonc } from "../utils/jsonc";
import {
  aggregateStats,
  calculateSessionDurationMs,
  formatDuration,
  formatLocalTimestamp,
  formatUnifiedTsv,
  sanitizeFileSegment,
} from "../utils/statsFormat";
import {
  readCurrentKeybindings,
  syncSessionKeybindingsDiff,
} from "./keybindingsService";

export interface StartSessionResult {
  alreadyActive: boolean;
  isNewSession: boolean;
  snapshotCount?: number;
}

/**
 * セッション計測を開始または再開する（確認ポップアップなし・即時反映）
 * - 新規開始時のみ初期キーバインドを自動スナップショット保存
 * - 一時停止からの再開時は初期スナップショットを保持したまま再開
 */
export async function startOrResumeSession(
  store: StatsStore,
  sessionName?: string,
): Promise<StartSessionResult> {
  await store.syncFromDisk();

  const sessionData = store.getSessionData();
  if (sessionData.isActive) {
    return { alreadyActive: true, isNewSession: false };
  }

  const isNewSession = !sessionData.startedAt;
  const nowIso = new Date().toISOString();

  let nextName = sessionData.name;
  if (sessionName !== undefined) {
    const trimmed = sessionName.trim();
    nextName = trimmed.length > 0 ? trimmed : sessionData.name;
  }

  // まず計測開始状態を即時反映（statsByExt を上書きしない部分更新）
  await store.updateSessionState({
    sessionId: isNewSession
      ? crypto.randomUUID()
      : (sessionData.sessionId ?? nowIso),
    name: nextName ?? null,
    startedAt: isNewSession ? nowIso : (sessionData.startedAt ?? nowIso),
    keybindingsDiff: isNewSession
      ? null
      : (sessionData.keybindingsDiff ?? null),
    isActive: true,
    lastStartedAt: nowIso,
    lastHeartbeatAt: nowIso,
    stoppedAt: null,
  });

  // 新規開始（または未保存）の場合のみ初期キーバインドを自動取得
  let snapshotCount = store.getSessionData().initialKeybindingsCount;
  if (isNewSession || !snapshotCount) {
    const kbInfo = await readCurrentKeybindings();
    if (kbInfo && kbInfo.items.length > 0) {
      await store.setInitialKeybindings(kbInfo.items);
      snapshotCount = kbInfo.items.length;
      await store.flush();
    }
  } else {
    // 再開時は現在の差分状態だけ最新化しておく
    await syncSessionKeybindingsDiff(store);
  }

  return {
    alreadyActive: false,
    isNewSession,
    snapshotCount,
  };
}

/**
 * セッション計測を一時停止し、最新キーバインド差分を自動同期する（ポップアップなし）
 */
export async function pauseSession(store: StatsStore): Promise<boolean> {
  await store.syncFromDisk();

  const sessionData = store.getSessionData();
  if (!sessionData.isActive) {
    return false;
  }

  const nowMs = Date.now();
  let accumulatedMs = sessionData.accumulatedMs || 0;
  if (sessionData.lastStartedAt) {
    const startMs = new Date(sessionData.lastStartedAt).getTime();
    if (!isNaN(startMs)) {
      accumulatedMs += Math.max(0, nowMs - startMs);
    }
  }

  await store.updateSessionState({
    isActive: false,
    accumulatedMs,
    lastStartedAt: null,
    lastHeartbeatAt: null,
    stoppedAt: new Date(nowMs).toISOString(),
  });
  await syncSessionKeybindingsDiff(store);
  return true;
}

export interface SessionExportResult {
  outputDirUri: vscode.Uri;
  primaryFileUri?: vscode.Uri;
  savedFiles: string[];
  resetPerformed: boolean;
}

/**
 * Webview モーダルで指定された条件に従ってセッション統計・キーバインド一式をローカル保存する
 */
export async function executeSessionExport(
  store: StatsStore,
  options: SessionExportOptions,
): Promise<SessionExportResult> {
  const rawDir = (options.dirPath || "").trim();
  if (!rawDir) {
    throw new Error("保存先フォルダを指定してください。");
  }

  if (
    !options.includeStatsJson &&
    !options.includeStatsTsv &&
    !options.includeDiffJson &&
    !options.includeInitialKb &&
    !options.includeCurrentKb
  ) {
    throw new Error("保存するファイルを1つ以上選択してください。");
  }

  // 自ウィンドウの未保存分をフラッシュし、他ウィンドウの最新状態を同期
  await store.flush();
  await store.syncFromDisk();

  // セッション名の反映と最新キーバインド差分の同期
  if (options.sessionName !== undefined) {
    await store.setSessionName(options.sessionName);
  }
  await syncSessionKeybindingsDiff(store);

  const sessionData = store.getSessionData();
  const baseDirUri = vscode.Uri.file(rawDir);
  await vscode.workspace.fs.createDirectory(baseDirUri);
  await store.setLastExportDir(baseDirUri.fsPath);

  const now = new Date();
  const localStamp = formatLocalTimestamp(now);
  const safeName = sessionData.name ? sanitizeFileSegment(sessionData.name) : "";
  const folderOrPrefixName = safeName
    ? `${localStamp}_${safeName}`
    : localStamp;

  let outputDirUri = baseDirUri;
  const useSubdir = Boolean(options.createSubdirectory);
  if (useSubdir) {
    outputDirUri = vscode.Uri.joinPath(baseDirUri, folderOrPrefixName);
    await vscode.workspace.fs.createDirectory(outputDirUri);
  }

  const makeFileName = (subName: string, flatPrefix: string, ext: string) =>
    useSubdir ? `${subName}.${ext}` : `${flatPrefix}-${folderOrPrefixName}.${ext}`;

  const durationMs = calculateSessionDurationMs(sessionData);
  const durationText = formatDuration(durationMs);
  const sessionAggregated = aggregateStats(sessionData.statsByExt);
  const encoder = new TextEncoder();
  const savedFiles: string[] = [];
  let primaryFileUri: vscode.Uri | undefined;

  // 1. セッション統計 JSON
  if (options.includeStatsJson) {
    const fileName = makeFileName("session-stats", "session-stats", "json");
    const fileUri = vscode.Uri.joinPath(outputDirUri, fileName);

    const sessionTotal = sessionAggregated.totalInputs;
    const sessionNonConsecutive = sessionAggregated.totalNonConsecutive;
    const sessionConsecutive = sessionTotal - sessionNonConsecutive;
    const sessionRepeatRate =
      sessionTotal > 0
        ? ((sessionConsecutive / sessionTotal) * 100).toFixed(1)
        : "0.0";

    const payload = {
      version: 2,
      type: "sessionStatistics",
      exportedAt: now.toISOString(),
      session: {
        name: sessionData.name,
        isActive: sessionData.isActive,
        startedAt: sessionData.startedAt,
        stoppedAt: sessionData.stoppedAt,
        durationMs,
        durationText,
        initialKeybindingsCount: sessionData.initialKeybindingsCount,
      },
      summary: {
        totalInputs: sessionTotal,
        nonConsecutiveInputs: sessionNonConsecutive,
        consecutiveInputs: sessionConsecutive,
        repeatRate: `${sessionRepeatRate}%`,
        totalSequences: sessionAggregated.totalSequences,
        extensionsCount: Object.keys(sessionData.statsByExt).length,
      },
      byExtension: sessionData.statsByExt,
      totalStats: sessionAggregated.totalStats,
      nonConsecutiveStats: sessionAggregated.nonConsecutiveStats,
      sequenceStats: sessionAggregated.sequenceStats,
      keybindingsDiff: sessionData.keybindingsDiff,
    };

    await vscode.workspace.fs.writeFile(
      fileUri,
      encoder.encode(JSON.stringify(payload, null, 2)),
    );
    savedFiles.push(fileName);
    primaryFileUri = fileUri;
  }

  // 2. セッション統計 TSV（AI分析向け統合形式）
  if (options.includeStatsTsv) {
    const fileName = makeFileName("session-stats", "session-stats", "tsv");
    const fileUri = vscode.Uri.joinPath(outputDirUri, fileName);
    const tsvContent = formatUnifiedTsv(sessionAggregated);
    await vscode.workspace.fs.writeFile(fileUri, encoder.encode(tsvContent));
    savedFiles.push(fileName);
    if (!primaryFileUri) {
      primaryFileUri = fileUri;
    }
  }

  // 3. キーバインド変更差分 JSON
  if (options.includeDiffJson && sessionData.keybindingsDiff) {
    const diff = sessionData.keybindingsDiff;
    const fileName = makeFileName("keybindings-diff", "session-diff", "json");
    const fileUri = vscode.Uri.joinPath(outputDirUri, fileName);
    const diffPayload = {
      version: 2,
      type: "sessionKeybindingsDiff",
      calculatedAt: diff.calculatedAt,
      session: {
        name: sessionData.name,
        startedAt: sessionData.startedAt,
        stoppedAt: sessionData.stoppedAt,
        durationMs,
      },
      summary: {
        initialKeybindingsCount: diff.initialCount,
        currentKeybindingsCount: diff.currentCount,
        addedCount: diff.addedCount,
        removedCount: diff.removedCount,
        modifiedCount: diff.modifiedCount,
        totalChanges: diff.diffs.length,
      },
      diffs: diff.diffs,
    };
    await vscode.workspace.fs.writeFile(
      fileUri,
      encoder.encode(JSON.stringify(diffPayload, null, 2)),
    );
    savedFiles.push(fileName);
    if (!primaryFileUri) {
      primaryFileUri = fileUri;
    }
  }

  // 4. 開始時のキーバインド設定 JSON
  if (options.includeInitialKb) {
    const initialKb = await store.getInitialKeybindings();
    if (initialKb && initialKb.length > 0) {
      const fileName = makeFileName(
        "initial-keybindings",
        "session-initial-keybindings",
        "json",
      );
      const fileUri = vscode.Uri.joinPath(outputDirUri, fileName);
      await vscode.workspace.fs.writeFile(
        fileUri,
        encoder.encode(JSON.stringify(initialKb, null, 2)),
      );
      savedFiles.push(fileName);
      if (!primaryFileUri) {
        primaryFileUri = fileUri;
      }
    }
  }

  // 5. 現在（終了時点）のキーバインド設定 JSONC（コメント維持）
  if (options.includeCurrentKb) {
    const currentKb = await readCurrentKeybindings();
    if (currentKb && currentKb.rawText) {
      const fileName = makeFileName(
        "current-keybindings",
        "session-current-keybindings",
        "jsonc",
      );
      const fileUri = vscode.Uri.joinPath(outputDirUri, fileName);
      await vscode.workspace.fs.writeFile(
        fileUri,
        encoder.encode(currentKb.rawText),
      );
      savedFiles.push(fileName);
      if (!primaryFileUri) {
        primaryFileUri = fileUri;
      }
    }
  }

  let resetPerformed = false;
  if (options.resetAfterSave) {
    await store.resetSession();
    resetPerformed = true;
  }

  return {
    outputDirUri,
    primaryFileUri,
    savedFiles,
    resetPerformed,
  };
}

export interface ImportStatsSummary {
  addedKeysCount: number;
  addedTotalCount: number;
}

/**
 * JSON / JSONC 文字列から統計データをパースし、現在の累計統計へ合算する
 */
export async function importStatsFromText(
  store: StatsStore,
  rawInput: string,
): Promise<ImportStatsSummary> {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    throw new Error("インポートするJSONデータが入力されていません。");
  }

  let parsed: any;
  try {
    parsed = parseJsonc(trimmed);
  } catch {
    throw new Error(
      "無効なJSON（またはJSONC）フォーマットです。構文を確認してください。",
    );
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("統計データのオブジェクト形式が不正です。");
  }

  const importedDelta: StatsByExtension = {};
  let addedTotalCount = 0;
  let addedKeysCount = 0;

  const mergeExtensionStats = (
    extName: string,
    importedTotal: Record<string, any>,
    importedNonConsecutive: Record<string, any>,
    importedSequence?: Record<string, any>,
  ) => {
    if (!importedDelta[extName]) {
      importedDelta[extName] = {
        shortcutStats: {},
        shortcutStatsNonConsecutive: {},
        sequenceStats: {},
      };
    }

    for (const [key, val] of Object.entries(importedTotal || {})) {
      const num = Number(val);
      if (!isNaN(num) && num > 0) {
        const count = Math.round(num);
        importedDelta[extName].shortcutStats[key] =
          (importedDelta[extName].shortcutStats[key] || 0) + count;
        addedTotalCount += count;
        addedKeysCount++;
      }
    }

    for (const [key, val] of Object.entries(importedNonConsecutive || {})) {
      const num = Number(val);
      if (!isNaN(num) && num > 0) {
        const count = Math.round(num);
        importedDelta[extName].shortcutStatsNonConsecutive[key] =
          (importedDelta[extName].shortcutStatsNonConsecutive[key] || 0) + count;
      }
    }

    if (importedSequence && typeof importedSequence === "object") {
      if (!importedDelta[extName].sequenceStats) {
        importedDelta[extName].sequenceStats = {};
      }
      for (const [key, val] of Object.entries(importedSequence)) {
        const num = Number(val);
        if (!isNaN(num) && num > 0) {
          const count = Math.round(num);
          importedDelta[extName].sequenceStats![key] =
            (importedDelta[extName].sequenceStats![key] || 0) + count;
        }
      }
    }
  };

  if (parsed.byExtension && typeof parsed.byExtension === "object") {
    for (const [ext, extData] of Object.entries<any>(parsed.byExtension)) {
      if (extData && typeof extData === "object") {
        const rawTotal = extData.shortcutStats || {};
        const rawNonConsecutive =
          extData.shortcutStatsNonConsecutive || rawTotal;
        const rawSequence = extData.sequenceStats;
        mergeExtensionStats(ext, rawTotal, rawNonConsecutive, rawSequence);
      }
    }
  } else if (
    parsed.shortcutStats &&
    typeof parsed.shortcutStats === "object"
  ) {
    const rawTotal = parsed.shortcutStats;
    const rawNonConsecutive =
      parsed.shortcutStatsNonConsecutive &&
      typeof parsed.shortcutStatsNonConsecutive === "object"
        ? parsed.shortcutStatsNonConsecutive
        : parsed.shortcutStats;
    const rawSequence = parsed.sequenceStats;
    mergeExtensionStats("(legacy)", rawTotal, rawNonConsecutive, rawSequence);
  } else {
    mergeExtensionStats("(legacy)", parsed, parsed);
  }

  if (addedKeysCount === 0) {
    throw new Error("インポート可能な正の数値データが見つかりませんでした。");
  }

  await store.addImportedStats(importedDelta);
  return { addedKeysCount, addedTotalCount };
}

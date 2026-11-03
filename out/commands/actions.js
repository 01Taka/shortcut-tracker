"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.showStatsAction = showStatsAction;
exports.copyStatsTsvAction = copyStatsTsvAction;
exports.copyStatsJsonAction = copyStatsJsonAction;
exports.importStatsJsonAction = importStatsJsonAction;
exports.resetStatsAction = resetStatsAction;
exports.startSessionAction = startSessionAction;
exports.stopSessionAction = stopSessionAction;
exports.resetSessionAction = resetSessionAction;
exports.copySessionJsonAction = copySessionJsonAction;
exports.copySessionTsvAction = copySessionTsvAction;
exports.copyKeybindingsDiffJsonAction = copyKeybindingsDiffJsonAction;
exports.exportSessionToDirectoryAction = exportSessionToDirectoryAction;
const path = require("path");
const vscode = require("vscode");
const keybindingsService_1 = require("../services/keybindingsService");
const statsPanel_1 = require("../ui/statsPanel");
const statsFormat_1 = require("../utils/statsFormat");
async function showStatsAction(store) {
    await (0, statsPanel_1.openOrRevealStatsPanel)(store, async (tabType) => {
        let targetType = "all";
        if (tabType === "tab-raw") {
            targetType = "raw";
        }
        else if (tabType === "tab-dedup") {
            targetType = "dedup";
        }
        await copyTsvAction(store.getStatsByExt(), "メイン統計", targetType);
    });
}
async function copyStatsTsvAction(store) {
    await copyTsvAction(store.getStatsByExt(), "メイン統計");
}
async function copyStatsJsonAction(store) {
    const payload = {
        version: 2,
        exportedAt: new Date().toISOString(),
        byExtension: store.getStatsByExt(),
    };
    const jsonStr = JSON.stringify(payload, null, 2);
    await vscode.env.clipboard.writeText(jsonStr);
    vscode.window.showInformationMessage("ショートカット統計データを拡張子別JSON形式でクリップボードにコピーしました。");
}
async function importStatsJsonAction(store) {
    const input = await vscode.window.showInputBox({
        prompt: "インポートする統計データ（JSON）を入力してください（現在の統計と合算されます）",
        placeHolder: '{"version": 2, "byExtension": { ".ts": { "shortcutStats": {...} } }}',
        ignoreFocusOut: true,
    });
    if (!input || !input.trim()) {
        return;
    }
    let parsed;
    try {
        parsed = JSON.parse(input.trim());
    }
    catch {
        vscode.window.showErrorMessage("無効なJSONフォーマットです。インポートを中止しました。");
        return;
    }
    if (!parsed || typeof parsed !== "object") {
        vscode.window.showErrorMessage("統計データの形式が不正です。");
        return;
    }
    const statsByExt = store.getStatsByExt();
    let addedTotalCount = 0;
    let addedKeysCount = 0;
    const mergeExtensionStats = (extName, importedTotal, importedNonConsecutive) => {
        if (!statsByExt[extName]) {
            statsByExt[extName] = {
                shortcutStats: {},
                shortcutStatsNonConsecutive: {},
            };
        }
        for (const [key, val] of Object.entries(importedTotal || {})) {
            const num = Number(val);
            if (!isNaN(num) && num > 0) {
                const count = Math.round(num);
                statsByExt[extName].shortcutStats[key] =
                    (statsByExt[extName].shortcutStats[key] || 0) + count;
                addedTotalCount += count;
                addedKeysCount++;
            }
        }
        for (const [key, val] of Object.entries(importedNonConsecutive || {})) {
            const num = Number(val);
            if (!isNaN(num) && num > 0) {
                const count = Math.round(num);
                statsByExt[extName].shortcutStatsNonConsecutive[key] =
                    (statsByExt[extName].shortcutStatsNonConsecutive[key] || 0) + count;
            }
        }
    };
    if (parsed.byExtension && typeof parsed.byExtension === "object") {
        // version: 2 形式
        for (const [ext, extData] of Object.entries(parsed.byExtension)) {
            if (extData && typeof extData === "object") {
                const rawTotal = extData.shortcutStats || {};
                const rawNonConsecutive = extData.shortcutStatsNonConsecutive || rawTotal;
                mergeExtensionStats(ext, rawTotal, rawNonConsecutive);
            }
        }
    }
    else if (parsed.shortcutStats &&
        typeof parsed.shortcutStats === "object") {
        // version: 1 形式（shortcutStats, shortcutStatsNonConsecutive を直下に持つ）
        const rawTotal = parsed.shortcutStats;
        const rawNonConsecutive = parsed.shortcutStatsNonConsecutive &&
            typeof parsed.shortcutStatsNonConsecutive === "object"
            ? parsed.shortcutStatsNonConsecutive
            : parsed.shortcutStats;
        mergeExtensionStats("(legacy)", rawTotal, rawNonConsecutive);
    }
    else {
        // フラットなキーバインド辞書形式
        mergeExtensionStats("(legacy)", parsed, parsed);
    }
    if (addedKeysCount === 0) {
        vscode.window.showWarningMessage("インポート可能な正の数値データが見つかりませんでした。");
        return;
    }
    await store.markStatsModified();
    vscode.window.showInformationMessage(`統計データをインポートしました（${addedKeysCount} 個のキー、計 ${addedTotalCount.toLocaleString()} 回を加算）。`);
    await (0, statsPanel_1.refreshStatsPanel)(store);
}
async function resetStatsAction(store) {
    const confirm = await vscode.window.showWarningMessage("ショートカットの統計データをすべてリセットしますか？", { modal: true }, "リセット");
    if (confirm === "リセット") {
        await store.resetAllStats();
        vscode.window.showInformationMessage("ショートカットの統計データを初期化しました。");
        await (0, statsPanel_1.refreshStatsPanel)(store);
    }
}
async function startSessionAction(store) {
    const sessionData = store.getSessionData();
    if (sessionData.isActive) {
        vscode.window.showInformationMessage("セッション計測は既に実行中です。");
        return;
    }
    let snapshotSaved = false;
    const askSnapshot = await vscode.window.showInformationMessage("セッション開始時のキーバインド設定をスナップショットとして保存しますか？（セッション終了時に変更差分を計算できるようになります）", "保存する", "保存しない");
    if (askSnapshot === "保存する") {
        const kbInfo = await (0, keybindingsService_1.readCurrentKeybindings)();
        if (kbInfo && kbInfo.items.length > 0) {
            await store.setInitialKeybindings(kbInfo.items);
            sessionData.keybindingsDiff = undefined;
            snapshotSaved = true;
        }
        else {
            vscode.window.showWarningMessage("keybindings.json を読み込めなかったため、キーバインドのスナップショットは保存されませんでした。");
        }
    }
    const now = new Date().toISOString();
    sessionData.isActive = true;
    if (!sessionData.startedAt) {
        sessionData.startedAt = now;
    }
    sessionData.lastStartedAt = now;
    sessionData.stoppedAt = undefined;
    await store.saveSessionData(sessionData);
    if (snapshotSaved && sessionData.initialKeybindingsCount) {
        vscode.window.showInformationMessage(`開始時のキーバインド設定（${sessionData.initialKeybindingsCount.toLocaleString()} 件）を保存し、セッション計測を開始しました。`);
    }
    else {
        vscode.window.showInformationMessage("ショートカットセッション計測を開始しました。");
    }
    await (0, statsPanel_1.refreshStatsPanel)(store);
}
async function stopSessionAction(store) {
    const sessionData = store.getSessionData();
    if (!sessionData.isActive) {
        vscode.window.showInformationMessage("セッション計測は実行されていません。");
        return;
    }
    const nowMs = Date.now();
    if (sessionData.lastStartedAt) {
        const startMs = new Date(sessionData.lastStartedAt).getTime();
        sessionData.accumulatedMs =
            (sessionData.accumulatedMs || 0) + Math.max(0, nowMs - startMs);
    }
    sessionData.isActive = false;
    sessionData.lastStartedAt = undefined;
    sessionData.stoppedAt = new Date().toISOString();
    await store.saveSessionData(sessionData);
    vscode.window.showInformationMessage("ショートカットセッション計測を一時停止しました。");
    await (0, statsPanel_1.refreshStatsPanel)(store);
    // 開始時のキーバインドスナップショットが存在する場合、差分計算と保存の質問を行う
    const initialKeybindings = await store.getInitialKeybindings();
    if (initialKeybindings && initialKeybindings.length > 0) {
        const askDiff = await vscode.window.showInformationMessage("セッション開始時からのキーバインド設定の差分を計算し、変更された部分を保存しますか？", "差分を計算して保存", "保存しない");
        if (askDiff === "差分を計算して保存") {
            const currentKb = await (0, keybindingsService_1.readCurrentKeybindings)();
            if (currentKb && currentKb.items) {
                const diff = (0, keybindingsService_1.calculateKeybindingsDiff)(initialKeybindings, currentKb.items);
                sessionData.keybindingsDiff = diff;
                await store.saveSessionData(sessionData);
                if (diff.diffs.length === 0) {
                    vscode.window.showInformationMessage("セッション開始時からキーバインド設定の変更はありませんでした。");
                }
                else {
                    const savedUri = await (0, keybindingsService_1.saveDiffToFile)(diff, sessionData);
                    const msg = `キーバインドの変更差分を保存しました（追加: ${diff.addedCount}件, 削除: ${diff.removedCount}件, 変更: ${diff.modifiedCount}件）。`;
                    const action = savedUri
                        ? await vscode.window.showInformationMessage(msg, "差分ファイルを開く", "差分JSONをコピー")
                        : await vscode.window.showInformationMessage(msg, "差分JSONをコピー");
                    if (action === "差分ファイルを開く" && savedUri) {
                        const doc = await vscode.workspace.openTextDocument(savedUri);
                        await vscode.window.showTextDocument(doc);
                    }
                    else if (action === "差分JSONをコピー") {
                        await vscode.env.clipboard.writeText(JSON.stringify(diff, null, 2));
                        vscode.window.showInformationMessage("差分データをクリップボードにコピーしました。");
                    }
                }
                await (0, statsPanel_1.refreshStatsPanel)(store);
            }
            else {
                vscode.window.showErrorMessage("現在の keybindings.json を読み込めなかったため、差分を計算できませんでした。");
            }
        }
    }
    await exportSessionToDirectoryAction(store);
}
async function resetSessionAction(store) {
    const confirm = await vscode.window.showWarningMessage("セッション計測データおよびキーバインドのスナップショット・差分をリセットしますか？（メイン統計には影響しません）", { modal: true }, "リセット");
    if (confirm === "リセット") {
        await store.resetSession();
        vscode.window.showInformationMessage("セッション計測データをリセットしました。");
        await (0, statsPanel_1.refreshStatsPanel)(store);
    }
}
async function copySessionJsonAction(store) {
    const sessionData = store.getSessionData();
    const durationMs = (0, statsFormat_1.calculateSessionDurationMs)(sessionData);
    const payload = {
        version: 2,
        exportedAt: new Date().toISOString(),
        byExtension: sessionData.statsByExt,
        session: {
            startedAt: sessionData.startedAt,
            stoppedAt: sessionData.stoppedAt,
            durationMs,
            initialKeybindingsCount: sessionData.initialKeybindingsCount,
            keybindingsDiff: sessionData.keybindingsDiff,
        },
    };
    const jsonStr = JSON.stringify(payload, null, 2);
    await vscode.env.clipboard.writeText(jsonStr);
    vscode.window.showInformationMessage("セッション統計データをJSON形式でクリップボードにコピーしました。");
}
async function copySessionTsvAction(store) {
    const sessionData = store.getSessionData();
    await copyTsvAction(sessionData.statsByExt, "セッション統計");
}
async function copyKeybindingsDiffJsonAction(store) {
    const sessionData = store.getSessionData();
    if (!sessionData.keybindingsDiff) {
        vscode.window.showInformationMessage("保存されたキーバインド差分データがありません。");
        return;
    }
    await vscode.env.clipboard.writeText(JSON.stringify(sessionData.keybindingsDiff, null, 2));
    vscode.window.showInformationMessage("キーバインド差分データをクリップボードにコピーしました。");
}
/**
 * セッション統計データを任意のローカルディレクトリに書き込む
 * （チェックボックス付き選択で、始めた時点のキーバインドも同時に保存可能）
 */
async function exportSessionToDirectoryAction(store, predefinedDirUri) {
    const sessionData = store.getSessionData();
    const sessionAggregated = (0, statsFormat_1.aggregateStats)(sessionData.statsByExt);
    const sessionTotal = sessionAggregated.totalInputs;
    const initialKbSnapshot = await store.getInitialKeybindings();
    const pickItems = [
        {
            id: "stats",
            label: "$(graph) セッション統計データを保存",
            description: "session-stats-*.json (拡張子別打鍵数・集計サマリー・差分概要)",
            picked: true,
        },
    ];
    if (initialKbSnapshot && initialKbSnapshot.length > 0) {
        pickItems.push({
            id: "initialKeybindings",
            label: "$(key) 始めた時点でのキーバインド（ショートカット）データを保存",
            description: `session-initial-keybindings-*.json (${initialKbSnapshot.length.toLocaleString()} 件)`,
            picked: true,
        });
    }
    else {
        pickItems.push({
            id: "initialKeybindings",
            label: "$(key) 現在のキーバインド（ショートカット）データを保存",
            description: "現在の keybindings.json の内容をスナップショットとして保存",
            picked: false,
        });
    }
    pickItems.push({
        id: "createSubdirectory",
        label: "$(folder) ディレクトリとして保存",
        description: "YYYY-MM-DD-HHmmss のディレクトリを作成してその中に保存する",
        picked: true,
    });
    const selectedOptions = await vscode.window.showQuickPick(pickItems, {
        canPickMany: true,
        title: "セッション統計データをローカルディレクトリに保存しますか？",
        placeHolder: "保存するデータにチェックを入れて決定（ESCまたは未選択で保存をスキップ）",
    });
    if (!selectedOptions || selectedOptions.length === 0) {
        return undefined;
    }
    const saveStats = selectedOptions.some((item) => item.id === "stats");
    const saveInitialKeybindings = selectedOptions.some((item) => item.id === "initialKeybindings");
    const createSubdirectory = selectedOptions.some((item) => item.id === "createSubdirectory");
    // 保存先ディレクトリの決定
    let dirUri = predefinedDirUri;
    if (!dirUri) {
        const lastExportDir = store.getLastExportDir();
        if (lastExportDir) {
            const dirChoice = await vscode.window.showQuickPick([
                {
                    label: "$(folder) 前回と同じフォルダに保存",
                    description: lastExportDir,
                    value: "last",
                },
                {
                    label: "$(folder-opened) 別のディレクトリを選択...",
                    description: "フォルダ選択ダイアログを開く",
                    value: "choose",
                },
            ], {
                title: "保存先ディレクトリの選択",
                placeHolder: "保存先ディレクトリを選択してください",
            });
            if (!dirChoice) {
                return undefined;
            }
            if (dirChoice.value === "last") {
                dirUri = vscode.Uri.file(lastExportDir);
            }
        }
        if (!dirUri) {
            const selectedDirs = await vscode.window.showOpenDialog({
                canSelectFiles: false,
                canSelectFolders: true,
                canSelectMany: false,
                defaultUri: lastExportDir
                    ? vscode.Uri.file(lastExportDir)
                    : vscode.workspace.workspaceFolders?.[0]?.uri,
                title: "セッション統計データの保存先ディレクトリを選択",
                openLabel: "このフォルダに保存",
            });
            if (!selectedDirs || selectedDirs.length === 0) {
                return undefined;
            }
            dirUri = selectedDirs[0];
            await store.setLastExportDir(dirUri.fsPath);
        }
    }
    const durationMs = (0, statsFormat_1.calculateSessionDurationMs)(sessionData);
    const durationText = (0, statsFormat_1.formatDuration)(durationMs);
    const dateStr = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    let outputDirUri = dirUri;
    if (createSubdirectory) {
        outputDirUri = vscode.Uri.joinPath(dirUri, dateStr);
        await vscode.workspace.fs.createDirectory(outputDirUri);
    }
    const encoder = new TextEncoder();
    const savedFiles = [];
    let primaryFileUri;
    // A. セッション統計データ（session-stats-*.json）
    if (saveStats) {
        const fileName = `session-stats-${dateStr}.json`;
        const fileUri = vscode.Uri.joinPath(outputDirUri, fileName);
        const sessionNonConsecutive = sessionAggregated.totalNonConsecutive;
        const sessionConsecutive = sessionTotal - sessionNonConsecutive;
        const sessionRepeatRate = sessionTotal > 0
            ? ((sessionConsecutive / sessionTotal) * 100).toFixed(1)
            : "0.0";
        const payload = {
            version: 2,
            type: "sessionStatistics",
            exportedAt: new Date().toISOString(),
            session: {
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
                extensionsCount: Object.keys(sessionData.statsByExt).length,
            },
            byExtension: sessionData.statsByExt,
            totalStats: sessionAggregated.totalStats,
            nonConsecutiveStats: sessionAggregated.nonConsecutiveStats,
            keybindingsDiff: sessionData.keybindingsDiff,
        };
        await vscode.workspace.fs.writeFile(fileUri, encoder.encode(JSON.stringify(payload, null, 2)));
        savedFiles.push(fileName);
        primaryFileUri = fileUri;
    }
    // B. キーバインド差分データ（session-diff-*.json）
    if (sessionData.keybindingsDiff &&
        sessionData.keybindingsDiff.diffs.length > 0) {
        const diffFileName = `session-diff-${dateStr}.json`;
        const diffFileUri = vscode.Uri.joinPath(outputDirUri, diffFileName);
        const diffPayload = {
            version: 2,
            type: "sessionKeybindingsDiff",
            calculatedAt: sessionData.keybindingsDiff.calculatedAt,
            session: {
                startedAt: sessionData.startedAt,
                stoppedAt: sessionData.stoppedAt,
                durationMs,
            },
            summary: {
                initialKeybindingsCount: sessionData.keybindingsDiff.initialCount,
                currentKeybindingsCount: sessionData.keybindingsDiff.currentCount,
                addedCount: sessionData.keybindingsDiff.addedCount,
                removedCount: sessionData.keybindingsDiff.removedCount,
                modifiedCount: sessionData.keybindingsDiff.modifiedCount,
                totalChanges: sessionData.keybindingsDiff.diffs.length,
            },
            diffs: sessionData.keybindingsDiff.diffs,
        };
        await vscode.workspace.fs.writeFile(diffFileUri, encoder.encode(JSON.stringify(diffPayload, null, 2)));
        savedFiles.push(diffFileName);
        if (!primaryFileUri) {
            primaryFileUri = diffFileUri;
        }
    }
    // C. 始めた時点でのキーバインド（ショートカット）データ（session-initial-keybindings-*.json）
    if (saveInitialKeybindings) {
        let kbItems = initialKbSnapshot;
        if (!kbItems || kbItems.length === 0) {
            const currentKb = await (0, keybindingsService_1.readCurrentKeybindings)();
            kbItems = currentKb?.items;
        }
        if (kbItems && kbItems.length > 0) {
            const kbFileName = `session-initial-keybindings-${dateStr}.json`;
            const kbFileUri = vscode.Uri.joinPath(outputDirUri, kbFileName);
            await vscode.workspace.fs.writeFile(kbFileUri, encoder.encode(JSON.stringify(kbItems, null, 2)));
            savedFiles.push(kbFileName);
            if (!primaryFileUri) {
                primaryFileUri = kbFileUri;
            }
        }
    }
    if (savedFiles.length > 0) {
        const targetFolderDisplay = createSubdirectory
            ? `${path.basename(dirUri.fsPath)}/${dateStr}`
            : path.basename(dirUri.fsPath);
        const action = await vscode.window.showInformationMessage(`[${targetFolderDisplay}] に保存しました (${savedFiles.length} 件): ${savedFiles.join(", ")}`, "ファイルを開く");
        if (action === "ファイルを開く" && primaryFileUri) {
            const doc = await vscode.workspace.openTextDocument(primaryFileUri);
            await vscode.window.showTextDocument(doc);
        }
    }
    return primaryFileUri;
}
async function copyTsvAction(statsByExt, scopeName = "統計", targetType) {
    const availableExts = Object.keys(statsByExt);
    if (availableExts.length === 0) {
        vscode.window.showInformationMessage(`コピー対象の${scopeName}データがありません。`);
        return;
    }
    // 1. 対象の拡張子をマルチ選択
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
    const { totalStats, nonConsecutiveStats } = (0, statsFormat_1.aggregateStats)(statsByExt, selectedExts);
    // 2. 統計の集計種類を選択（指定されていない場合）
    let selectedType = targetType;
    if (!selectedType) {
        const choice = await vscode.window.showQuickPick([
            {
                label: "現行の統計 (全入力)",
                description: "キー\t回数\tパーセント",
                value: "raw",
            },
            {
                label: "連続除外統計 (非連続)",
                description: "キー\t回数\tパーセント",
                value: "dedup",
            },
            {
                label: "両方の統計をまとめる",
                description: "全入力および連続除外の2つの表を出力",
                value: "all",
            },
        ], {
            placeHolder: `クリップボードにコピーする統計の種類を選択してください (${scopeName})`,
        });
        if (!choice) {
            return;
        }
        selectedType = choice.value;
    }
    let tsv = "";
    let typeLabel = "";
    if (selectedType === "raw") {
        tsv = (0, statsFormat_1.formatTsv)(totalStats);
        typeLabel = "現行の統計 (全入力)";
    }
    else if (selectedType === "dedup") {
        tsv = (0, statsFormat_1.formatTsv)(nonConsecutiveStats);
        typeLabel = "連続除外統計 (非連続)";
    }
    else {
        tsv = `【${scopeName} - 現行の統計 (全入力)】\n${(0, statsFormat_1.formatTsv)(totalStats)}\n\n【${scopeName} - 連続除外統計 (非連続)】\n${(0, statsFormat_1.formatTsv)(nonConsecutiveStats)}`;
        typeLabel = "統計データ (全入力 & 連続除外)";
    }
    const extsLabel = selectedExts.length === availableExts.length
        ? "全拡張子"
        : selectedExts.join(", ");
    await vscode.env.clipboard.writeText(tsv);
    vscode.window.showInformationMessage(`[${scopeName} / ${extsLabel}] ${typeLabel} をTSV形式（キー 回数 パーセント）でクリップボードにコピーしました。`);
}
//# sourceMappingURL=actions.js.map
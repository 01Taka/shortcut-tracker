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
exports.formatKeybindingsJsonAction = formatKeybindingsJsonAction;
const vscode = require("vscode");
const keybindingsService_1 = require("../services/keybindingsService");
const sessionService_1 = require("../services/sessionService");
const statsPanel_1 = require("../ui/statsPanel");
const keybindingsFormat_1 = require("../utils/keybindingsFormat");
const statsFormat_1 = require("../utils/statsFormat");
async function showStatsAction(store) {
    await (0, statsPanel_1.openOrRevealStatsPanel)(store, {
        onCopyTsvFallback: async (tabType) => {
            await store.syncFromDisk();
            let targetType = "unified";
            if (tabType === "tab-raw") {
                targetType = "raw";
            }
            else if (tabType === "tab-dedup") {
                targetType = "dedup";
            }
            await copyTsvQuickPickAction(store.getStatsByExt(), "メイン統計", targetType);
        },
    });
}
async function copyStatsTsvAction(store) {
    await store.syncFromDisk();
    await copyTsvQuickPickAction(store.getStatsByExt(), "メイン統計");
}
async function copyStatsJsonAction(store) {
    await store.syncFromDisk();
    const payload = {
        version: 2,
        exportedAt: new Date().toISOString(),
        byExtension: store.getStatsByExt(),
    };
    const jsonStr = JSON.stringify(payload, null, 2);
    await vscode.env.clipboard.writeText(jsonStr);
    vscode.window.setStatusBarMessage("ショートカット累計統計をJSON形式でコピーしました", 3500);
}
/**
 * コマンドパレット等から呼ばれた場合も Webview のインポートモーダルを直接開く
 */
async function importStatsJsonAction(store) {
    await (0, statsPanel_1.openOrRevealStatsPanel)(store, {
        initialMode: "global",
        openModal: "importJson",
    });
}
/**
 * コマンドパレット等から呼ばれた場合も Webview の削除確認モーダルを直接開く
 */
async function resetStatsAction(store) {
    await (0, statsPanel_1.openOrRevealStatsPanel)(store, {
        initialMode: "global",
        openModal: "resetGlobal",
    });
}
/**
 * セッション計測の開始・再開（ダイアログなしで即時開始＆初期スナップショット自動取得）
 */
async function startSessionAction(store) {
    const res = await (0, sessionService_1.startOrResumeSession)(store);
    await (0, statsPanel_1.refreshStatsPanel)(store);
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
async function stopSessionAction(store) {
    const paused = await (0, sessionService_1.pauseSession)(store);
    await (0, statsPanel_1.refreshStatsPanel)(store);
    if (!paused) {
        vscode.window.setStatusBarMessage("セッション計測は実行されていません", 3000);
        return;
    }
    vscode.window.setStatusBarMessage("ショートカットセッション計測を一時停止しました", 3000);
}
/**
 * コマンドパレット等から呼ばれた場合も Webview のセッションリセットモーダルを直接開く
 */
async function resetSessionAction(store) {
    await (0, statsPanel_1.openOrRevealStatsPanel)(store, {
        initialMode: "session",
        openModal: "resetSession",
    });
}
async function copySessionJsonAction(store) {
    await store.syncFromDisk();
    await (0, keybindingsService_1.syncSessionKeybindingsDiff)(store);
    const sessionData = store.getSessionData();
    const durationMs = (0, statsFormat_1.calculateSessionDurationMs)(sessionData);
    const payload = {
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
    vscode.window.setStatusBarMessage("セッション統計データをJSON形式でコピーしました", 3500);
}
async function copySessionTsvAction(store) {
    await store.syncFromDisk();
    const sessionData = store.getSessionData();
    await copyTsvQuickPickAction(sessionData.statsByExt, "セッション統計");
}
async function copyKeybindingsDiffJsonAction(store) {
    await (0, keybindingsService_1.syncSessionKeybindingsDiff)(store);
    const sessionData = store.getSessionData();
    if (!sessionData.keybindingsDiff) {
        vscode.window.setStatusBarMessage("記録されたキーバインド差分データがありません", 3000);
        return;
    }
    await vscode.env.clipboard.writeText(JSON.stringify(sessionData.keybindingsDiff, null, 2));
    vscode.window.setStatusBarMessage("キーバインド差分データをクリップボードにコピーしました", 3500);
}
/**
 * コマンドパレット等から呼ばれた場合も Webview の保存設定モーダルを直接開く
 */
async function exportSessionToDirectoryAction(store) {
    await (0, statsPanel_1.openOrRevealStatsPanel)(store, {
        initialMode: "session",
        openModal: "exportSession",
    });
}
async function copyTsvQuickPickAction(statsByExt, scopeName = "統計", targetType) {
    const availableExts = Object.keys(statsByExt);
    if (availableExts.length === 0) {
        vscode.window.showInformationMessage(`コピー対象の${scopeName}データがありません。`);
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
    const aggregated = (0, statsFormat_1.aggregateStats)(statsByExt, selectedExts);
    let selectedType = targetType;
    if (!selectedType) {
        const choice = await vscode.window.showQuickPick([
            {
                label: "統合形式 (AI分析向け推奨)",
                description: "キー / 全入力 / 全入力% / 非連続 / 非連続% / リピート率",
                value: "unified",
            },
            {
                label: "キーの組み合わせ (遷移統計)",
                description: "キーの組み合わせ / 回数 / パーセント",
                value: "sequence",
            },
            {
                label: "現行の統計 (全入力のみ)",
                description: "キー / 回数 / パーセント",
                value: "raw",
            },
            {
                label: "連続除外統計 (非連続のみ)",
                description: "キー / 回数 / パーセント",
                value: "dedup",
            },
            {
                label: "両方の統計を2ブロックで出力",
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
    if (selectedType === "unified") {
        tsv = (0, statsFormat_1.formatUnifiedTsv)(aggregated);
        typeLabel = "統合TSV";
    }
    else if (selectedType === "sequence") {
        tsv = (0, statsFormat_1.formatSequenceTsv)(aggregated.sequenceStats);
        typeLabel = "キー組み合わせTSV";
    }
    else if (selectedType === "raw") {
        tsv = (0, statsFormat_1.formatTsv)(aggregated.totalStats);
        typeLabel = "全入力TSV";
    }
    else if (selectedType === "dedup") {
        tsv = (0, statsFormat_1.formatTsv)(aggregated.nonConsecutiveStats);
        typeLabel = "非連続TSV";
    }
    else {
        tsv = `【${scopeName} - 現行の統計 (全入力)】\n${(0, statsFormat_1.formatTsv)(aggregated.totalStats)}\n\n【${scopeName} - 連続除外統計 (非連続)】\n${(0, statsFormat_1.formatTsv)(aggregated.nonConsecutiveStats)}`;
        typeLabel = "2表TSV";
    }
    const extsLabel = selectedExts.length === availableExts.length
        ? "全拡張子"
        : selectedExts.join(", ");
    await vscode.env.clipboard.writeText(tsv);
    vscode.window.setStatusBarMessage(`[${scopeName} / ${extsLabel}] ${typeLabel} をコピーしました`, 3500);
}
/**
 * アクティブエディタの keybindings JSON/JSONC をフォーマット
 */
async function formatKeybindingsJsonAction() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showWarningMessage("アクティブなエディタがありません。");
        return;
    }
    const { document } = editor;
    if (document.languageId !== "json" && document.languageId !== "jsonc") {
        vscode.window.showWarningMessage("JSON または JSONC ファイルを開いた状態で実行してください。");
        return;
    }
    const tabSize = typeof editor.options.tabSize === "number" ? editor.options.tabSize : 2;
    const indentUnit = editor.options.insertSpaces === false ? "\t" : " ".repeat(tabSize);
    let replacements;
    try {
        replacements = (0, keybindingsFormat_1.computeKeybindingsFormatReplacements)(document.getText(), {
            indentUnit,
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        vscode.window.showWarningMessage(`有効なJSON配列として解析できないためフォーマットを中止しました: ${message}`);
        return;
    }
    if (replacements.length === 0) {
        vscode.window.setStatusBarMessage("フォーマット対象の変更はありませんでした", 3000);
        return;
    }
    const applied = await editor.edit((editBuilder) => {
        for (const r of replacements) {
            const range = new vscode.Range(document.positionAt(r.start), document.positionAt(r.end));
            editBuilder.replace(range, r.newText);
        }
    });
    if (applied) {
        vscode.window.setStatusBarMessage(`${replacements.length} 件のキーバインドをフォーマットしました`, 3500);
    }
}
//# sourceMappingURL=actions.js.map
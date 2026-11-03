"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const path = require("path");
const vscode = require("vscode");
function getActiveFileExtension() {
    const editor = vscode.window.activeTextEditor;
    if (!editor || !editor.document) {
        return "(none)";
    }
    const fileName = editor.document.fileName;
    const ext = path.extname(fileName).toLowerCase();
    if (ext) {
        return ext;
    }
    // 拡張子がないファイル（Dockerfile, Makefile等）や未保存ファイル
    if (editor.document.languageId) {
        return editor.document.languageId.toLowerCase();
    }
    return "(no-ext)";
}
function getStatsByExt(context) {
    let statsByExt = context.globalState.get("shortcutStatsByExt");
    if (!statsByExt || typeof statsByExt !== "object") {
        statsByExt = {};
        // 旧データ（shortcutStats, shortcutStatsNonConsecutive）が存在するか確認し、(legacy) にマイグレーション
        const oldTotal = context.globalState.get("shortcutStats");
        const oldNonConsecutive = context.globalState.get("shortcutStatsNonConsecutive");
        if (oldTotal && Object.keys(oldTotal).length > 0) {
            statsByExt["(legacy)"] = {
                shortcutStats: { ...oldTotal },
                shortcutStatsNonConsecutive: {
                    ...(oldNonConsecutive || oldTotal),
                },
            };
            // バックグラウンドで新形式に移行保存
            context.globalState.update("shortcutStatsByExt", statsByExt);
        }
    }
    return statsByExt;
}
function aggregateStats(statsByExt, filterExtensions) {
    const totalStats = {};
    const nonConsecutiveStats = {};
    const targetExts = filterExtensions
        ? Object.keys(statsByExt).filter((ext) => filterExtensions.includes(ext))
        : Object.keys(statsByExt);
    for (const ext of targetExts) {
        const data = statsByExt[ext];
        if (!data) {
            continue;
        }
        if (data.shortcutStats) {
            for (const [key, count] of Object.entries(data.shortcutStats)) {
                totalStats[key] = (totalStats[key] || 0) + count;
            }
        }
        if (data.shortcutStatsNonConsecutive) {
            for (const [key, count] of Object.entries(data.shortcutStatsNonConsecutive)) {
                nonConsecutiveStats[key] = (nonConsecutiveStats[key] || 0) + count;
            }
        }
    }
    return { totalStats, nonConsecutiveStats };
}
function activate(context) {
    let currentPanel;
    async function refreshStatsPanel() {
        if (currentPanel) {
            currentPanel.webview.html = await renderStatsHtml(context);
        }
    }
    // 1. 汎用ラッパーコマンド（キー入力を集計して本来のコマンドを実行）
    const trackAndRun = vscode.commands.registerCommand("myTracker.trackAndRun", async (args) => {
        if (!args || !args.keyName || !args.command) {
            return;
        }
        // 操作中ファイルの拡張子を取得
        const ext = getActiveFileExtension();
        // 直前の入力キーを取得して連続入力を判定（全体ストリームで判定）
        const lastKey = context.globalState.get("lastTrackedKey");
        const isConsecutive = lastKey === args.keyName;
        const statsByExt = getStatsByExt(context);
        if (!statsByExt[ext]) {
            statsByExt[ext] = {
                shortcutStats: {},
                shortcutStatsNonConsecutive: {},
            };
        }
        statsByExt[ext].shortcutStats[args.keyName] =
            (statsByExt[ext].shortcutStats[args.keyName] || 0) + 1;
        if (!isConsecutive) {
            statsByExt[ext].shortcutStatsNonConsecutive[args.keyName] =
                (statsByExt[ext].shortcutStatsNonConsecutive[args.keyName] || 0) + 1;
        }
        // 状態を永続保存
        await Promise.all([
            context.globalState.update("shortcutStatsByExt", statsByExt),
            context.globalState.update("lastTrackedKey", args.keyName),
        ]);
        // 本来のコマンドを実行
        try {
            if (args.commandArgs !== undefined) {
                await vscode.commands.executeCommand(args.command, args.commandArgs);
            }
            else {
                await vscode.commands.executeCommand(args.command);
            }
        }
        catch (error) {
            console.error(`Command execution failed: ${args.command}`, error);
        }
    });
    // 2. 統計の可視化コマンド (Cmd/Ctrl + Shift + P -> "Shortcut Stats: Show Statistics")
    const showStats = vscode.commands.registerCommand("myTracker.showStats", async () => {
        if (currentPanel) {
            currentPanel.reveal(vscode.ViewColumn.One);
            await refreshStatsPanel();
            return;
        }
        currentPanel = vscode.window.createWebviewPanel("shortcutStats", "ショートカット利用統計", vscode.ViewColumn.One, {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(context.extensionUri, "media"),
            ],
        });
        currentPanel.onDidDispose(() => {
            currentPanel = undefined;
        });
        currentPanel.webview.onDidReceiveMessage(async (message) => {
            if (message.command === "copyJson") {
                await vscode.commands.executeCommand("myTracker.copyStatsJson");
            }
            else if (message.command === "copyTsv") {
                let targetType = "all";
                if (message.tabType === "tab-raw") {
                    targetType = "raw";
                }
                else if (message.tabType === "tab-dedup") {
                    targetType = "dedup";
                }
                await copyTsvAction(context, targetType);
            }
            else if (message.command === "refresh") {
                await refreshStatsPanel();
                vscode.window.setStatusBarMessage("ショートカット統計を最新に更新しました", 2000);
            }
            else if (message.command === "importJson") {
                await vscode.commands.executeCommand("myTracker.importStatsJson");
            }
            else if (message.command === "reset") {
                await vscode.commands.executeCommand("myTracker.resetStats");
            }
        }, undefined, context.subscriptions);
        currentPanel.webview.html = await renderStatsHtml(context);
    });
    // 3. 統計データをTSV形式（キー 回数 パーセント）でコピーするコマンド
    const copyStatsTsv = vscode.commands.registerCommand("myTracker.copyStatsTsv", async () => {
        await copyTsvAction(context);
    });
    // 4. 統計データをJSON形式（拡張子別 version: 2）でコピーするコマンド
    const copyStatsJson = vscode.commands.registerCommand("myTracker.copyStatsJson", async () => {
        const statsByExt = getStatsByExt(context);
        const payload = {
            version: 2,
            exportedAt: new Date().toISOString(),
            byExtension: statsByExt,
        };
        const jsonStr = JSON.stringify(payload, null, 2);
        await vscode.env.clipboard.writeText(jsonStr);
        vscode.window.showInformationMessage("ショートカット統計データを拡張子別JSON形式でクリップボードにコピーしました。");
    });
    // 5. 統計データをJSON形式でインポートして現在の統計と合計するコマンド
    const importStatsJson = vscode.commands.registerCommand("myTracker.importStatsJson", async () => {
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
        catch (error) {
            vscode.window.showErrorMessage("無効なJSONフォーマットです。インポートを中止しました。");
            return;
        }
        if (!parsed || typeof parsed !== "object") {
            vscode.window.showErrorMessage("統計データの形式が不正です。");
            return;
        }
        const statsByExt = getStatsByExt(context);
        let addedTotalCount = 0;
        let addedKeysCount = 0;
        // ヘルパー：特定拡張子のデータに統計を加算
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
        await context.globalState.update("shortcutStatsByExt", statsByExt);
        vscode.window.showInformationMessage(`統計データをインポートしました（${addedKeysCount} 個のキー、計 ${addedTotalCount.toLocaleString()} 回を加算）。`);
        await refreshStatsPanel();
    });
    // 6. 統計のリセットコマンド
    const resetStats = vscode.commands.registerCommand("myTracker.resetStats", async () => {
        const confirm = await vscode.window.showWarningMessage("ショートカットの統計データをすべてリセットしますか？", { modal: true }, "リセット");
        if (confirm === "リセット") {
            await Promise.all([
                context.globalState.update("shortcutStatsByExt", {}),
                context.globalState.update("shortcutStats", undefined),
                context.globalState.update("shortcutStatsNonConsecutive", undefined),
                context.globalState.update("lastTrackedKey", undefined),
            ]);
            vscode.window.showInformationMessage("ショートカットの統計データを初期化しました。");
            await refreshStatsPanel();
        }
    });
    context.subscriptions.push(trackAndRun, showStats, copyStatsTsv, copyStatsJson, importStatsJson, resetStats);
}
function deactivate() { }
function escapeHtml(text) {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
async function renderStatsHtml(context) {
    const statsByExt = getStatsByExt(context);
    const { totalStats, nonConsecutiveStats } = aggregateStats(statsByExt);
    const lastKey = context.globalState.get("lastTrackedKey");
    // キーの全集合
    const allKeys = Array.from(new Set([...Object.keys(totalStats), ...Object.keys(nonConsecutiveStats)]));
    const totalInputs = Object.values(totalStats).reduce((sum, count) => sum + count, 0);
    const totalNonConsecutive = Object.values(nonConsecutiveStats).reduce((sum, count) => sum + count, 0);
    const consecutiveInputs = totalInputs - totalNonConsecutive;
    const repeatRate = totalInputs > 0
        ? ((consecutiveInputs / totalInputs) * 100).toFixed(1)
        : "0.0";
    // 比較用リスト（総数降順）
    const comparisonList = allKeys
        .map((key) => {
        const totalCount = totalStats[key] || 0;
        const nonConsecutiveCount = nonConsecutiveStats[key] || 0;
        return { key, totalCount, nonConsecutiveCount };
    })
        .sort((a, b) => b.totalCount - a.totalCount);
    // 現行統計（全入力ランキング）
    const rawSorted = Object.entries(totalStats).sort((a, b) => b[1] - a[1]);
    // 非連続統計ランキング
    const nonConsecutiveSorted = Object.entries(nonConsecutiveStats).sort((a, b) => b[1] - a[1]);
    const comparisonRows = comparisonList
        .map(({ key, totalCount, nonConsecutiveCount }) => {
        const totalPct = totalInputs > 0
            ? ((totalCount / totalInputs) * 100).toFixed(1)
            : "0.0";
        const nonConsecutivePct = totalNonConsecutive > 0
            ? ((nonConsecutiveCount / totalNonConsecutive) * 100).toFixed(1)
            : "0.0";
        const rate = totalCount > 0
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
        const pct = totalInputs > 0 ? ((count / totalInputs) * 100).toFixed(1) : "0.0";
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
        const pct = totalNonConsecutive > 0
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
    const htmlUri = vscode.Uri.joinPath(context.extensionUri, "media", "stats.html");
    const bytes = await vscode.workspace.fs.readFile(htmlUri);
    let html = new TextDecoder("utf-8").decode(bytes);
    return html
        .replace("{{TOTAL_INPUTS}}", totalInputs.toLocaleString())
        .replace("{{TOTAL_NON_CONSECUTIVE}}", totalNonConsecutive.toLocaleString())
        .replace("{{CONSECUTIVE_INPUTS}}", consecutiveInputs.toLocaleString())
        .replace("{{REPEAT_RATE}}", repeatRate)
        .replace("{{COMPARISON_ROWS}}", comparisonRows ||
        '<tr><td colspan="4" class="empty">まだ記録がありません</td></tr>')
        .replace("{{RAW_ROWS}}", rawRows ||
        '<tr><td colspan="3" class="empty">まだ記録がありません</td></tr>')
        .replace("{{NON_CONSECUTIVE_ROWS}}", nonConsecutiveRows ||
        '<tr><td colspan="3" class="empty">まだ記録がありません</td></tr>')
        .replace("{{LAST_KEY}}", lastKey ? escapeHtml(lastKey) : "(なし)");
}
function formatTsv(stats) {
    const sorted = Object.entries(stats).sort((a, b) => b[1] - a[1]);
    const total = sorted.reduce((sum, [, count]) => sum + count, 0);
    const header = "キー\t回数\tパーセント";
    if (sorted.length === 0) {
        return header;
    }
    const rows = sorted.map(([key, count]) => {
        const pct = total > 0 ? ((count / total) * 100).toFixed(1) : "0.0";
        return `${key}\t${count}\t${pct}%`;
    });
    return [header, ...rows].join("\n");
}
async function copyTsvAction(context, targetType) {
    const statsByExt = getStatsByExt(context);
    const availableExts = Object.keys(statsByExt);
    if (availableExts.length === 0) {
        vscode.window.showInformationMessage("コピー対象の統計データがありません。");
        return;
    }
    // 1. 対象の拡張子をマルチ選択
    const extPickItems = availableExts.map((ext) => {
        const data = statsByExt[ext];
        const count = Object.values(data.shortcutStats || {}).reduce((sum, c) => sum + c, 0);
        return {
            label: ext,
            description: `${count.toLocaleString()} 回の入力`,
            picked: true, // デフォルトで全選択
        };
    });
    const selectedItems = await vscode.window.showQuickPick(extPickItems, {
        canPickMany: true,
        placeHolder: "TSV出力に含める拡張子を選択してください（Enterで決定）",
        title: "拡張子の選択",
    });
    if (!selectedItems || selectedItems.length === 0) {
        return;
    }
    const selectedExts = selectedItems.map((item) => item.label);
    const { totalStats, nonConsecutiveStats } = aggregateStats(statsByExt, selectedExts);
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
            placeHolder: "クリップボードにコピーする統計の種類を選択してください",
        });
        if (!choice) {
            return;
        }
        selectedType = choice.value;
    }
    let tsv = "";
    let typeLabel = "";
    if (selectedType === "raw") {
        tsv = formatTsv(totalStats);
        typeLabel = "現行の統計 (全入力)";
    }
    else if (selectedType === "dedup") {
        tsv = formatTsv(nonConsecutiveStats);
        typeLabel = "連続除外統計 (非連続)";
    }
    else {
        tsv = `【現行の統計 (全入力)】\n${formatTsv(totalStats)}\n\n【連続除外統計 (非連続)】\n${formatTsv(nonConsecutiveStats)}`;
        typeLabel = "統計データ (全入力 & 連続除外)";
    }
    const extsLabel = selectedExts.length === availableExts.length
        ? "全拡張子"
        : selectedExts.join(", ");
    await vscode.env.clipboard.writeText(tsv);
    vscode.window.showInformationMessage(`[${extsLabel}] ${typeLabel} をTSV形式（キー 回数 パーセント）でクリップボードにコピーしました。`);
}
//# sourceMappingURL=extension.js.map
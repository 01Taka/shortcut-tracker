"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = require("vscode");
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
        // 直前の入力キーを取得して連続入力を判定
        const lastKey = context.globalState.get("lastTrackedKey");
        const isConsecutive = lastKey === args.keyName;
        // 1. 現行の統計（すべての入力をカウント）
        const totalStats = context.globalState.get("shortcutStats", {});
        totalStats[args.keyName] = (totalStats[args.keyName] || 0) + 1;
        // 2. 連続した入力をカウントしない統計（直前と異なる場合のみカウント）
        const nonConsecutiveStats = context.globalState.get("shortcutStatsNonConsecutive", {});
        if (!isConsecutive) {
            nonConsecutiveStats[args.keyName] =
                (nonConsecutiveStats[args.keyName] || 0) + 1;
        }
        // 状態を永続保存（直前の入力キーも保存）
        await Promise.all([
            context.globalState.update("shortcutStats", totalStats),
            !isConsecutive
                ? context.globalState.update("shortcutStatsNonConsecutive", nonConsecutiveStats)
                : Promise.resolve(),
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
    // 4. 統計データをJSON形式でコピーするコマンド
    const copyStatsJson = vscode.commands.registerCommand("myTracker.copyStatsJson", async () => {
        const totalStats = context.globalState.get("shortcutStats", {});
        const nonConsecutiveStats = context.globalState.get("shortcutStatsNonConsecutive", {});
        const payload = {
            version: 1,
            exportedAt: new Date().toISOString(),
            shortcutStats: totalStats,
            shortcutStatsNonConsecutive: nonConsecutiveStats,
        };
        const jsonStr = JSON.stringify(payload, null, 2);
        await vscode.env.clipboard.writeText(jsonStr);
        vscode.window.showInformationMessage("ショートカット統計データをJSON形式でクリップボードにコピーしました。");
    });
    // 4. 統計データをJSON形式でインポートして現在の統計と合計するコマンド
    const importStatsJson = vscode.commands.registerCommand("myTracker.importStatsJson", async () => {
        const input = await vscode.window.showInputBox({
            prompt: "インポートする統計データ（JSON）を入力してください（現在の統計と合算されます）",
            placeHolder: '{"shortcutStats": {...}, "shortcutStatsNonConsecutive": {...}}',
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
        let importedTotal = {};
        let importedNonConsecutive = {};
        if (parsed && typeof parsed === "object") {
            if (parsed.shortcutStats && typeof parsed.shortcutStats === "object") {
                importedTotal = parsed.shortcutStats;
                importedNonConsecutive =
                    parsed.shortcutStatsNonConsecutive &&
                        typeof parsed.shortcutStatsNonConsecutive === "object"
                        ? parsed.shortcutStatsNonConsecutive
                        : parsed.shortcutStats;
            }
            else {
                // フラットなキーバインド辞書形式
                importedTotal = parsed;
                importedNonConsecutive = parsed;
            }
        }
        else {
            vscode.window.showErrorMessage("統計データの形式が不正です。");
            return;
        }
        const currentTotal = context.globalState.get("shortcutStats", {});
        const currentNonConsecutive = context.globalState.get("shortcutStatsNonConsecutive", {});
        let addedTotalCount = 0;
        let addedKeysCount = 0;
        for (const [key, val] of Object.entries(importedTotal)) {
            const num = Number(val);
            if (!isNaN(num) && num > 0) {
                const count = Math.round(num);
                currentTotal[key] = (currentTotal[key] || 0) + count;
                addedTotalCount += count;
                addedKeysCount++;
            }
        }
        for (const [key, val] of Object.entries(importedNonConsecutive)) {
            const num = Number(val);
            if (!isNaN(num) && num > 0) {
                const count = Math.round(num);
                currentNonConsecutive[key] =
                    (currentNonConsecutive[key] || 0) + count;
            }
        }
        if (addedKeysCount === 0) {
            vscode.window.showWarningMessage("インポート可能な正の数値データが見つかりませんでした。");
            return;
        }
        await Promise.all([
            context.globalState.update("shortcutStats", currentTotal),
            context.globalState.update("shortcutStatsNonConsecutive", currentNonConsecutive),
        ]);
        vscode.window.showInformationMessage(`統計データをインポートしました（${addedKeysCount} 個のキー、計 ${addedTotalCount.toLocaleString()} 回を加算）。`);
        await refreshStatsPanel();
    });
    // 5. 統計のリセットコマンド
    const resetStats = vscode.commands.registerCommand("myTracker.resetStats", async () => {
        const confirm = await vscode.window.showWarningMessage("ショートカットの統計データをすべてリセットしますか？", { modal: true }, "リセット");
        if (confirm === "リセット") {
            await Promise.all([
                context.globalState.update("shortcutStats", {}),
                context.globalState.update("shortcutStatsNonConsecutive", {}),
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
    const totalStats = context.globalState.get("shortcutStats", {});
    const nonConsecutiveStats = context.globalState.get("shortcutStatsNonConsecutive", {});
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
    const totalStats = context.globalState.get("shortcutStats", {});
    const nonConsecutiveStats = context.globalState.get("shortcutStatsNonConsecutive", {});
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
    let label = "";
    if (selectedType === "raw") {
        tsv = formatTsv(totalStats);
        label = "現行の統計 (全入力)";
    }
    else if (selectedType === "dedup") {
        tsv = formatTsv(nonConsecutiveStats);
        label = "連続除外統計 (非連続)";
    }
    else {
        tsv = `【現行の統計 (全入力)】\n${formatTsv(totalStats)}\n\n【連続除外統計 (非連続)】\n${formatTsv(nonConsecutiveStats)}`;
        label = "統計データ (全入力 & 連続除外)";
    }
    await vscode.env.clipboard.writeText(tsv);
    vscode.window.showInformationMessage(`${label} をTSV形式（キー 回数 パーセント）でクリップボードにコピーしました。`);
}
//# sourceMappingURL=extension.js.map
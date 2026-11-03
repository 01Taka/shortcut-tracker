"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const path = require("path");
const vscode = require("vscode");
/**
 * コメント付きJSON（JSONC）の安全な簡易パーサー
 */
function parseJsonc(text) {
    // BOM除去
    let clean = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
    let result = "";
    let inString = false;
    let inSingleComment = false;
    let inBlockComment = false;
    let quoteChar = "";
    for (let i = 0; i < clean.length; i++) {
        const char = clean[i];
        const next = clean[i + 1];
        if (inSingleComment) {
            if (char === "\n") {
                inSingleComment = false;
                result += char;
            }
        }
        else if (inBlockComment) {
            if (char === "*" && next === "/") {
                inBlockComment = false;
                i++;
            }
        }
        else if (inString) {
            result += char;
            if (char === "\\") {
                i++;
                if (i < clean.length) {
                    result += clean[i];
                }
            }
            else if (char === quoteChar) {
                inString = false;
            }
        }
        else {
            if (char === "/" && next === "/") {
                inSingleComment = true;
                i++;
            }
            else if (char === "/" && next === "*") {
                inBlockComment = true;
                i++;
            }
            else {
                result += char;
                if (char === '"' || char === "'") {
                    inString = true;
                    quoteChar = char;
                }
            }
        }
    }
    // 末尾のカンマ (trailing commas) も除去
    result = result.replace(/,\s*([}\]])/g, "$1");
    return JSON.parse(result);
}
/**
 * OSに応じたユーザーキーバインド設定（keybindings.json）のパスを取得
 */
function getUserKeybindingsUri() {
    const appName = vscode.env.appName.toLowerCase();
    let folderName = "Code";
    if (appName.includes("insiders")) {
        folderName = "Code - Insiders";
    }
    else if (appName.includes("vscodium") || appName.includes("codium")) {
        folderName = "VSCodium";
    }
    let userDir;
    if (process.platform === "win32") {
        const appData = process.env.APPDATA ||
            (process.env.USERPROFILE
                ? path.join(process.env.USERPROFILE, "AppData", "Roaming")
                : undefined);
        if (appData) {
            userDir = path.join(appData, folderName, "User");
        }
    }
    else if (process.platform === "darwin") {
        const home = process.env.HOME;
        if (home) {
            userDir = path.join(home, "Library", "Application Support", folderName, "User");
        }
    }
    else {
        // Linux
        const configHome = process.env.XDG_CONFIG_HOME ||
            (process.env.HOME ? path.join(process.env.HOME, ".config") : undefined);
        if (configHome) {
            userDir = path.join(configHome, folderName, "User");
        }
    }
    if (userDir) {
        return vscode.Uri.file(path.join(userDir, "keybindings.json"));
    }
    return undefined;
}
/**
 * 現在のユーザーキーバインド設定ファイルを読み込んでパース
 */
async function readCurrentKeybindings() {
    const uri = getUserKeybindingsUri();
    if (!uri) {
        return undefined;
    }
    try {
        const bytes = await vscode.workspace.fs.readFile(uri);
        const rawText = new TextDecoder("utf-8").decode(bytes);
        const items = parseJsonc(rawText);
        if (Array.isArray(items)) {
            return { uri, items, rawText };
        }
    }
    catch (error) {
        console.error("Failed to read user keybindings.json", error);
    }
    return undefined;
}
function getExactSignature(item) {
    if (!item || typeof item !== "object") {
        return "";
    }
    const key = String(item.key || "").toLowerCase().trim();
    const command = String(item.command || "").trim();
    const when = String(item.when || "").trim();
    const argsStr = item.args !== undefined ? JSON.stringify(item.args) : "";
    return `${key}|#|${command}|#|${when}|#|${argsStr}`;
}
/**
 * 開始時と終了時のキーバインド配列の差分を計算
 */
function calculateKeybindingsDiff(initialItems, currentItems) {
    const initialList = [...initialItems];
    const currentList = [...currentItems];
    const matchedInitialIndices = new Set();
    const matchedCurrentIndices = new Set();
    // 1. 完全一致を照合
    for (let cIdx = 0; cIdx < currentList.length; cIdx++) {
        const cItem = currentList[cIdx];
        const cSig = getExactSignature(cItem);
        for (let iIdx = 0; iIdx < initialList.length; iIdx++) {
            if (matchedInitialIndices.has(iIdx)) {
                continue;
            }
            const iItem = initialList[iIdx];
            if (getExactSignature(iItem) === cSig) {
                matchedCurrentIndices.add(cIdx);
                matchedInitialIndices.add(iIdx);
                break;
            }
        }
    }
    const unmatchedInitial = initialList
        .map((item, idx) => ({ item, idx }))
        .filter(({ idx }) => !matchedInitialIndices.has(idx));
    const unmatchedCurrent = currentList
        .map((item, idx) => ({ item, idx }))
        .filter(({ idx }) => !matchedCurrentIndices.has(idx));
    const diffs = [];
    const matchedModifiedCurrent = new Set();
    const matchedModifiedInitial = new Set();
    // 2. modified (同じキーを持つ変更) を照合
    for (const { item: cItem, idx: cIdx } of unmatchedCurrent) {
        const cKey = String(cItem.key || "").toLowerCase().trim();
        for (const { item: iItem, idx: iIdx } of unmatchedInitial) {
            if (matchedModifiedInitial.has(iIdx)) {
                continue;
            }
            const iKey = String(iItem.key || "").toLowerCase().trim();
            if (cKey && cKey === iKey) {
                matchedModifiedCurrent.add(cIdx);
                matchedModifiedInitial.add(iIdx);
                diffs.push({
                    type: "modified",
                    key: cItem.key,
                    command: cItem.command,
                    when: cItem.when,
                    args: cItem.args,
                    before: {
                        command: iItem.command,
                        when: iItem.when,
                        args: iItem.args,
                    },
                });
                break;
            }
        }
    }
    // 3. 残りの unmatchedCurrent は added
    for (const { item: cItem, idx: cIdx } of unmatchedCurrent) {
        if (!matchedModifiedCurrent.has(cIdx)) {
            diffs.push({
                type: "added",
                key: cItem.key,
                command: cItem.command,
                when: cItem.when,
                args: cItem.args,
            });
        }
    }
    // 4. 残りの unmatchedInitial は removed
    for (const { item: iItem, idx: iIdx } of unmatchedInitial) {
        if (!matchedModifiedInitial.has(iIdx)) {
            diffs.push({
                type: "removed",
                key: iItem.key,
                command: iItem.command,
                when: iItem.when,
                args: iItem.args,
            });
        }
    }
    let addedCount = 0;
    let removedCount = 0;
    let modifiedCount = 0;
    for (const d of diffs) {
        if (d.type === "added") {
            addedCount++;
        }
        else if (d.type === "removed") {
            removedCount++;
        }
        else if (d.type === "modified") {
            modifiedCount++;
        }
    }
    return {
        calculatedAt: new Date().toISOString(),
        initialCount: initialItems.length,
        currentCount: currentItems.length,
        addedCount,
        removedCount,
        modifiedCount,
        diffs,
    };
}
/**
 * 差分結果をワークスペース内の shortcuts-log ディレクトリなどにJSONファイルとして保存
 */
async function saveDiffToFile(diff, sessionData) {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
        return undefined;
    }
    const root = folders[0].uri;
    const shortcutsLogDir = vscode.Uri.joinPath(root, "shortcuts-log");
    let targetDir = root;
    try {
        await vscode.workspace.fs.stat(shortcutsLogDir);
        targetDir = shortcutsLogDir;
    }
    catch {
        targetDir = root;
    }
    const dateStr = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const fileUri = vscode.Uri.joinPath(targetDir, `session-diff-${dateStr}.json`);
    const payload = {
        version: 2,
        type: "sessionKeybindingsDiff",
        calculatedAt: diff.calculatedAt,
        session: {
            startedAt: sessionData.startedAt,
            stoppedAt: sessionData.stoppedAt,
            durationMs: sessionData.accumulatedMs,
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
    const bytes = new TextEncoder().encode(JSON.stringify(payload, null, 2));
    await vscode.workspace.fs.writeFile(fileUri, bytes);
    return fileUri;
}
/**
 * セッション統計データを任意のローカルディレクトリに書き込む
 * （チェックボックス付き選択で、始めた時点のキーバインドも同時に保存可能）
 */
async function exportSessionToDirectoryAction(context, predefinedDirUri) {
    const sessionData = getSessionData(context);
    const sessionAggregated = aggregateStats(sessionData.statsByExt);
    const sessionTotal = Object.values(sessionAggregated.totalStats).reduce((sum, count) => sum + count, 0);
    // 1. 保存する内容をチェックボックス付き QuickPick でユーザーに確認
    const pickItems = [
        {
            id: "stats",
            label: "$(graph) セッション統計データを保存",
            description: "session-stats-*.json (拡張子別打鍵数・集計サマリー・差分概要)",
            picked: true,
        },
    ];
    if (sessionData.initialKeybindings &&
        sessionData.initialKeybindings.length > 0) {
        pickItems.push({
            id: "initialKeybindings",
            label: "$(key) 始めた時点でのキーバインド（ショートカット）データを保存",
            description: `session-initial-keybindings-*.json (${sessionData.initialKeybindings.length.toLocaleString()} 件)`,
            picked: true, // デフォルトでチェックON
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
    // ディレクトリとして保存のチェックボックス項目
    pickItems.push({
        id: "createSubdirectory",
        label: "$(folder) ディレクトリとして保存",
        description: "YYYY-MM-DD-HHmmss のディレクトリを作成してその中に保存する",
        picked: true, // デフォルトでチェックON
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
    // 2. 保存先ディレクトリの決定
    let dirUri = predefinedDirUri;
    if (!dirUri) {
        const lastExportDir = context.globalState.get("lastSessionExportDir");
        // 前回フォルダがある場合は選択肢を表示
        if (lastExportDir) {
            const dirChoice = await vscode.window.showQuickPick([
                {
                    label: `$(folder) 前回と同じフォルダに保存`,
                    description: lastExportDir,
                    value: "last",
                },
                {
                    label: `$(folder-opened) 別のディレクトリを選択...`,
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
            await context.globalState.update("lastSessionExportDir", dirUri.fsPath);
        }
    }
    const durationMs = calculateSessionDurationMs(sessionData);
    const durationText = formatDuration(durationMs);
    const dateStr = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    // 「ディレクトリとして保存」にチェックがある場合、YYYY-MM-DD-HHmmss のディレクトリを作成してその中に配置
    let outputDirUri = dirUri;
    if (createSubdirectory) {
        outputDirUri = vscode.Uri.joinPath(dirUri, dateStr);
        await vscode.workspace.fs.createDirectory(outputDirUri);
    }
    const savedFiles = [];
    let primaryFileUri;
    // A. セッション統計データ（session-stats-*.json）
    if (saveStats) {
        const fileName = `session-stats-${dateStr}.json`;
        const fileUri = vscode.Uri.joinPath(outputDirUri, fileName);
        const sessionNonConsecutive = Object.values(sessionAggregated.nonConsecutiveStats).reduce((sum, count) => sum + count, 0);
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
        const bytes = new TextEncoder().encode(JSON.stringify(payload, null, 2));
        await vscode.workspace.fs.writeFile(fileUri, bytes);
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
        await vscode.workspace.fs.writeFile(diffFileUri, new TextEncoder().encode(JSON.stringify(diffPayload, null, 2)));
        savedFiles.push(diffFileName);
        if (!primaryFileUri) {
            primaryFileUri = diffFileUri;
        }
    }
    // C. 始めた時点でのキーバインド（ショートカット）データ（session-initial-keybindings-*.json）
    if (saveInitialKeybindings) {
        let kbItems = sessionData.initialKeybindings;
        if (!kbItems || kbItems.length === 0) {
            const currentKb = await readCurrentKeybindings();
            kbItems = currentKb?.items;
        }
        if (kbItems && kbItems.length > 0) {
            const kbFileName = `session-initial-keybindings-${dateStr}.json`;
            const kbFileUri = vscode.Uri.joinPath(outputDirUri, kbFileName);
            const kbBytes = new TextEncoder().encode(JSON.stringify(kbItems, null, 2));
            await vscode.workspace.fs.writeFile(kbFileUri, kbBytes);
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
function getSessionData(context) {
    const data = context.globalState.get("sessionData");
    if (data && typeof data === "object" && data.statsByExt) {
        return data;
    }
    return {
        isActive: false,
        accumulatedMs: 0,
        statsByExt: {},
    };
}
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
        // メイン統計の記録
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
        const updates = [
            context.globalState.update("shortcutStatsByExt", statsByExt),
            context.globalState.update("lastTrackedKey", args.keyName),
        ];
        // セッション計測中であればセッションデータにも記録
        const sessionData = getSessionData(context);
        if (sessionData.isActive) {
            if (!sessionData.statsByExt[ext]) {
                sessionData.statsByExt[ext] = {
                    shortcutStats: {},
                    shortcutStatsNonConsecutive: {},
                };
            }
            sessionData.statsByExt[ext].shortcutStats[args.keyName] =
                (sessionData.statsByExt[ext].shortcutStats[args.keyName] || 0) + 1;
            if (!isConsecutive) {
                sessionData.statsByExt[ext].shortcutStatsNonConsecutive[args.keyName] =
                    (sessionData.statsByExt[ext].shortcutStatsNonConsecutive[args.keyName] || 0) + 1;
            }
            updates.push(context.globalState.update("sessionData", sessionData));
        }
        // 状態を永続保存
        await Promise.all(updates);
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
                await copyTsvAction(context, getStatsByExt(context), "メイン統計", targetType);
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
            else if (message.command === "startSession") {
                await vscode.commands.executeCommand("myTracker.startSession");
            }
            else if (message.command === "stopSession") {
                await vscode.commands.executeCommand("myTracker.stopSession");
            }
            else if (message.command === "resetSession") {
                await vscode.commands.executeCommand("myTracker.resetSession");
            }
            else if (message.command === "copySessionJson") {
                await vscode.commands.executeCommand("myTracker.copySessionJson");
            }
            else if (message.command === "copySessionTsv") {
                await vscode.commands.executeCommand("myTracker.copySessionTsv");
            }
            else if (message.command === "copyKeybindingsDiffJson") {
                await vscode.commands.executeCommand("myTracker.copyKeybindingsDiffJson");
            }
            else if (message.command === "exportSessionToDirectory") {
                await vscode.commands.executeCommand("myTracker.exportSessionToDirectory");
            }
        }, undefined, context.subscriptions);
        currentPanel.webview.html = await renderStatsHtml(context);
    });
    // 3. 統計データをTSV形式（キー 回数 パーセント）でコピーするコマンド
    const copyStatsTsv = vscode.commands.registerCommand("myTracker.copyStatsTsv", async () => {
        await copyTsvAction(context, getStatsByExt(context), "メイン統計");
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
    // 7. セッション計測開始コマンド（開始時キーバインド保存の質問付き）
    const startSession = vscode.commands.registerCommand("myTracker.startSession", async () => {
        const sessionData = getSessionData(context);
        if (sessionData.isActive) {
            vscode.window.showInformationMessage("セッション計測は既に実行中です。");
            return;
        }
        // 開始時のキーバインド保存についての質問
        let snapshotSaved = false;
        const askSnapshot = await vscode.window.showInformationMessage("セッション開始時のキーバインド設定をスナップショットとして保存しますか？（セッション終了時に変更差分を計算できるようになります）", "保存する", "保存しない");
        if (askSnapshot === "保存する") {
            const kbInfo = await readCurrentKeybindings();
            if (kbInfo && kbInfo.items.length > 0) {
                sessionData.initialKeybindings = kbInfo.items;
                sessionData.initialKeybindingsCount = kbInfo.items.length;
                sessionData.keybindingsDiff = undefined; // 新規セッション用に以前の差分をリセット
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
        await context.globalState.update("sessionData", sessionData);
        if (snapshotSaved && sessionData.initialKeybindingsCount) {
            vscode.window.showInformationMessage(`開始時のキーバインド設定（${sessionData.initialKeybindingsCount.toLocaleString()} 件）を保存し、セッション計測を開始しました。`);
        }
        else {
            vscode.window.showInformationMessage("ショートカットセッション計測を開始しました。");
        }
        await refreshStatsPanel();
    });
    // 8. セッション計測停止コマンド（キーバインド差分計算・ローカルディレクトリ保存の質問付き）
    const stopSession = vscode.commands.registerCommand("myTracker.stopSession", async () => {
        const sessionData = getSessionData(context);
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
        await context.globalState.update("sessionData", sessionData);
        vscode.window.showInformationMessage("ショートカットセッション計測を一時停止しました。");
        await refreshStatsPanel();
        // 開始時のキーバインドスナップショットが存在する場合、差分計算と保存の質問を行う
        if (sessionData.initialKeybindings &&
            sessionData.initialKeybindings.length > 0) {
            const askDiff = await vscode.window.showInformationMessage("セッション開始時からのキーバインド設定の差分を計算し、変更された部分を保存しますか？", "差分を計算して保存", "保存しない");
            if (askDiff === "差分を計算して保存") {
                const currentKb = await readCurrentKeybindings();
                if (currentKb && currentKb.items) {
                    const diff = calculateKeybindingsDiff(sessionData.initialKeybindings, currentKb.items);
                    sessionData.keybindingsDiff = diff;
                    await context.globalState.update("sessionData", sessionData);
                    if (diff.diffs.length === 0) {
                        vscode.window.showInformationMessage("セッション開始時からキーバインド設定の変更はありませんでした。");
                    }
                    else {
                        // ワークスペースに差分ファイルを保存
                        const savedUri = await saveDiffToFile(diff, sessionData);
                        const msg = `キーバインドの変更差分を保存しました（追加: ${diff.addedCount}件, 削除: ${diff.removedCount}件, 変更: ${diff.modifiedCount}件）。`;
                        let action;
                        if (savedUri) {
                            action = await vscode.window.showInformationMessage(msg, "差分ファイルを開く", "差分JSONをコピー");
                        }
                        else {
                            action = await vscode.window.showInformationMessage(msg, "差分JSONをコピー");
                        }
                        if (action === "差分ファイルを開く" && savedUri) {
                            const doc = await vscode.workspace.openTextDocument(savedUri);
                            await vscode.window.showTextDocument(doc);
                        }
                        else if (action === "差分JSONをコピー") {
                            await vscode.env.clipboard.writeText(JSON.stringify(diff, null, 2));
                            vscode.window.showInformationMessage("差分データをクリップボードにコピーしました。");
                        }
                    }
                    await refreshStatsPanel();
                }
                else {
                    vscode.window.showErrorMessage("現在の keybindings.json を読み込めなかったため、差分を計算できませんでした。");
                }
            }
        }
        // セッション統計データのローカルディレクトリ保存についての質問・実行
        // （チェックボックス付きQuickPickで「始めた時点のキーバインド」も同時に保存可能）
        await exportSessionToDirectoryAction(context);
    });
    // 9. セッション計測リセットコマンド
    const resetSession = vscode.commands.registerCommand("myTracker.resetSession", async () => {
        const confirm = await vscode.window.showWarningMessage("セッション計測データおよびキーバインドのスナップショット・差分をリセットしますか？（メイン統計には影響しません）", { modal: true }, "リセット");
        if (confirm === "リセット") {
            const freshSession = {
                isActive: false,
                accumulatedMs: 0,
                statsByExt: {},
                initialKeybindings: undefined,
                initialKeybindingsCount: undefined,
                keybindingsDiff: undefined,
            };
            await context.globalState.update("sessionData", freshSession);
            vscode.window.showInformationMessage("セッション計測データをリセットしました。");
            await refreshStatsPanel();
        }
    });
    // 10. セッション統計のJSONコピーコマンド
    const copySessionJson = vscode.commands.registerCommand("myTracker.copySessionJson", async () => {
        const sessionData = getSessionData(context);
        const durationMs = calculateSessionDurationMs(sessionData);
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
    });
    // 11. セッション統計のTSVコピーコマンド
    const copySessionTsv = vscode.commands.registerCommand("myTracker.copySessionTsv", async () => {
        const sessionData = getSessionData(context);
        await copyTsvAction(context, sessionData.statsByExt, "セッション統計");
    });
    // 12. キーバインド差分JSONのコピーコマンド
    const copyKeybindingsDiffJson = vscode.commands.registerCommand("myTracker.copyKeybindingsDiffJson", async () => {
        const sessionData = getSessionData(context);
        if (!sessionData.keybindingsDiff) {
            vscode.window.showInformationMessage("保存されたキーバインド差分データがありません。");
            return;
        }
        await vscode.env.clipboard.writeText(JSON.stringify(sessionData.keybindingsDiff, null, 2));
        vscode.window.showInformationMessage("キーバインド差分データをクリップボードにコピーしました。");
    });
    // 13. セッション統計データをディレクトリに保存するコマンド
    const exportSessionToDirectory = vscode.commands.registerCommand("myTracker.exportSessionToDirectory", async () => {
        await exportSessionToDirectoryAction(context);
    });
    context.subscriptions.push(trackAndRun, showStats, copyStatsTsv, copyStatsJson, importStatsJson, resetStats, startSession, stopSession, resetSession, copySessionJson, copySessionTsv, copyKeybindingsDiffJson, exportSessionToDirectory);
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
    // メイン統計のキー全集合
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
    // --- セッション統計の計算 ---
    const sessionData = getSessionData(context);
    const sessionAggregated = aggregateStats(sessionData.statsByExt);
    const sessionTotal = Object.values(sessionAggregated.totalStats).reduce((sum, count) => sum + count, 0);
    const sessionNonConsecutive = Object.values(sessionAggregated.nonConsecutiveStats).reduce((sum, count) => sum + count, 0);
    const sessionConsecutive = sessionTotal - sessionNonConsecutive;
    const sessionRepeatRate = sessionTotal > 0
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
        }
        else {
            const diffRows = diff.diffs
                .map((entry) => {
                let badgeClass = "diff-badge-added";
                let badgeText = "追加";
                if (entry.type === "removed") {
                    badgeClass = "diff-badge-removed";
                    badgeText = "削除";
                }
                else if (entry.type === "modified") {
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
    const sessionAllKeys = Array.from(new Set([
        ...Object.keys(sessionAggregated.totalStats),
        ...Object.keys(sessionAggregated.nonConsecutiveStats),
    ]));
    const sessionComparisonList = sessionAllKeys
        .map((key) => {
        const totalCount = sessionAggregated.totalStats[key] || 0;
        const nonConsecutiveCount = sessionAggregated.nonConsecutiveStats[key] || 0;
        return { key, totalCount, nonConsecutiveCount };
    })
        .sort((a, b) => b.totalCount - a.totalCount);
    const sessionRows = sessionComparisonList
        .map(({ key, totalCount, nonConsecutiveCount }) => {
        const totalPct = sessionTotal > 0
            ? ((totalCount / sessionTotal) * 100).toFixed(1)
            : "0.0";
        const nonConsecutivePct = sessionNonConsecutive > 0
            ? ((nonConsecutiveCount / sessionNonConsecutive) * 100).toFixed(1)
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
        .replace("{{LAST_KEY}}", lastKey ? escapeHtml(lastKey) : "(なし)")
        .replace("{{SESSION_STATUS_BADGE}}", sessionStatusBadge)
        .replace("{{SESSION_TOGGLE_BTN}}", sessionToggleBtn)
        .replace("{{SESSION_STARTED_AT}}", sessionStartedAtText)
        .replace("{{SESSION_DURATION}}", sessionDurationText)
        .replace("{{SESSION_SNAPSHOT_INFO}}", sessionSnapshotInfo)
        .replace("{{KEYBINDINGS_DIFF_SECTION}}", keybindingsDiffHtml)
        .replace("{{SESSION_TOTAL_INPUTS}}", sessionTotal.toLocaleString())
        .replace("{{SESSION_NON_CONSECUTIVE}}", sessionNonConsecutive.toLocaleString())
        .replace("{{SESSION_REPEAT_RATE}}", sessionRepeatRate)
        .replace("{{SESSION_ROWS}}", sessionRows ||
        '<tr><td colspan="4" class="empty">セッション中のショートカット記録はまだありません</td></tr>');
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
async function copyTsvAction(context, statsByExt, scopeName = "統計", targetType) {
    const availableExts = Object.keys(statsByExt);
    if (availableExts.length === 0) {
        vscode.window.showInformationMessage(`コピー対象の${scopeName}データがありません。`);
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
        placeHolder: `TSV出力に含める拡張子を選択してください（${scopeName}）`,
        title: `拡張子の選択 (${scopeName})`,
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
        tsv = formatTsv(totalStats);
        typeLabel = "現行の統計 (全入力)";
    }
    else if (selectedType === "dedup") {
        tsv = formatTsv(nonConsecutiveStats);
        typeLabel = "連続除外統計 (非連続)";
    }
    else {
        tsv = `【${scopeName} - 現行の統計 (全入力)】\n${formatTsv(totalStats)}\n\n【${scopeName} - 連続除外統計 (非連続)】\n${formatTsv(nonConsecutiveStats)}`;
        typeLabel = "統計データ (全入力 & 連続除外)";
    }
    const extsLabel = selectedExts.length === availableExts.length
        ? "全拡張子"
        : selectedExts.join(", ");
    await vscode.env.clipboard.writeText(tsv);
    vscode.window.showInformationMessage(`[${scopeName} / ${extsLabel}] ${typeLabel} をTSV形式（キー 回数 パーセント）でクリップボードにコピーしました。`);
}
//# sourceMappingURL=extension.js.map
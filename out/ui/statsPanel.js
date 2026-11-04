"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isStatsPanelOpen = isStatsPanelOpen;
exports.refreshStatsPanel = refreshStatsPanel;
exports.openOrRevealStatsPanel = openOrRevealStatsPanel;
const crypto = require("crypto");
const vscode = require("vscode");
const keybindingsService_1 = require("../services/keybindingsService");
const sessionService_1 = require("../services/sessionService");
const LIVE_PUSH_INTERVAL_MS = 200;
let currentPanel;
let cachedHtmlTemplate;
function isStatsPanelOpen() {
    return currentPanel !== undefined;
}
function buildStatsPayload(store) {
    const sessionData = store.getSessionData();
    return {
        statsByExt: store.getStatsByExt(),
        lastTrackedKey: store.getLastTrackedKey() ?? null,
        lastExportDir: store.getLastExportDir() ?? null,
        session: {
            isActive: Boolean(sessionData.isActive),
            name: sessionData.name ?? null,
            startedAt: sessionData.startedAt ?? null,
            stoppedAt: sessionData.stoppedAt ?? null,
            accumulatedMs: sessionData.accumulatedMs || 0,
            lastStartedAt: sessionData.lastStartedAt ?? null,
            initialKeybindingsCount: sessionData.initialKeybindingsCount ?? null,
            statsByExt: sessionData.statsByExt || {},
            keybindingsDiff: sessionData.keybindingsDiff ?? null,
        },
        serverNowMs: Date.now(),
    };
}
async function refreshStatsPanel(store) {
    if (!currentPanel) {
        return;
    }
    await currentPanel.webview.postMessage({
        type: "statsUpdate",
        payload: buildStatsPayload(store),
    });
}
async function openOrRevealStatsPanel(store, options) {
    await store.syncFromDisk();
    // パネル表示前に初期スナップショットがある場合は最新差分を自動同期
    if (store.getSessionData().initialKeybindingsCount) {
        void (0, keybindingsService_1.syncSessionKeybindingsDiff)(store);
    }
    if (currentPanel) {
        currentPanel.reveal(vscode.ViewColumn.One);
        await refreshStatsPanel(store);
        if (options?.initialMode || options?.openModal) {
            await currentPanel.webview.postMessage({
                type: "navigate",
                mode: options.initialMode,
                modal: options.openModal,
            });
        }
        return;
    }
    const mediaRoot = vscode.Uri.joinPath(store.context.extensionUri, "media");
    const panel = vscode.window.createWebviewPanel("shortcutStats", "ショートカット利用統計", vscode.ViewColumn.One, {
        enableScripts: true,
        localResourceRoots: [mediaRoot],
    });
    currentPanel = panel;
    const panelDisposables = [];
    let livePushTimer;
    let pendingPushWhileHidden = false;
    let pendingNavigation = options?.initialMode || options?.openModal
        ? { mode: options.initialMode, modal: options.openModal }
        : undefined;
    const pushNow = () => {
        if (!currentPanel) {
            return;
        }
        if (!currentPanel.visible) {
            pendingPushWhileHidden = true;
            return;
        }
        pendingPushWhileHidden = false;
        void currentPanel.webview.postMessage({
            type: "statsUpdate",
            payload: buildStatsPayload(store),
        });
    };
    const scheduleLivePush = () => {
        if (!currentPanel) {
            return;
        }
        if (!currentPanel.visible) {
            pendingPushWhileHidden = true;
            return;
        }
        if (livePushTimer !== undefined) {
            return;
        }
        livePushTimer = setTimeout(() => {
            livePushTimer = undefined;
            pushNow();
        }, LIVE_PUSH_INTERVAL_MS);
    };
    panelDisposables.push(store.onDidChange(scheduleLivePush));
    // パネルが開いている間に keybindings.json が保存されたら差分を自動再計算
    const userKbPath = (0, keybindingsService_1.getUserKeybindingsUri)()?.fsPath.toLowerCase();
    if (userKbPath) {
        panelDisposables.push(vscode.workspace.onDidSaveTextDocument((doc) => {
            if (doc.fileName.toLowerCase() === userKbPath) {
                void (0, keybindingsService_1.syncSessionKeybindingsDiff)(store);
            }
        }));
    }
    panel.onDidChangeViewState((e) => {
        if (e.webviewPanel.visible) {
            void store.syncFromDisk().then(() => {
                if (pendingPushWhileHidden) {
                    pushNow();
                }
                if (store.getSessionData().initialKeybindingsCount) {
                    void (0, keybindingsService_1.syncSessionKeybindingsDiff)(store);
                }
            });
        }
    }, null, panelDisposables);
    panel.onDidDispose(() => {
        if (livePushTimer !== undefined) {
            clearTimeout(livePushTimer);
            livePushTimer = undefined;
        }
        if (currentPanel === panel) {
            currentPanel = undefined;
        }
        while (panelDisposables.length > 0) {
            panelDisposables.pop()?.dispose();
        }
    }, null, panelDisposables);
    panel.webview.onDidReceiveMessage(async (message) => {
        switch (message.command) {
            case "ready": {
                await refreshStatsPanel(store);
                if (pendingNavigation) {
                    const nav = pendingNavigation;
                    pendingNavigation = undefined;
                    await panel.webview.postMessage({
                        type: "navigate",
                        mode: nav.mode,
                        modal: nav.modal,
                    });
                }
                break;
            }
            case "copyDirectText": {
                if (typeof message.text === "string" && message.text.length > 0) {
                    await vscode.env.clipboard.writeText(message.text);
                }
                if (typeof message.infoMessage === "string" && message.infoMessage) {
                    vscode.window.setStatusBarMessage(message.infoMessage, 3500);
                    await panel.webview.postMessage({
                        type: "toast",
                        kind: "success",
                        message: message.infoMessage,
                    });
                }
                break;
            }
            case "refresh": {
                await store.syncFromDisk();
                await (0, keybindingsService_1.syncSessionKeybindingsDiff)(store);
                await refreshStatsPanel(store);
                await panel.webview.postMessage({
                    type: "toast",
                    kind: "info",
                    message: "最新の統計・差分データに更新しました",
                });
                break;
            }
            case "startSession": {
                const res = await (0, sessionService_1.startOrResumeSession)(store, message.sessionName);
                await refreshStatsPanel(store);
                if (!res.alreadyActive) {
                    const label = res.isNewSession
                        ? res.snapshotCount
                            ? `セッション計測を開始しました（初期キーバインド ${res.snapshotCount.toLocaleString()} 件を自動記録）`
                            : "セッション計測を開始しました"
                        : "セッション計測を再開しました";
                    vscode.window.setStatusBarMessage(label, 3500);
                    await panel.webview.postMessage({
                        type: "toast",
                        kind: "success",
                        message: label,
                    });
                }
                break;
            }
            case "stopSession": {
                const paused = await (0, sessionService_1.pauseSession)(store);
                await refreshStatsPanel(store);
                if (paused) {
                    vscode.window.setStatusBarMessage("セッション計測を一時停止しました", 3000);
                    await panel.webview.postMessage({
                        type: "toast",
                        kind: "info",
                        message: "セッション計測を一時停止しました",
                    });
                }
                break;
            }
            case "updateSessionName": {
                if (typeof message.name === "string") {
                    await store.setSessionName(message.name);
                    await refreshStatsPanel(store);
                }
                break;
            }
            case "recalcDiff": {
                const diff = await (0, keybindingsService_1.syncSessionKeybindingsDiff)(store);
                await refreshStatsPanel(store);
                await panel.webview.postMessage({
                    type: "toast",
                    kind: "info",
                    message: diff
                        ? `キーバインド差分を再計算しました（変更 ${diff.diffs.length} 件）`
                        : "比較元となる初期キーバインドが記録されていません",
                });
                break;
            }
            case "browseExportDir": {
                const currentDir = typeof message.currentDir === "string" && message.currentDir.trim()
                    ? message.currentDir.trim()
                    : store.getLastExportDir();
                const picked = await vscode.window.showOpenDialog({
                    canSelectFiles: false,
                    canSelectFolders: true,
                    canSelectMany: false,
                    defaultUri: currentDir ? vscode.Uri.file(currentDir) : undefined,
                    title: "セッションデータの保存先フォルダを選択",
                    openLabel: "このフォルダを選択",
                });
                if (picked && picked.length > 0) {
                    const fsPath = picked[0].fsPath;
                    await store.setLastExportDir(fsPath);
                    await panel.webview.postMessage({
                        type: "exportDirPicked",
                        dirPath: fsPath,
                    });
                }
                break;
            }
            case "executeSessionExport": {
                try {
                    const opts = message.options;
                    const result = await (0, sessionService_1.executeSessionExport)(store, opts);
                    await refreshStatsPanel(store);
                    await panel.webview.postMessage({
                        type: "exportSessionResult",
                        ok: true,
                        outputDirPath: result.outputDirUri.fsPath,
                        primaryFilePath: result.primaryFileUri?.fsPath ?? null,
                        savedFiles: result.savedFiles,
                        resetPerformed: result.resetPerformed,
                    });
                }
                catch (err) {
                    await panel.webview.postMessage({
                        type: "exportSessionResult",
                        ok: false,
                        error: err instanceof Error
                            ? err.message
                            : "ファイルの保存中にエラーが発生しました。",
                    });
                }
                break;
            }
            case "openExportedPath": {
                if (typeof message.filePath === "string" && message.filePath) {
                    const uri = vscode.Uri.file(message.filePath);
                    if (message.revealInOs) {
                        await vscode.commands.executeCommand("revealFileInOS", uri);
                    }
                    else {
                        const doc = await vscode.workspace.openTextDocument(uri);
                        await vscode.window.showTextDocument(doc);
                    }
                }
                break;
            }
            case "browseImportFile": {
                const picked = await vscode.window.showOpenDialog({
                    canSelectFiles: true,
                    canSelectFolders: false,
                    canSelectMany: false,
                    filters: {
                        "JSON / JSONC": ["json", "jsonc"],
                    },
                    title: "インポートする統計JSONファイルを選択",
                    openLabel: "読み込む",
                });
                if (picked && picked.length > 0) {
                    try {
                        const bytes = await vscode.workspace.fs.readFile(picked[0]);
                        const text = new TextDecoder("utf-8").decode(bytes);
                        await panel.webview.postMessage({
                            type: "importFileLoaded",
                            fileName: picked[0].fsPath,
                            content: text,
                        });
                    }
                    catch {
                        await panel.webview.postMessage({
                            type: "importJsonResult",
                            ok: false,
                            error: "選択されたファイルを読み込めませんでした。",
                        });
                    }
                }
                break;
            }
            case "executeImportJson": {
                try {
                    const summary = await (0, sessionService_1.importStatsFromText)(store, String(message.rawJson || ""));
                    await refreshStatsPanel(store);
                    await panel.webview.postMessage({
                        type: "importJsonResult",
                        ok: true,
                        addedKeysCount: summary.addedKeysCount,
                        addedTotalCount: summary.addedTotalCount,
                    });
                }
                catch (err) {
                    await panel.webview.postMessage({
                        type: "importJsonResult",
                        ok: false,
                        error: err instanceof Error
                            ? err.message
                            : "インポートに失敗しました。",
                    });
                }
                break;
            }
            case "confirmResetSession": {
                await store.resetSession();
                await refreshStatsPanel(store);
                await panel.webview.postMessage({
                    type: "toast",
                    kind: "success",
                    message: "セッション計測データをリセットしました",
                });
                break;
            }
            case "confirmResetGlobal": {
                await store.resetAllStats();
                await refreshStatsPanel(store);
                await panel.webview.postMessage({
                    type: "toast",
                    kind: "success",
                    message: "累計統計データをすべて削除しました",
                });
                break;
            }
            case "copyJson":
                await vscode.commands.executeCommand("myTracker.copyStatsJson");
                await panel.webview.postMessage({
                    type: "toast",
                    kind: "success",
                    message: "累計統計のJSONデータをコピーしました",
                });
                break;
            case "copySessionJson":
                await vscode.commands.executeCommand("myTracker.copySessionJson");
                await panel.webview.postMessage({
                    type: "toast",
                    kind: "success",
                    message: "セッション統計のJSONデータをコピーしました",
                });
                break;
            case "copyKeybindingsDiffJson": {
                await (0, keybindingsService_1.syncSessionKeybindingsDiff)(store);
                const diff = store.getSessionData().keybindingsDiff;
                if (!diff) {
                    await panel.webview.postMessage({
                        type: "toast",
                        kind: "info",
                        message: "キーバインド差分データがありません",
                    });
                }
                else {
                    await vscode.env.clipboard.writeText(JSON.stringify(diff, null, 2));
                    await panel.webview.postMessage({
                        type: "toast",
                        kind: "success",
                        message: `キーバインド差分JSON（${diff.diffs.length} 件）をコピーしました`,
                    });
                }
                break;
            }
            case "copyTsv":
                if (options?.onCopyTsvFallback) {
                    await options.onCopyTsvFallback(message.tabType);
                }
                else {
                    await vscode.commands.executeCommand("myTracker.copyStatsTsv");
                }
                break;
            case "copySessionTsv":
                await vscode.commands.executeCommand("myTracker.copySessionTsv");
                break;
        }
    }, undefined, panelDisposables);
    panel.webview.html = await renderInitialHtml(store, panel.webview);
}
async function getHtmlTemplate(extensionUri) {
    if (cachedHtmlTemplate !== undefined) {
        return cachedHtmlTemplate;
    }
    const htmlUri = vscode.Uri.joinPath(extensionUri, "media", "stats.html");
    const bytes = await vscode.workspace.fs.readFile(htmlUri);
    cachedHtmlTemplate = new TextDecoder("utf-8").decode(bytes);
    return cachedHtmlTemplate;
}
async function renderInitialHtml(store, webview) {
    const extensionUri = store.context.extensionUri;
    const template = await getHtmlTemplate(extensionUri);
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, "media", "stats.css"));
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, "media", "stats.js"));
    const nonce = crypto.randomBytes(16).toString("base64");
    const safeInitialJson = JSON.stringify(buildStatsPayload(store)).replace(/</g, "\\u003c");
    const replacements = {
        CSP_SOURCE: webview.cspSource,
        NONCE: nonce,
        STYLE_URI: styleUri.toString(),
        SCRIPT_URI: scriptUri.toString(),
        INITIAL_JSON: safeInitialJson,
    };
    return template.replace(/\{\{([A-Z_]+)\}\}/g, (match, key) => Object.prototype.hasOwnProperty.call(replacements, key)
        ? replacements[key]
        : match);
}
//# sourceMappingURL=statsPanel.js.map
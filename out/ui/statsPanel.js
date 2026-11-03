"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isStatsPanelOpen = isStatsPanelOpen;
exports.refreshStatsPanel = refreshStatsPanel;
exports.openOrRevealStatsPanel = openOrRevealStatsPanel;
const crypto = require("crypto");
const vscode = require("vscode");
/**
 * Webview 表示中のリアルタイム反映スロットル間隔 (ms)
 */
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
        session: {
            isActive: Boolean(sessionData.isActive),
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
/**
 * 統計パネルが開いている場合、画面をリロードせずに JSON メッセージで差分レス更新する
 */
async function refreshStatsPanel(store) {
    if (!currentPanel) {
        return;
    }
    await currentPanel.webview.postMessage({
        type: "statsUpdate",
        payload: buildStatsPayload(store),
    });
}
async function openOrRevealStatsPanel(store, onCopyTsvFallback) {
    if (currentPanel) {
        currentPanel.reveal(vscode.ViewColumn.One);
        await refreshStatsPanel(store);
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
    // パネルが開いている間のみストア変更を購読し、リアルタイム反映する
    panelDisposables.push(store.onDidChange(scheduleLivePush));
    panel.onDidChangeViewState((e) => {
        if (e.webviewPanel.visible && pendingPushWhileHidden) {
            pushNow();
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
            case "ready":
                await refreshStatsPanel(store);
                break;
            case "copyDirectText":
                if (typeof message.text === "string") {
                    await vscode.env.clipboard.writeText(message.text);
                    if (typeof message.infoMessage === "string" && message.infoMessage) {
                        vscode.window.showInformationMessage(message.infoMessage);
                    }
                }
                break;
            case "copyJson":
                await vscode.commands.executeCommand("myTracker.copyStatsJson");
                break;
            case "copyTsv":
                if (onCopyTsvFallback) {
                    await onCopyTsvFallback(message.tabType);
                }
                else {
                    await vscode.commands.executeCommand("myTracker.copyStatsTsv");
                }
                break;
            case "refresh":
                await refreshStatsPanel(store);
                vscode.window.setStatusBarMessage("ショートカット統計を最新に更新しました", 2000);
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
                await vscode.commands.executeCommand("myTracker.copyKeybindingsDiffJson");
                break;
            case "exportSessionToDirectory":
                await vscode.commands.executeCommand("myTracker.exportSessionToDirectory");
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
    // 初回描画チラつきゼロのため初期JSONを埋め込み（</script> インジェクション防止エスケープ済み）
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
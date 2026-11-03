"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = require("vscode");
const statsStore_1 = require("./store/statsStore");
let activeStore;
/**
 * 拡張機能エントリポイント（高速起動設計）
 * - 起動時は最小限のストア生成とコマンド登録のみを同期実行（< 1ms）
 * - UI描画・JSONCパース・差分計算・エクスポート処理は必要時に動的 import で遅延ロード
 */
function activate(context) {
    const store = new statsStore_1.StatsStore(context);
    activeStore = store;
    let actionsModulePromise;
    const loadActions = () => {
        if (!actionsModulePromise) {
            actionsModulePromise = Promise.resolve().then(() => require("./commands/actions"));
        }
        return actionsModulePromise;
    };
    // 1. 汎用ラッパーコマンド（ホットパス: インメモリO(1)記録 + 即座に本来のコマンドを実行）
    const trackAndRun = vscode.commands.registerCommand("myTracker.trackAndRun", (args) => {
        if (!args || !args.keyName || !args.command) {
            return;
        }
        store.recordKey(args.keyName);
        const execution = args.commandArgs !== undefined
            ? vscode.commands.executeCommand(args.command, args.commandArgs)
            : vscode.commands.executeCommand(args.command);
        return execution.then(undefined, (error) => {
            console.error(`Command execution failed: ${args.command}`, error);
        });
    });
    // 2〜13. 各種操作コマンド（実行時にのみハンドラモジュールを遅延ロード）
    const registerLazyCommand = (commandId, pickHandler) => vscode.commands.registerCommand(commandId, async () => {
        const mod = await loadActions();
        await pickHandler(mod)(store);
    });
    context.subscriptions.push(trackAndRun, registerLazyCommand("myTracker.showStats", (m) => m.showStatsAction), registerLazyCommand("myTracker.copyStatsTsv", (m) => m.copyStatsTsvAction), registerLazyCommand("myTracker.copyStatsJson", (m) => m.copyStatsJsonAction), registerLazyCommand("myTracker.importStatsJson", (m) => m.importStatsJsonAction), registerLazyCommand("myTracker.resetStats", (m) => m.resetStatsAction), registerLazyCommand("myTracker.startSession", (m) => m.startSessionAction), registerLazyCommand("myTracker.stopSession", (m) => m.stopSessionAction), registerLazyCommand("myTracker.resetSession", (m) => m.resetSessionAction), registerLazyCommand("myTracker.copySessionJson", (m) => m.copySessionJsonAction), registerLazyCommand("myTracker.copySessionTsv", (m) => m.copySessionTsvAction), registerLazyCommand("myTracker.copyKeybindingsDiffJson", (m) => m.copyKeybindingsDiffJsonAction), registerLazyCommand("myTracker.exportSessionToDirectory", (m) => m.exportSessionToDirectoryAction));
}
function deactivate() {
    return activeStore?.flush();
}
//# sourceMappingURL=extension.js.map
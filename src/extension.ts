import * as vscode from "vscode";
import { StatsStore } from "./store/statsStore";
import type { TrackArgs } from "./types";

export type {
  ExportDataV2,
  ExtensionStats,
  KeybindingDiffEntry,
  KeybindingsDiffResult,
  SessionData,
  StatsByExtension,
} from "./types";

let activeStore: StatsStore | undefined;

function buildTrackedKeyName(args: TrackArgs): string {
  const defaultName = Array.isArray(args.command)
    ? "runCommands"
    : args.command;
  const baseName = args.keyName || defaultName;
  const withSuffix = args.nameSuffix
    ? `${baseName}:${args.nameSuffix}`
    : baseName;
  return args.key ? `${withSuffix} (${args.key})` : withSuffix;
}

/**
 * 拡張機能エントリポイント（高速起動設計）
 * - 起動時は最小限のストア生成とコマンド登録のみを同期実行（< 1ms）
 * - UI描画・JSONCパース・差分計算・エクスポート処理は必要時に動的 import で遅延ロード
 */
export function activate(context: vscode.ExtensionContext): void {
  const store = new StatsStore(context);
  activeStore = store;

  // 起動完了後の次ティックで、前回計測中だったセッションの再開時刻補正を非同期で行う（activate自体は0msで完了）
  setImmediate(() => {
    store.initializeBackgroundSessionState();
  });

  let actionsModulePromise:
    | Promise<typeof import("./commands/actions")>
    | undefined;
  const loadActions = () => {
    if (!actionsModulePromise) {
      actionsModulePromise = import("./commands/actions");
    }
    return actionsModulePromise;
  };

  // 1. 汎用ラッパーコマンド（ホットパス: インメモリO(1)記録 + 即座に本来のコマンドを実行）
  const trackAndRun = vscode.commands.registerCommand(
    "myTracker.trackAndRun",
    (args: TrackArgs) => {
      if (
        !args ||
        (typeof args.command !== "string" && !Array.isArray(args.command)) ||
        args.command === ""
      ) {
        return;
      }

      store.recordKey(buildTrackedKeyName(args));

      const execution = Array.isArray(args.command)
        ? vscode.commands.executeCommand("runCommands", {
            commands: args.command,
          })
        : args.commandArgs !== undefined
          ? vscode.commands.executeCommand(args.command, args.commandArgs)
          : vscode.commands.executeCommand(args.command);

      return execution.then(undefined, (error) => {
        console.error(`Command execution failed: ${args.command}`, error);
      });
    },
  );

  // 2〜13. 各種操作コマンド（実行時にのみハンドラモジュールを遅延ロード）
  const registerLazyCommand = (
    commandId: string,
    pickHandler: (
      mod: typeof import("./commands/actions"),
    ) => (s: StatsStore) => Promise<unknown>,
  ): vscode.Disposable =>
    vscode.commands.registerCommand(commandId, async () => {
      const mod = await loadActions();
      await pickHandler(mod)(store);
    });

  context.subscriptions.push(
    vscode.window.onDidChangeWindowState((e) => {
      if (e.focused) {
        void store.syncFromDisk();
      } else {
        void store.flush();
      }
    }),
    trackAndRun,
    registerLazyCommand("myTracker.showStats", (m) => m.showStatsAction),
    registerLazyCommand("myTracker.copyStatsTsv", (m) => m.copyStatsTsvAction),
    registerLazyCommand(
      "myTracker.copyStatsJson",
      (m) => m.copyStatsJsonAction,
    ),
    registerLazyCommand(
      "myTracker.importStatsJson",
      (m) => m.importStatsJsonAction,
    ),
    registerLazyCommand("myTracker.resetStats", (m) => m.resetStatsAction),
    registerLazyCommand("myTracker.startSession", (m) => m.startSessionAction),
    registerLazyCommand("myTracker.stopSession", (m) => m.stopSessionAction),
    registerLazyCommand("myTracker.resetSession", (m) => m.resetSessionAction),
    registerLazyCommand(
      "myTracker.copySessionJson",
      (m) => m.copySessionJsonAction,
    ),
    registerLazyCommand(
      "myTracker.copySessionTsv",
      (m) => m.copySessionTsvAction,
    ),
    registerLazyCommand(
      "myTracker.copyKeybindingsDiffJson",
      (m) => m.copyKeybindingsDiffJsonAction,
    ),
    registerLazyCommand(
      "myTracker.exportSessionToDirectory",
      (m) => m.exportSessionToDirectoryAction,
    ),
    registerLazyCommand(
      "myTracker.formatKeybindingsJson",
      (m) => m.formatKeybindingsJsonAction,
    ),
  );
}

export function deactivate(): Promise<void> | undefined {
  return activeStore?.shutdown();
}

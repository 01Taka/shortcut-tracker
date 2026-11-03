export interface TrackArgs {
  keyName: string;
  command: string;
  commandArgs?: unknown;
}

export interface ExtensionStats {
  shortcutStats: Record<string, number>;
  shortcutStatsNonConsecutive: Record<string, number>;
}

export type StatsByExtension = Record<string, ExtensionStats>;

export interface KeybindingDiffEntry {
  type: "added" | "removed" | "modified";
  key: string;
  command: string;
  when?: string;
  args?: any;
  before?: {
    command: string;
    when?: string;
    args?: any;
  };
}

export interface KeybindingsDiffResult {
  calculatedAt: string;
  initialCount: number;
  currentCount: number;
  addedCount: number;
  removedCount: number;
  modifiedCount: number;
  diffs: KeybindingDiffEntry[];
}

export interface ExportDataV2 {
  version: 2;
  exportedAt: string;
  byExtension: StatsByExtension;
  session?: {
    startedAt?: string;
    stoppedAt?: string;
    durationMs: number;
    initialKeybindingsCount?: number;
    keybindingsDiff?: KeybindingsDiffResult;
  };
}

export interface SessionData {
  isActive: boolean;
  startedAt?: string;
  stoppedAt?: string;
  accumulatedMs: number;
  lastStartedAt?: string;
  statsByExt: StatsByExtension;
  /**
   * @deprecated 新バージョンでは globalState 肥大化を防ぐため globalStorageUri 配下のファイルに保存。
   * 既存データからの自動マイグレーション互換用のオプショナルフィールド。
   */
  initialKeybindings?: any[];
  initialKeybindingsCount?: number;
  keybindingsDiff?: KeybindingsDiffResult;
}

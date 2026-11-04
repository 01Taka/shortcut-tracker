import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import type {
  KeybindingsDiffResult,
  SessionData,
  StatsByExtension,
} from "../types";

/**
 * 連続打鍵時のファイル・globalState 書き込みを間引くバッチ保存間隔 (ms)
 */
const FLUSH_INTERVAL_MS = 1500;

/**
 * 異常終了時に閉じていた時間が加算されるのを防ぐためのセッションハートビート間隔 (ms)
 */
const SESSION_HEARTBEAT_INTERVAL_MS = 60_000;

/**
 * ウィンドウ生存確認用ハートビート間隔 (ms)
 */
const WINDOW_HEARTBEAT_INTERVAL_MS = 15_000;

/**
 * ハートビートが途絶えたと判定するタイムアウト (ms)
 */
const WINDOW_HEARTBEAT_TIMEOUT_MS = 60_000;

/**
 * 複数ウィンドウ間でのフォールバック定期同期チェック間隔 (ms)
 * （通常は fs.watch とウィンドウフォーカス切替で即時同期される）
 */
const SYNC_POLL_INTERVAL_MS = 3000;

/**
 * クロスプロセス排他ロックのタイムアウト・孤立ロック破棄閾値 (ms)
 */
const LOCK_ACQUIRE_TIMEOUT_MS = 3000;
const STALE_LOCK_TIMEOUT_MS = 5000;

const SESSION_DATA_FILENAME = "session-data.json";
const STATS_DATA_FILENAME = "stats-data.json";
const STORAGE_LOCK_FILENAME = "storage.lock";
const ACTIVE_WINDOWS_DIRNAME = "active-windows";
const INITIAL_KEYBINDINGS_FILENAME = "session-initial-keybindings.json";

interface DocExtCacheEntry {
  fileName: string;
  languageId: string;
  ext: string;
}

interface WindowHeartbeatRecord {
  windowId: string;
  pid: number;
  createdAt: number;
  lastHeartbeat: number;
}

export interface SessionStatePatch {
  sessionId?: string | null;
  isActive?: boolean;
  name?: string | null;
  startedAt?: string | null;
  stoppedAt?: string | null;
  accumulatedMs?: number;
  lastStartedAt?: string | null;
  lastHeartbeatAt?: string | null;
  initialKeybindingsCount?: number | null;
  keybindingsDiff?: KeybindingsDiffResult | null;
  /** true の場合、statsByExt も空オブジェクト {} に初期化する */
  resetStats?: boolean;
}

function getSessionGenerationKey(session: {
  sessionId?: string;
  startedAt?: string;
}): string {
  return session.sessionId || session.startedAt || "";
}

function isProcessAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) {
    return false;
  }
  try {
    process.kill(pid, 0);
    return true;
  } catch (err: any) {
    return err?.code === "EPERM";
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cloneStatsByExt(source: StatsByExtension): StatsByExtension {
  const result: StatsByExtension = {};
  for (const [ext, data] of Object.entries(source)) {
    if (!data || typeof data !== "object") {
      continue;
    }
    result[ext] = {
      shortcutStats: { ...(data.shortcutStats || {}) },
      shortcutStatsNonConsecutive: {
        ...(data.shortcutStatsNonConsecutive || {}),
      },
      sequenceStats: data.sequenceStats ? { ...data.sequenceStats } : undefined,
    };
  }
  return result;
}

function hasAnyStatsEntries(stats: StatsByExtension): boolean {
  return Object.keys(stats).length > 0;
}

/**
 * target に対して delta のカウントを加算マージする（インプレース更新）
 */
function mergeStatsDelta(
  target: StatsByExtension,
  delta: StatsByExtension,
): void {
  for (const [ext, data] of Object.entries(delta)) {
    if (!data || typeof data !== "object") {
      continue;
    }
    let t = target[ext];
    if (!t) {
      t = {
        shortcutStats: {},
        shortcutStatsNonConsecutive: {},
        sequenceStats: {},
      };
      target[ext] = t;
    }
    if (data.shortcutStats) {
      for (const [k, v] of Object.entries(data.shortcutStats)) {
        if (v > 0) {
          t.shortcutStats[k] = (t.shortcutStats[k] || 0) + v;
        }
      }
    }
    if (data.shortcutStatsNonConsecutive) {
      for (const [k, v] of Object.entries(data.shortcutStatsNonConsecutive)) {
        if (v > 0) {
          t.shortcutStatsNonConsecutive[k] =
            (t.shortcutStatsNonConsecutive[k] || 0) + v;
        }
      }
    }
    if (data.sequenceStats) {
      if (!t.sequenceStats) {
        t.sequenceStats = {};
      }
      for (const [k, v] of Object.entries(data.sequenceStats)) {
        if (v > 0) {
          t.sequenceStats[k] = (t.sequenceStats[k] || 0) + v;
        }
      }
    }
  }
}

function mergeSessionPatches(
  base: SessionStatePatch | undefined,
  next: SessionStatePatch,
): SessionStatePatch {
  if (!base) {
    return { ...next };
  }
  const merged: SessionStatePatch = { ...base, ...next };
  if (base.resetStats || next.resetStats) {
    merged.resetStats = true;
  }
  return merged;
}

function applySessionPatch(target: SessionData, patch: SessionStatePatch): void {
  const assignOptional = <K extends keyof SessionData>(
    key: K,
    val: SessionData[K] | null | undefined,
  ) => {
    if (val === null || val === undefined) {
      delete target[key];
    } else {
      target[key] = val;
    }
  };

  if (Object.prototype.hasOwnProperty.call(patch, "sessionId")) {
    assignOptional("sessionId", patch.sessionId ?? undefined);
  }
  if (patch.isActive !== undefined) {
    target.isActive = patch.isActive;
  }
  if (Object.prototype.hasOwnProperty.call(patch, "name")) {
    assignOptional("name", patch.name ?? undefined);
  }
  if (Object.prototype.hasOwnProperty.call(patch, "startedAt")) {
    assignOptional("startedAt", patch.startedAt ?? undefined);
  }
  if (Object.prototype.hasOwnProperty.call(patch, "stoppedAt")) {
    assignOptional("stoppedAt", patch.stoppedAt ?? undefined);
  }
  if (patch.accumulatedMs !== undefined) {
    target.accumulatedMs = patch.accumulatedMs;
  }
  if (Object.prototype.hasOwnProperty.call(patch, "lastStartedAt")) {
    assignOptional("lastStartedAt", patch.lastStartedAt ?? undefined);
  }
  if (Object.prototype.hasOwnProperty.call(patch, "lastHeartbeatAt")) {
    assignOptional("lastHeartbeatAt", patch.lastHeartbeatAt ?? undefined);
  }
  if (Object.prototype.hasOwnProperty.call(patch, "initialKeybindingsCount")) {
    assignOptional(
      "initialKeybindingsCount",
      patch.initialKeybindingsCount ?? undefined,
    );
  }
  if (Object.prototype.hasOwnProperty.call(patch, "keybindingsDiff")) {
    assignOptional("keybindingsDiff", patch.keybindingsDiff ?? undefined);
  }
  if (patch.resetStats) {
    target.statsByExt = {};
  }
}

async function safeStatFile(
  filePath: string,
): Promise<{ mtimeMs: number; size: number } | undefined> {
  try {
    const st = await fs.promises.stat(filePath);
    return { mtimeMs: st.mtimeMs, size: st.size };
  } catch {
    return undefined;
  }
}

async function safeReadJsonFile<T>(filePath: string): Promise<T | undefined> {
  try {
    const raw = await fs.promises.readFile(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

async function safeWriteRawFile(
  filePath: string,
  content: string,
): Promise<{ mtimeMs: number; size: number } | undefined> {
  const dir = path.dirname(filePath);
  await fs.promises.mkdir(dir, { recursive: true });
  const tmpPath = `${filePath}.${process.pid}.${crypto.randomBytes(4).toString("hex")}.tmp`;
  try {
    await fs.promises.writeFile(tmpPath, content, "utf-8");
    try {
      await fs.promises.rename(tmpPath, filePath);
    } catch {
      await fs.promises.copyFile(tmpPath, filePath);
      await fs.promises.unlink(tmpPath).catch(() => {});
    }
  } catch {
    await fs.promises.unlink(tmpPath).catch(() => {});
    await fs.promises.writeFile(filePath, content, "utf-8");
  }
  return safeStatFile(filePath);
}

/**
 * 複数ウィンドウ同期・インメモリキャッシュ・遅延バッチ保存を備えた統計ストア
 * - activate() 時やキー打鍵時は同期ファイルI/Oを一切行わず、メモリ上の O(1) 加算のみで即座に完了
 * - クロスプロセス排他ロックとデルタ加算マージにより、複数ウィンドウで同時打鍵しても上書き消失（ロストアップデート）を防止
 * - セッションの状態変更と統計増分を分離し、世代管理（sessionId / startedAt）でリセット後の残骸混入を防止
 * - 複数ウィンドウのうち一部を閉じてもセッション計測を継続し、全ウィンドウ終了時のみ休止する
 */
export class StatsStore {
  public readonly windowId: string = crypto.randomUUID();
  private readonly createdAtMs: number = Date.now();

  private memoryInitialized = false;
  private backgroundInitPromise: Promise<void> | undefined;
  private isDisposed = false;

  private statsByExt: StatsByExtension = {};
  private lastTrackedKey: string | undefined;
  private lastTrackedTime: number | undefined;
  private sessionData: SessionData = {
    isActive: false,
    accumulatedMs: 0,
    statsByExt: {},
  };

  /**
   * 既存バージョン（globalStateのみ）からの初回マイグレーション用ベースデータ。
   * 共有ファイルが未作成だった初回のみ使用され、作成済みなら破棄される。
   */
  private migrationBaseStats: StatsByExtension | undefined;
  private migrationBaseSession: SessionData | undefined;

  /**
   * このウィンドウで発生し、まだディスクへフラッシュされていない未コミットの増分・状態変更
   */
  private deltaStatsByExt: StatsByExtension = {};
  private deltaSessionStatsByExt: StatsByExtension = {};
  private deltaSessionGen: string = "";
  private pendingSessionPatch: SessionStatePatch | undefined;
  private pendingHeartbeatAt: string | undefined;

  private statsResetEpoch = 0;
  private sessionResetEpoch = 0;

  /**
   * 初期キーバインドのメモリキャッシュ（セッション世代と件数に紐付けて管理）
   */
  private cachedInitialKbItems: any[] | null | undefined = undefined;
  private cachedInitialKbGen: string | undefined = undefined;
  private cachedInitialKbCount: number | undefined = undefined;

  /**
   * ディスク上の最終同期状態（不要なファイル再読込・JSONパース・UI再描画を防ぐ）
   */
  private lastSyncedStatsMtimeMs = 0;
  private lastSyncedStatsSize = -1;
  private lastSyncedStatsRaw = "";
  private lastSyncedSessionMtimeMs = 0;
  private lastSyncedSessionSize = -1;
  private lastSyncedSessionRaw = "";

  private dirtyStats = false;
  private dirtyLastKey = false;
  private dirtySession = false;

  private flushTimer: ReturnType<typeof setTimeout> | undefined;
  private heartbeatTimer: ReturnType<typeof setInterval> | undefined;
  private windowHeartbeatTimer: ReturnType<typeof setInterval> | undefined;
  private syncPollTimer: ReturnType<typeof setInterval> | undefined;
  private syncDebounceTimer: ReturnType<typeof setTimeout> | undefined;
  private fileWatcher: fs.FSWatcher | undefined;

  /**
   * プロセス内の全ディスクI/O操作（flush / sync / reset / shutdown）を直列化するキュー
   */
  private ioQueue: Promise<void> = Promise.resolve();
  private pendingSyncPromise: Promise<void> | undefined;

  private readonly docExtCache = new WeakMap<
    vscode.TextDocument,
    DocExtCacheEntry
  >();
  private readonly changeListeners = new Set<() => void>();

  constructor(public readonly context: vscode.ExtensionContext) {}

  private get globalStorageDir(): string {
    return this.context.globalStorageUri.fsPath;
  }

  private get statsFilePath(): string {
    return path.join(this.globalStorageDir, STATS_DATA_FILENAME);
  }

  private get sessionFilePath(): string {
    return path.join(this.globalStorageDir, SESSION_DATA_FILENAME);
  }

  private get lockFilePath(): string {
    return path.join(this.globalStorageDir, STORAGE_LOCK_FILENAME);
  }

  private get activeWindowsDir(): string {
    return path.join(this.globalStorageDir, ACTIVE_WINDOWS_DIRNAME);
  }

  private get myWindowHeartbeatPath(): string {
    return path.join(this.activeWindowsDir, `${this.windowId}.json`);
  }

  /**
   * 統計データの変更通知を購読する（パネルが開いている間のみ登録される軽量リスナー）
   */
  public onDidChange(listener: () => void): vscode.Disposable {
    this.changeListeners.add(listener);
    return new vscode.Disposable(() => {
      this.changeListeners.delete(listener);
    });
  }

  private notifyChanged(): void {
    if (this.changeListeners.size === 0) {
      return;
    }
    for (const listener of this.changeListeners) {
      try {
        listener();
      } catch (error) {
        console.error("StatsStore change listener error", error);
      }
    }
  }

  private enqueueIo<T>(task: () => Promise<T>): Promise<T> {
    const run = this.ioQueue.then(task, task);
    this.ioQueue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  /**
   * 複数ウィンドウ間で Read-Modify-Write の競合を防ぐ軽量ファイルロック
   */
  private async withStorageLock<T>(fn: () => Promise<T>): Promise<T> {
    await fs.promises.mkdir(this.globalStorageDir, { recursive: true });
    const deadline = Date.now() + LOCK_ACQUIRE_TIMEOUT_MS;
    let acquired = false;

    while (Date.now() < deadline) {
      try {
        const fh = await fs.promises.open(this.lockFilePath, "wx");
        await fh.close();
        acquired = true;
        break;
      } catch (err: any) {
        if (err?.code === "EEXIST") {
          const st = await safeStatFile(this.lockFilePath);
          if (st && Date.now() - st.mtimeMs > STALE_LOCK_TIMEOUT_MS) {
            await fs.promises.unlink(this.lockFilePath).catch(() => {});
            continue;
          }
          await sleep(15 + Math.floor(Math.random() * 25));
          continue;
        }
        if (err?.code === "ENOENT") {
          await fs.promises.mkdir(this.globalStorageDir, { recursive: true });
          continue;
        }
        break;
      }
    }

    try {
      return await fn();
    } finally {
      if (acquired) {
        await fs.promises.unlink(this.lockFilePath).catch(() => {});
      }
    }
  }

  /**
   * 同期ファイルI/Oを一切行わず、globalState のインメモリキャッシュから初期状態を即座に構築する
   */
  private ensureMemoryInitialized(): void {
    if (this.memoryInitialized) {
      return;
    }
    this.memoryInitialized = true;

    let storedStats =
      this.context.globalState.get<StatsByExtension>("shortcutStatsByExt");
    if (!storedStats || typeof storedStats !== "object") {
      storedStats = {};
      const oldTotal =
        this.context.globalState.get<Record<string, number>>("shortcutStats");
      const oldNonConsecutive = this.context.globalState.get<
        Record<string, number>
      >("shortcutStatsNonConsecutive");

      if (oldTotal && Object.keys(oldTotal).length > 0) {
        storedStats["(legacy)"] = {
          shortcutStats: { ...oldTotal },
          shortcutStatsNonConsecutive: {
            ...(oldNonConsecutive || oldTotal),
          },
        };
      }
    }
    this.statsByExt = cloneStatsByExt(storedStats);
    if (hasAnyStatsEntries(this.statsByExt)) {
      this.migrationBaseStats = cloneStatsByExt(this.statsByExt);
    }

    this.lastTrackedKey =
      this.context.globalState.get<string>("lastTrackedKey");

    const rawSession = this.context.globalState.get<SessionData>("sessionData");
    if (rawSession && typeof rawSession === "object" && rawSession.statsByExt) {
      let legacyKb: any[] | undefined;
      if (
        Array.isArray(rawSession.initialKeybindings) &&
        rawSession.initialKeybindings.length > 0
      ) {
        legacyKb = rawSession.initialKeybindings;
      }
      const normalizedSession: SessionData = {
        ...rawSession,
        statsByExt: cloneStatsByExt(rawSession.statsByExt),
        initialKeybindings: undefined,
        initialKeybindingsCount:
          rawSession.initialKeybindingsCount ?? legacyKb?.length,
      };
      this.sessionData = normalizedSession;
      this.migrationBaseSession = {
        ...normalizedSession,
        statsByExt: cloneStatsByExt(normalizedSession.statsByExt),
      };
      if (legacyKb) {
        const gen = getSessionGenerationKey(normalizedSession);
        this.cachedInitialKbItems = legacyKb;
        this.cachedInitialKbGen = gen;
        this.cachedInitialKbCount = legacyKb.length;
        void this.migrateLegacyInitialKeybindings(legacyKb);
      }
    } else {
      this.sessionData = {
        isActive: false,
        accumulatedMs: 0,
        statsByExt: {},
      };
    }

    this.deltaSessionGen = getSessionGenerationKey(this.sessionData);

    if (!this.isDisposed) {
      void this.ensureBackgroundReady();
    }
  }

  /**
   * 起動直後の次ティックで呼び出し、バックグラウンドで共有ストレージとの同期とセッション復旧を開始する
   */
  public initializeBackgroundSessionState(): void {
    this.ensureMemoryInitialized();
    void this.ensureBackgroundReady();
  }

  private ensureBackgroundReady(): Promise<void> {
    if (this.backgroundInitPromise) {
      return this.backgroundInitPromise;
    }

    this.backgroundInitPromise = this.enqueueIo(async () => {
      if (this.isDisposed) {
        return;
      }

      try {
        await fs.promises.mkdir(this.activeWindowsDir, { recursive: true });
        await this.writeMyWindowHeartbeat();

        let stateChanged = false;

        await this.withStorageLock(async () => {
          const otherActiveWindows = await this.countOtherActiveWindows();

          // 1. 累計統計ファイルの初期同期またはマイグレーション
          const statsStat = await safeStatFile(this.statsFilePath);
          if (statsStat) {
            this.migrationBaseStats = undefined;
            const raw = await fs.promises.readFile(this.statsFilePath, "utf-8");
            const parsed = JSON.parse(raw) as StatsByExtension;
            if (parsed && typeof parsed === "object") {
              this.lastSyncedStatsMtimeMs = statsStat.mtimeMs;
              this.lastSyncedStatsSize = statsStat.size;
              this.lastSyncedStatsRaw = raw;
              const merged = cloneStatsByExt(parsed);
              mergeStatsDelta(merged, this.deltaStatsByExt);
              this.statsByExt = merged;
              stateChanged = true;
            }
          } else if (this.migrationBaseStats) {
            const initialDiskStats = cloneStatsByExt(this.migrationBaseStats);
            this.migrationBaseStats = undefined;
            const raw = JSON.stringify(initialDiskStats);
            const st = await safeWriteRawFile(this.statsFilePath, raw);
            this.lastSyncedStatsRaw = raw;
            this.lastSyncedStatsMtimeMs = st?.mtimeMs ?? 0;
            this.lastSyncedStatsSize = st?.size ?? -1;
          }

          // 2. セッションファイルの初期同期・マイグレーション・異常終了/再起動リカバリ
          let diskSession: SessionData | undefined;
          const sessionStat = await safeStatFile(this.sessionFilePath);
          if (sessionStat) {
            this.migrationBaseSession = undefined;
            const raw = await fs.promises.readFile(
              this.sessionFilePath,
              "utf-8",
            );
            const parsed = JSON.parse(raw) as SessionData;
            if (parsed && typeof parsed === "object") {
              diskSession = parsed;
              this.lastSyncedSessionMtimeMs = sessionStat.mtimeMs;
              this.lastSyncedSessionSize = sessionStat.size;
              this.lastSyncedSessionRaw = raw;
            }
          } else if (this.migrationBaseSession) {
            diskSession = {
              ...this.migrationBaseSession,
              statsByExt: cloneStatsByExt(
                this.migrationBaseSession.statsByExt || {},
              ),
            };
            this.migrationBaseSession = undefined;
          }

          if (diskSession) {
            let needsSessionSave = !sessionStat;

            // 他に稼働中のウィンドウが存在せず（全ウィンドウ終了後の初回起動）、
            // 前回「計測中」のまま終了していた場合は閉鎖時間を除外して現在時刻から自動再開する
            if (otherActiveWindows === 0 && diskSession.isActive) {
              const nowIso = new Date().toISOString();
              if (diskSession.lastStartedAt) {
                const startMs = new Date(diskSession.lastStartedAt).getTime();
                const hbMs = diskSession.lastHeartbeatAt
                  ? new Date(diskSession.lastHeartbeatAt).getTime()
                  : startMs;
                if (!isNaN(startMs) && !isNaN(hbMs) && hbMs > startMs) {
                  diskSession.accumulatedMs =
                    (diskSession.accumulatedMs || 0) + (hbMs - startMs);
                }
              }
              diskSession.lastStartedAt = nowIso;
              diskSession.lastHeartbeatAt = nowIso;
              needsSessionSave = true;
            }

            if (needsSessionSave) {
              const raw = JSON.stringify(diskSession);
              const st = await safeWriteRawFile(this.sessionFilePath, raw);
              this.lastSyncedSessionRaw = raw;
              this.lastSyncedSessionMtimeMs = st?.mtimeMs ?? 0;
              this.lastSyncedSessionSize = st?.size ?? -1;
            }

            this.applyDiskSessionToMemory(diskSession);
            stateChanged = true;
          }
        });

        if (this.isDisposed) {
          return;
        }

        // 各種バックグラウンド監視の開始
        this.windowHeartbeatTimer = setInterval(() => {
          void this.writeMyWindowHeartbeat();
          void this.cleanupStaleWindows();
        }, WINDOW_HEARTBEAT_INTERVAL_MS);
        this.windowHeartbeatTimer.unref?.();

        this.syncHeartbeatTimer();
        this.setupFileWatcher();

        this.syncPollTimer = setInterval(() => {
          if (vscode.window.state.focused || this.changeListeners.size > 0) {
            void this.syncFromDisk();
          }
        }, SYNC_POLL_INTERVAL_MS);
        this.syncPollTimer.unref?.();

        if (stateChanged) {
          this.notifyChanged();
        }
      } catch (err) {
        console.error("Failed to initialize background session state", err);
      }
    });

    return this.backgroundInitPromise;
  }

  private applyDiskSessionToMemory(diskSession: SessionData): void {
    const mergedSessionStats = cloneStatsByExt(diskSession.statsByExt || {});
    const working: SessionData = {
      ...diskSession,
      statsByExt: mergedSessionStats,
    };

    if (this.pendingSessionPatch) {
      applySessionPatch(working, this.pendingSessionPatch);
    }

    const effectiveGen = getSessionGenerationKey(working);
    if (this.deltaSessionGen !== effectiveGen) {
      // 別ウィンドウでセッションがリセットまたは新規開始された場合は古い世代の未保存デルタを破棄
      this.deltaSessionStatsByExt = {};
      this.deltaSessionGen = effectiveGen;
    }

    if (!this.pendingSessionPatch?.resetStats) {
      mergeStatsDelta(working.statsByExt, this.deltaSessionStatsByExt);
    }

    const prevActive = this.sessionData.isActive;
    this.sessionData = working;
    if (prevActive !== this.sessionData.isActive) {
      this.syncHeartbeatTimer();
    }
  }

  private async writeMyWindowHeartbeat(): Promise<void> {
    if (this.isDisposed) {
      return;
    }
    const record: WindowHeartbeatRecord = {
      windowId: this.windowId,
      pid: process.pid,
      createdAt: this.createdAtMs,
      lastHeartbeat: Date.now(),
    };
    try {
      await safeWriteRawFile(
        this.myWindowHeartbeatPath,
        JSON.stringify(record),
      );
    } catch {}
  }

  private isWindowRecordAlive(
    data: WindowHeartbeatRecord | undefined,
    now: number,
  ): boolean {
    if (!data || !data.windowId || !data.lastHeartbeat) {
      return false;
    }
    if (!isProcessAlive(data.pid)) {
      return false;
    }
    if (now - data.lastHeartbeat > WINDOW_HEARTBEAT_TIMEOUT_MS) {
      return false;
    }
    return true;
  }

  private async cleanupStaleWindows(): Promise<void> {
    try {
      const entries = await fs.promises.readdir(this.activeWindowsDir);
      const now = Date.now();
      for (const entry of entries) {
        if (!entry.endsWith(".json") || entry === `${this.windowId}.json`) {
          continue;
        }
        const filePath = path.join(this.activeWindowsDir, entry);
        const data = await safeReadJsonFile<WindowHeartbeatRecord>(filePath);
        if (!this.isWindowRecordAlive(data, now)) {
          await fs.promises.unlink(filePath).catch(() => {});
        }
      }
    } catch {}
  }

  /**
   * 自分自身を除いた、現在生存中の他ウィンドウ数を返す（0以上の整数）
   */
  private async countOtherActiveWindows(): Promise<number> {
    try {
      const entries = await fs.promises.readdir(this.activeWindowsDir);
      const now = Date.now();
      let otherCount = 0;
      for (const entry of entries) {
        if (!entry.endsWith(".json") || entry === `${this.windowId}.json`) {
          continue;
        }
        const filePath = path.join(this.activeWindowsDir, entry);
        const data = await safeReadJsonFile<WindowHeartbeatRecord>(filePath);
        if (this.isWindowRecordAlive(data, now)) {
          otherCount++;
        } else {
          await fs.promises.unlink(filePath).catch(() => {});
        }
      }
      return otherCount;
    } catch {
      return 0;
    }
  }

  private setupFileWatcher(): void {
    try {
      this.fileWatcher = fs.watch(
        this.globalStorageDir,
        (_event, filename) => {
          if (this.isDisposed) {
            return;
          }
          if (filename) {
            const base = path.basename(filename);
            if (
              base !== SESSION_DATA_FILENAME &&
              base !== STATS_DATA_FILENAME
            ) {
              return;
            }
          }
          if (this.syncDebounceTimer !== undefined) {
            return;
          }
          this.syncDebounceTimer = setTimeout(() => {
            this.syncDebounceTimer = undefined;
            void this.syncFromDisk();
          }, 40);
          this.syncDebounceTimer.unref?.();
        },
      );
    } catch (err) {
      console.error("Failed to start storage file watcher", err);
    }
  }

  /**
   * ディスクから最新の統計およびセッションデータを同期し、ローカルの未保存増分（デルタ）と合算する。
   * ファイルの mtime / size / 内容に変化がない場合は JSON パースも UI 通知も行わない。
   */
  public syncFromDisk(): Promise<void> {
    if (this.isDisposed) {
      return Promise.resolve();
    }
    this.ensureMemoryInitialized();

    if (this.pendingSyncPromise) {
      return this.pendingSyncPromise;
    }

    const p = this.enqueueIo(async () => {
      this.pendingSyncPromise = undefined;
      if (this.isDisposed) {
        return;
      }

      try {
        let changed = false;

        // 1. 累計統計ファイルの差分検知・同期
        const statsStat = await safeStatFile(this.statsFilePath);
        if (
          statsStat &&
          (statsStat.mtimeMs !== this.lastSyncedStatsMtimeMs ||
            statsStat.size !== this.lastSyncedStatsSize)
        ) {
          const raw = await fs.promises
            .readFile(this.statsFilePath, "utf-8")
            .catch(() => undefined);
          if (raw !== undefined) {
            this.lastSyncedStatsMtimeMs = statsStat.mtimeMs;
            this.lastSyncedStatsSize = statsStat.size;
            if (raw !== this.lastSyncedStatsRaw) {
              try {
                const diskStats = JSON.parse(raw) as StatsByExtension;
                if (diskStats && typeof diskStats === "object") {
                  this.lastSyncedStatsRaw = raw;
                  this.migrationBaseStats = undefined;
                  const merged = cloneStatsByExt(diskStats);
                  mergeStatsDelta(merged, this.deltaStatsByExt);
                  this.statsByExt = merged;
                  changed = true;
                }
              } catch {
                // 書き込み途中の競合等でパース失敗した場合は次回同期に委ねる
              }
            }
          }
        }

        // 2. セッションデータファイルの差分検知・同期
        const sessionStat = await safeStatFile(this.sessionFilePath);
        if (
          sessionStat &&
          (sessionStat.mtimeMs !== this.lastSyncedSessionMtimeMs ||
            sessionStat.size !== this.lastSyncedSessionSize)
        ) {
          const raw = await fs.promises
            .readFile(this.sessionFilePath, "utf-8")
            .catch(() => undefined);
          if (raw !== undefined) {
            this.lastSyncedSessionMtimeMs = sessionStat.mtimeMs;
            this.lastSyncedSessionSize = sessionStat.size;
            if (raw !== this.lastSyncedSessionRaw) {
              try {
                const diskSession = JSON.parse(raw) as SessionData;
                if (diskSession && typeof diskSession === "object") {
                  this.lastSyncedSessionRaw = raw;
                  this.migrationBaseSession = undefined;
                  this.applyDiskSessionToMemory(diskSession);
                  changed = true;
                }
              } catch {
                // 次回同期に委ねる
              }
            }
          }
        }

        if (changed) {
          this.notifyChanged();
        }
      } catch (err) {
        console.error("Failed in syncFromDisk", err);
      }
    });

    this.pendingSyncPromise = p;
    return p;
  }

  private syncHeartbeatTimer(): void {
    if (this.sessionData.isActive && !this.isDisposed) {
      if (this.heartbeatTimer === undefined) {
        this.heartbeatTimer = setInterval(() => {
          if (!this.sessionData.isActive || this.isDisposed) {
            return;
          }
          // 他ウィンドウが直近でハートビート更新済みなら無駄なディスク書き込みをスキップ
          const lastHbMs = this.sessionData.lastHeartbeatAt
            ? Date.parse(this.sessionData.lastHeartbeatAt)
            : 0;
          if (
            !isNaN(lastHbMs) &&
            lastHbMs > 0 &&
            Date.now() - lastHbMs < SESSION_HEARTBEAT_INTERVAL_MS - 5000
          ) {
            return;
          }
          const nowIso = new Date().toISOString();
          this.sessionData.lastHeartbeatAt = nowIso;
          this.pendingHeartbeatAt = nowIso;
          this.dirtySession = true;
          this.scheduleFlush();
        }, SESSION_HEARTBEAT_INTERVAL_MS);
        this.heartbeatTimer.unref?.();
      }
    } else if (this.heartbeatTimer !== undefined) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
  }

  private async migrateLegacyInitialKeybindings(items: any[]): Promise<void> {
    try {
      await this.writeInitialKeybindingsFile(items);
      this.dirtySession = true;
      await this.flush();
    } catch (error) {
      console.error(
        "Failed to migrate initialKeybindings out of globalState",
        error,
      );
    }
  }

  private getActiveFileExtension(): string {
    const doc = vscode.window.activeTextEditor?.document;
    if (!doc) {
      return "(none)";
    }

    const fileName = doc.fileName;
    const languageId = doc.languageId;
    const cached = this.docExtCache.get(doc);
    if (
      cached &&
      cached.fileName === fileName &&
      cached.languageId === languageId
    ) {
      return cached.ext;
    }

    const rawExt = path.extname(fileName).toLowerCase();
    const ext = rawExt || (languageId ? languageId.toLowerCase() : "(no-ext)");
    this.docExtCache.set(doc, { fileName, languageId, ext });
    return ext;
  }

  /**
   * キー入力をインメモリで即座（O(1)・非ブロッキング）に記録し、バックグラウンド保存を予約する
   */
  public recordKey(keyName: string): void {
    this.ensureMemoryInitialized();

    const now = Date.now();
    const ext = this.getActiveFileExtension();
    const isConsecutive = this.lastTrackedKey === keyName;

    // キー組み合わせ（シーケンス）の判定
    let seqKey: string | undefined;
    if (this.lastTrackedKey && this.lastTrackedTime !== undefined) {
      const timeoutMs =
        vscode.workspace
          .getConfiguration("shortcutTracker")
          .get<number>("sequenceTimeoutMs", 2000) || 2000;
      if (now - this.lastTrackedTime <= timeoutMs) {
        seqKey = `${this.lastTrackedKey} -> ${keyName}`;
      }
    }

    this.lastTrackedKey = keyName;
    this.lastTrackedTime = now;
    this.dirtyLastKey = true;

    // 1. 累計統計のローカル加算 & デルタ加算
    let extStats = this.statsByExt[ext];
    if (!extStats) {
      extStats = {
        shortcutStats: {},
        shortcutStatsNonConsecutive: {},
        sequenceStats: {},
      };
      this.statsByExt[ext] = extStats;
    }
    extStats.shortcutStats[keyName] =
      (extStats.shortcutStats[keyName] || 0) + 1;
    if (!isConsecutive) {
      extStats.shortcutStatsNonConsecutive[keyName] =
        (extStats.shortcutStatsNonConsecutive[keyName] || 0) + 1;
    }
    if (seqKey) {
      if (!extStats.sequenceStats) {
        extStats.sequenceStats = {};
      }
      extStats.sequenceStats[seqKey] =
        (extStats.sequenceStats[seqKey] || 0) + 1;
    }

    let deltaExt = this.deltaStatsByExt[ext];
    if (!deltaExt) {
      deltaExt = {
        shortcutStats: {},
        shortcutStatsNonConsecutive: {},
        sequenceStats: {},
      };
      this.deltaStatsByExt[ext] = deltaExt;
    }
    deltaExt.shortcutStats[keyName] =
      (deltaExt.shortcutStats[keyName] || 0) + 1;
    if (!isConsecutive) {
      deltaExt.shortcutStatsNonConsecutive[keyName] =
        (deltaExt.shortcutStatsNonConsecutive[keyName] || 0) + 1;
    }
    if (seqKey) {
      if (!deltaExt.sequenceStats) {
        deltaExt.sequenceStats = {};
      }
      deltaExt.sequenceStats[seqKey] =
        (deltaExt.sequenceStats[seqKey] || 0) + 1;
    }
    this.dirtyStats = true;

    // 2. セッション計測中の場合のローカル加算 & 世代付きデルタ加算
    if (this.sessionData.isActive) {
      const currentGen = getSessionGenerationKey(this.sessionData);
      if (this.deltaSessionGen !== currentGen) {
        this.deltaSessionStatsByExt = {};
        this.deltaSessionGen = currentGen;
      }

      let sessionExt = this.sessionData.statsByExt[ext];
      if (!sessionExt) {
        sessionExt = {
          shortcutStats: {},
          shortcutStatsNonConsecutive: {},
          sequenceStats: {},
        };
        this.sessionData.statsByExt[ext] = sessionExt;
      }
      sessionExt.shortcutStats[keyName] =
        (sessionExt.shortcutStats[keyName] || 0) + 1;
      if (!isConsecutive) {
        sessionExt.shortcutStatsNonConsecutive[keyName] =
          (sessionExt.shortcutStatsNonConsecutive[keyName] || 0) + 1;
      }
      if (seqKey) {
        if (!sessionExt.sequenceStats) {
          sessionExt.sequenceStats = {};
        }
        sessionExt.sequenceStats[seqKey] =
          (sessionExt.sequenceStats[seqKey] || 0) + 1;
      }

      let deltaSessionExt = this.deltaSessionStatsByExt[ext];
      if (!deltaSessionExt) {
        deltaSessionExt = {
          shortcutStats: {},
          shortcutStatsNonConsecutive: {},
          sequenceStats: {},
        };
        this.deltaSessionStatsByExt[ext] = deltaSessionExt;
      }
      deltaSessionExt.shortcutStats[keyName] =
        (deltaSessionExt.shortcutStats[keyName] || 0) + 1;
      if (!isConsecutive) {
        deltaSessionExt.shortcutStatsNonConsecutive[keyName] =
          (deltaSessionExt.shortcutStatsNonConsecutive[keyName] || 0) + 1;
      }
      if (seqKey) {
        if (!deltaSessionExt.sequenceStats) {
          deltaSessionExt.sequenceStats = {};
        }
        deltaSessionExt.sequenceStats[seqKey] =
          (deltaSessionExt.sequenceStats[seqKey] || 0) + 1;
      }

      const nowIso = new Date().toISOString();
      this.sessionData.lastHeartbeatAt = nowIso;
      this.pendingHeartbeatAt = nowIso;
      this.dirtySession = true;
    }

    this.scheduleFlush();
    this.notifyChanged();
  }

  public getStatsByExt(): StatsByExtension {
    this.ensureMemoryInitialized();
    return this.statsByExt;
  }

  public getLastTrackedKey(): string | undefined {
    this.ensureMemoryInitialized();
    return this.lastTrackedKey;
  }

  public getSessionData(): SessionData {
    this.ensureMemoryInitialized();
    return this.sessionData;
  }

  public getLastExportDir(): string | undefined {
    return (
      this.context.globalState.get<string>("lastSessionExportDir") ||
      vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
    );
  }

  public async setLastExportDir(dirPath: string): Promise<void> {
    await this.context.globalState.update("lastSessionExportDir", dirPath);
  }

  /**
   * セッションのメタデータ・ライフサイクル状態のみを部分更新し、即時フラッシュする。
   * （他ウィンドウの statsByExt を上書き破壊しない安全な更新メソッド）
   */
  public async updateSessionState(patch: SessionStatePatch): Promise<void> {
    this.ensureMemoryInitialized();

    const prevGen = getSessionGenerationKey(this.sessionData);
    applySessionPatch(this.sessionData, patch);
    const nextGen = getSessionGenerationKey(this.sessionData);

    if (patch.resetStats || prevGen !== nextGen) {
      this.deltaSessionStatsByExt = {};
      this.deltaSessionGen = nextGen;
    }

    this.pendingSessionPatch = mergeSessionPatches(
      this.pendingSessionPatch,
      patch,
    );
    this.syncHeartbeatTimer();
    this.dirtySession = true;
    this.notifyChanged();
    await this.flush();
  }

  public async setSessionName(name: string): Promise<void> {
    const trimmed = name.trim();
    const newName = trimmed.length > 0 ? trimmed : null;
    await this.updateSessionState({ name: newName });
  }

  /**
   * 外部JSONからインポートされた統計増分をデルタとして安全に合算し、即時フラッシュする
   */
  public async addImportedStats(importedDelta: StatsByExtension): Promise<void> {
    this.ensureMemoryInitialized();
    mergeStatsDelta(this.statsByExt, importedDelta);
    mergeStatsDelta(this.deltaStatsByExt, importedDelta);
    this.dirtyStats = true;
    this.notifyChanged();
    await this.flush();
  }

  public async markStatsModified(): Promise<void> {
    this.ensureMemoryInitialized();
    this.dirtyStats = true;
    this.notifyChanged();
    await this.flush();
  }

  public async resetAllStats(): Promise<void> {
    this.ensureMemoryInitialized();
    this.statsResetEpoch++;
    this.statsByExt = {};
    this.deltaStatsByExt = {};
    this.migrationBaseStats = undefined;
    this.lastTrackedKey = undefined;
    this.lastTrackedTime = undefined;
    this.dirtyStats = false;
    this.dirtyLastKey = false;
    this.notifyChanged();

    await this.enqueueIo(async () => {
      await this.withStorageLock(async () => {
        const emptyRaw = "{}";
        const st = await safeWriteRawFile(this.statsFilePath, emptyRaw);
        this.lastSyncedStatsRaw = emptyRaw;
        this.lastSyncedStatsMtimeMs = st?.mtimeMs ?? 0;
        this.lastSyncedStatsSize = st?.size ?? -1;
      });

      await Promise.all([
        this.context.globalState.update("shortcutStatsByExt", {}),
        this.context.globalState.update("shortcutStats", undefined),
        this.context.globalState.update(
          "shortcutStatsNonConsecutive",
          undefined,
        ),
        this.context.globalState.update("lastTrackedKey", undefined),
      ]);
    });
  }

  /**
   * セッション状態を保存する（後方互換用）。
   * statsByExt の丸ごと上書きによる他ウィンドウ打鍵消失・二重加算を防ぐため、状態フィールドのみをパッチ反映する。
   */
  public async saveSessionData(sessionData: SessionData): Promise<void> {
    this.ensureMemoryInitialized();
    if (sessionData.initialKeybindings) {
      await this.setInitialKeybindings(sessionData.initialKeybindings);
      sessionData = { ...sessionData, initialKeybindings: undefined };
    }

    const isResetLike =
      !sessionData.isActive &&
      !sessionData.startedAt &&
      !hasAnyStatsEntries(sessionData.statsByExt || {});

    await this.updateSessionState({
      sessionId: sessionData.sessionId ?? null,
      isActive: sessionData.isActive,
      name: sessionData.name ?? null,
      startedAt: sessionData.startedAt ?? null,
      stoppedAt: sessionData.stoppedAt ?? null,
      accumulatedMs: sessionData.accumulatedMs ?? 0,
      lastStartedAt: sessionData.lastStartedAt ?? null,
      lastHeartbeatAt: sessionData.lastHeartbeatAt ?? null,
      initialKeybindingsCount: sessionData.initialKeybindingsCount ?? null,
      keybindingsDiff: sessionData.keybindingsDiff ?? null,
      resetStats: isResetLike ? true : undefined,
    });
  }

  public async resetSession(): Promise<void> {
    this.ensureMemoryInitialized();
    this.sessionResetEpoch++;
    this.lastTrackedTime = undefined;
    this.deltaSessionStatsByExt = {};
    this.deltaSessionGen = "";
    this.pendingSessionPatch = undefined;
    this.pendingHeartbeatAt = undefined;
    this.migrationBaseSession = undefined;
    await this.setInitialKeybindings(undefined);

    await this.updateSessionState({
      sessionId: null,
      isActive: false,
      name: null,
      startedAt: null,
      stoppedAt: null,
      accumulatedMs: 0,
      lastStartedAt: null,
      lastHeartbeatAt: null,
      initialKeybindingsCount: null,
      keybindingsDiff: null,
      resetStats: true,
    });
  }

  private getInitialKeybindingsUri(): vscode.Uri {
    return vscode.Uri.joinPath(
      this.context.globalStorageUri,
      INITIAL_KEYBINDINGS_FILENAME,
    );
  }

  private async writeInitialKeybindingsFile(items: any[]): Promise<void> {
    await vscode.workspace.fs.createDirectory(this.context.globalStorageUri);
    const bytes = new TextEncoder().encode(JSON.stringify(items));
    await vscode.workspace.fs.writeFile(this.getInitialKeybindingsUri(), bytes);
  }

  public async getInitialKeybindings(): Promise<any[] | undefined> {
    await this.syncFromDisk();

    const currentGen = getSessionGenerationKey(this.sessionData);
    const currentCount = this.sessionData.initialKeybindingsCount;

    if (!currentCount) {
      this.cachedInitialKbItems = null;
      this.cachedInitialKbGen = currentGen;
      this.cachedInitialKbCount = undefined;
      return undefined;
    }

    if (
      Array.isArray(this.cachedInitialKbItems) &&
      this.cachedInitialKbGen === currentGen &&
      this.cachedInitialKbCount === currentCount
    ) {
      return this.cachedInitialKbItems;
    }

    try {
      const bytes = await vscode.workspace.fs.readFile(
        this.getInitialKeybindingsUri(),
      );
      const parsed = JSON.parse(new TextDecoder("utf-8").decode(bytes));
      if (Array.isArray(parsed)) {
        this.cachedInitialKbItems = parsed;
        this.cachedInitialKbGen = currentGen;
        this.cachedInitialKbCount = currentCount;
        return parsed;
      }
    } catch {
      // ファイルが存在しない場合は空扱い
    }

    this.cachedInitialKbItems = null;
    this.cachedInitialKbGen = currentGen;
    this.cachedInitialKbCount = undefined;
    return undefined;
  }

  public async setInitialKeybindings(items: any[] | undefined): Promise<void> {
    this.ensureMemoryInitialized();
    const currentGen = getSessionGenerationKey(this.sessionData);
    if (items && items.length > 0) {
      this.cachedInitialKbItems = items;
      this.cachedInitialKbGen = currentGen;
      this.cachedInitialKbCount = items.length;
      this.sessionData.initialKeybindingsCount = items.length;
      await this.writeInitialKeybindingsFile(items);
    } else {
      this.cachedInitialKbItems = null;
      this.cachedInitialKbGen = currentGen;
      this.cachedInitialKbCount = undefined;
      this.sessionData.initialKeybindingsCount = undefined;
      try {
        await vscode.workspace.fs.delete(this.getInitialKeybindingsUri(), {
          useTrash: false,
        });
      } catch {
        // 既に存在しない場合は無視
      }
    }
    this.pendingSessionPatch = mergeSessionPatches(this.pendingSessionPatch, {
      initialKeybindingsCount: this.sessionData.initialKeybindingsCount ?? null,
    });
    this.dirtySession = true;
  }

  private scheduleFlush(): void {
    if (this.flushTimer !== undefined || this.isDisposed) {
      return;
    }
    this.flushTimer = setTimeout(() => {
      this.flushTimer = undefined;
      void this.flush();
    }, FLUSH_INTERVAL_MS);
  }

  /**
   * VS Code ウィンドウ終了時に呼び出される。
   * - 他のウィンドウがまだ稼働中の場合は、セッションタイマーを中断せず未保存デルタのみ永続化
   * - 自分が最後の稼働ウィンドウだった場合のみ、ロック内でアトミックに閉鎖前経過時間を確定して休止化する
   */
  public async shutdown(): Promise<void> {
    this.isDisposed = true;

    if (this.flushTimer !== undefined) {
      clearTimeout(this.flushTimer);
      this.flushTimer = undefined;
    }
    if (this.syncDebounceTimer !== undefined) {
      clearTimeout(this.syncDebounceTimer);
      this.syncDebounceTimer = undefined;
    }
    if (this.heartbeatTimer !== undefined) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
    if (this.windowHeartbeatTimer !== undefined) {
      clearInterval(this.windowHeartbeatTimer);
      this.windowHeartbeatTimer = undefined;
    }
    if (this.syncPollTimer !== undefined) {
      clearInterval(this.syncPollTimer);
      this.syncPollTimer = undefined;
    }
    if (this.fileWatcher) {
      this.fileWatcher.close();
      this.fileWatcher = undefined;
    }

    // まず未保存のデルタや状態変更があればフラッシュする
    await this.flush();

    // ロック内で自身のウィンドウハートビートを削除し、最後のウィンドウであればセッションを休止状態にする
    if (!this.memoryInitialized) {
      await fs.promises.unlink(this.myWindowHeartbeatPath).catch(() => {});
      return;
    }

    await this.enqueueIo(async () => {
      await this.withStorageLock(async () => {
        await fs.promises.unlink(this.myWindowHeartbeatPath).catch(() => {});
        const otherActive = await this.countOtherActiveWindows();
        if (otherActive > 0) {
          return;
        }

        const diskSession =
          (await safeReadJsonFile<SessionData>(this.sessionFilePath)) ||
          this.sessionData;
        if (diskSession.isActive && diskSession.lastStartedAt) {
          const startMs = new Date(diskSession.lastStartedAt).getTime();
          if (!isNaN(startMs)) {
            diskSession.accumulatedMs =
              (diskSession.accumulatedMs || 0) +
              Math.max(0, Date.now() - startMs);
          }
          delete diskSession.lastStartedAt;
          delete diskSession.lastHeartbeatAt;

          const raw = JSON.stringify(diskSession);
          const st = await safeWriteRawFile(this.sessionFilePath, raw);
          this.lastSyncedSessionRaw = raw;
          this.lastSyncedSessionMtimeMs = st?.mtimeMs ?? 0;
          this.lastSyncedSessionSize = st?.size ?? -1;
          this.sessionData = diskSession;
          await this.context.globalState.update(
            "sessionData",
            this.sessionData,
          );
        }
      });
    });
  }

  /**
   * 未保存のインメモリ統計およびデルタを、クロスプロセスロック下で最新ディスクデータとマージして永続化する
   */
  public flush(): Promise<void> {
    if (this.flushTimer !== undefined) {
      clearTimeout(this.flushTimer);
      this.flushTimer = undefined;
    }

    const hasDeltaStats = hasAnyStatsEntries(this.deltaStatsByExt);
    const hasDeltaSession = hasAnyStatsEntries(this.deltaSessionStatsByExt);

    if (
      !this.dirtyStats &&
      !this.dirtyLastKey &&
      !this.dirtySession &&
      !hasDeltaStats &&
      !hasDeltaSession &&
      !this.pendingSessionPatch &&
      !this.pendingHeartbeatAt
    ) {
      return this.ioQueue;
    }

    const saveStats =
      this.dirtyStats || hasDeltaStats || Boolean(this.migrationBaseStats);
    const saveLastKey = this.dirtyLastKey;
    const saveSession =
      this.dirtySession ||
      hasDeltaSession ||
      Boolean(this.pendingSessionPatch) ||
      Boolean(this.pendingHeartbeatAt) ||
      Boolean(this.migrationBaseSession);

    const capturedStatsEpoch = this.statsResetEpoch;
    const capturedSessionEpoch = this.sessionResetEpoch;

    // 今回フラッシュするデルタ・パッチをスワップして取り出す
    const currentDeltaStats = this.deltaStatsByExt;
    this.deltaStatsByExt = {};

    const currentDeltaSession = this.deltaSessionStatsByExt;
    const currentDeltaSessionGen = this.deltaSessionGen;
    this.deltaSessionStatsByExt = {};

    const currentSessionPatch = this.pendingSessionPatch;
    this.pendingSessionPatch = undefined;

    const currentHeartbeatAt = this.pendingHeartbeatAt;
    this.pendingHeartbeatAt = undefined;

    this.dirtyStats = false;
    this.dirtyLastKey = false;
    this.dirtySession = false;

    return this.enqueueIo(async () => {
      try {
        let pulledRemoteUpdates = false;

        await this.withStorageLock(async () => {
          // 1. 累計統計の保存（ディスク上の最新にデルタを加算マージ）
          if (saveStats && capturedStatsEpoch === this.statsResetEpoch) {
            let diskStats: StatsByExtension | undefined;
            const rawDiskStats = await fs.promises
              .readFile(this.statsFilePath, "utf-8")
              .catch(() => undefined);

            if (rawDiskStats !== undefined) {
              if (
                this.lastSyncedStatsRaw &&
                rawDiskStats !== this.lastSyncedStatsRaw
              ) {
                pulledRemoteUpdates = true;
              }
              this.migrationBaseStats = undefined;
              diskStats = JSON.parse(rawDiskStats) as StatsByExtension;
            } else if (this.migrationBaseStats) {
              diskStats = cloneStatsByExt(this.migrationBaseStats);
              this.migrationBaseStats = undefined;
            } else {
              diskStats = {};
            }

            mergeStatsDelta(diskStats, currentDeltaStats);
            const nextRawStats = JSON.stringify(diskStats);
            const st = await safeWriteRawFile(this.statsFilePath, nextRawStats);
            this.lastSyncedStatsRaw = nextRawStats;
            this.lastSyncedStatsMtimeMs = st?.mtimeMs ?? 0;
            this.lastSyncedStatsSize = st?.size ?? -1;

            // flush 実行中に発生した新規デルタがあれば合算してメモリを更新
            const updatedLocal = cloneStatsByExt(diskStats);
            mergeStatsDelta(updatedLocal, this.deltaStatsByExt);
            this.statsByExt = updatedLocal;

            void this.context.globalState.update(
              "shortcutStatsByExt",
              this.statsByExt,
            );
          }

          // 2. セッションデータの保存（ディスク上の最新に状態パッチと世代一致デルタをマージ）
          if (saveSession && capturedSessionEpoch === this.sessionResetEpoch) {
            let diskSession: SessionData | undefined;
            const rawDiskSession = await fs.promises
              .readFile(this.sessionFilePath, "utf-8")
              .catch(() => undefined);

            if (rawDiskSession !== undefined) {
              if (
                this.lastSyncedSessionRaw &&
                rawDiskSession !== this.lastSyncedSessionRaw
              ) {
                pulledRemoteUpdates = true;
              }
              this.migrationBaseSession = undefined;
              diskSession = JSON.parse(rawDiskSession) as SessionData;
            } else if (this.migrationBaseSession) {
              diskSession = {
                ...this.migrationBaseSession,
                statsByExt: cloneStatsByExt(
                  this.migrationBaseSession.statsByExt || {},
                ),
              };
              this.migrationBaseSession = undefined;
            } else {
              diskSession = {
                isActive: false,
                accumulatedMs: 0,
                statsByExt: {},
              };
            }

            diskSession.statsByExt = diskSession.statsByExt || {};

            if (currentSessionPatch) {
              applySessionPatch(diskSession, currentSessionPatch);
            }

            // 同一セッション世代に対する打鍵デルタのみマージ（リセット後の残骸混入を防止）
            const diskGen = getSessionGenerationKey(diskSession);
            if (
              hasAnyStatsEntries(currentDeltaSession) &&
              diskGen === currentDeltaSessionGen &&
              Boolean(diskSession.startedAt)
            ) {
              mergeStatsDelta(diskSession.statsByExt, currentDeltaSession);
            }

            // ハートビートは現在アクティブ稼働中のセッションに対してのみ最新時刻を反映
            if (
              currentHeartbeatAt &&
              diskSession.isActive &&
              diskSession.lastStartedAt
            ) {
              if (
                !diskSession.lastHeartbeatAt ||
                currentHeartbeatAt > diskSession.lastHeartbeatAt
              ) {
                diskSession.lastHeartbeatAt = currentHeartbeatAt;
              }
            }

            const nextRawSession = JSON.stringify(diskSession);
            const st = await safeWriteRawFile(
              this.sessionFilePath,
              nextRawSession,
            );
            this.lastSyncedSessionRaw = nextRawSession;
            this.lastSyncedSessionMtimeMs = st?.mtimeMs ?? 0;
            this.lastSyncedSessionSize = st?.size ?? -1;

            this.applyDiskSessionToMemory(diskSession);

            void this.context.globalState.update(
              "sessionData",
              this.sessionData,
            );
          }
        });

        if (saveLastKey && capturedStatsEpoch === this.statsResetEpoch) {
          void this.context.globalState.update(
            "lastTrackedKey",
            this.lastTrackedKey,
          );
        }

        if (pulledRemoteUpdates) {
          this.notifyChanged();
        }
      } catch (error) {
        // 失敗時は未コミット分を安全にロールバックして次回リトライ可能にする
        if (capturedStatsEpoch === this.statsResetEpoch) {
          mergeStatsDelta(this.deltaStatsByExt, currentDeltaStats);
          if (saveStats) {
            this.dirtyStats = true;
          }
          if (saveLastKey) {
            this.dirtyLastKey = true;
          }
        }
        if (capturedSessionEpoch === this.sessionResetEpoch) {
          if (this.deltaSessionGen === currentDeltaSessionGen) {
            mergeStatsDelta(this.deltaSessionStatsByExt, currentDeltaSession);
          }
          if (currentSessionPatch) {
            this.pendingSessionPatch = this.pendingSessionPatch
              ? mergeSessionPatches(currentSessionPatch, this.pendingSessionPatch)
              : currentSessionPatch;
          }
          if (currentHeartbeatAt && !this.pendingHeartbeatAt) {
            this.pendingHeartbeatAt = currentHeartbeatAt;
          }
          if (saveSession) {
            this.dirtySession = true;
          }
        }
        console.error("Failed to persist shortcut stats", error);
      }
    });
  }
}

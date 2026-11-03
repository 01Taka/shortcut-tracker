import * as path from "path";
import * as vscode from "vscode";
import type { SessionData, StatsByExtension } from "../types";

/**
 * 連続打鍵時の globalState 書き込み（IPC・SQLiteシリアライズ）を間引く間隔 (ms)
 */
const FLUSH_INTERVAL_MS = 1500;
const INITIAL_KEYBINDINGS_FILENAME = "session-initial-keybindings.json";

interface DocExtCacheEntry {
  fileName: string;
  languageId: string;
  ext: string;
}

/**
 * インメモリキャッシュと遅延バッチ保存を備えた統計ストア
 * - activate() 時はファイルI/Oや重い初期化を一切行わない
 * - キー入力時はメモリ上の O(1) 加算のみを同期実行し、本来のコマンド実行をブロックしない
 * - 巨大な initialKeybindings は globalState から globalStorageUri 配下のファイルへオフロード
 */
export class StatsStore {
  private loaded = false;
  private statsByExt: StatsByExtension = {};
  private lastTrackedKey: string | undefined;
  private sessionData: SessionData = {
    isActive: false,
    accumulatedMs: 0,
    statsByExt: {},
  };

  /**
   * undefined = 未読込, null = 保存データなし, any[] = 読込済みキャッシュ
   */
  private cachedInitialKeybindings: any[] | null | undefined = undefined;

  private dirtyStats = false;
  private dirtyLastKey = false;
  private dirtySession = false;
  private flushTimer: ReturnType<typeof setTimeout> | undefined;
  private activeFlushPromise: Promise<void> = Promise.resolve();

  private readonly docExtCache = new WeakMap<
    vscode.TextDocument,
    DocExtCacheEntry
  >();

  constructor(public readonly context: vscode.ExtensionContext) {}

  private ensureLoaded(): void {
    if (this.loaded) {
      return;
    }
    this.loaded = true;

    let storedStats =
      this.context.globalState.get<StatsByExtension>("shortcutStatsByExt");

    if (!storedStats || typeof storedStats !== "object") {
      storedStats = {};
      // 旧データ（shortcutStats, shortcutStatsNonConsecutive）が存在するか確認し、(legacy) にマイグレーション
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
        this.dirtyStats = true;
      }
    }

    this.statsByExt = storedStats;
    this.lastTrackedKey =
      this.context.globalState.get<string>("lastTrackedKey");

    const rawSession = this.context.globalState.get<SessionData>("sessionData");
    if (rawSession && typeof rawSession === "object" && rawSession.statsByExt) {
      if (
        Array.isArray(rawSession.initialKeybindings) &&
        rawSession.initialKeybindings.length > 0
      ) {
        const legacyKb = rawSession.initialKeybindings;
        this.cachedInitialKeybindings = legacyKb;
        this.sessionData = {
          ...rawSession,
          initialKeybindings: undefined,
          initialKeybindingsCount:
            rawSession.initialKeybindingsCount ?? legacyKb.length,
        };
        void this.migrateLegacyInitialKeybindings(legacyKb);
      } else {
        this.sessionData = rawSession;
      }
    } else {
      this.sessionData = {
        isActive: false,
        accumulatedMs: 0,
        statsByExt: {},
      };
    }

    if (this.dirtyStats) {
      this.scheduleFlush();
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
    // 拡張子がないファイル（Dockerfile, Makefile等）や未保存ファイルは languageId を使用
    const ext = rawExt || (languageId ? languageId.toLowerCase() : "(no-ext)");
    this.docExtCache.set(doc, { fileName, languageId, ext });
    return ext;
  }

  /**
   * キー入力をインメモリで即座（O(1)・非ブロッキング）に記録し、バックグラウンド保存を予約する
   */
  public recordKey(keyName: string): void {
    this.ensureLoaded();

    const ext = this.getActiveFileExtension();
    const isConsecutive = this.lastTrackedKey === keyName;
    this.lastTrackedKey = keyName;
    this.dirtyLastKey = true;

    let extStats = this.statsByExt[ext];
    if (!extStats) {
      extStats = {
        shortcutStats: {},
        shortcutStatsNonConsecutive: {},
      };
      this.statsByExt[ext] = extStats;
    }

    extStats.shortcutStats[keyName] =
      (extStats.shortcutStats[keyName] || 0) + 1;
    if (!isConsecutive) {
      extStats.shortcutStatsNonConsecutive[keyName] =
        (extStats.shortcutStatsNonConsecutive[keyName] || 0) + 1;
    }
    this.dirtyStats = true;

    if (this.sessionData.isActive) {
      let sessionExt = this.sessionData.statsByExt[ext];
      if (!sessionExt) {
        sessionExt = {
          shortcutStats: {},
          shortcutStatsNonConsecutive: {},
        };
        this.sessionData.statsByExt[ext] = sessionExt;
      }

      sessionExt.shortcutStats[keyName] =
        (sessionExt.shortcutStats[keyName] || 0) + 1;
      if (!isConsecutive) {
        sessionExt.shortcutStatsNonConsecutive[keyName] =
          (sessionExt.shortcutStatsNonConsecutive[keyName] || 0) + 1;
      }
      this.dirtySession = true;
    }

    this.scheduleFlush();
  }

  public getStatsByExt(): StatsByExtension {
    this.ensureLoaded();
    return this.statsByExt;
  }

  public getLastTrackedKey(): string | undefined {
    this.ensureLoaded();
    return this.lastTrackedKey;
  }

  public getSessionData(): SessionData {
    this.ensureLoaded();
    return this.sessionData;
  }

  public getLastExportDir(): string | undefined {
    return this.context.globalState.get<string>("lastSessionExportDir");
  }

  public async setLastExportDir(dirPath: string): Promise<void> {
    await this.context.globalState.update("lastSessionExportDir", dirPath);
  }

  public async markStatsModified(): Promise<void> {
    this.ensureLoaded();
    this.dirtyStats = true;
    await this.flush();
  }

  public async resetAllStats(): Promise<void> {
    this.ensureLoaded();
    this.statsByExt = {};
    this.lastTrackedKey = undefined;
    this.dirtyStats = false;
    this.dirtyLastKey = false;

    await Promise.all([
      this.context.globalState.update("shortcutStatsByExt", {}),
      this.context.globalState.update("shortcutStats", undefined),
      this.context.globalState.update("shortcutStatsNonConsecutive", undefined),
      this.context.globalState.update("lastTrackedKey", undefined),
    ]);
  }

  public async saveSessionData(sessionData: SessionData): Promise<void> {
    this.ensureLoaded();
    // 万一 initialKeybindings が渡されても globalState には混入させない
    if (sessionData.initialKeybindings) {
      await this.setInitialKeybindings(sessionData.initialKeybindings);
      sessionData = { ...sessionData, initialKeybindings: undefined };
    }
    this.sessionData = sessionData;
    this.dirtySession = true;
    await this.flush();
  }

  public async resetSession(): Promise<void> {
    this.ensureLoaded();
    await this.setInitialKeybindings(undefined);
    this.sessionData = {
      isActive: false,
      accumulatedMs: 0,
      statsByExt: {},
      initialKeybindingsCount: undefined,
      keybindingsDiff: undefined,
    };
    this.dirtySession = true;
    await this.flush();
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
    this.ensureLoaded();
    if (this.cachedInitialKeybindings !== undefined) {
      return this.cachedInitialKeybindings ?? undefined;
    }
    if (!this.sessionData.initialKeybindingsCount) {
      this.cachedInitialKeybindings = null;
      return undefined;
    }

    try {
      const bytes = await vscode.workspace.fs.readFile(
        this.getInitialKeybindingsUri(),
      );
      const parsed = JSON.parse(new TextDecoder("utf-8").decode(bytes));
      if (Array.isArray(parsed)) {
        this.cachedInitialKeybindings = parsed;
        return parsed;
      }
    } catch {
      // ファイルが存在しない場合は空扱い
    }

    this.cachedInitialKeybindings = null;
    return undefined;
  }

  public async setInitialKeybindings(items: any[] | undefined): Promise<void> {
    this.ensureLoaded();
    if (items && items.length > 0) {
      this.cachedInitialKeybindings = items;
      this.sessionData.initialKeybindingsCount = items.length;
      await this.writeInitialKeybindingsFile(items);
    } else {
      this.cachedInitialKeybindings = null;
      this.sessionData.initialKeybindingsCount = undefined;
      try {
        await vscode.workspace.fs.delete(this.getInitialKeybindingsUri(), {
          useTrash: false,
        });
      } catch {
        // 既に存在しない場合は無視
      }
    }
    this.dirtySession = true;
  }

  private scheduleFlush(): void {
    if (this.flushTimer !== undefined) {
      return;
    }
    this.flushTimer = setTimeout(() => {
      this.flushTimer = undefined;
      void this.flush();
    }, FLUSH_INTERVAL_MS);
  }

  /**
   * 未保存のインメモリ統計を即座に globalState へ永続化する
   */
  public flush(): Promise<void> {
    if (this.flushTimer !== undefined) {
      clearTimeout(this.flushTimer);
      this.flushTimer = undefined;
    }

    if (!this.dirtyStats && !this.dirtyLastKey && !this.dirtySession) {
      return this.activeFlushPromise;
    }

    const saveStats = this.dirtyStats;
    const saveLastKey = this.dirtyLastKey;
    const saveSession = this.dirtySession;

    this.dirtyStats = false;
    this.dirtyLastKey = false;
    this.dirtySession = false;

    this.activeFlushPromise = this.activeFlushPromise.then(async () => {
      const updates: Thenable<void>[] = [];
      if (saveStats) {
        updates.push(
          this.context.globalState.update("shortcutStatsByExt", this.statsByExt),
        );
      }
      if (saveLastKey) {
        updates.push(
          this.context.globalState.update(
            "lastTrackedKey",
            this.lastTrackedKey,
          ),
        );
      }
      if (saveSession) {
        updates.push(
          this.context.globalState.update("sessionData", this.sessionData),
        );
      }

      try {
        await Promise.all(updates);
      } catch (error) {
        if (saveStats) {
          this.dirtyStats = true;
        }
        if (saveLastKey) {
          this.dirtyLastKey = true;
        }
        if (saveSession) {
          this.dirtySession = true;
        }
        console.error("Failed to persist shortcut stats", error);
      }
    });

    return this.activeFlushPromise;
  }
}

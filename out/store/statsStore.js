"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StatsStore = void 0;
const path = require("path");
const vscode = require("vscode");
/**
 * 連続打鍵時の globalState 書き込み（IPC・SQLiteシリアライズ）を間引く間隔 (ms)
 */
const FLUSH_INTERVAL_MS = 1500;
const INITIAL_KEYBINDINGS_FILENAME = "session-initial-keybindings.json";
/**
 * インメモリキャッシュと遅延バッチ保存を備えた統計ストア
 * - activate() 時はファイルI/Oや重い初期化を一切行わない
 * - キー入力時はメモリ上の O(1) 加算のみを同期実行し、本来のコマンド実行をブロックしない
 * - 巨大な initialKeybindings は globalState から globalStorageUri 配下のファイルへオフロード
 */
class StatsStore {
    context;
    loaded = false;
    statsByExt = {};
    lastTrackedKey;
    sessionData = {
        isActive: false,
        accumulatedMs: 0,
        statsByExt: {},
    };
    /**
     * undefined = 未読込, null = 保存データなし, any[] = 読込済みキャッシュ
     */
    cachedInitialKeybindings = undefined;
    dirtyStats = false;
    dirtyLastKey = false;
    dirtySession = false;
    flushTimer;
    activeFlushPromise = Promise.resolve();
    docExtCache = new WeakMap();
    changeListeners = new Set();
    constructor(context) {
        this.context = context;
    }
    /**
     * 統計データの変更通知を購読する（パネルが開いている間のみ登録される軽量リスナー）
     */
    onDidChange(listener) {
        this.changeListeners.add(listener);
        return new vscode.Disposable(() => {
            this.changeListeners.delete(listener);
        });
    }
    notifyChanged() {
        if (this.changeListeners.size === 0) {
            return;
        }
        for (const listener of this.changeListeners) {
            try {
                listener();
            }
            catch (error) {
                console.error("StatsStore change listener error", error);
            }
        }
    }
    ensureLoaded() {
        if (this.loaded) {
            return;
        }
        this.loaded = true;
        let storedStats = this.context.globalState.get("shortcutStatsByExt");
        if (!storedStats || typeof storedStats !== "object") {
            storedStats = {};
            // 旧データ（shortcutStats, shortcutStatsNonConsecutive）が存在するか確認し、(legacy) にマイグレーション
            const oldTotal = this.context.globalState.get("shortcutStats");
            const oldNonConsecutive = this.context.globalState.get("shortcutStatsNonConsecutive");
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
            this.context.globalState.get("lastTrackedKey");
        const rawSession = this.context.globalState.get("sessionData");
        if (rawSession && typeof rawSession === "object" && rawSession.statsByExt) {
            if (Array.isArray(rawSession.initialKeybindings) &&
                rawSession.initialKeybindings.length > 0) {
                const legacyKb = rawSession.initialKeybindings;
                this.cachedInitialKeybindings = legacyKb;
                this.sessionData = {
                    ...rawSession,
                    initialKeybindings: undefined,
                    initialKeybindingsCount: rawSession.initialKeybindingsCount ?? legacyKb.length,
                };
                void this.migrateLegacyInitialKeybindings(legacyKb);
            }
            else {
                this.sessionData = rawSession;
            }
        }
        else {
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
    async migrateLegacyInitialKeybindings(items) {
        try {
            await this.writeInitialKeybindingsFile(items);
            this.dirtySession = true;
            await this.flush();
        }
        catch (error) {
            console.error("Failed to migrate initialKeybindings out of globalState", error);
        }
    }
    getActiveFileExtension() {
        const doc = vscode.window.activeTextEditor?.document;
        if (!doc) {
            return "(none)";
        }
        const fileName = doc.fileName;
        const languageId = doc.languageId;
        const cached = this.docExtCache.get(doc);
        if (cached &&
            cached.fileName === fileName &&
            cached.languageId === languageId) {
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
    recordKey(keyName) {
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
        this.notifyChanged();
    }
    getStatsByExt() {
        this.ensureLoaded();
        return this.statsByExt;
    }
    getLastTrackedKey() {
        this.ensureLoaded();
        return this.lastTrackedKey;
    }
    getSessionData() {
        this.ensureLoaded();
        return this.sessionData;
    }
    getLastExportDir() {
        return this.context.globalState.get("lastSessionExportDir");
    }
    async setLastExportDir(dirPath) {
        await this.context.globalState.update("lastSessionExportDir", dirPath);
    }
    async markStatsModified() {
        this.ensureLoaded();
        this.dirtyStats = true;
        this.notifyChanged();
        await this.flush();
    }
    async resetAllStats() {
        this.ensureLoaded();
        this.statsByExt = {};
        this.lastTrackedKey = undefined;
        this.dirtyStats = false;
        this.dirtyLastKey = false;
        this.notifyChanged();
        await Promise.all([
            this.context.globalState.update("shortcutStatsByExt", {}),
            this.context.globalState.update("shortcutStats", undefined),
            this.context.globalState.update("shortcutStatsNonConsecutive", undefined),
            this.context.globalState.update("lastTrackedKey", undefined),
        ]);
    }
    async saveSessionData(sessionData) {
        this.ensureLoaded();
        // 万一 initialKeybindings が渡されても globalState には混入させない
        if (sessionData.initialKeybindings) {
            await this.setInitialKeybindings(sessionData.initialKeybindings);
            sessionData = { ...sessionData, initialKeybindings: undefined };
        }
        this.sessionData = sessionData;
        this.dirtySession = true;
        this.notifyChanged();
        await this.flush();
    }
    async resetSession() {
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
        this.notifyChanged();
        await this.flush();
    }
    getInitialKeybindingsUri() {
        return vscode.Uri.joinPath(this.context.globalStorageUri, INITIAL_KEYBINDINGS_FILENAME);
    }
    async writeInitialKeybindingsFile(items) {
        await vscode.workspace.fs.createDirectory(this.context.globalStorageUri);
        const bytes = new TextEncoder().encode(JSON.stringify(items));
        await vscode.workspace.fs.writeFile(this.getInitialKeybindingsUri(), bytes);
    }
    async getInitialKeybindings() {
        this.ensureLoaded();
        if (this.cachedInitialKeybindings !== undefined) {
            return this.cachedInitialKeybindings ?? undefined;
        }
        if (!this.sessionData.initialKeybindingsCount) {
            this.cachedInitialKeybindings = null;
            return undefined;
        }
        try {
            const bytes = await vscode.workspace.fs.readFile(this.getInitialKeybindingsUri());
            const parsed = JSON.parse(new TextDecoder("utf-8").decode(bytes));
            if (Array.isArray(parsed)) {
                this.cachedInitialKeybindings = parsed;
                return parsed;
            }
        }
        catch {
            // ファイルが存在しない場合は空扱い
        }
        this.cachedInitialKeybindings = null;
        return undefined;
    }
    async setInitialKeybindings(items) {
        this.ensureLoaded();
        if (items && items.length > 0) {
            this.cachedInitialKeybindings = items;
            this.sessionData.initialKeybindingsCount = items.length;
            await this.writeInitialKeybindingsFile(items);
        }
        else {
            this.cachedInitialKeybindings = null;
            this.sessionData.initialKeybindingsCount = undefined;
            try {
                await vscode.workspace.fs.delete(this.getInitialKeybindingsUri(), {
                    useTrash: false,
                });
            }
            catch {
                // 既に存在しない場合は無視
            }
        }
        this.dirtySession = true;
    }
    scheduleFlush() {
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
    flush() {
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
            const updates = [];
            if (saveStats) {
                updates.push(this.context.globalState.update("shortcutStatsByExt", this.statsByExt));
            }
            if (saveLastKey) {
                updates.push(this.context.globalState.update("lastTrackedKey", this.lastTrackedKey));
            }
            if (saveSession) {
                updates.push(this.context.globalState.update("sessionData", this.sessionData));
            }
            try {
                await Promise.all(updates);
            }
            catch (error) {
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
exports.StatsStore = StatsStore;
//# sourceMappingURL=statsStore.js.map
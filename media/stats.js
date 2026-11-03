(function () {
  "use strict";

  const vscode = acquireVsCodeApi();

  // --- UI State (Webview 永続化対象) ---
  const savedState = vscode.getState() || {};
  const state = {
    mode: savedState.mode === "session" ? "session" : "global",
    groupMode: savedState.groupMode === "key" ? "key" : "command",
    sortKey: savedState.sortKey || "total",
    sortDir: savedState.sortDir || "desc",
    searchQuery: savedState.searchQuery || "",
    selectedGlobalExts: Array.isArray(savedState.selectedGlobalExts)
      ? savedState.selectedGlobalExts
      : [],
    selectedSessionExts: Array.isArray(savedState.selectedSessionExts)
      ? savedState.selectedSessionExts
      : [],
    tsvFormat: savedState.tsvFormat || "unified",
    diffExpanded:
      typeof savedState.diffExpanded === "boolean"
        ? savedState.diffExpanded
        : null,
    diffFilter: savedState.diffFilter || "all",
    expandedGroupIds: Array.isArray(savedState.expandedGroupIds)
      ? savedState.expandedGroupIds
      : [],
    exportPrefs: Object.assign(
      {
        createSubdirectory: true,
        includeStatsJson: true,
        includeStatsTsv: true,
        includeDiffJson: true,
        includeInitialKb: true,
        includeCurrentKb: false,
      },
      savedState.exportPrefs || {},
    ),
  };

  function persistState() {
    vscode.setState(state);
  }

  // --- Data Store ---
  let appData = {
    statsByExt: {},
    lastTrackedKey: null,
    lastExportDir: null,
    session: {
      isActive: false,
      name: null,
      startedAt: null,
      stoppedAt: null,
      accumulatedMs: 0,
      lastStartedAt: null,
      initialKeybindingsCount: null,
      statsByExt: {},
      keybindingsDiff: null,
    },
    serverNowMs: Date.now(),
  };
  let clockOffsetMs = 0;
  let sessionTickTimer = null;
  let activeModalId = null; // "exportSession" | "importJson" | "resetSession" | "resetGlobal" | null
  let isSubmittingExport = false;

  let currentFilteredContext = {
    visibleRows: [],
    totalInputs: 0,
    totalNonConsecutive: 0,
    scopeLabel: "メイン統計",
    extSummaryLabel: "全拡張子",
  };

  // --- Utilities ---
  const ESCAPE_MAP = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (ch) => ESCAPE_MAP[ch]);
  }

  const parseCache = new Map();
  function parseKeyEntry(rawKey) {
    const keyStr = String(rawKey || "");
    const cached = parseCache.get(keyStr);
    if (cached) {
      return cached;
    }

    let commandLabel = "";
    let shortcut = keyStr.trim();

    const match = /^(.*?)\s*\(([^()]+)\)\s*$/.exec(keyStr);
    if (match && match[2].trim()) {
      commandLabel = match[1].trim();
      shortcut = match[2].trim();
    }

    const parsed = { rawKey: keyStr, commandLabel, shortcut };
    parseCache.set(keyStr, parsed);
    return parsed;
  }

  function splitKeyCombo(chord) {
    const parts = [];
    let buf = "";
    for (let i = 0; i < chord.length; i++) {
      const ch = chord[i];
      if (ch === "+") {
        if (buf.length > 0) {
          parts.push(buf);
          buf = "";
        } else {
          parts.push("+");
        }
      } else {
        buf += ch;
      }
    }
    if (buf.length > 0) {
      parts.push(buf);
    } else if (
      chord.endsWith("+") &&
      chord.length > 1 &&
      !chord.endsWith("++")
    ) {
      parts.push("+");
    }
    return parts;
  }

  const kbdHtmlCache = new Map();
  function renderShortcutKbdHtml(shortcutStr) {
    const s = String(shortcutStr || "").trim();
    if (!s) {
      return '<span class="cmd-name">(未設定)</span>';
    }
    const cached = kbdHtmlCache.get(s);
    if (cached) {
      return cached;
    }

    const chords = s.split(/\s+/).filter(Boolean);
    const chordHtmlList = chords.map((chord) => {
      const keys = splitKeyCombo(chord);
      const caps = keys
        .map((k) => `<kbd class="keycap">${escapeHtml(k)}</kbd>`)
        .join('<span class="key-plus">+</span>');
      return `<span class="kbd-chord">${caps}</span>`;
    });

    const html = `<span class="kbd-sequence">${chordHtmlList.join('<span class="chord-sep">→</span>')}</span>`;
    kbdHtmlCache.set(s, html);
    return html;
  }

  function calculateLiveSessionMs() {
    const sess = appData.session;
    let ms = sess.accumulatedMs || 0;
    if (sess.isActive && sess.lastStartedAt) {
      const startMs = new Date(sess.lastStartedAt).getTime();
      const nowMs = Date.now() + clockOffsetMs;
      if (!isNaN(startMs)) {
        ms += Math.max(0, nowMs - startMs);
      }
    }
    return ms;
  }

  function formatDurationJa(ms) {
    if (ms <= 0) {
      return "0秒";
    }
    const sec = Math.floor(ms / 1000);
    const hours = Math.floor(sec / 3600);
    const minutes = Math.floor((sec % 3600) / 60);
    const seconds = sec % 60;
    const parts = [];
    if (hours > 0) parts.push(`${hours}時間`);
    if (minutes > 0) parts.push(`${minutes}分`);
    if (seconds > 0 || parts.length === 0) parts.push(`${seconds}秒`);
    return parts.join(" ");
  }

  function formatDurationCompact(ms) {
    const sec = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    const mm = String(m).padStart(2, "0");
    const ss = String(s).padStart(2, "0");
    return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
  }

  function formatLocalPreviewStamp() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  }

  function sanitizePreviewSegment(raw) {
    return String(raw || "")
      .trim()
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
      .replace(/\s+/g, "-")
      .replace(/\.+$/g, "")
      .slice(0, 60);
  }

  // --- Data Aggregation & Grouping ---
  function getActiveSelectedExts() {
    return state.mode === "session"
      ? state.selectedSessionExts
      : state.selectedGlobalExts;
  }

  function setActiveSelectedExts(nextExts) {
    if (state.mode === "session") {
      state.selectedSessionExts = nextExts;
    } else {
      state.selectedGlobalExts = nextExts;
    }
  }

  function computeExtensionList(statsByExt) {
    const list = [];
    let grandTotal = 0;

    for (const ext of Object.keys(statsByExt || {})) {
      const data = statsByExt[ext];
      if (!data || !data.shortcutStats) continue;
      let count = 0;
      for (const val of Object.values(data.shortcutStats)) {
        count += val;
      }
      if (count > 0) {
        list.push({ ext, count });
        grandTotal += count;
      }
    }

    list.sort((a, b) => b.count - a.count || a.ext.localeCompare(b.ext));
    return { list, grandTotal };
  }

  function aggregateBySelectedExts(statsByExt, selectedExts) {
    const totalStats = {};
    const nonConsecutiveStats = {};
    let totalInputs = 0;
    let totalNonConsecutive = 0;

    const filterSet =
      selectedExts && selectedExts.length > 0 ? new Set(selectedExts) : null;

    for (const ext of Object.keys(statsByExt || {})) {
      if (filterSet && !filterSet.has(ext)) continue;
      const data = statsByExt[ext];
      if (!data) continue;

      if (data.shortcutStats) {
        for (const [k, c] of Object.entries(data.shortcutStats)) {
          totalStats[k] = (totalStats[k] || 0) + c;
          totalInputs += c;
        }
      }
      if (data.shortcutStatsNonConsecutive) {
        for (const [k, c] of Object.entries(data.shortcutStatsNonConsecutive)) {
          nonConsecutiveStats[k] = (nonConsecutiveStats[k] || 0) + c;
          totalNonConsecutive += c;
        }
      }
    }

    return { totalStats, nonConsecutiveStats, totalInputs, totalNonConsecutive };
  }

  function buildRankingRows(totalStats, nonConsecutiveStats, groupMode) {
    const allRawKeys = Array.from(
      new Set([
        ...Object.keys(totalStats),
        ...Object.keys(nonConsecutiveStats),
      ]),
    );

    if (groupMode === "command") {
      return allRawKeys.map((rawKey) => {
        const parsed = parseKeyEntry(rawKey);
        const totalCount = totalStats[rawKey] || 0;
        const nonConsecutiveCount = nonConsecutiveStats[rawKey] || 0;
        const repeatRate =
          totalCount > 0
            ? ((totalCount - nonConsecutiveCount) / totalCount) * 100
            : 0;

        return {
          id: rawKey,
          tsvKey: rawKey,
          sortLabel:
            parsed.shortcut.toLowerCase() +
            " " +
            parsed.commandLabel.toLowerCase(),
          searchTarget: rawKey.toLowerCase(),
          shortcut: parsed.shortcut,
          commandLabel: parsed.commandLabel,
          totalCount,
          nonConsecutiveCount,
          repeatRate,
          children: [],
        };
      });
    }

    const groupMap = new Map();
    for (const rawKey of allRawKeys) {
      const parsed = parseKeyEntry(rawKey);
      const normShortcut = parsed.shortcut.toLowerCase();
      const totalCount = totalStats[rawKey] || 0;
      const nonConsecutiveCount = nonConsecutiveStats[rawKey] || 0;

      let group = groupMap.get(normShortcut);
      if (!group) {
        group = {
          id: `key:${normShortcut}`,
          tsvKey: parsed.shortcut,
          sortLabel: normShortcut,
          shortcut: parsed.shortcut,
          commandLabel: "",
          totalCount: 0,
          nonConsecutiveCount: 0,
          repeatRate: 0,
          searchParts: [normShortcut],
          children: [],
        };
        groupMap.set(normShortcut, group);
      }

      group.totalCount += totalCount;
      group.nonConsecutiveCount += nonConsecutiveCount;
      if (parsed.commandLabel) {
        group.searchParts.push(parsed.commandLabel.toLowerCase());
      }
      group.children.push({
        rawKey,
        commandLabel: parsed.commandLabel || rawKey,
        shortcut: parsed.shortcut,
        totalCount,
        nonConsecutiveCount,
        repeatRate:
          totalCount > 0
            ? ((totalCount - nonConsecutiveCount) / totalCount) * 100
            : 0,
      });
    }

    const groupedRows = [];
    for (const group of groupMap.values()) {
      group.repeatRate =
        group.totalCount > 0
          ? ((group.totalCount - group.nonConsecutiveCount) /
              group.totalCount) *
            100
          : 0;
      group.children.sort((a, b) => b.totalCount - a.totalCount);
      if (group.children.length === 1 && group.children[0].commandLabel) {
        group.commandLabel = group.children[0].commandLabel;
      }
      group.searchTarget = group.searchParts.join(" ");
      groupedRows.push(group);
    }

    return groupedRows;
  }

  function filterAndSortRows(rows) {
    const q = state.searchQuery.trim().toLowerCase();
    const filtered = q
      ? rows.filter((r) => r.searchTarget.includes(q))
      : rows.slice();

    const dir = state.sortDir === "asc" ? 1 : -1;
    const key = state.sortKey;

    filtered.sort((a, b) => {
      let cmp = 0;
      if (key === "key") {
        cmp = a.sortLabel.localeCompare(b.sortLabel);
      } else if (key === "nonConsecutive") {
        cmp = a.nonConsecutiveCount - b.nonConsecutiveCount;
      } else if (key === "repeatRate") {
        cmp = a.repeatRate - b.repeatRate;
      } else {
        cmp = a.totalCount - b.totalCount;
      }
      if (cmp !== 0) {
        return cmp * dir;
      }
      if (b.totalCount !== a.totalCount) {
        return b.totalCount - a.totalCount;
      }
      return a.sortLabel.localeCompare(b.sortLabel);
    });

    return filtered;
  }

  // --- DOM Elements ---
  const els = {
    lastKeyContent: document.getElementById("last-key-content"),
    modeTabGlobal: document.getElementById("mode-tab-global"),
    modeTabSession: document.getElementById("mode-tab-session"),
    badgeGlobalCount: document.getElementById("badge-global-count"),
    badgeSessionStatus: document.getElementById("badge-session-status"),

    sessionHero: document.getElementById("session-hero"),
    sessionNameInput: document.getElementById("session-name-input"),
    sessionLiveBadge: document.getElementById("session-live-badge"),
    sessionLiveText: document.getElementById("session-live-text"),
    sessionDuration: document.getElementById("session-duration"),
    sessionStartedAt: document.getElementById("session-started-at"),
    sessionSnapshotInfo: document.getElementById("session-snapshot-info"),
    btnSessionToggle: document.getElementById("btn-session-toggle"),
    btnSessionSave: document.getElementById("btn-session-save"),
    btnSessionReset: document.getElementById("btn-session-reset"),

    kpiTitleTotal: document.getElementById("kpi-title-total"),
    kpiTotalInputs: document.getElementById("kpi-total-inputs"),
    kpiSubTotal: document.getElementById("kpi-sub-total"),
    kpiNonConsecutive: document.getElementById("kpi-non-consecutive"),
    kpiSubNonConsecutive: document.getElementById("kpi-sub-non-consecutive"),
    kpiRepeatRate: document.getElementById("kpi-repeat-rate"),
    kpiRepeatBar: document.getElementById("kpi-repeat-bar"),
    kpiSubRepeat: document.getElementById("kpi-sub-repeat"),
    kpiTitleUnique: document.getElementById("kpi-title-unique"),
    kpiUniqueCount: document.getElementById("kpi-unique-count"),
    kpiUniqueUnit: document.getElementById("kpi-unique-unit"),
    kpiSubTop: document.getElementById("kpi-sub-top"),

    diffSection: document.getElementById("diff-section"),
    diffToggleBtn: document.getElementById("diff-toggle-btn"),
    diffChevron: document.getElementById("diff-chevron"),
    diffSummaryBadges: document.getElementById("diff-summary-badges"),
    btnCopyDiffJson: document.getElementById("btn-copy-diff-json"),
    diffBody: document.getElementById("diff-body"),
    diffEmptyMsg: document.getElementById("diff-empty-msg"),
    diffContentWrap: document.getElementById("diff-content-wrap"),
    diffFilterGroup: document.getElementById("diff-filter-group"),
    diffTbody: document.getElementById("diff-tbody"),

    extFilterBar: document.getElementById("ext-filter-bar"),
    extChipsContainer: document.getElementById("ext-chips-container"),
    extClearBtn: document.getElementById("ext-clear-btn"),

    searchInput: document.getElementById("search-input"),
    searchCountBadge: document.getElementById("search-count-badge"),
    searchClearBtn: document.getElementById("search-clear-btn"),

    groupBtnCommand: document.getElementById("group-btn-command"),
    groupBtnKey: document.getElementById("group-btn-key"),

    tsvMenuContainer: document.getElementById("tsv-menu-container"),
    tsvFormatHint: document.getElementById("tsv-format-hint"),
    tsvDropdown: document.getElementById("tsv-dropdown"),
    globalActionsGroup: document.getElementById("global-actions-group"),

    rankingTbody: document.getElementById("ranking-tbody"),

    // Modals & Toast
    modalBackdrop: document.getElementById("modal-backdrop"),
    modalExportSession: document.getElementById("modal-export-session"),
    exportSessionName: document.getElementById("export-session-name"),
    exportDirInput: document.getElementById("export-dir-input"),
    exportPathPreview: document.getElementById("export-path-preview"),
    chkExportSubdir: document.getElementById("chk-export-subdir"),
    chkExportStatsJson: document.getElementById("chk-export-stats-json"),
    chkExportStatsTsv: document.getElementById("chk-export-stats-tsv"),
    chkExportDiffJson: document.getElementById("chk-export-diff-json"),
    chkExportInitialKb: document.getElementById("chk-export-initial-kb"),
    chkExportCurrentKb: document.getElementById("chk-export-current-kb"),
    exportDiffHint: document.getElementById("export-diff-hint"),
    exportInitKbHint: document.getElementById("export-init-kb-hint"),
    exportModalError: document.getElementById("export-modal-error"),
    btnExecExportKeep: document.getElementById("btn-exec-export-keep"),
    btnExecExportReset: document.getElementById("btn-exec-export-reset"),

    modalImportJson: document.getElementById("modal-import-json"),
    importJsonTextarea: document.getElementById("import-json-textarea"),
    importFileBadge: document.getElementById("import-file-badge"),
    importModalError: document.getElementById("import-modal-error"),

    modalConfirmReset: document.getElementById("modal-confirm-reset"),
    modalResetTitle: document.getElementById("modal-reset-title"),
    modalResetDesc: document.getElementById("modal-reset-desc"),
    modalResetSummary: document.getElementById("modal-reset-summary"),
    btnSwitchToExport: document.getElementById("btn-switch-to-export"),
    btnConfirmResetExec: document.getElementById("btn-confirm-reset-exec"),

    toastContainer: document.getElementById("toast-container"),
  };

  // --- Toast Helper ---
  function showToast(message, kind = "info", actionButtons = []) {
    if (!els.toastContainer) return;

    const item = document.createElement("div");
    item.className = `toast-item ${kind === "success" ? "success" : ""}`;

    const textDiv = document.createElement("div");
    textDiv.textContent = message;
    item.appendChild(textDiv);

    if (actionButtons.length > 0) {
      const actionsDiv = document.createElement("div");
      actionsDiv.className = "toast-actions";
      for (const act of actionButtons) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "btn btn-secondary btn-sm";
        b.textContent = act.label;
        b.addEventListener("click", () => {
          act.onClick();
          item.remove();
        });
        actionsDiv.appendChild(b);
      }
      item.appendChild(actionsDiv);
    }

    els.toastContainer.appendChild(item);

    const ttl = actionButtons.length > 0 ? 8000 : 3200;
    setTimeout(() => {
      if (item.parentNode) {
        item.remove();
      }
    }, ttl);
  }

  // --- Modal Control ---
  function closeModal() {
    activeModalId = null;
    els.modalBackdrop.classList.add("hidden");
    els.modalExportSession.classList.add("hidden");
    els.modalImportJson.classList.add("hidden");
    els.modalConfirmReset.classList.add("hidden");
  }

  function updateExportPathPreview() {
    const dirVal = (els.exportDirInput.value || "").trim();
    if (!dirVal) {
      els.exportPathPreview.textContent =
        "保存先フォルダを選択してください";
      return;
    }
    const cleanDir = dirVal.replace(/[\\/]+$/, "");
    const sep = cleanDir.includes("\\") ? "\\" : "/";
    const stamp = formatLocalPreviewStamp();
    const safeName = sanitizePreviewSegment(els.exportSessionName.value);
    const folderOrPrefix = safeName ? `${stamp}_${safeName}` : stamp;

    if (els.chkExportSubdir.checked) {
      els.exportPathPreview.textContent = `出力先プレビュー: ${cleanDir}${sep}${folderOrPrefix}${sep}`;
    } else {
      els.exportPathPreview.textContent = `出力先プレビュー: ${cleanDir}${sep}session-stats-${folderOrPrefix}.json 等`;
    }
  }

  function openModal(modalType) {
    closeModal();
    activeModalId = modalType;
    els.modalBackdrop.classList.remove("hidden");

    if (modalType === "exportSession") {
      const sess = appData.session;
      els.exportSessionName.value = sess.name || "";
      if (!els.exportDirInput.value.trim() && appData.lastExportDir) {
        els.exportDirInput.value = appData.lastExportDir;
      }

      els.chkExportSubdir.checked = Boolean(state.exportPrefs.createSubdirectory);
      els.chkExportStatsJson.checked = Boolean(state.exportPrefs.includeStatsJson);
      els.chkExportStatsTsv.checked = Boolean(state.exportPrefs.includeStatsTsv);
      els.chkExportDiffJson.checked = Boolean(state.exportPrefs.includeDiffJson);
      els.chkExportInitialKb.checked = Boolean(state.exportPrefs.includeInitialKb);
      els.chkExportCurrentKb.checked = Boolean(state.exportPrefs.includeCurrentKb);

      const diffCount = sess.keybindingsDiff?.diffs?.length ?? null;
      els.exportDiffHint.textContent =
        diffCount !== null ? `変更 ${diffCount} 件` : "自動計算して出力";

      els.exportInitKbHint.textContent = sess.initialKeybindingsCount
        ? `${sess.initialKeybindingsCount.toLocaleString()} 件記録済み`
        : "未記録";
      els.chkExportInitialKb.disabled = !sess.initialKeybindingsCount;
      if (!sess.initialKeybindingsCount) {
        els.chkExportInitialKb.checked = false;
      }

      els.exportModalError.classList.add("hidden");
      isSubmittingExport = false;
      els.btnExecExportKeep.disabled = false;
      els.btnExecExportReset.disabled = false;

      updateExportPathPreview();
      els.modalExportSession.classList.remove("hidden");
      els.exportSessionName.focus();
    } else if (modalType === "importJson") {
      els.importModalError.classList.add("hidden");
      els.importFileBadge.classList.add("hidden");
      els.modalImportJson.classList.remove("hidden");
      els.importJsonTextarea.focus();
    } else if (modalType === "resetSession") {
      const sess = appData.session;
      const sessAgg = computeExtensionList(sess.statsByExt);
      const durText = formatDurationJa(calculateLiveSessionMs());

      els.modalResetTitle.textContent = "セッション計測のリセット確認";
      els.modalResetDesc.textContent =
        "現在のセッション計測データ・初期キーバインド記録・変更差分を初期化します（累計統計には影響しません）。";
      els.modalResetSummary.innerHTML = [
        `<div>セッション名: <b>${escapeHtml(sess.name || "(未設定)")}</b></div>`,
        `<div>計測時間: <b>${escapeHtml(durText)}</b> / 記録打鍵数: <b>${sessAgg.grandTotal.toLocaleString()} 回</b></div>`,
      ].join("");

      const hasSessionData = Boolean(sess.startedAt || sessAgg.grandTotal > 0);
      els.btnSwitchToExport.classList.toggle("hidden", !hasSessionData);
      els.btnConfirmResetExec.textContent = "保存せずリセットする";
      els.modalConfirmReset.classList.remove("hidden");
    } else if (modalType === "resetGlobal") {
      const globalAgg = computeExtensionList(appData.statsByExt);
      els.modalResetTitle.textContent = "累計統計データの全削除確認";
      els.modalResetDesc.textContent =
        "これまでに蓄積されたすべての累計ショートカット統計データを完全に削除します。この操作は元に戻せません。";
      els.modalResetSummary.innerHTML = `<div>削除される累計打鍵数: <b>${globalAgg.grandTotal.toLocaleString()} 回</b>（${globalAgg.list.length} 拡張子）</div>`;
      els.btnSwitchToExport.classList.add("hidden");
      els.btnConfirmResetExec.textContent = "すべて削除する";
      els.modalConfirmReset.classList.remove("hidden");
    }
  }

  function submitSessionExport(resetAfterSave) {
    if (isSubmittingExport) return;

    const dirPath = (els.exportDirInput.value || "").trim();
    if (!dirPath) {
      els.exportModalError.textContent =
        "保存先ベースフォルダを指定してください（「📂 参照...」から選択できます）。";
      els.exportModalError.classList.remove("hidden");
      return;
    }

    const prefs = {
      createSubdirectory: els.chkExportSubdir.checked,
      includeStatsJson: els.chkExportStatsJson.checked,
      includeStatsTsv: els.chkExportStatsTsv.checked,
      includeDiffJson: els.chkExportDiffJson.checked,
      includeInitialKb:
        !els.chkExportInitialKb.disabled && els.chkExportInitialKb.checked,
      includeCurrentKb: els.chkExportCurrentKb.checked,
    };

    if (
      !prefs.includeStatsJson &&
      !prefs.includeStatsTsv &&
      !prefs.includeDiffJson &&
      !prefs.includeInitialKb &&
      !prefs.includeCurrentKb
    ) {
      els.exportModalError.textContent =
        "保存するファイルを1つ以上チェックしてください。";
      els.exportModalError.classList.remove("hidden");
      return;
    }

    state.exportPrefs = Object.assign({}, state.exportPrefs, prefs);
    persistState();

    els.exportModalError.classList.add("hidden");
    isSubmittingExport = true;
    els.btnExecExportKeep.disabled = true;
    els.btnExecExportReset.disabled = true;

    vscode.postMessage({
      command: "executeSessionExport",
      options: Object.assign(
        {
          dirPath,
          sessionName: els.exportSessionName.value.trim(),
          resetAfterSave: Boolean(resetAfterSave),
        },
        prefs,
      ),
    });
  }

  // --- Rendering ---
  function renderHeaderAndTimersOnly() {
    const sess = appData.session;
    const durationMs = calculateLiveSessionMs();

    if (sess.isActive) {
      els.badgeSessionStatus.className = "tab-badge recording";
      els.badgeSessionStatus.textContent = `● 計測中 ${formatDurationCompact(durationMs)}`;
    } else if (sess.startedAt) {
      els.badgeSessionStatus.className = "tab-badge";
      els.badgeSessionStatus.textContent = `一時停止 (${formatDurationCompact(durationMs)})`;
    } else {
      els.badgeSessionStatus.className = "tab-badge";
      els.badgeSessionStatus.textContent = "未開始";
    }

    if (state.mode === "session") {
      els.sessionDuration.textContent = formatDurationJa(durationMs);
      if (durationMs >= 5000 && currentFilteredContext.totalInputs > 0) {
        const perMin = (
          currentFilteredContext.totalInputs /
          (durationMs / 60000)
        ).toFixed(1);
        els.kpiSubTotal.textContent = `平均ペース: ${perMin} 回/分`;
      }
    }
  }

  function syncSessionTimerLoop() {
    if (appData.session.isActive) {
      if (!sessionTickTimer) {
        sessionTickTimer = setInterval(renderHeaderAndTimersOnly, 1000);
      }
    } else if (sessionTickTimer) {
      clearInterval(sessionTickTimer);
      sessionTickTimer = null;
    }
  }

  function renderDiffSection() {
    const sess = appData.session;
    const diff = sess.keybindingsDiff;
    if (state.mode !== "session" || (!diff && !sess.initialKeybindingsCount)) {
      els.diffSection.classList.add("hidden");
      return;
    }

    els.diffSection.classList.remove("hidden");

    const diffsList = diff && Array.isArray(diff.diffs) ? diff.diffs : [];
    const totalChanges = diffsList.length;
    const isExpanded =
      state.diffExpanded !== null
        ? state.diffExpanded
        : totalChanges > 0 && totalChanges <= 6;

    els.diffToggleBtn.setAttribute("aria-expanded", String(isExpanded));
    els.diffChevron.classList.toggle("expanded", isExpanded);
    els.diffBody.classList.toggle("hidden", !isExpanded);
    els.btnCopyDiffJson.classList.toggle("hidden", totalChanges === 0);

    if (!diff || totalChanges === 0) {
      els.diffSummaryBadges.innerHTML =
        '<span class="diff-pill neutral">変更なし</span>';
      els.diffEmptyMsg.classList.remove("hidden");
      els.diffContentWrap.classList.add("hidden");
      return;
    }

    els.diffSummaryBadges.innerHTML = [
      `<span class="diff-pill neutral">計 ${totalChanges} 件</span>`,
      diff.addedCount > 0
        ? `<span class="diff-pill added">+${diff.addedCount} 追加</span>`
        : "",
      diff.modifiedCount > 0
        ? `<span class="diff-pill modified">~${diff.modifiedCount} 変更</span>`
        : "",
      diff.removedCount > 0
        ? `<span class="diff-pill removed">-${diff.removedCount} 削除</span>`
        : "",
    ].join("");

    els.diffEmptyMsg.classList.add("hidden");
    els.diffContentWrap.classList.remove("hidden");

    els.diffFilterGroup.querySelectorAll(".seg-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.diffType === state.diffFilter);
    });

    if (!isExpanded) {
      return;
    }

    const filteredDiffs =
      state.diffFilter === "all"
        ? diffsList
        : diffsList.filter((d) => d.type === state.diffFilter);

    if (filteredDiffs.length === 0) {
      els.diffTbody.innerHTML =
        '<tr><td colspan="3" class="empty-state-cell">該当する種別の変更はありません</td></tr>';
      return;
    }

    els.diffTbody.innerHTML = filteredDiffs
      .map((entry) => {
        let badgeCls = "added";
        let badgeLabel = "追加";
        if (entry.type === "removed") {
          badgeCls = "removed";
          badgeLabel = "削除";
        } else if (entry.type === "modified") {
          badgeCls = "modified";
          badgeLabel = "変更";
        }

        let detail = `<code class="inline-code">${escapeHtml(entry.command || "")}</code>`;
        if (entry.when) {
          detail += ` <span class="cmd-name">(when: ${escapeHtml(entry.when)})</span>`;
        }
        if (entry.before) {
          const beforeWhen = entry.before.when
            ? ` (when: ${escapeHtml(entry.before.when)})`
            : "";
          detail += `<div class="cmd-name" style="margin-top:3px;">変更前: <code class="inline-code">${escapeHtml(entry.before.command || "")}</code>${beforeWhen}</div>`;
        }

        return `
          <tr>
            <td><span class="diff-pill ${badgeCls}">${badgeLabel}</span></td>
            <td>${renderShortcutKbdHtml(entry.key)}</td>
            <td>${detail}</td>
          </tr>`;
      })
      .join("");
  }

  function renderAll() {
    const isSessionMode = state.mode === "session";
    const activeStatsByExt = isSessionMode
      ? appData.session.statsByExt
      : appData.statsByExt;

    // 1. 直前のキー表示
    if (appData.lastTrackedKey) {
      const parsedLast = parseKeyEntry(appData.lastTrackedKey);
      els.lastKeyContent.innerHTML = parsedLast.commandLabel
        ? `${renderShortcutKbdHtml(parsedLast.shortcut)} <span class="cmd-name">${escapeHtml(parsedLast.commandLabel)}</span>`
        : renderShortcutKbdHtml(parsedLast.shortcut);
    } else {
      els.lastKeyContent.textContent = "(なし)";
    }

    // 2. モードタブ更新
    const globalExtInfo = computeExtensionList(appData.statsByExt);
    els.badgeGlobalCount.textContent = globalExtInfo.grandTotal.toLocaleString();

    els.modeTabGlobal.classList.toggle("active", !isSessionMode);
    els.modeTabGlobal.setAttribute("aria-selected", String(!isSessionMode));
    els.modeTabSession.classList.toggle("active", isSessionMode);
    els.modeTabSession.setAttribute("aria-selected", String(isSessionMode));

    els.sessionHero.classList.toggle("hidden", !isSessionMode);
    els.globalActionsGroup.classList.toggle("hidden", isSessionMode);

    // 3. セッションコントロールパネル更新
    const sess = appData.session;
    const isPaused = !sess.isActive && Boolean(sess.startedAt);
    if (isSessionMode) {
      els.sessionHero.classList.toggle("is-active", sess.isActive);
      els.sessionHero.classList.toggle("is-paused", isPaused);

      if (document.activeElement !== els.sessionNameInput) {
        els.sessionNameInput.value = sess.name || "";
      }

      if (sess.isActive) {
        els.sessionLiveBadge.className = "live-status-badge active";
        els.sessionLiveText.textContent = "計測中";
        els.btnSessionToggle.className = "btn btn-secondary";
        els.btnSessionToggle.textContent = "⏸ 一時停止";
      } else if (isPaused) {
        els.sessionLiveBadge.className = "live-status-badge paused";
        els.sessionLiveText.textContent = "一時停止中";
        els.btnSessionToggle.className = "btn btn-primary";
        els.btnSessionToggle.textContent = "▶ 計測を再開";
      } else {
        els.sessionLiveBadge.className = "live-status-badge inactive";
        els.sessionLiveText.textContent = "未開始";
        els.btnSessionToggle.className = "btn btn-primary";
        els.btnSessionToggle.textContent = "▶ 新規計測を開始";
      }

      els.sessionStartedAt.textContent = sess.startedAt
        ? new Date(sess.startedAt).toLocaleString("ja-JP")
        : "(未開始)";
      els.sessionSnapshotInfo.textContent = sess.initialKeybindingsCount
        ? `記録済み (${sess.initialKeybindingsCount.toLocaleString()} 件)`
        : "開始時に自動保存";

      const hasAnySessionState = Boolean(
        sess.startedAt || sess.isActive || sess.name,
      );
      els.btnSessionReset.disabled = !hasAnySessionState;
    }

    // 4. 拡張子フィルタチップ
    const extInfo = isSessionMode
      ? computeExtensionList(activeStatsByExt)
      : globalExtInfo;
    const availableExtSet = new Set(extInfo.list.map((item) => item.ext));
    const selectedExts = getActiveSelectedExts().filter((e) =>
      availableExtSet.has(e),
    );
    setActiveSelectedExts(selectedExts);

    if (extInfo.list.length === 0) {
      els.extFilterBar.classList.add("hidden");
    } else {
      els.extFilterBar.classList.remove("hidden");
      const allActive = selectedExts.length === 0;
      els.extClearBtn.classList.toggle("hidden", allActive);

      const selectedSet = new Set(selectedExts);
      const chipsHtml = [
        `<button type="button" class="ext-chip ${allActive ? "active" : ""}" data-action="clear-ext-filter">
          <span>すべて</span>
          <span class="ext-chip-count">${extInfo.grandTotal.toLocaleString()}</span>
        </button>`,
        ...extInfo.list.map(({ ext, count }) => {
          const isSelected = selectedSet.has(ext);
          return `<button type="button" class="ext-chip ${isSelected ? "active" : ""}" data-action="toggle-ext-chip" data-ext="${escapeHtml(ext)}">
            <span>${escapeHtml(ext)}</span>
            <span class="ext-chip-count">${count.toLocaleString()}</span>
          </button>`;
        }),
      ].join("");
      els.extChipsContainer.innerHTML = chipsHtml;
    }

    // 5. 集計・グルーピング・ソート
    const aggregated = aggregateBySelectedExts(activeStatsByExt, selectedExts);
    const allBuiltRows = buildRankingRows(
      aggregated.totalStats,
      aggregated.nonConsecutiveStats,
      state.groupMode,
    );
    const visibleRows = filterAndSortRows(allBuiltRows);

    const scopeLabel = isSessionMode ? "セッション統計" : "メイン統計";
    const extSummaryLabel =
      selectedExts.length === 0 ? "全拡張子" : selectedExts.join(", ");

    currentFilteredContext = {
      visibleRows,
      totalInputs: aggregated.totalInputs,
      totalNonConsecutive: aggregated.totalNonConsecutive,
      scopeLabel,
      extSummaryLabel,
    };

    // 6. KPI カード更新
    const consecutiveInputs =
      aggregated.totalInputs - aggregated.totalNonConsecutive;
    const repeatRateNum =
      aggregated.totalInputs > 0
        ? (consecutiveInputs / aggregated.totalInputs) * 100
        : 0;

    els.kpiTitleTotal.textContent = isSessionMode
      ? "セッション総入力 (全入力)"
      : "総入力回数 (全入力)";
    els.kpiTotalInputs.textContent = aggregated.totalInputs.toLocaleString();

    if (isSessionMode) {
      const durMs = calculateLiveSessionMs();
      if (durMs >= 5000 && aggregated.totalInputs > 0) {
        const perMin = (aggregated.totalInputs / (durMs / 60000)).toFixed(1);
        els.kpiSubTotal.textContent = `平均ペース: ${perMin} 回/分`;
      } else {
        els.kpiSubTotal.textContent =
          selectedExts.length > 0
            ? `対象: ${extSummaryLabel}`
            : "セッション中の総実行回数";
      }
    } else {
      els.kpiSubTotal.textContent =
        selectedExts.length > 0
          ? `フィルタ中: ${extSummaryLabel}`
          : `全 ${extInfo.list.length} 拡張子の合計`;
    }

    els.kpiNonConsecutive.textContent =
      aggregated.totalNonConsecutive.toLocaleString();
    els.kpiRepeatRate.textContent = repeatRateNum.toFixed(1);
    els.kpiRepeatBar.style.width = `${Math.min(100, Math.max(0, repeatRateNum)).toFixed(1)}%`;
    els.kpiSubRepeat.textContent = `連続打鍵: ${consecutiveInputs.toLocaleString()} 回`;

    els.kpiTitleUnique.textContent =
      state.groupMode === "key" ? "使用物理キー数" : "使用コマンド数";
    els.kpiUniqueCount.textContent = allBuiltRows.length.toLocaleString();
    els.kpiUniqueUnit.textContent = state.groupMode === "key" ? "キー" : "項目";

    if (allBuiltRows.length > 0) {
      let topRow = allBuiltRows[0];
      for (let i = 1; i < allBuiltRows.length; i++) {
        if (allBuiltRows[i].totalCount > topRow.totalCount) {
          topRow = allBuiltRows[i];
        }
      }
      els.kpiSubTop.textContent = `最頻出: ${topRow.shortcut}${topRow.commandLabel ? ` (${topRow.commandLabel})` : ""}`;
      els.kpiSubTop.title = els.kpiSubTop.textContent;
    } else {
      els.kpiSubTop.textContent = "最頻出: -";
      els.kpiSubTop.title = "";
    }

    // 7. タイマー・差分描画
    renderHeaderAndTimersOnly();
    renderDiffSection();

    // 8. ツールバー同期
    els.groupBtnCommand.classList.toggle("active", state.groupMode === "command");
    els.groupBtnKey.classList.toggle("active", state.groupMode === "key");

    if (els.searchInput.value !== state.searchQuery) {
      els.searchInput.value = state.searchQuery;
    }
    const hasQuery = state.searchQuery.trim().length > 0;
    els.searchClearBtn.classList.toggle("hidden", !hasQuery);
    if (hasQuery && allBuiltRows.length > 0) {
      els.searchCountBadge.classList.remove("hidden");
      els.searchCountBadge.textContent = `${visibleRows.length} / ${allBuiltRows.length} 件`;
    } else {
      els.searchCountBadge.classList.add("hidden");
    }

    const formatNames = {
      unified: "統合",
      raw: "全入力",
      dedup: "非連続",
      both: "2表",
    };
    els.tsvFormatHint.textContent = formatNames[state.tsvFormat] || "統合";
    ["unified", "raw", "dedup", "both"].forEach((fmt) => {
      const mark = document.getElementById(`check-tsv-${fmt}`);
      if (mark) {
        mark.textContent = state.tsvFormat === fmt ? "✓" : "";
      }
    });

    ["key", "total", "nonConsecutive", "repeatRate"].forEach((colKey) => {
      const ind = document.getElementById(`sort-ind-${colKey}`);
      const th = ind ? ind.closest("th") : null;
      if (!ind || !th) return;
      if (state.sortKey === colKey) {
        th.classList.add("sorted");
        ind.textContent = state.sortDir === "asc" ? "↑" : "↓";
      } else {
        th.classList.remove("sorted");
        ind.textContent = "";
      }
    });

    // 9. ランキングテーブル描画
    renderRankingTableBody(
      visibleRows,
      allBuiltRows.length,
      aggregated.totalInputs,
      aggregated.totalNonConsecutive,
      isSessionMode,
    );
  }

  function renderRankingTableBody(
    visibleRows,
    unfilteredCount,
    totalInputs,
    totalNonConsecutive,
    isSessionMode,
  ) {
    if (unfilteredCount === 0) {
      const emptyTitle = isSessionMode
        ? "セッション中のショートカット記録はまだありません"
        : "まだショートカットの記録がありません";
      const emptyDesc = isSessionMode
        ? appData.session.isActive
          ? "ショートカットを使用するとリアルタイムにここへ集計されます。"
          : "「▶ 新規計測を開始」を押すと、確認ダイアログなしで即座に計測が始まります。"
        : "登録されたショートカットキーを使用すると自動的に集計されます。";

      els.rankingTbody.innerHTML = `
        <tr>
          <td colspan="5" class="empty-state-cell">
            <div class="empty-state-title">${emptyTitle}</div>
            <div class="empty-state-desc">${emptyDesc}</div>
          </td>
        </tr>`;
      return;
    }

    if (visibleRows.length === 0) {
      els.rankingTbody.innerHTML = `
        <tr>
          <td colspan="5" class="empty-state-cell">
            <div class="empty-state-title">「${escapeHtml(state.searchQuery.trim())}」に一致する項目はありません</div>
            <div class="empty-state-desc">検索キーワードを変更するか、Esc キーで検索をクリアしてください。</div>
          </td>
        </tr>`;
      return;
    }

    let maxTotal = 1;
    let maxNonConsecutive = 1;
    for (let i = 0; i < visibleRows.length; i++) {
      if (visibleRows[i].totalCount > maxTotal) {
        maxTotal = visibleRows[i].totalCount;
      }
      if (visibleRows[i].nonConsecutiveCount > maxNonConsecutive) {
        maxNonConsecutive = visibleRows[i].nonConsecutiveCount;
      }
    }

    const expandedSet = new Set(state.expandedGroupIds);
    const htmlChunks = [];

    for (let idx = 0; idx < visibleRows.length; idx++) {
      const row = visibleRows[idx];
      const rank = idx + 1;
      const totalPct =
        totalInputs > 0
          ? ((row.totalCount / totalInputs) * 100).toFixed(1)
          : "0.0";
      const nonConsecPct =
        totalNonConsecutive > 0
          ? ((row.nonConsecutiveCount / totalNonConsecutive) * 100).toFixed(1)
          : "0.0";
      const rateStr = row.repeatRate.toFixed(1);

      const totalBarWidth = Math.max(
        2,
        Math.round((row.totalCount / maxTotal) * 100),
      );
      const nonConsecBarWidth =
        row.nonConsecutiveCount > 0
          ? Math.max(
              2,
              Math.round((row.nonConsecutiveCount / maxNonConsecutive) * 100),
            )
          : 0;

      const hasExpandableChildren =
        state.groupMode === "key" && row.children.length > 1;
      const isExpanded = hasExpandableChildren && expandedSet.has(row.id);

      const rateClass =
        row.repeatRate >= 50
          ? "rate-pill high"
          : row.repeatRate === 0
            ? "rate-pill zero"
            : "rate-pill";

      let shortcutCellInner = "";
      if (hasExpandableChildren) {
        shortcutCellInner = `
          <div class="shortcut-cell">
            <div class="shortcut-main">
              <span class="expand-chevron ${isExpanded ? "open" : ""}">▸</span>
              ${renderShortcutKbdHtml(row.shortcut)}
            </div>
            <span class="group-count-badge">${row.children.length} コマンド合算</span>
          </div>`;
      } else {
        shortcutCellInner = `
          <div class="shortcut-cell">
            <div class="shortcut-main">
              ${renderShortcutKbdHtml(row.shortcut)}
              ${row.commandLabel ? `<span class="cmd-name">${escapeHtml(row.commandLabel)}</span>` : ""}
            </div>
          </div>`;
      }

      htmlChunks.push(`
        <tr
          class="ranking-row ${hasExpandableChildren ? "expandable" : ""}"
          ${hasExpandableChildren ? `data-action="toggle-group-row" data-group-id="${escapeHtml(row.id)}"` : ""}
        >
          <td class="col-rank ${rank <= 3 ? "rank-top" : ""}">${rank}</td>
          <td class="col-shortcut">${shortcutCellInner}</td>
          <td class="col-metric">
            <div class="metric-cell">
              <div class="metric-numbers">
                <span class="metric-count">${row.totalCount.toLocaleString()}</span>
                <span class="metric-pct">(${totalPct}%)</span>
              </div>
              <div class="bar-track">
                <div class="bar-fill" style="width:${totalBarWidth}%"></div>
              </div>
            </div>
          </td>
          <td class="col-metric">
            <div class="metric-cell">
              <div class="metric-numbers">
                <span class="metric-count">${row.nonConsecutiveCount.toLocaleString()}</span>
                <span class="metric-pct">(${nonConsecPct}%)</span>
              </div>
              <div class="bar-track">
                <div class="bar-fill secondary" style="width:${nonConsecBarWidth}%"></div>
              </div>
            </div>
          </td>
          <td class="col-rate">
            <span class="${rateClass}">${rateStr}%</span>
          </td>
        </tr>`);

      if (isExpanded) {
        for (const child of row.children) {
          const childShareInTotal =
            totalInputs > 0
              ? ((child.totalCount / totalInputs) * 100).toFixed(1)
              : "0.0";
          const childNonConsecPct =
            totalNonConsecutive > 0
              ? ((child.nonConsecutiveCount / totalNonConsecutive) * 100).toFixed(
                  1,
                )
              : "0.0";
          htmlChunks.push(`
            <tr class="breakdown-row">
              <td class="col-rank"></td>
              <td class="col-shortcut">
                <div class="breakdown-indent">
                  <span class="tree-branch">└</span>
                  <span class="cmd-name">${escapeHtml(child.commandLabel)}</span>
                </div>
              </td>
              <td class="col-metric">
                <div class="metric-numbers">
                  <span>${child.totalCount.toLocaleString()}</span>
                  <span class="metric-pct">(${childShareInTotal}%)</span>
                </div>
              </td>
              <td class="col-metric">
                <div class="metric-numbers">
                  <span>${child.nonConsecutiveCount.toLocaleString()}</span>
                  <span class="metric-pct">(${childNonConsecPct}%)</span>
                </div>
              </td>
              <td class="col-rate">
                <span class="rate-pill">${child.repeatRate.toFixed(1)}%</span>
              </td>
            </tr>`);
        }
      }
    }

    els.rankingTbody.innerHTML = htmlChunks.join("");
  }

  // --- Direct Filtered TSV Builder ---
  function copyCurrentViewAsTsv(format) {
    const {
      visibleRows,
      totalInputs,
      totalNonConsecutive,
      scopeLabel,
      extSummaryLabel,
    } = currentFilteredContext;

    if (visibleRows.length === 0) {
      showToast(`コピー対象の${scopeLabel}データがありません`, "info");
      return;
    }

    const baseTotal =
      totalInputs || visibleRows.reduce((s, r) => s + r.totalCount, 0);
    const baseNonConsec =
      totalNonConsecutive ||
      visibleRows.reduce((s, r) => s + r.nonConsecutiveCount, 0);

    let tsvText = "";
    let formatDesc = "";

    if (format === "unified") {
      const header = "キー\t全入力\t全入力%\t非連続\t非連続%\tリピート率";
      const lines = visibleRows.map((r) => {
        const tPct =
          baseTotal > 0 ? ((r.totalCount / baseTotal) * 100).toFixed(1) : "0.0";
        const ncPct =
          baseNonConsec > 0
            ? ((r.nonConsecutiveCount / baseNonConsec) * 100).toFixed(1)
            : "0.0";
        return `${r.tsvKey}\t${r.totalCount}\t${tPct}%\t${r.nonConsecutiveCount}\t${ncPct}%\t${r.repeatRate.toFixed(1)}%`;
      });
      tsvText = [header, ...lines].join("\n");
      formatDesc = "統合TSV";
    } else if (format === "raw") {
      const header = "キー\t回数\tパーセント";
      const lines = visibleRows.map((r) => {
        const pct =
          baseTotal > 0 ? ((r.totalCount / baseTotal) * 100).toFixed(1) : "0.0";
        return `${r.tsvKey}\t${r.totalCount}\t${pct}%`;
      });
      tsvText = [header, ...lines].join("\n");
      formatDesc = "全入力TSV";
    } else if (format === "dedup") {
      const header = "キー\t回数\tパーセント";
      const lines = visibleRows.map((r) => {
        const pct =
          baseNonConsec > 0
            ? ((r.nonConsecutiveCount / baseNonConsec) * 100).toFixed(1)
            : "0.0";
        return `${r.tsvKey}\t${r.nonConsecutiveCount}\t${pct}%`;
      });
      tsvText = [header, ...lines].join("\n");
      formatDesc = "非連続TSV";
    } else {
      const header = "キー\t回数\tパーセント";
      const rawLines = visibleRows.map((r) => {
        const pct =
          baseTotal > 0 ? ((r.totalCount / baseTotal) * 100).toFixed(1) : "0.0";
        return `${r.tsvKey}\t${r.totalCount}\t${pct}%`;
      });
      const dedupSorted = visibleRows
        .slice()
        .sort((a, b) => b.nonConsecutiveCount - a.nonConsecutiveCount);
      const dedupLines = dedupSorted.map((r) => {
        const pct =
          baseNonConsec > 0
            ? ((r.nonConsecutiveCount / baseNonConsec) * 100).toFixed(1)
            : "0.0";
        return `${r.tsvKey}\t${r.nonConsecutiveCount}\t${pct}%`;
      });
      tsvText = `【${scopeLabel} - 現行の統計 (全入力)】\n${[header, ...rawLines].join("\n")}\n\n【${scopeLabel} - 連続除外統計 (非連続)】\n${[header, ...dedupLines].join("\n")}`;
      formatDesc = "2表TSV";
    }

    const groupTag = state.groupMode === "key" ? " / 物理キー合算" : "";
    vscode.postMessage({
      command: "copyDirectText",
      text: tsvText,
      infoMessage: `[${scopeLabel} / ${extSummaryLabel}${groupTag}] ${formatDesc}（${visibleRows.length} 件）をコピーしました`,
    });
  }

  // --- Event Delegation ---
  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;

    if (!els.tsvMenuContainer.contains(target)) {
      els.tsvDropdown.classList.add("hidden");
    }

    // モーダル背景の直接クリックで閉じる
    if (target === els.modalBackdrop) {
      closeModal();
      return;
    }

    const actionEl = target.closest("[data-action]");
    if (!actionEl) return;

    const action = actionEl.getAttribute("data-action");
    switch (action) {
      case "switch-mode": {
        const nextMode = actionEl.getAttribute("data-mode");
        if (nextMode === "global" || nextMode === "session") {
          state.mode = nextMode;
          persistState();
          renderAll();
        }
        break;
      }

      case "refresh":
        vscode.postMessage({ command: "refresh" });
        break;

      case "toggle-session":
        vscode.postMessage({
          command: appData.session.isActive ? "stopSession" : "startSession",
          sessionName: els.sessionNameInput.value.trim(),
        });
        break;

      case "open-export-modal":
        openModal("exportSession");
        break;

      case "browse-export-dir":
        vscode.postMessage({
          command: "browseExportDir",
          currentDir: els.exportDirInput.value.trim(),
        });
        break;

      case "submit-export-keep":
        submitSessionExport(false);
        break;

      case "submit-export-reset":
        submitSessionExport(true);
        break;

      case "open-import-modal":
        openModal("importJson");
        break;

      case "browse-import-file":
        vscode.postMessage({ command: "browseImportFile" });
        break;

      case "submit-import-json": {
        const rawJson = els.importJsonTextarea.value.trim();
        if (!rawJson) {
          els.importModalError.textContent =
            "JSONデータを貼り付けるか、ファイルから読み込んでください。";
          els.importModalError.classList.remove("hidden");
          break;
        }
        els.importModalError.classList.add("hidden");
        vscode.postMessage({ command: "executeImportJson", rawJson });
        break;
      }

      case "open-reset-session-modal":
        if (!els.btnSessionReset.disabled) {
          openModal("resetSession");
        }
        break;

      case "open-reset-global-modal":
        openModal("resetGlobal");
        break;

      case "execute-confirmed-reset": {
        const targetModal = activeModalId;
        closeModal();
        if (targetModal === "resetSession") {
          vscode.postMessage({ command: "confirmResetSession" });
        } else if (targetModal === "resetGlobal") {
          vscode.postMessage({ command: "confirmResetGlobal" });
        }
        break;
      }

      case "close-modal":
        closeModal();
        break;

      case "toggle-diff-accordion": {
        const currentlyExpanded =
          els.diffToggleBtn.getAttribute("aria-expanded") === "true";
        state.diffExpanded = !currentlyExpanded;
        persistState();
        renderDiffSection();
        break;
      }

      case "recalc-diff":
        vscode.postMessage({ command: "recalcDiff" });
        break;

      case "filter-diff": {
        const dtype = actionEl.getAttribute("data-diff-type") || "all";
        state.diffFilter = dtype;
        persistState();
        renderDiffSection();
        break;
      }

      case "copy-diff-json":
        vscode.postMessage({ command: "copyKeybindingsDiffJson" });
        break;

      case "toggle-ext-chip": {
        const ext = actionEl.getAttribute("data-ext");
        if (!ext) break;
        const current = getActiveSelectedExts().slice();
        const idx = current.indexOf(ext);
        if (idx >= 0) {
          current.splice(idx, 1);
        } else {
          current.push(ext);
        }
        setActiveSelectedExts(current);
        persistState();
        renderAll();
        break;
      }

      case "clear-ext-filter":
        setActiveSelectedExts([]);
        persistState();
        renderAll();
        break;

      case "clear-search":
        state.searchQuery = "";
        els.searchInput.value = "";
        persistState();
        renderAll();
        els.searchInput.focus();
        break;

      case "set-grouping": {
        const gmode = actionEl.getAttribute("data-group-mode");
        if (gmode === "command" || gmode === "key") {
          state.groupMode = gmode;
          persistState();
          renderAll();
        }
        break;
      }

      case "sort-column": {
        const colKey = actionEl.getAttribute("data-sort-key");
        if (!colKey) break;
        if (state.sortKey === colKey) {
          state.sortDir = state.sortDir === "desc" ? "asc" : "desc";
        } else {
          state.sortKey = colKey;
          state.sortDir = colKey === "key" ? "asc" : "desc";
        }
        persistState();
        renderAll();
        break;
      }

      case "toggle-group-row": {
        const gid = actionEl.getAttribute("data-group-id");
        if (!gid) break;
        const idx = state.expandedGroupIds.indexOf(gid);
        if (idx >= 0) {
          state.expandedGroupIds.splice(idx, 1);
        } else {
          state.expandedGroupIds.push(gid);
        }
        persistState();
        renderAll();
        break;
      }

      case "copy-tsv-now":
        els.tsvDropdown.classList.add("hidden");
        copyCurrentViewAsTsv(state.tsvFormat);
        break;

      case "toggle-tsv-menu":
        els.tsvDropdown.classList.toggle("hidden");
        break;

      case "select-tsv-format": {
        const fmt = actionEl.getAttribute("data-tsv-format") || "unified";
        state.tsvFormat = fmt;
        persistState();
        els.tsvDropdown.classList.add("hidden");
        renderAll();
        copyCurrentViewAsTsv(fmt);
        break;
      }

      case "copy-json":
        vscode.postMessage({
          command: state.mode === "session" ? "copySessionJson" : "copyJson",
        });
        break;
    }
  });

  // セッション名の即時保存（変更確定時・Enter押下時）
  if (els.sessionNameInput) {
    els.sessionNameInput.addEventListener("change", () => {
      vscode.postMessage({
        command: "updateSessionName",
        name: els.sessionNameInput.value,
      });
    });
    els.sessionNameInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        els.sessionNameInput.blur();
      }
    });
  }

  // 保存モーダル入力変更時のパスプレビュー更新
  [els.exportSessionName, els.exportDirInput, els.chkExportSubdir].forEach(
    (el) => {
      if (!el) return;
      el.addEventListener("input", updateExportPathPreview);
      el.addEventListener("change", updateExportPathPreview);
    },
  );

  // リアルタイム検索
  els.searchInput.addEventListener("input", () => {
    state.searchQuery = els.searchInput.value;
    persistState();
    renderAll();
  });

  // キーボードショートカット (/ フォーカス、Esc モーダル/メニュー/検索クリア)
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (activeModalId) {
        event.preventDefault();
        closeModal();
        return;
      }
      if (!els.tsvDropdown.classList.contains("hidden")) {
        els.tsvDropdown.classList.add("hidden");
        return;
      }
      if (state.searchQuery.length > 0) {
        state.searchQuery = "";
        els.searchInput.value = "";
        persistState();
        renderAll();
      } else if (document.activeElement === els.searchInput) {
        els.searchInput.blur();
      }
      return;
    }

    if (
      event.key === "/" &&
      !activeModalId &&
      document.activeElement !== els.searchInput &&
      !(document.activeElement instanceof HTMLInputElement) &&
      !(document.activeElement instanceof HTMLTextAreaElement)
    ) {
      event.preventDefault();
      els.searchInput.focus();
      els.searchInput.select();
    }
  });

  // Extension Host からのメッセージ受信
  window.addEventListener("message", (event) => {
    const msg = event.data;
    if (!msg) return;

    switch (msg.type) {
      case "statsUpdate":
        if (msg.payload) {
          applyIncomingPayload(msg.payload);
        }
        break;

      case "navigate":
        if (msg.mode === "global" || msg.mode === "session") {
          state.mode = msg.mode;
          persistState();
          renderAll();
        }
        if (msg.modal) {
          openModal(msg.modal);
        }
        break;

      case "exportDirPicked":
        if (typeof msg.dirPath === "string") {
          appData.lastExportDir = msg.dirPath;
          els.exportDirInput.value = msg.dirPath;
          els.exportModalError.classList.add("hidden");
          updateExportPathPreview();
        }
        break;

      case "exportSessionResult":
        isSubmittingExport = false;
        els.btnExecExportKeep.disabled = false;
        els.btnExecExportReset.disabled = false;

        if (!msg.ok) {
          els.exportModalError.textContent =
            msg.error || "保存中にエラーが発生しました。";
          els.exportModalError.classList.remove("hidden");
          break;
        }

        closeModal();
        {
          const count = Array.isArray(msg.savedFiles)
            ? msg.savedFiles.length
            : 0;
          const resetSuffix = msg.resetPerformed
            ? "（セッションをリセットしました）"
            : "";
          const actions = [];
          if (msg.outputDirPath) {
            actions.push({
              label: "📂 保存フォルダを表示",
              onClick: () =>
                vscode.postMessage({
                  command: "openExportedPath",
                  filePath: msg.outputDirPath,
                  revealInOs: true,
                }),
            });
          }
          if (msg.primaryFilePath) {
            actions.push({
              label: "📄 ファイルを開く",
              onClick: () =>
                vscode.postMessage({
                  command: "openExportedPath",
                  filePath: msg.primaryFilePath,
                  revealInOs: false,
                }),
            });
          }
          showToast(
            `${count} 件のセッションファイルを保存しました${resetSuffix}`,
            "success",
            actions,
          );
        }
        break;

      case "importFileLoaded":
        if (typeof msg.content === "string") {
          els.importJsonTextarea.value = msg.content;
          els.importModalError.classList.add("hidden");
          if (msg.fileName) {
            els.importFileBadge.textContent = `読み込み元: ${msg.fileName}`;
            els.importFileBadge.classList.remove("hidden");
          }
        }
        break;

      case "importJsonResult":
        if (!msg.ok) {
          els.importModalError.textContent =
            msg.error || "インポートに失敗しました。";
          els.importModalError.classList.remove("hidden");
          break;
        }
        closeModal();
        els.importJsonTextarea.value = "";
        showToast(
          `統計データをインポートしました（${msg.addedKeysCount} 項目 / 計 ${Number(msg.addedTotalCount || 0).toLocaleString()} 回を加算）`,
          "success",
        );
        break;

      case "toast":
        if (msg.message) {
          showToast(msg.message, msg.kind || "info");
        }
        break;
    }
  });

  function applyIncomingPayload(payload) {
    appData = payload;
    if (typeof payload.serverNowMs === "number") {
      clockOffsetMs = payload.serverNowMs - Date.now();
    }
    syncSessionTimerLoop();
    renderAll();
  }

  // --- Bootstrap ---
  const initialJsonEl = document.getElementById("initial-data");
  if (initialJsonEl && initialJsonEl.textContent) {
    try {
      const parsed = JSON.parse(initialJsonEl.textContent);
      applyIncomingPayload(parsed);
    } catch {
      renderAll();
    }
  } else {
    renderAll();
  }

  vscode.postMessage({ command: "ready" });
})();

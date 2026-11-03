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
  };

  function persistState() {
    vscode.setState(state);
  }

  // --- Data Store ---
  let appData = {
    statsByExt: {},
    lastTrackedKey: null,
    session: {
      isActive: false,
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

  // 現在画面に表示されている行キャッシュ（TSV即時出力用）
  let currentFilteredContext = {
    visibleRows: [],
    totalInputs: 0,
    totalNonConsecutive: 0,
    scopeLabel: "累計統計",
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

  /**
   * "cursorUp (alt+k)" -> { commandLabel: "cursorUp", shortcut: "alt+k" }
   * "alt+k" -> { commandLabel: "", shortcut: "alt+k" }
   */
  const parseCache = new Map();
  function parseKeyEntry(rawKey) {
    const keyStr = String(rawKey || "");
    const cached = parseCache.get(keyStr);
    if (cached) {
      return cached;
    }

    let commandLabel = "";
    let shortcut = keyStr.trim();

    // 末尾の "(...)" をショートカットキーとして抽出
    const match = /^(.*?)\s*\(([^()]+)\)\s*$/.exec(keyStr);
    if (match && match[2].trim()) {
      commandLabel = match[1].trim();
      shortcut = match[2].trim();
    }

    const parsed = { rawKey: keyStr, commandLabel, shortcut };
    parseCache.set(keyStr, parsed);
    return parsed;
  }

  /**
   * "ctrl++" や "shift+alt+k" をキー単位の配列に分解
   */
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

  /**
   * ショートカット文字列 ("alt+f alt+e" 等) を <kbd> バッジ列の HTML に変換
   */
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
      ms += Math.max(0, nowMs - startMs);
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
          sortLabel: parsed.shortcut.toLowerCase() + " " + parsed.commandLabel.toLowerCase(),
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

    // 物理キー単位での合算モード
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
      // タイブレーカー: 総数降順 -> キー名昇順
      if (b.totalCount !== a.totalCount) {
        return b.totalCount - a.totalCount;
      }
      return a.sortLabel.localeCompare(b.sortLabel);
    });

    return filtered;
  }

  // --- DOM Rendering ---
  const els = {
    lastKeyContent: document.getElementById("last-key-content"),
    modeTabGlobal: document.getElementById("mode-tab-global"),
    modeTabSession: document.getElementById("mode-tab-session"),
    badgeGlobalCount: document.getElementById("badge-global-count"),
    badgeSessionStatus: document.getElementById("badge-session-status"),

    sessionHero: document.getElementById("session-hero"),
    sessionLiveBadge: document.getElementById("session-live-badge"),
    sessionLiveText: document.getElementById("session-live-text"),
    sessionDuration: document.getElementById("session-duration"),
    sessionStartedAt: document.getElementById("session-started-at"),
    sessionSnapshotInfo: document.getElementById("session-snapshot-info"),
    btnSessionToggle: document.getElementById("btn-session-toggle"),

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
  };

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
      els.badgeSessionStatus.textContent = "停止中";
    }

    if (state.mode === "session") {
      els.sessionDuration.textContent = formatDurationJa(durationMs);
      // セッションモード時は1分あたりペースも更新
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
    const diff = appData.session.keybindingsDiff;
    if (state.mode !== "session" || !diff) {
      els.diffSection.classList.add("hidden");
      return;
    }

    els.diffSection.classList.remove("hidden");

    const totalChanges = Array.isArray(diff.diffs) ? diff.diffs.length : 0;
    const isExpanded =
      state.diffExpanded !== null
        ? state.diffExpanded
        : totalChanges > 0 && totalChanges <= 6;

    els.diffToggleBtn.setAttribute("aria-expanded", String(isExpanded));
    els.diffChevron.classList.toggle("expanded", isExpanded);
    els.diffBody.classList.toggle("hidden", !isExpanded);
    els.btnCopyDiffJson.classList.toggle("hidden", totalChanges === 0);

    if (totalChanges === 0) {
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

    // フィルタボタン状態同期
    els.diffFilterGroup.querySelectorAll(".seg-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.diffType === state.diffFilter);
    });

    if (!isExpanded) {
      return;
    }

    const filteredDiffs =
      state.diffFilter === "all"
        ? diff.diffs
        : diff.diffs.filter((d) => d.type === state.diffFilter);

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

    // 2. モードタブと全体カウントバッジ
    const globalExtInfo = computeExtensionList(appData.statsByExt);
    els.badgeGlobalCount.textContent = globalExtInfo.grandTotal.toLocaleString();

    els.modeTabGlobal.classList.toggle("active", !isSessionMode);
    els.modeTabGlobal.setAttribute("aria-selected", String(!isSessionMode));
    els.modeTabSession.classList.toggle("active", isSessionMode);
    els.modeTabSession.setAttribute("aria-selected", String(isSessionMode));

    els.sessionHero.classList.toggle("hidden", !isSessionMode);
    els.globalActionsGroup.classList.toggle("hidden", isSessionMode);

    // 3. セッションコントロールパネル更新
    if (isSessionMode) {
      const sess = appData.session;
      els.sessionHero.classList.toggle("is-active", sess.isActive);
      els.sessionLiveBadge.className = sess.isActive
        ? "live-status-badge active"
        : "live-status-badge inactive";
      els.sessionLiveText.textContent = sess.isActive ? "計測中" : "停止中";
      els.sessionStartedAt.textContent = sess.startedAt
        ? new Date(sess.startedAt).toLocaleString("ja-JP")
        : "(未開始)";
      els.sessionSnapshotInfo.textContent = sess.initialKeybindingsCount
        ? `保存済み (${sess.initialKeybindingsCount.toLocaleString()} 件)`
        : "未保存";

      if (sess.isActive) {
        els.btnSessionToggle.className = "btn btn-secondary";
        els.btnSessionToggle.textContent = "⏸ 計測を一時停止";
      } else {
        els.btnSessionToggle.className = "btn btn-primary";
        els.btnSessionToggle.textContent = sess.startedAt
          ? "▶ 計測を再開"
          : "▶ 計測を開始";
      }
    }

    // 4. 拡張子フィルタチップの構築と無効な選択のクリーンアップ
    const extInfo = isSessionMode
      ? computeExtensionList(activeStatsByExt)
      : globalExtInfo;
    const availableExtSet = new Set(extInfo.list.map((item) => item.ext));
    let selectedExts = getActiveSelectedExts().filter((e) =>
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

    // 5. 選択された拡張子で集計・グルーピング・ソート
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
    const repeatRateStr = repeatRateNum.toFixed(1);

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
    els.kpiRepeatRate.textContent = repeatRateStr;
    els.kpiRepeatBar.style.width = `${Math.min(100, Math.max(0, repeatRateNum)).toFixed(1)}%`;
    els.kpiSubRepeat.textContent = `連続打鍵: ${consecutiveInputs.toLocaleString()} 回`;

    els.kpiTitleUnique.textContent =
      state.groupMode === "key" ? "使用物理キー数" : "使用コマンド数";
    els.kpiUniqueCount.textContent = allBuiltRows.length.toLocaleString();
    els.kpiUniqueUnit.textContent = state.groupMode === "key" ? "キー" : "項目";

    // 最頻出ショートカット表示
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

    // 7. ヘッダータイマーと差分セクションの描画
    renderHeaderAndTimersOnly();
    renderDiffSection();

    // 8. ツールバー状態同期（グルーピング・検索・TSVフォーマット表示・ソート矢印）
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

    // 9. ランキングテーブル本体の描画
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
          : "「▶ 計測を開始」を押して特定期間のショートカット使用状況を記録できます。"
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

    // インライン横棒バーの相対スケール基準（最大値＝100%幅）を算出
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
        totalInputs > 0 ? ((row.totalCount / totalInputs) * 100).toFixed(1) : "0.0";
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

      // 物理キー合算モードの内訳サブ行
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
    const { visibleRows, totalInputs, totalNonConsecutive, scopeLabel, extSummaryLabel } =
      currentFilteredContext;

    if (visibleRows.length === 0) {
      vscode.postMessage({
        command: "copyDirectText",
        text: "",
        infoMessage: `コピー対象の${scopeLabel}データがありません。`,
      });
      return;
    }

    // 選択された行集合に対する合計値（検索中でも全体比がずれないよう集計母数を使用、0の場合は行合計にフォールバック）
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
      infoMessage: `[${scopeLabel} / ${extSummaryLabel}${groupTag}] ${formatDesc}（${visibleRows.length} 件）をクリップボードにコピーしました。`,
    });
  }

  // --- Event Delegation ---
  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;

    // TSVドロップダウン外クリックで閉じる
    if (!els.tsvMenuContainer.contains(target)) {
      els.tsvDropdown.classList.add("hidden");
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
        });
        break;

      case "export-session-dir":
        vscode.postMessage({ command: "exportSessionToDirectory" });
        break;

      case "reset-session":
        vscode.postMessage({ command: "resetSession" });
        break;

      case "toggle-diff-accordion": {
        const currentlyExpanded =
          els.diffToggleBtn.getAttribute("aria-expanded") === "true";
        state.diffExpanded = !currentlyExpanded;
        persistState();
        renderDiffSection();
        break;
      }

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

      case "open-tsv-quickpick":
        els.tsvDropdown.classList.add("hidden");
        vscode.postMessage({
          command: state.mode === "session" ? "copySessionTsv" : "copyTsv",
        });
        break;

      case "copy-json":
        vscode.postMessage({
          command: state.mode === "session" ? "copySessionJson" : "copyJson",
        });
        break;

      case "import-json":
        vscode.postMessage({ command: "importJson" });
        break;

      case "reset-global":
        vscode.postMessage({ command: "reset" });
        break;
    }
  });

  // リアルタイムインクリメンタル検索
  els.searchInput.addEventListener("input", () => {
    state.searchQuery = els.searchInput.value;
    persistState();
    renderAll();
  });

  // キーボードショートカット (/ で検索フォーカス、Esc で検索/メニュー解除)
  document.addEventListener("keydown", (event) => {
    if (
      event.key === "/" &&
      document.activeElement !== els.searchInput &&
      !(document.activeElement instanceof HTMLInputElement)
    ) {
      event.preventDefault();
      els.searchInput.focus();
      els.searchInput.select();
    } else if (event.key === "Escape") {
      if (!els.tsvDropdown.classList.contains("hidden")) {
        els.tsvDropdown.classList.add("hidden");
      } else if (state.searchQuery.length > 0) {
        state.searchQuery = "";
        els.searchInput.value = "";
        persistState();
        renderAll();
      } else if (document.activeElement === els.searchInput) {
        els.searchInput.blur();
      }
    }
  });

  // Extension Host からのライブデータ受信
  window.addEventListener("message", (event) => {
    const msg = event.data;
    if (msg && msg.type === "statsUpdate" && msg.payload) {
      applyIncomingPayload(msg.payload);
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

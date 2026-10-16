[
  //#region 基本カーソル移動系
  {
    key: "alt+h",
    command: "cursorLeft",
  },
  {
    key: "shift+alt+h",
    command: "cursorWordLeft",
    when: "textInputFocus",
  },
  {
    key: "alt+l",
    command: "cursorRight",
  },
  {
    key: "shift+alt+l",
    command: "cursorWordEndRight",
    when: "textInputFocus",
  },
  {
    key: "alt+k",
    command: "cursorUp",
    when: "textInputFocus",
  },
  {
    key: "alt+j",
    command: "cursorDown",
    when: "textInputFocus",
  },
  //#endregion

  //#region スクロール系
  {
    key: "shift+alt+k",
    command: "editorScroll",
    args: {
      to: "up",
      by: "wrappedLine",
      value: 10,
      revealCursor: false,
    },
    when: "textInputFocus && !inReferenceSearchEditor",
  },
  {
    key: "shift+alt+j",
    command: "editorScroll",
    args: {
      to: "down",
      by: "wrappedLine",
      value: 10,
      revealCursor: false,
    },
    when: "textInputFocus && !inReferenceSearchEditor",
  },
  {
    key: "shift+alt+k",
    command: "editorScroll",
    args: {
      to: "up",
      by: "wrappedLine",
      value: 4,
      revealCursor: false,
    },
    when: "inReferenceSearchEditor && !editorReadonly",
  },
  {
    key: "shift+alt+j",
    command: "editorScroll",
    args: {
      to: "down",
      by: "wrappedLine",
      value: 4,
      revealCursor: false,
    },
    when: "inReferenceSearchEditor && !editorReadonly",
  },
  //#endregion

  //#region カーソルジャンプ系
  {
    key: "ctrl+alt+h",
    command: "runCommands",
    args: {
      commands: ["cursorHome", "cursorWordEndRight"],
    },
    when: "textInputFocus",
  },
  {
    key: "ctrl+alt+l",
    command: "runCommands",
    args: { commands: ["cursorEnd", "cursorWordLeft"] },
    when: "textInputFocus",
  },
  {
    key: "alt+enter",
    command: "runCommands",
    args: {
      commands: [
        {
          command: "cursorMove",
          args: {
            to: "viewPortTop",
            by: "wrappedLine",
          },
        },
        {
          command: "cursorMove",
          args: { to: "down", value: 19, by: "wrappedLine" },
        },
        {
          command: "cursorEnd",
        },
      ],
    },
    when: "editorTextFocus && !findInputFocussed && !inReferenceSearchEditor",
  },
  {
    key: "alt+enter",
    command: "runCommands",
    args: {
      commands: [
        {
          command: "cursorMove",
          args: {
            to: "viewPortTop",
            by: "wrappedLine",
          },
        },
        {
          command: "cursorMove",
          args: { to: "down", value: 5, by: "wrappedLine" },
        },
        {
          command: "cursorEnd",
        },
      ],
    },
    when: "editorTextFocus && !findInputFocussed && inReferenceSearchEditor",
  },
  {
    key: "ctrl+alt+enter",
    command: "runCommands",
    args: {
      commands: [
        {
          command: "cursorMove",
          args: {
            to: "viewPortTop",
            by: "wrappedLine",
          },
        },
        {
          command: "cursorEnd",
        },
      ],
    },
    when: "editorTextFocus && !replaceInputFocussed",
  },
  {
    key: "ctrl+alt+k",
    command: "cursorMove",
    args: {
      to: "prevBlankLine",
    },
    when: "editorTextFocus",
  },
  {
    key: "ctrl+alt+j",
    command: "cursorMove",
    args: {
      to: "nextBlankLine",
    },
    when: "editorTextFocus",
  },
  {
    key: "alt+,",
    command: "editor.action.marker.prev",
    when: "editorFocus",
  },
  {
    key: "shift+alt+,",
    command: "editor.action.marker.next",
    when: "editorFocus",
  },
  {
    key: "ctrl+alt+,",
    command: "workbench.action.editor.nextChange",
    when: "editorTextFocus && !textCompareEditorActive && quickDiffDecorationCount != '0'",
  },
  {
    key: "ctrl+shift+alt+,",
    command: "workbench.action.editor.previousChange",
    when: "editorTextFocus && !textCompareEditorActive && quickDiffDecorationCount != '0'",
  },
  //#endregion

  //#region ナビゲーション・ジャンプ系
  {
    key: "alt+m",
    command: "editor.action.peekDefinition",
    when: "editorHasDefinitionProvider && editorTextFocus && !inReferenceSearchEditor && !isInEmbeddedEditor",
  },
  {
    key: "alt+shift+m",
    command: "togglePeekWidgetFocus",
    when: "referenceSearchVisible",
  },
  {
    key: "shift+alt+m",
    command: "editor.action.goToReferences",
    when: "editorHasReferenceProvider && editorTextFocus && !inReferenceSearchEditor && !isInEmbeddedEditor && !inSnippetMode",
  },
  {
    key: "ctrl+alt+m",
    command: "editor.action.goToImplementation",
    when: "editorHasImplementationProvider && editorTextFocus",
  },
  {
    key: "alt+f alt+m",
    command: "editor.action.revealDefinitionAside",
    when: "editorHasDefinitionProvider && editorTextFocus && !isInEmbeddedEditor",
  },
  {
    key: "alt+g",
    command: "editor.action.accessibleViewGoToSymbol",
    when: "accessibilityHelpIsShown && accessibleViewGoToSymbolSupported || accessibleViewGoToSymbolSupported && accessibleViewIsShown",
  },
  {
    key: "alt+g",
    command: "workbench.action.gotoSymbol",
    when: "!accessibilityHelpIsShown && !accessibleViewIsShown",
  },
  {
    key: "shift+alt+g",
    command: "workbench.action.showAllSymbols",
  },
  {
    key: "ctrl+shift+alt+h",
    command: "workbench.action.navigateBack",
    when: "canNavigateBack",
  },
  {
    key: "ctrl+shift+alt+l",
    command: "workbench.action.navigateForward",
    when: "canNavigateForward",
  },
  //#endregion

  //#region スマート範囲選択系
  {
    key: "alt+o",
    command: "editor.action.smartSelect.expand",
  },
  {
    key: "shift+alt+o",
    command: "editor.action.smartSelect.shrink",
  },
  {
    key: "alt+i",
    command: "editor.action.addSelectionToNextFindMatch",
    when: "editorFocus",
  },
  {
    key: "shift+alt+i",
    command: "cursorUndo",
    when: "editorFocus",
  },
  {
    key: "alt+f alt+i",
    command: "editor.action.selectHighlights",
    when: "editorFocus",
  },
  {
    key: "ctrl+alt+i",
    command: "editor.action.moveSelectionToNextFindMatch",
    when: "editorFocus",
  },
  //#endregion

  //#region 選択アンカー＋アクション即時実行（通常確定 & 行末確定）
  {
    key: "ctrl+shift+alt+k",
    command: "editor.action.insertCursorAbove",
    when: "editorTextFocus",
  },
  {
    key: "ctrl+shift+alt+j",
    command: "editor.action.insertCursorBelow",
    when: "editorTextFocus",
  },
  {
    key: "alt+f alt+a",
    command: "editor.action.insertCursorAtEndOfEachLineSelected",
    when: "editorTextFocus",
  },

  // ==========================================
  // 1. 通常確定（カーソル位置まで）
  // ==========================================
  {
    key: "alt+a",
    command: "editor.action.setSelectionAnchor",
    when: "editorTextFocus && !selectionAnchorSet",
  },
  {
    key: "alt+a",
    command: "editor.action.selectFromAnchorToCursor",
    when: "editorTextFocus && selectionAnchorSet",
  },
  {
    key: "alt+y",
    command: "runCommands",
    args: {
      commands: [
        "editor.action.selectFromAnchorToCursor",
        "editor.action.clipboardCopyAction",
      ],
    },
    when: "editorTextFocus && selectionAnchorSet",
  },
  {
    key: "alt+d",
    command: "runCommands",
    args: {
      commands: [
        "editor.action.selectFromAnchorToCursor",
        "editor.action.clipboardCutAction",
      ],
    },
    when: "editorTextFocus && selectionAnchorSet",
  },
  {
    key: "alt+b",
    command: "runCommands",
    args: {
      commands: ["editor.action.selectFromAnchorToCursor", "deleteLeft"],
    },
    when: "editorTextFocus && selectionAnchorSet",
  },
  {
    key: "alt+p",
    command: "runCommands",
    args: {
      commands: [
        "editor.action.selectFromAnchorToCursor",
        "editor.action.clipboardPasteAction",
      ],
    },
    when: "editorTextFocus && selectionAnchorSet",
  },

  // ==========================================
  // 2. 行末確定（最終行の改行まで含めて即時実行）
  // ==========================================
  // 行頭にアンカーセット
  {
    key: "shift+alt+a",
    command: "runCommands",
    args: {
      commands: [
        "cursorLineStart",
        "editor.action.setSelectionAnchor",
        "cursorUndo",
      ],
    },
    when: "editorTextFocus && !selectionAnchorSet",
  },
  // 行末まで確定のみ
  {
    key: "shift+alt+a",
    command: "runCommands",
    args: {
      commands: [
        "cursorDown",
        "cursorLineStart",
        "editor.action.selectFromAnchorToCursor",
      ],
    },
    when: "editorTextFocus && selectionAnchorSet",
  },
  // 行末までコピー
  {
    key: "shift+alt+y",
    command: "runCommands",
    args: {
      commands: [
        "cursorDown",
        "cursorLineStart",
        "editor.action.selectFromAnchorToCursor",
        "editor.action.clipboardCopyAction",
      ],
    },
    when: "editorTextFocus && selectionAnchorSet",
  },
  // 行末まで切り取り（行全体のカット）
  {
    key: "shift+alt+d",
    command: "runCommands",
    args: {
      commands: [
        "cursorDown",
        "cursorLineStart",
        "editor.action.selectFromAnchorToCursor",
        "editor.action.clipboardCutAction",
      ],
    },
    when: "editorTextFocus && selectionAnchorSet",
  },
  // 行末まで削除（行全体の削除）
  {
    key: "shift+alt+b",
    command: "runCommands",
    args: {
      commands: [
        "cursorDown",
        "cursorLineStart",
        "editor.action.selectFromAnchorToCursor",
        "deleteLeft",
      ],
    },
    when: "editorTextFocus && selectionAnchorSet",
  },
  // 行末までペースト（行全体を上書き貼り付け）
  {
    key: "shift+alt+p",
    command: "runCommands",
    args: {
      commands: [
        "cursorDown",
        "cursorLineStart",
        "editor.action.selectFromAnchorToCursor",
        "editor.action.clipboardPasteAction",
      ],
    },
    when: "editorTextFocus && selectionAnchorSet",
  },
  //#endregion

  //#region テキスト編集・行操作系
  {
    key: "shift+space",
    command: "runCommands",
    when: "editorTextFocus && !editorReadonly && !isComposing",
    args: {
      commands: [
        {
          command: "type",
          args: { text: " " },
        },
        "cursorLeft",
      ],
    },
  },
  {
    key: "alt+/",
    command: "editor.action.commentLine",
    when: "editorTextFocus && !editorReadonly",
  },
  {
    key: "shift+alt+/",
    command: "editor.action.blockComment",
    when: "editorTextFocus && !editorReadonly",
  },
  {
    key: "alt+[",
    command: "editor.action.insertLineBefore",
    when: "editorTextFocus && !editorReadonly",
  },
  {
    key: "alt+]",
    command: "editor.action.insertLineAfter",
    when: "editorTextFocus && !editorReadonly",
  },
  {
    key: "ctrl+alt+[",
    command: "editor.action.moveLinesUpAction",
    when: "editorTextFocus && !editorReadonly",
  },
  {
    key: "ctrl+alt+]",
    command: "editor.action.moveLinesDownAction",
    when: "editorTextFocus && !editorReadonly",
  },
  {
    key: "shift+alt+[",
    command: "editor.action.copyLinesUpAction",
    when: "editorTextFocus && !editorReadonly",
  },
  {
    key: "shift+alt+]",
    command: "editor.action.copyLinesDownAction",
    when: "editorTextFocus && !editorReadonly",
  },
  //#endregion

  //#region テキスト削除系
  {
    key: "alt+b",
    command: "deleteLeft",
    when: "textInputFocus && !selectionAnchorSet",
  },
  {
    key: "alt+n",
    command: "deleteRight",
    when: "textInputFocus",
  },
  {
    key: "shift+alt+b",
    command: "deleteWordLeft",
    when: "textInputFocus && !selectionAnchorSet",
  },
  {
    key: "shift+alt+n",
    command: "deleteWordRight",
    when: "textInputFocus",
  },
  {
    key: "shift+alt+d",
    command: "editor.action.deleteLines",
    when: "textInputFocus && !editorReadonly && !selectionAnchorSet",
  },
  {
    key: "alt+f alt+d",
    command: "runCommands",
    args: {
      commands: ["cursorHome", "deleteAllRight"],
    },
    when: "textInputFocus && !editorReadonly && !editorHasSelection",
  },
  {
    key: "alt+f alt+d",
    command: "runCommands",
    args: {
      commands: ["editor.action.deleteLines", "editor.action.insertLineBefore"],
    },
    when: "textInputFocus && !editorReadonly && editorHasSelection",
  },
  {
    key: "ctrl+alt+d",
    command: "editor.action.joinLines",
    when: "editorTextFocus && !editorReadonly",
  },
  //#endregion

  //#region 基本操作系（クリップボード・履歴・保存）
  {
    key: "alt+y",
    command: "editor.action.clipboardCopyAction",
    when: "!selectionAnchorSet",
  },
  {
    key: "alt+d",
    command: "editor.action.clipboardCutAction",
    when: "!selectionAnchorSet",
  },
  {
    key: "alt+p",
    command: "editor.action.clipboardPasteAction",
    when: "!selectionAnchorSet",
  },
  {
    key: "ctrl+alt+p",
    command: "runCommands",
    args: {
      commands: [
        "editor.action.insertLineAfter",
        "editor.action.clipboardPasteAction",
      ],
    },
    when: "!selectionAnchorSet",
  },
  {
    key: "alt+u",
    command: "undo",
  },
  {
    key: "alt+r",
    command: "redo",
    when: "!searchViewletFocus && !chatFindWidgetVisible",
  },
  {
    key: "shift+alt+u",
    command: "redo",
  },
  {
    key: "shift+alt+enter",
    command: "saveAll",
  },
  {
    key: "alt+c",
    command: "editor.action.selectAll",
  },
  {
    key: "alt+c",
    command: "list.selectAll",
    when: "listFocus && listSupportsMultiselect && !inputFocus && !treestickyScrollFocused",
  },
  //#endregion

  //#region クリップボード操作拡張系
  {
    key: "shift+alt+c",
    command: "runCommands",
    args: {
      commands: [
        "editor.action.selectAll",
        "editor.action.clipboardCopyAction",
      ],
    },
  },
  {
    key: "shift+alt+y",
    command: "runCommands",
    args: {
      commands: [
        "editor.action.addSelectionToNextFindMatch",
        "editor.action.clipboardCopyAction",
      ],
    },
    when: "editorTextFocus && !editorHasSelection && !selectionAnchorSet",
  },
  {
    key: "shift+alt+p",
    command: "runCommands",
    args: {
      commands: [
        "editor.action.addSelectionToNextFindMatch",
        "editor.action.clipboardPasteAction",
      ],
    },
    when: "editorTextFocus && !editorHasSelection && !selectionAnchorSet",
  },
  {
    key: "shift+alt+y",
    command: "runCommands",
    args: {
      commands: [
        "editor.action.selectHighlights",
        "editor.action.clipboardCopyAction",
      ],
    },
    when: "editorTextFocus && editorHasSelection && !selectionAnchorSet",
  },
  {
    key: "shift+alt+p",
    command: "runCommands",
    args: {
      commands: [
        "editor.action.selectHighlights",
        "editor.action.clipboardPasteAction",
      ],
    },
    when: "editorTextFocus && editorHasSelection && !selectionAnchorSet",
  },
  //#endregion

  //#region 機能呼び出し・インテリセンス
  {
    key: "alt+=",
    command: "editor.action.triggerSuggest",
    when: "editorHasCompletionItemProvider && textInputFocus && !editorReadonly && !suggestWidgetVisible",
  },
  {
    key: "shift+alt+=",
    command: "editor.action.triggerParameterHints",
    when: "editorHasSignatureHelpProvider && textInputFocus",
  },
  {
    key: "alt+.",
    command: "editor.action.quickFix",
    when: "editorHasCodeActionsProvider && textInputFocus && !editorReadonly",
  },
  {
    key: "shift+alt+.",
    command: "editor.action.refactor",
    when: "editorHasCodeActionsProvider && textInputFocus && !editorReadonly",
  },
  {
    key: "alt+;",
    command: "editor.action.showHover",
    when: "editorTextFocus && !editorHoverVisible",
  },
  {
    key: "shift+alt+;",
    command: "leaveEditorHover",
    when: "editorHoverVisible",
  },
  {
    key: "alt+f alt+o",
    command: "editor.action.rename",
    when: "editorHasRenameProvider && editorTextFocus && !editorReadonly",
  },
  //#endregion

  //#region フォーカス移動・リスト選択系
  {
    key: "k",
    command: "list.focusUp",
    when: "listFocus && !inputFocus && !treestickyScrollFocused",
  },
  {
    key: "j",
    command: "list.focusDown",
    when: "listFocus && !inputFocus && !treestickyScrollFocused",
  },
  {
    key: "alt+k",
    command: "list.focusUp",
    when: "listFocus && !inputFocus && !treestickyScrollFocused",
  },
  {
    key: "alt+j",
    command: "list.focusDown",
    when: "listFocus && !inputFocus && !treestickyScrollFocused",
  },
  {
    key: "alt+k",
    command: "selectPrevSuggestion",
    when: "suggestWidgetMultipleSuggestions && suggestWidgetVisible && textInputFocus || suggestWidgetVisible && textInputFocus && !suggestWidgetHasFocusedSuggestion",
  },
  {
    key: "alt+j",
    command: "selectNextSuggestion",
    when: "suggestWidgetMultipleSuggestions && suggestWidgetVisible && textInputFocus || suggestWidgetVisible && textInputFocus && !suggestWidgetHasFocusedSuggestion",
  },
  {
    key: "alt+k",
    command: "focusPreviousRenameSuggestion",
    when: "renameInputVisible",
  },
  {
    key: "alt+j",
    command: "focusNextRenameSuggestion",
    when: "renameInputVisible",
  },
  {
    key: "alt+k",
    command: "quickInput.previous",
    when: "inQuickInput && quickInputType == 'quickPick' || inQuickInput && quickInputType == 'quickTree'",
  },
  {
    key: "alt+j",
    command: "quickInput.next",
    when: "inQuickInput && quickInputType == 'quickPick' || inQuickInput && quickInputType == 'quickTree'",
  },
  {
    key: "alt+k",
    command: "selectPrevCodeAction",
    when: "codeActionMenuVisible",
  },
  {
    key: "alt+j",
    command: "selectNextCodeAction",
    when: "codeActionMenuVisible",
  },
  //#endregion

  //#region 確定系
  {
    key: "m",
    command: "list.select",
    when: "listFocus && !inputFocus && !treestickyScrollFocused",
  },
  {
    key: "alt+m",
    command: "list.select",
    when: "listFocus && !inputFocus && !treestickyScrollFocused",
  },
  {
    key: "alt+m",
    command: "acceptRenameInput",
    when: "editorFocus && renameInputVisible && !isComposing",
  },
  {
    key: "alt+m",
    command: "acceptSelectedCodeAction",
    when: "codeActionMenuVisible",
  },
  {
    key: "alt+m",
    command: "acceptSelectedSuggestion",
    when: "acceptSuggestionOnEnter && suggestWidgetHasFocusedSuggestion && suggestWidgetVisible && suggestionMakesTextEdit && textInputFocus",
  },
  {
    key: "shift+alt+m",
    command: "jumpToNextSnippetPlaceholder",
    when: "hasNextTabstop && inSnippetMode && textInputFocus",
  },
  //#endregion

  //#region 閉じる・キャンセル系
  {
    key: "alt+e",
    command: "removeSecondaryCursors",
    when: "editorHasMultipleSelections && textInputFocus",
  },
  {
    key: "alt+e",
    command: "cancelSelection",
    when: "editorHasSelection && textInputFocus",
  },
  {
    key: "alt+e",
    command: "leaveSnippet",
    when: "inSnippetMode && textInputFocus",
  },
  {
    key: "alt+e",
    command: "hideSuggestWidget",
    when: "suggestWidgetVisible && textInputFocus",
  },
  {
    key: "alt+e",
    command: "hideCodeActionWidget",
    when: "codeActionMenuVisible",
  },
  {
    key: "alt+e",
    command: "quickInput.hide",
    when: "inQuickInput",
  },
  {
    key: "alt+e",
    command: "closeFindWidget",
    when: "editorFocus && findWidgetVisible && !isComposing",
  },
  {
    key: "alt+e",
    command: "editor.action.cancelSelectionAnchor",
    when: "editorTextFocus && selectionAnchorSet",
  },
  {
    key: "alt+e",
    command: "editor.action.inlineSuggest.hide",
    when: "inlineSuggestVisible && textInputFocus",
  },
  {
    key: "alt+e",
    command: "closeEditorHover",
    when: "editorHoverVisible",
  },
  {
    key: "alt+e",
    command: "closeMarkersNavigation",
    when: "editorFocus && markersNavigationVisible",
  },
  {
    key: "alt+e",
    command: "closeReferenceSearch",
    when: "referenceSearchVisible",
  },
  {
    key: "alt+e",
    command: "cancelRenameInput",
    when: "editorFocus && renameInputVisible",
  },
  //#endregion

  //#region テキスト検索系
  {
    key: "alt+s",
    command: "actions.find",
    when: "editorFocus || editorIsOpen",
  },
  {
    key: "alt+s",
    command: "closeFindWidget",
    when: "findWidgetVisible && !isComposing",
  },
  {
    key: "shift+alt+s",
    command: "editor.action.startFindReplaceAction",
    when: "editorFocus || editorIsOpen",
  },
  {
    key: "alt+k",
    command: "editor.action.previousMatchFindAction",
    when: "editorFocus && findInputFocussed",
  },
  {
    key: "alt+j",
    command: "editor.action.nextMatchFindAction",
    when: "editorFocus && findInputFocussed",
  },
  // 削除されたキー(alt+w, alt+r, alt+l)のリカバリー
  {
    key: "alt+f alt+w",
    command: "toggleSearchEditorWholeWord",
    when: "inSearchEditor && searchInputBoxFocus",
  },
  {
    key: "alt+f alt+w",
    command: "toggleFindWholeWord",
    when: "editorFocus",
  },
  {
    key: "alt+f alt+w",
    command: "toggleSearchWholeWord",
    when: "searchViewletFocus",
  },
  {
    key: "alt+f alt+r",
    command: "toggleFindRegex",
    when: "editorFocus",
  },
  {
    key: "alt+f alt+r",
    command: "toggleSearchRegex",
    when: "searchViewletFocus",
  },
  {
    key: "alt+f alt+r",
    command: "workbench.action.chat.toggleFindRegex",
    when: "chatFindWidgetVisible",
  },
  {
    key: "alt+f alt+c",
    command: "toggleFindCaseSensitive",
    when: "editorFocus",
  },
  {
    key: "alt+f alt+c",
    command: "toggleSearchCaseSensitive",
    when: "searchViewletFocus",
  },
  {
    key: "alt+f alt+c",
    command: "workbench.action.chat.toggleFindCaseSensitive",
    when: "chatFindWidgetVisible",
  },
  {
    key: "alt+f alt+l",
    command: "toggleFindInSelection",
    when: "editorFocus",
  },
  //#endregion

  //#region コード構造系
  {
    key: "alt+8",
    command: "editor.toggleFold",
    when: "editorTextFocus && foldingEnabled",
  },
  {
    key: "shift+alt+8",
    command: "editor.toggleFoldRecursively", // ※子ブロックも含めて再帰的にトグル
    when: "editorTextFocus && foldingEnabled",
  },
  {
    key: "alt+9",
    command: "editor.foldAll",
    when: "editorTextFocus && foldingEnabled",
  },
  {
    key: "shift+alt+9",
    command: "editor.unfoldAll",
    when: "editorTextFocus && foldingEnabled",
  },
  {
    key: "alt+f alt+f",
    command: "editor.action.formatDocument",
    when: "editorHasDocumentFormattingProvider && editorTextFocus && !editorReadonly && !inCompositeEditor",
  },
  {
    key: "alt+f alt+f",
    command: "editor.action.formatDocument.none",
    when: "editorTextFocus && !editorHasDocumentFormattingProvider && !editorReadonly",
  },
  //#endregion

  //#region コード実行系
  {
    key: "alt+f alt+enter",
    command: "code-runner.run",
    when: "editorTextFocus",
  },
  {
    key: "shift+alt+f shift+alt+enter",
    command: "code-runner.stop",
  },
  //#endregion

  //#region エディタ・画面分割系
  {
    key: "alt+w",
    command: "workbench.action.closeActiveEditor",
  },
  {
    key: "shift+alt+w",
    command: "workbench.action.reopenClosedEditor",
  },
  {
    key: "shift+alt+`",
    command: "workbench.action.terminal.toggleTerminal",
    when: "terminal.active",
  },
  {
    key: "ctrl+shift+alt+`",
    command: "workbench.action.focusActiveEditorGroup",
    when: "terminalFocus",
  },
  {
    key: "ctrl+shift+alt+`",
    command: "workbench.action.terminal.focus",
    when: "!terminalFocus",
  },
  {
    key: "alt+q",
    command: "workbench.action.quickOpenNavigateNextInEditorPicker",
    when: "inEditorsPicker && inQuickOpen",
  },
  {
    key: "alt+q",
    command: "workbench.action.quickOpenPreviousRecentlyUsedEditorInGroup",
    when: "!activeEditorGroupEmpty",
  },
  {
    key: "alt+f alt+q",
    command: "workbench.action.quickOpen",
  },
  {
    key: "shift+alt+q",
    command: "workbench.action.showCommands",
  },
  {
    key: "alt+0",
    command: "workbench.action.nextEditorInGroup",
  },
  {
    key: "shift+alt+0",
    command: "workbench.action.previousEditorInGroup",
  },
  {
    key: "ctrl+alt+0",
    command: "workbench.action.lastEditorInGroup",
  },
  {
    key: "alt+'",
    command: "workbench.action.closeGroup",
  },
  {
    key: "shift+alt+'",
    command: "workbench.action.splitEditor",
  },
  {
    key: "alt+-",
    command: "workbench.action.focusRightGroup",
  },
  {
    key: "shift+alt+-",
    command: "workbench.action.focusLeftGroup",
  },
  {
    key: "ctrl+alt+-",
    command: "workbench.action.focusBelowGroup",
  },
  {
    key: "ctrl+shift+alt+-",
    command: "workbench.action.focusAboveGroup",
  },

  //#endregion

  //#region サイドバー系
  // --- エクスプローラー (Explorer) ---
  {
    key: "alt+f alt+e",
    command: "workbench.action.toggleSidebarVisibility",
    when: "activeViewlet == 'workbench.view.explorer' && sideBarVisible",
  },
  {
    key: "alt+f alt+e",
    command: "workbench.view.explorer",
    when: "activeViewlet != 'workbench.view.explorer' || !sideBarVisible",
  },
  // --- ソース管理 (SCM / Git) ---
  {
    key: "alt+f alt+g",
    command: "workbench.action.toggleSidebarVisibility",
    when: "activeViewlet == 'workbench.view.scm' && sideBarVisible",
  },
  {
    key: "alt+f alt+g",
    command: "workbench.view.scm",
    when: "activeViewlet != 'workbench.view.scm' || !sideBarVisible",
  },
  // --- 検索 (Find in Files) ---
  {
    key: "alt+f alt+s",
    command: "workbench.action.toggleSidebarVisibility",
    when: "activeViewlet == 'workbench.view.search' && sideBarVisible",
  },
  {
    key: "alt+f alt+s",
    command: "workbench.action.findInFiles",
    when: "activeViewlet != 'workbench.view.search' || !sideBarVisible",
  },
  // --- 置換 ---
  {
    key: "shift+alt+f shift+alt+s",
    command: "workbench.action.toggleSidebarVisibility",
    when: "activeViewlet == 'workbench.view.search' && sideBarVisible",
  },
  {
    key: "shift+alt+f shift+alt+s",
    command: "workbench.action.replaceInFiles",
    when: "activeViewlet != 'workbench.view.search' || !sideBarVisible",
  },
  //#endregion

  //#region ファイル・フォルダ操作系
  {
    key: "alt+f alt+n",
    command: "explorer.newFile",
  },
  {
    key: "shift+alt+f shift+alt+n",
    command: "explorer.newFolder",
  },
  {
    key: "alt+f alt+r",
    command: "renameFile",
    when: "filesExplorerFocus && foldersViewVisible && !explorerResourceIsRoot && !explorerResourceReadonly && !inputFocus",
  },
  {
    key: "alt+f alt+d",
    command: "runCommands",
    args: {
      commands: ["filesExplorer.copy", "filesExplorer.paste", "renameFile"],
    },
    when: "filesExplorerFocus && foldersViewVisible && !explorerResourceIsRoot && !explorerResourceReadonly && !inputFocus",
  },
  //#endregion

  //#region デフォルトショートカットの無効化
  {
    key: "ctrl+shift+alt+l",
    command: "-workbench.action.quickchat.toggle",
    when: "chatIsEnabled",
  },
  {
    key: "alt+w",
    command: "-toggleFindWholeWord",
    when: "editorFocus",
  },
  {
    key: "alt+r",
    command: "-toggleFindRegex",
    when: "editorFocus",
  },
  {
    key: "alt+c",
    command: "-toggleFindCaseSensitive",
    when: "editorFocus",
  },
  {
    key: "alt+l",
    command: "-toggleFindInSelection",
    when: "editorFocus",
  },
  {
    key: "shift+alt+i",
    command: "-editor.action.insertCursorAtEndOfEachLineSelected",
    when: "editorTextFocus",
  },
  {
    key: "ctrl+alt+i",
    command: "-workbench.action.chat.open",
    when: "!chatSetupDisabledInWorkspace && !chatSetupHidden",
  },
  {
    key: "ctrl+alt+m",
    command: "-code-runner.stop",
  },
  {
    key: "alt+0",
    command: "-workbench.action.lastEditorInGroup",
  },
  // when文変更
  {
    key: "ctrl+alt+enter",
    command: "editor.action.replaceAll",
    when: "editorFocus && replaceInputFocussed",
  },
  //#endregion

  // --- 自動追加検出用セパレーター（GUI等でキーバインドを追加した際に下部へ追記される目印） ---
  {
    key: "-",
  },
];

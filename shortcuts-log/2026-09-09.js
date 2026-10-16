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
    when: "textInputFocus",
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
    when: "textInputFocus",
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
            to: "viewPortCenter",
            by: "wrappedLine",
          },
        },
        {
          command: "cursorEnd",
        },
      ],
    },
    when: "editorTextFocus",
  },
  {
    key: "alt+home",
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
    when: "editorTextFocus",
  },
  {
    key: "alt+f alt+k",
    command: "cursorMove",
    args: {
      to: "prevBlankLine",
    },
    when: "editorTextFocus",
  },
  {
    key: "alt+f alt+j",
    command: "cursorMove",
    args: {
      to: "nextBlankLine",
    },
    when: "editorTextFocus",
  },
  {
    key: "alt+[IntlRo]",
    command: "editor.action.jumpToBracket",
    when: "editorTextFocus",
  },
  //#endregion

  //#region ナビゲーション・ジャンプ系
  {
    key: "alt+m",
    command: "editor.action.revealDefinition",
    when: "editorHasDefinitionProvider && editorTextFocus",
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
    key: "ctrl+shift+alt+h",
    command: "workbench.action.navigateBack",
    when: "canNavigateBack",
  },
  {
    key: "ctrl+shift+alt+l",
    command: "workbench.action.navigateForward",
    when: "canNavigateForward",
  },
  {
    key: "alt+f alt+p",
    command: "workbench.action.quickOpen",
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
  //#endregion

  //#region 基本範囲選択系
  // 左右
  {
    key: "alt+left",
    command: "cursorLeftSelect",
    when: "textInputFocus",
  },
  {
    key: "alt+right",
    command: "cursorRightSelect",
    when: "textInputFocus",
  },
  {
    key: "shift+alt+left",
    command: "cursorWordLeftSelect",
    when: "textInputFocus && !accessibilityModeEnabled",
  },
  {
    key: "shift+alt+right",
    command: "cursorWordEndRightSelect",
    when: "textInputFocus && !accessibilityModeEnabled",
  },
  {
    key: "alt+f alt+left",
    command: "cursorHomeSelect",
    when: "textInputFocus",
  },
  {
    key: "alt+f alt+right",
    command: "cursorEndSelect",
    when: "textInputFocus",
  },
  {
    key: "shift+alt+f shift+alt+left",
    command: "cursorHomeSelect",
    when: "textInputFocus",
  },
  {
    key: "shift+alt+f shift+alt+right",
    command: "cursorEndSelect",
    when: "textInputFocus",
  },

  // 上下
  {
    key: "alt+up",
    command: "runCommands",
    when: "editorTextFocus && !editorHasSelection",
    args: {
      commands: ["cursorLineEnd", "cursorUpSelect", "cursorLineStartSelect"],
    },
  },
  {
    key: "alt+up",
    command: "cursorUpSelect",
    when: "editorTextFocus && editorHasSelection",
  },
  {
    key: "alt+down",
    command: "runCommands",
    when: "editorTextFocus && !editorHasSelection",
    args: {
      commands: ["cursorLineStart", "cursorDownSelect", "cursorDownSelect"],
    },
  },
  {
    key: "alt+down",
    command: "cursorDownSelect",
    when: "editorTextFocus && editorHasSelection",
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
    key: "alt+shift+i",
    command: "cursorUndo",
    when: "editorFocus",
  },
  {
    key: "alt+f alt+i",
    command: "editor.action.selectHighlights",
    when: "editorFocus",
  },
  //#endregion

  //#region テキスト編集・行操作系
  {
    key: "shift+space",
    command: "runCommands",
    when: "editorTextFocus && !editorReadonly",
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
    key: "alt+oem_2",
    command: "editor.action.commentLine",
    when: "editorTextFocus && !editorReadonly",
  },
  {
    key: "alt+9",
    command: "editor.action.insertLineBefore",
    when: "editorTextFocus && !editorReadonly",
  },
  {
    key: "alt+8",
    command: "editor.action.insertLineAfter",
    when: "editorTextFocus && !editorReadonly",
  },
  {
    key: "ctrl+alt+k",
    command: "editor.action.moveLinesUpAction",
    when: "editorTextFocus && !editorReadonly",
  },
  {
    key: "ctrl+alt+j",
    command: "editor.action.moveLinesDownAction",
    when: "editorTextFocus && !editorReadonly",
  },
  {
    key: "ctrl+shift+alt+k",
    command: "editor.action.copyLinesUpAction",
    when: "editorTextFocus && !editorReadonly",
  },
  {
    key: "ctrl+shift+alt+j",
    command: "editor.action.copyLinesDownAction",
    when: "editorTextFocus && !editorReadonly",
  },
  //#endregion

  //#region テキスト削除系
  {
    key: "alt+b",
    command: "deleteLeft",
    when: "textInputFocus",
  },
  {
    key: "alt+n",
    command: "deleteRight",
    when: "textInputFocus",
  },
  {
    key: "shift+alt+b",
    command: "deleteWordLeft",
    when: "textInputFocus",
  },
  {
    key: "shift+alt+n",
    command: "deleteWordRight",
    when: "textInputFocus",
  },
  {
    key: "alt+shift+d",
    command: "editor.action.deleteLines",
    when: "textInputFocus && !editorReadonly",
  },
  //#endregion

  //#region 基本操作系（クリップボード・履歴・保存）
  {
    key: "alt+y",
    command: "editor.action.clipboardCopyAction",
  },
  {
    key: "alt+d",
    command: "editor.action.clipboardCutAction",
  },
  {
    key: "alt+p",
    command: "editor.action.clipboardPasteAction",
  },
  {
    key: "alt+u",
    command: "undo",
  },
  {
    key: "alt+r",
    command: "redo",
  },
  {
    key: "shift+alt+enter",
    command: "saveAll",
  },
  {
    key: "alt+f alt+a",
    command: "editor.action.selectAll",
  },
  {
    key: "alt+f alt+a",
    command: "list.selectAll",
    when: "listFocus && listSupportsMultiselect && !inputFocus && !treestickyScrollFocused",
  },
  //#endregion

  //#region 機能呼び出し・インテリセンス
  {
    key: "shift+alt+p",
    command: "workbench.action.showCommands",
  },
  {
    key: "alt+[Semicolon]",
    command: "editor.action.triggerSuggest",
    when: "editorHasCompletionItemProvider && textInputFocus && !editorReadonly && !suggestWidgetVisible",
  },
  {
    key: "alt+oem_period",
    command: "editor.action.quickFix",
    when: "editorHasCodeActionsProvider && textInputFocus && !editorReadonly",
  },
  {
    key: "alt+oem_1",
    command: "editor.action.showHover",
    when: "editorTextFocus && !editorHoverVisible",
  },
  {
    key: "shift+alt+oem_1",
    command: "leaveEditorHover",
    when: "editorHoverVisible && editorHoverVisible",
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
    key: "alt+shift+m",
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
    when: "editorFocus && findWidgetVisible && !isComposing",
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
  //#endregion

  //#region コード構造形
  {
    key: "alt+oem_4",
    command: "editor.fold",
    when: "editorTextFocus && foldingEnabled",
  },
  {
    key: "alt+oem_6",
    command: "editor.unfold",
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
  //#region

  //#endregion コード実行系
  // {
  //   "key": "alt+f alt+enter",
  //   "command": "python.execInTerminal-icon",
  //   "when": "editorTextFocus && editorLangId == 'python'"
  // },
  // {
  //   "key": "alt+f alt+enter",
  //   "command": "C_Cpp.BuildAndDebugFile",
  //   "when": "editorTextFocus && (editorLangId == 'c' || editorLangId == 'cpp')"
  // },
  {
    key: "alt+f alt+enter",
    command: "code-runner.run",
    when: "editorTextFocus",
  },
  //#endregion

  //#region エディタ・画面分割系
  {
    key: "ctrl+[IntlRo]",
    command: "workbench.action.splitEditor",
  },
  {
    key: "alt+w",
    command: "workbench.action.closeActiveEditor",
  },
  {
    key: "alt+1",
    command: "workbench.action.focusFirstEditorGroup",
  },
  {
    key: "alt+2",
    command: "workbench.action.focusSecondEditorGroup",
  },
  {
    key: "alt+3",
    command: "workbench.action.focusThirdEditorGroup",
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
    key: "alt+up",
    command: "-editor.action.moveLinesUpAction",
    when: "editorTextFocus && !editorReadonly",
  },
  {
    key: "alt+down",
    command: "-editor.action.moveLinesDownAction",
    when: "editorTextFocus && !editorReadonly",
  },
  {
    key: "shift+alt+up",
    command: "-editor.action.copyLinesUpAction",
    when: "editorTextFocus && !editorReadonly",
  },
  {
    key: "shift+alt+down",
    command: "-editor.action.copyLinesDownAction",
    when: "editorTextFocus && !editorReadonly",
  },
  {
    key: "ctrl+shift+alt+l",
    command: "-workbench.action.quickchat.toggle",
    when: "chatIsEnabled",
  },
  {
    key: "alt+left",
    command: "-workbench.action.navigateBack",
    when: "canNavigateBack",
  },
  {
    key: "alt+right",
    command: "-workbench.action.navigateForward",
    when: "canNavigateForward",
  },
  {
    key: "shift+alt+left",
    command: "-editor.action.smartSelect.shrink",
    when: "editorTextFocus",
  },
  {
    key: "shift+alt+right",
    command: "-editor.action.smartSelect.expand",
    when: "editorTextFocus",
  },
  {
    key: "ctrl+shift+i",
    command: "-workbench.action.chat.openagent",
    when: "config.chat.agent.enabled && !chatSetupDisabledInWorkspace && !chatSetupHidden",
  },
  //#endregion

  // --- 自動追加検出用セパレーター（GUI等でキーバインドを追加した際に下部へ追記される目印） ---
  {
    key: "-",
  },
];

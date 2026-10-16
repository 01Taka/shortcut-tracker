[
  //#region カーソル移動
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
    key: "alt+j",
    command: "cursorDown",
    when: "textInputFocus",
  },
  {
    key: "alt+k",
    command: "cursorUp",
    when: "textInputFocus",
  },
  //#endregion

  //#region カーソルジャンプ系
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
    key: "alt+[IntlRo]",
    command: "editor.action.jumpToBracket",
    when: "editorTextFocus",
  },
  // {
  //   "key": "shift+alt+j",
  //   "command": "cursorMove",
  //   "args": {
  //     "to": "down",
  //     "by": "line",
  //     "value": 5,
  //   },
  //   "when": "textInputFocus",
  // },
  {
    key: "alt+f alt+j",
    command: "runCommands",
    when: "editorTextFocus",
    args: {
      commands: [
        {
          command: "cursorMove",
          args: { to: "nextBlankLine" },
        },
        { command: "cursorDown" },
        { command: "cursorEnd" },
      ],
    },
  },
  // {
  //   "key": "shift+alt+k",
  //   "command": "cursorMove",
  //   "args": {
  //     "to": "up",
  //     "by": "line",
  //     "value": 5,
  //   },
  //   "when": "textInputFocus",
  // },
  {
    key: "alt+f alt+k",
    command: "runCommands",
    when: "editorTextFocus",
    args: {
      commands: [
        {
          command: "cursorMove",
          args: { to: "prevBlankLine" },
        },
        {
          command: "cursorMove",
          args: { to: "prevBlankLine" },
        },
        { command: "cursorDown" },
        { command: "cursorEnd" },
      ],
    },
  },
  //#endregion

  // 補完
  {
    key: "alt+[Semicolon]",
    command: "editor.action.triggerSuggest",
    when: "editorHasCompletionItemProvider && textInputFocus && !editorReadonly && !suggestWidgetVisible",
  },

  //#region  フォーカス移動系
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
    key: "alt+j",
    command: "focusNextRenameSuggestion",
    when: "renameInputVisible",
  },
  {
    key: "alt+k",
    command: "focusPreviousRenameSuggestion",
    when: "renameInputVisible",
  },
  {
    key: "alt+j",
    command: "quickInput.next",
    when: "inQuickInput && quickInputType == 'quickPick' || inQuickInput && quickInputType == 'quickTree'",
  },
  {
    key: "alt+k",
    command: "quickInput.previous",
    when: "inQuickInput && quickInputType == 'quickPick' || inQuickInput && quickInputType == 'quickTree'",
  },
  //#endregion

  // 範囲選択系
  {
    key: "ctrl+alt+j",
    command: "cursorDownSelect",
    when: "textInputFocus",
  },
  {
    key: "ctrl+alt+k",
    command: "cursorUpSelect",
    when: "textInputFocus",
  },
  {
    key: "ctrl+alt+h",
    command: "cursorLeftSelect",
    when: "textInputFocus",
  },
  {
    key: "ctrl+alt+l",
    command: "cursorRightSelect",
    when: "textInputFocus",
  },
  {
    key: "alt+i",
    command: "editor.action.addSelectionToNextFindMatch",
    when: "editorFocus",
  },
  {
    key: "alt+shift+i",
    command: "editor.action.selectHighlights",
    when: "editorFocus",
  },
  {
    key: "alt+o",
    command: "editor.action.smartSelect.expand",
  },
  {
    key: "shift+alt+o",
    command: "editor.action.smartSelect.shrink",
  },

  // テキスト削除系
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

  // 基本操作系
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
    key: "alt+m",
    command: "editor.action.revealDefinition",
    when: "editorHasDefinitionProvider && editorTextFocus",
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
    key: "alt+f alt+p",
    command: "workbench.action.quickOpen",
  },

  // 確定系
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

  // 閉じる系
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

  // テキスト検索系
  {
    key: "alt+s",
    command: "actions.find",
    when: "editorFocus || editorIsOpen",
  },
  {
    key: "alt+s",
    command: "actions.find",
    when: "editorFocus || editorIsOpen",
  },
  {
    key: "alt+m",
    command: "closeFindWidget",
    when: "editorFocus && findWidgetVisible && !isComposing",
  },
  {
    key: "alt+j",
    command: "editor.action.nextMatchFindAction",
    when: "editorFocus && findInputFocussed",
  },
  {
    key: "alt+k",
    command: "editor.action.previousMatchFindAction",
    when: "editorFocus && findInputFocussed",
  },

  // エディタ操作系
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

  // デフォルト操作無効用
  // {
  //   "key": "alt+f",
  //   "command": "",
  // },
  // コマンドファンクション(f)系
  // 行挿入
  {
    key: "shift+alt+j",
    command: "editor.action.insertLineAfter",
    when: "editorTextFocus && !editorReadonly",
  },
  {
    key: "shift+alt+k",
    command: "editor.action.insertLineBefore",
    when: "editorTextFocus && !editorReadonly",
  },
  // 高速移動系
  {
    key: "alt+f alt+h",
    command: "cursorHome",
    when: "textInputFocus",
  },
  {
    key: "alt+f alt+l",
    command: "cursorEnd",
    when: "textInputFocus",
  },
  // ファイル操作系
  {
    key: "alt+f alt+e",
    command: "workbench.view.explorer",
    when: "viewContainer.workbench.view.explorer.enabled",
  },
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
  // フォーマット
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
  // 実行系
  {
    key: "alt+f alt+enter",
    command: "python.execInTerminal-icon",
  },
  {
    key: "alt+f alt+enter",
    command: "C_Cpp.BuildAndDebugFile",
  },
  {
    key: "ctrl+shift+i",
    command: "-workbench.action.chat.openagent",
    when: "config.chat.agent.enabled && !chatSetupDisabledInWorkspace && !chatSetupHidden",
  },
  {
    key: "alt+enter",
    command: "saveAll",
  },
  {
    key: "alt+f alt+g",
    command: "workbench.view.scm",
    when: "workbench.scm.active",
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

  // 後から追加
  {
    key: "alt+oem_period",
    command: "editor.action.quickFix",
    when: "editorHasCodeActionsProvider && textInputFocus && !editorReadonly",
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
  {
    key: "ctrl+shift+alt+j",
    command: "editorScroll",
    args: {
      to: "down",
      by: "line",
      value: 3,
    },
    when: "textInputFocus",
  },
  {
    key: "ctrl+shift+alt+k",
    command: "editorScroll",
    args: {
      to: "up",
      by: "line",
      value: 3,
    },
    when: "textInputFocus",
  },
  {
    key: "shift+alt+f shift+alt+l",
    command: "cursorEndSelect",
    when: "textInputFocus",
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
];

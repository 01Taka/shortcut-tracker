[
  //#region 基本カーソル移動系
  {
    key: "alt+h",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "cursorLeft (alt+h)",
      command: "cursorLeft",
    },
  },
  {
    key: "shift+alt+h",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "cursorWordLeft (shift+alt+h)",
      command: "cursorWordLeft",
    },
    when: "textInputFocus",
  },
  {
    key: "alt+l",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "cursorRight (alt+l)",
      command: "cursorRight",
    },
  },
  {
    key: "shift+alt+l",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "cursorWordEndRight (shift+alt+l)",
      command: "cursorWordEndRight",
    },
    when: "textInputFocus",
  },
  {
    key: "alt+k",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "cursorUp (alt+k)",
      command: "cursorUp",
    },
    when: "textInputFocus",
  },
  {
    key: "alt+j",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "cursorDown (alt+j)",
      command: "cursorDown",
    },
    when: "textInputFocus",
  },
  //#endregion

  //#region スクロール系
  {
    key: "shift+alt+k",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "editorScrollUp10 (shift+alt+k)",
      command: "editorScroll",
      commandArgs: {
        to: "up",
        by: "wrappedLine",
        value: 10,
        revealCursor: false,
      },
    },
    when: "textInputFocus && !inReferenceSearchEditor",
  },
  {
    key: "shift+alt+j",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "editorScrollDown10 (shift+alt+j)",
      command: "editorScroll",
      commandArgs: {
        to: "down",
        by: "wrappedLine",
        value: 10,
        revealCursor: false,
      },
    },
    when: "textInputFocus && !inReferenceSearchEditor",
  },
  {
    key: "shift+alt+k",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "editorScrollUp4 (shift+alt+k)",
      command: "editorScroll",
      commandArgs: {
        to: "up",
        by: "wrappedLine",
        value: 4,
        revealCursor: false,
      },
    },
    when: "inReferenceSearchEditor && !editorReadonly",
  },
  {
    key: "shift+alt+j",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "editorScrollDown4 (shift+alt+j)",
      command: "editorScroll",
      commandArgs: {
        to: "down",
        by: "wrappedLine",
        value: 4,
        revealCursor: false,
      },
    },
    when: "inReferenceSearchEditor && !editorReadonly",
  },
  //#endregion

  //#region カーソルジャンプ系
  {
    key: "ctrl+alt+h",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "jumpToFirstWordEnd (ctrl+alt+h)",
      command: "cursorHome",
    },
    when: "textInputFocus",
  },
  {
    key: "ctrl+alt+l",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "jumpToLastWord (ctrl+alt+l)",
      command: "runCommands",
      commandArgs: {
        commands: ["cursorEnd", "cursorWordLeft"],
      },
    },
    when: "textInputFocus",
  },
  {
    key: "alt+enter",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "jumpToViewPortMiddle (alt+enter)",
      command: "runCommands",
      commandArgs: {
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
    },
    when: "editorTextFocus && !findInputFocussed && !inReferenceSearchEditor",
  },
  {
    key: "alt+enter",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "jumpToPeekMiddle (alt+enter)",
      command: "runCommands",
      commandArgs: {
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
    },
    when: "editorTextFocus && !findInputFocussed && inReferenceSearchEditor",
  },
  {
    key: "ctrl+alt+enter",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "jumpToViewPortTop (ctrl+alt+enter)",
      command: "runCommands",
      commandArgs: {
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
    },
    when: "editorTextFocus && !replaceInputFocussed",
  },
  {
    key: "ctrl+alt+k",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "cursorMovePrevBlankLine (ctrl+alt+k)",
      command: "cursorMove",
      commandArgs: {
        to: "prevBlankLine",
      },
    },
    when: "editorTextFocus",
  },
  {
    key: "ctrl+alt+j",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "cursorMoveNextBlankLine (ctrl+alt+j)",
      command: "cursorMove",
      commandArgs: {
        to: "nextBlankLine",
      },
    },
    when: "editorTextFocus",
  },
  {
    key: "alt+,",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "editor.action.marker.prev (alt+,)",
      command: "editor.action.marker.prev",
    },
    when: "editorFocus",
  },
  {
    key: "shift+alt+,",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "editor.action.marker.next (shift+alt+,)",
      command: "editor.action.marker.next",
    },
    when: "editorFocus",
  },
  {
    key: "ctrl+alt+,",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "workbench.action.editor.nextChange (ctrl+alt+,)",
      command: "workbench.action.editor.nextChange",
    },
    when: "editorTextFocus && !textCompareEditorActive && quickDiffDecorationCount != '0'",
  },
  {
    key: "ctrl+shift+alt+,",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "workbench.action.editor.previousChange (ctrl+shift+alt+,)",
      command: "workbench.action.editor.previousChange",
    },
    when: "editorTextFocus && !textCompareEditorActive && quickDiffDecorationCount != '0'",
  },
  //#endregion

  //#region ナビゲーション・ジャンプ系
  {
    key: "alt+g",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "editor.action.accessibleViewGoToSymbol (alt+g)",
      command: "editor.action.accessibleViewGoToSymbol",
    },
    when: "accessibilityHelpIsShown && accessibleViewGoToSymbolSupported || accessibleViewGoToSymbolSupported && accessibleViewIsShown",
  },
  {
    key: "alt+g",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "workbench.action.gotoSymbol (alt+g)",
      command: "workbench.action.gotoSymbol",
    },
    when: "!accessibilityHelpIsShown && !accessibleViewIsShown",
  },
  {
    key: "shift+alt+g",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "workbench.action.showAllSymbols (shift+alt+g)",
      command: "workbench.action.showAllSymbols",
    },
  },
  {
    key: "ctrl+shift+alt+h",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "workbench.action.navigateBack (ctrl+shift+alt+h)",
      command: "workbench.action.navigateBack",
    },
    when: "canNavigateBack",
  },
  {
    key: "ctrl+shift+alt+l",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "workbench.action.navigateForward (ctrl+shift+alt+l)",
      command: "workbench.action.navigateForward",
    },
    when: "canNavigateForward",
  },
  //#endregion

  //#region スマート範囲選択系
  {
    key: "alt+o",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "editor.action.smartSelect.expand (alt+o)",
      command: "editor.action.smartSelect.expand",
    },
  },
  {
    key: "shift+alt+o",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "editor.action.smartSelect.shrink (shift+alt+o)",
      command: "editor.action.smartSelect.shrink",
    },
  },
  {
    key: "ctrl+alt+o",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "editor.action.selectToBracket:initial (ctrl+alt+o)",
      command: "editor.action.selectToBracket",
      commandArgs: {
        selectBrackets: false,
      },
    },
    when: "editorTextFocus && !editor.hasSelection",
  },
  {
    key: "ctrl+alt+o",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "editor.action.selectToBracket:extend (ctrl+alt+o)",
      command: "editor.action.selectToBracket",
      commandArgs: {
        selectBrackets: true,
      },
    },
    when: "editorTextFocus && editor.hasSelection",
  },
  {
    key: "alt+i",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "editor.action.addSelectionToNextFindMatch (alt+i)",
      command: "editor.action.addSelectionToNextFindMatch",
    },
    when: "editorFocus",
  },
  {
    key: "shift+alt+i",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "cursorUndo (shift+alt+i)",
      command: "cursorUndo",
    },
    when: "editorFocus",
  },
  {
    key: "alt+f alt+i",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "editor.action.selectHighlights (alt+f alt+i)",
      command: "editor.action.selectHighlights",
    },
    when: "editorFocus",
  },
  {
    key: "ctrl+alt+i",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "expandLineSelection (ctrl+alt+i)",
      command: "expandLineSelection",
    },
    when: "editorFocus",
  },
  //#endregion

  //#region 選択アンカー＋アクション即時実行（通常確定 & 行末確定）
  {
    key: "ctrl+shift+alt+k",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "editor.action.insertCursorAbove (ctrl+shift+alt+k)",
      command: "editor.action.insertCursorAbove",
    },
    when: "editorTextFocus",
  },
  {
    key: "ctrl+shift+alt+j",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "editor.action.insertCursorBelow (ctrl+shift+alt+j)",
      command: "editor.action.insertCursorBelow",
    },
    when: "editorTextFocus",
  },
  {
    key: "alt+f alt+a",
    command: "myTracker.trackAndRun",
    args: {
      keyName:
        "editor.action.insertCursorAtEndOfEachLineSelected (alt+f alt+a)",
      command: "editor.action.insertCursorAtEndOfEachLineSelected",
    },
    when: "editorTextFocus",
  },

  // ==========================================
  // 1. 通常確定（カーソル位置まで）
  // ==========================================
  {
    key: "alt+a",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "editor.action.setSelectionAnchor (alt+a)",
      command: "editor.action.setSelectionAnchor",
    },
    when: "editorTextFocus && !selectionAnchorSet",
  },
  {
    key: "alt+a",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "editor.action.selectFromAnchorToCursor (alt+a)",
      command: "editor.action.selectFromAnchorToCursor",
    },
    when: "editorTextFocus && selectionAnchorSet",
  },
  {
    key: "alt+y",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "copyFromAnchor (alt+y)",
      command: "runCommands",
      commandArgs: {
        commands: [
          "editor.action.selectFromAnchorToCursor",
          "editor.action.clipboardCopyAction",
        ],
      },
    },
    when: "editorTextFocus && selectionAnchorSet",
  },
  {
    key: "alt+d",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "cutFromAnchor (alt+d)",
      command: "runCommands",
      commandArgs: {
        commands: [
          "editor.action.selectFromAnchorToCursor",
          "editor.action.clipboardCutAction",
        ],
      },
    },
    when: "editorTextFocus && selectionAnchorSet",
  },
  {
    key: "alt+b",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "deleteFromAnchor (alt+b)",
      command: "runCommands",
      commandArgs: {
        commands: ["editor.action.selectFromAnchorToCursor", "deleteLeft"],
      },
    },
    when: "editorTextFocus && selectionAnchorSet",
  },
  {
    key: "alt+p",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "pasteFromAnchor (alt+p)",
      command: "runCommands",
      commandArgs: {
        commands: [
          "editor.action.selectFromAnchorToCursor",
          "editor.action.clipboardPasteAction",
        ],
      },
    },
    when: "editorTextFocus && selectionAnchorSet",
  },

  // ==========================================
  // 2. 行末確定（最終行の改行まで含めて即時実行）
  // ==========================================
  // 行頭にアンカーセット
  {
    key: "shift+alt+a",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "setLineStartAnchor (shift+alt+a)",
      command: "runCommands",
      commandArgs: {
        commands: [
          "cursorLineStart",
          "editor.action.setSelectionAnchor",
          "cursorUndo",
        ],
      },
    },
    when: "editorTextFocus && !selectionAnchorSet",
  },
  // 行末まで確定のみ
  {
    key: "shift+alt+a",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "selectLinesToCurrentLineEndFromAnchor (shift+alt+a)",
      command: "runCommands",
      commandArgs: {
        commands: [
          "cursorDown",
          "cursorLineStart",
          "editor.action.selectFromAnchorToCursor",
        ],
      },
    },
    when: "editorTextFocus && selectionAnchorSet",
  },
  // 行末までコピー
  {
    key: "shift+alt+y",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "copyLinesFromAnchor (shift+alt+y)",
      command: "runCommands",
      commandArgs: {
        commands: [
          "cursorDown",
          "cursorLineStart",
          "editor.action.selectFromAnchorToCursor",
          "editor.action.clipboardCopyAction",
        ],
      },
    },
    when: "editorTextFocus && selectionAnchorSet",
  },
  // 行末まで切り取り（行全体のカット）
  {
    key: "shift+alt+d",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "cutLinesFromAnchor (shift+alt+d)",
      command: "runCommands",
      commandArgs: {
        commands: [
          "cursorDown",
          "cursorLineStart",
          "editor.action.selectFromAnchorToCursor",
          "editor.action.clipboardCutAction",
        ],
      },
    },
    when: "editorTextFocus && selectionAnchorSet",
  },
  // 行末まで削除（行全体の削除）
  {
    key: "shift+alt+b",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "deleteLinesFromAnchor (shift+alt+b)",
      command: "runCommands",
      commandArgs: {
        commands: [
          "cursorDown",
          "cursorLineStart",
          "editor.action.selectFromAnchorToCursor",
          "deleteLeft",
        ],
      },
    },
    when: "editorTextFocus && selectionAnchorSet",
  },
  // 行末までペースト（行全体を上書き貼り付け）
  {
    key: "shift+alt+p",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "pasteLinesFromAnchor (shift+alt+p)",
      command: "runCommands",
      commandArgs: {
        commands: [
          "cursorDown",
          "cursorLineStart",
          "editor.action.selectFromAnchorToCursor",
          "editor.action.clipboardPasteAction",
        ],
      },
    },
    when: "editorTextFocus && selectionAnchorSet",
  },
  //#endregion

  //#region テキスト編集・行操作系
  {
    key: "shift+space",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "insertSpaceAndCursorLeft (shift+space)",
      command: "runCommands",
      commandArgs: {
        commands: [
          {
            command: "type",
            args: { text: " " },
          },
          "cursorLeft",
        ],
      },
    },
    when: "editorTextFocus && !editorReadonly && !isComposing",
  },
  {
    key: "alt+/",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "editor.action.commentLine (alt+/)",
      command: "editor.action.commentLine",
    },
    when: "editorTextFocus && !editorReadonly",
  },
  {
    key: "shift+alt+/",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "editor.action.blockComment (shift+alt+/)",
      command: "editor.action.blockComment",
    },
    when: "editorTextFocus && !editorReadonly",
  },
  {
    key: "alt+f alt+/",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "commentSelectionAtLineEnd (alt+f alt+/)",
      command: "runCommands",
      commandArgs: {
        commands: [
          "editor.action.clipboardCutAction",
          "cursorEnd",
          {
            command: "editor.action.insertSnippet",
            args: {
              snippet: " ${1:$CLIPBOARD}$0",
            },
          },
          "editor.action.blockComment",
          "cursorLeft",
          "cursorWordLeft",
          "cursorWordLeft",
        ],
      },
    },
    when: "editor.hasSelection && editorTextFocus && !editorReadonly",
  },
  {
    key: "alt+f alt+/",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "extractLineEndComment (alt+f alt+/)",
      command: "runCommands",
      commandArgs: {
        commands: [
          "cursorLineEnd",
          "editor.action.blockComment",
          "editor.action.clipboardCutAction",
          "cursorWordLeft",
          "cursorWordLeft",
        ],
      },
    },
    when: "!editor.hasSelection && editorTextFocus && !editorReadonly",
  },
  {
    key: "alt+[",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "editor.action.insertLineBefore (alt+[)",
      command: "editor.action.insertLineBefore",
    },
    when: "editorTextFocus && !editorReadonly",
  },
  {
    key: "alt+]",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "editor.action.insertLineAfter (alt+])",
      command: "editor.action.insertLineAfter",
    },
    when: "editorTextFocus && !editorReadonly",
  },
  {
    key: "shift+alt+[",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "editor.action.moveLinesUpAction (shift+alt+[)",
      command: "editor.action.moveLinesUpAction",
    },
    when: "editorTextFocus && !editorReadonly",
  },
  {
    key: "shift+alt+]",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "editor.action.moveLinesDownAction (shift+alt+])",
      command: "editor.action.moveLinesDownAction",
    },
    when: "editorTextFocus && !editorReadonly",
  },
  {
    key: "ctrl+alt+[",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "editor.action.copyLinesUpAction (ctrl+alt+[)",
      command: "editor.action.copyLinesUpAction",
    },
    when: "editorTextFocus && !editorReadonly",
  },
  {
    key: "ctrl+alt+]",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "editor.action.copyLinesDownAction (ctrl+alt+])",
      command: "editor.action.copyLinesDownAction",
    },
    when: "editorTextFocus && !editorReadonly",
  },
  //#endregion

  //#region テキスト削除系
  {
    key: "alt+b",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "deleteLeft (alt+b)",
      command: "deleteLeft",
    },
    when: "textInputFocus && !selectionAnchorSet",
  },
  {
    key: "shift+alt+b",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "deleteWordLeft (shift+alt+b)",
      command: "deleteWordLeft",
    },
    when: "textInputFocus && !selectionAnchorSet",
  },
  {
    key: "ctrl+alt+b",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "deleteAllLeft (ctrl+alt+b)",
      command: "deleteAllLeft",
    },
    when: "textInputFocus && !selectionAnchorSet",
  },
  {
    key: "alt+n",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "deleteRight (alt+n)",
      command: "deleteRight",
    },
    when: "textInputFocus",
  },
  {
    key: "shift+alt+n",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "deleteWordRight (shift+alt+n)",
      command: "deleteWordRight",
    },
    when: "textInputFocus",
  },
  {
    key: "ctrl+alt+n",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "deleteAllRight (ctrl+alt+n)",
      command: "deleteAllRight",
    },
    when: "textInputFocus",
  },
  {
    key: "alt+v",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "editor.action.deleteLines (alt+v)",
      command: "editor.action.deleteLines",
    },
    when: "textInputFocus && !editorReadonly && !selectionAnchorSet",
  },
  {
    key: "shift+alt+v",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "clearLineContent (shift+alt+v)",
      command: "runCommands",
      commandArgs: {
        commands: ["cursorHome", "deleteAllRight"],
      },
    },
    when: "textInputFocus && !editorReadonly && !editorHasSelection",
  },
  {
    key: "shift+alt+v",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "replaceSelectionWithEmptyLine (shift+alt+v)",
      command: "runCommands",
      commandArgs: {
        commands: [
          "editor.action.deleteLines",
          "editor.action.insertLineBefore",
        ],
      },
    },
    when: "textInputFocus && !editorReadonly && editorHasSelection",
  },
  {
    key: "alt+f alt+v",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "editor.action.joinLines (alt+f alt+v)",
      command: "editor.action.joinLines",
    },
    when: "editorTextFocus && !editorReadonly",
  },
  //#endregion

  //#region 基本操作系（クリップボード・履歴・保存）
  {
    key: "alt+y",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "editor.action.clipboardCopyAction (alt+y)",
      command: "editor.action.clipboardCopyAction",
    },
    when: "!selectionAnchorSet",
  },
  {
    key: "alt+d",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "editor.action.clipboardCutAction (alt+d)",
      command: "editor.action.clipboardCutAction",
    },
    when: "!selectionAnchorSet",
  },
  {
    key: "ctrl+alt+d",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "cutEntireLine (ctrl+alt+d)",
      command: "runCommands",
      commandArgs: {
        commands: ["expandLineSelection", "editor.action.clipboardCutAction"],
      },
    },
    when: "!selectionAnchorSet",
  },
  {
    key: "alt+p",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "editor.action.clipboardPasteAction (alt+p)",
      command: "editor.action.clipboardPasteAction",
    },
    when: "!selectionAnchorSet",
  },
  {
    key: "ctrl+alt+p",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "pasteNewLineBelow (ctrl+alt+p)",
      command: "runCommands",
      commandArgs: {
        commands: [
          "editor.action.insertLineAfter",
          "editor.action.clipboardPasteAction",
        ],
      },
    },
    when: "!selectionAnchorSet",
  },
  {
    key: "alt+u",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "undo (alt+u)",
      command: "undo",
    },
  },
  {
    key: "alt+r",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "redo (alt+r)",
      command: "redo",
    },
    when: "!searchViewletFocus && !chatFindWidgetVisible",
  },
  {
    key: "shift+alt+u",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "redo (shift+alt+u)",
      command: "redo",
    },
  },
  {
    key: "shift+alt+enter",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "saveAll (shift+alt+enter)",
      command: "saveAll",
    },
  },
  //#endregion

  //#region クリップボード操作拡張系
  {
    key: "alt+f alt+y",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "copyAllContent (alt+f alt+y)",
      command: "runCommands",
      commandArgs: {
        commands: [
          "editor.action.selectAll",
          "editor.action.clipboardCopyAction",
        ],
      },
    },
  },
  {
    key: "alt+c",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "copyAllContent (alt+c)",
      command: "runCommands",
      commandArgs: {
        commands: [
          "editor.action.selectAll",
          "editor.action.clipboardCopyAction",
        ],
      },
    },
  },
  {
    key: "alt+f alt+p",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "pasteReplaceAllContent (alt+f alt+p)",
      command: "runCommands",
      commandArgs: {
        commands: [
          "editor.action.selectAll",
          "editor.action.clipboardPasteAction",
        ],
      },
    },
  },
  {
    key: "shift+alt+c",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "pasteReplaceAllContent (shift+alt+c)",
      command: "runCommands",
      commandArgs: {
        commands: [
          "editor.action.selectAll",
          "editor.action.clipboardPasteAction",
        ],
      },
    },
  },
  // --- 1. 選択なし時（カーソル下の単語に対する即時アクション） ---
  {
    key: "shift+alt+y",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "copyCurrentWord (shift+alt+y)",
      command: "runCommands",
      commandArgs: {
        commands: [
          "editor.action.addSelectionToNextFindMatch",
          "editor.action.clipboardCopyAction",
        ],
      },
    },
    when: "editorTextFocus && !editorHasSelection && !selectionAnchorSet",
  },
  {
    key: "shift+alt+d",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "cutCurrentWord (shift+alt+d)",
      command: "runCommands",
      commandArgs: {
        commands: [
          "editor.action.addSelectionToNextFindMatch",
          "editor.action.clipboardCutAction",
        ],
      },
    },
    when: "editorTextFocus && !editorHasSelection && !selectionAnchorSet",
  },
  {
    key: "shift+alt+p",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "replaceCurrentWordWithPaste (shift+alt+p)",
      command: "runCommands",
      commandArgs: {
        commands: [
          "editor.action.addSelectionToNextFindMatch",
          "editor.action.clipboardPasteAction",
        ],
      },
    },
    when: "editorTextFocus && !editorHasSelection && !selectionAnchorSet",
  },
  // --- 2. 選択あり時（同名ハイライト全てに対する一括アクション） ---
  {
    key: "shift+alt+y",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "copyAllHighlights (shift+alt+y)",
      command: "runCommands",
      commandArgs: {
        commands: [
          "editor.action.selectHighlights",
          "editor.action.clipboardCopyAction",
        ],
      },
    },
    when: "editorTextFocus && editorHasSelection && !selectionAnchorSet",
  },
  {
    key: "shift+alt+d",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "cutAllHighlights (shift+alt+d)",
      command: "runCommands",
      commandArgs: {
        commands: [
          "editor.action.selectHighlights",
          "editor.action.clipboardCutAction",
        ],
      },
    },
    when: "editorTextFocus && editorHasSelection && !selectionAnchorSet",
  },
  {
    key: "shift+alt+p",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "replaceAllHighlightsWithPaste (shift+alt+p)",
      command: "runCommands",
      commandArgs: {
        commands: [
          "editor.action.selectHighlights",
          "editor.action.clipboardPasteAction",
        ],
      },
    },
    when: "editorTextFocus && editorHasSelection && !selectionAnchorSet",
  },
  //#endregion

  //#region 機能呼び出し・インテリセンス
  {
    key: "alt+=",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "editor.action.triggerSuggest (alt+=)",
      command: "editor.action.triggerSuggest",
    },
    when: "editorHasCompletionItemProvider && textInputFocus && !editorReadonly && !suggestWidgetVisible",
  },
  {
    key: "shift+alt+=",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "editor.action.triggerParameterHints (shift+alt+=)",
      command: "editor.action.triggerParameterHints",
    },
    when: "editorHasSignatureHelpProvider && textInputFocus",
  },
  {
    key: "alt+.",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "editor.action.quickFix (alt+.)",
      command: "editor.action.quickFix",
    },
    when: "editorHasCodeActionsProvider && textInputFocus && !editorReadonly",
  },
  {
    key: "shift+alt+.",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "editor.action.refactor (shift+alt+.)",
      command: "editor.action.refactor",
    },
    when: "editorHasCodeActionsProvider && textInputFocus && !editorReadonly",
  },
  {
    key: "alt+;",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "editor.action.showHover (alt+;)",
      command: "editor.action.showHover",
    },
    when: "editorTextFocus && !editorHoverVisible",
  },
  {
    key: "shift+alt+;",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "leaveEditorHover (shift+alt+;)",
      command: "leaveEditorHover",
    },
    when: "editorHoverVisible",
  },
  {
    key: "alt+f alt+o",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "editor.action.rename (alt+f alt+o)",
      command: "editor.action.rename",
    },
    when: "editorHasRenameProvider && editorTextFocus && !editorReadonly",
  },
  //#endregion

  //#region フォーカス移動・リスト選択系
  {
    key: "k",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "list.focusUp (k)",
      command: "list.focusUp",
    },
    when: "listFocus && !inputFocus && !treestickyScrollFocused",
  },
  {
    key: "j",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "list.focusDown (j)",
      command: "list.focusDown",
    },
    when: "listFocus && !inputFocus && !treestickyScrollFocused",
  },
  {
    key: "alt+k",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "list.focusUp (alt+k)",
      command: "list.focusUp",
    },
    when: "listFocus && !inputFocus && !treestickyScrollFocused",
  },
  {
    key: "alt+j",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "list.focusDown (alt+j)",
      command: "list.focusDown",
    },
    when: "listFocus && !inputFocus && !treestickyScrollFocused",
  },
  {
    key: "alt+k",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "selectPrevSuggestion (alt+k)",
      command: "selectPrevSuggestion",
    },
    when: "suggestWidgetMultipleSuggestions && suggestWidgetVisible && textInputFocus || suggestWidgetVisible && textInputFocus && !suggestWidgetHasFocusedSuggestion",
  },
  {
    key: "alt+j",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "selectNextSuggestion (alt+j)",
      command: "selectNextSuggestion",
    },
    when: "suggestWidgetMultipleSuggestions && suggestWidgetVisible && textInputFocus || suggestWidgetVisible && textInputFocus && !suggestWidgetHasFocusedSuggestion",
  },
  {
    key: "alt+k",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "focusPreviousRenameSuggestion (alt+k)",
      command: "focusPreviousRenameSuggestion",
    },
    when: "renameInputVisible",
  },
  {
    key: "alt+j",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "focusNextRenameSuggestion (alt+j)",
      command: "focusNextRenameSuggestion",
    },
    when: "renameInputVisible",
  },
  {
    key: "alt+k",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "quickInput.previous (alt+k)",
      command: "quickInput.previous",
    },
    when: "inQuickInput && quickInputType == 'quickPick' || inQuickInput && quickInputType == 'quickTree'",
  },
  {
    key: "alt+j",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "quickInput.next (alt+j)",
      command: "quickInput.next",
    },
    when: "inQuickInput && quickInputType == 'quickPick' || inQuickInput && quickInputType == 'quickTree'",
  },
  {
    key: "alt+k",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "selectPrevCodeAction (alt+k)",
      command: "selectPrevCodeAction",
    },
    when: "codeActionMenuVisible",
  },
  {
    key: "alt+j",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "selectNextCodeAction (alt+j)",
      command: "selectNextCodeAction",
    },
    when: "codeActionMenuVisible",
  },
  {
    key: "shift+alt+k",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "list.scrollUpFast (shift+alt+k)",
      command: "runCommands",
      commandArgs: {
        commands: ["list.scrollUp", "list.scrollUp", "list.scrollUp"],
      },
    },
    when: "filesExplorerFocus && !inputFocus",
  },
  {
    key: "shift+alt+j",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "list.scrollDownFast (shift+alt+j)",
      command: "runCommands",
      commandArgs: {
        commands: ["list.scrollDown", "list.scrollDown", "list.scrollDown"],
      },
    },
    when: "filesExplorerFocus && !inputFocus",
  },
  {
    key: "ctrl+alt+k",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "list.focusPageUp (ctrl+alt+k)",
      command: "list.focusPageUp",
    },
    when: "listFocus && !inputFocus && !treestickyScrollFocused",
  },
  {
    key: "ctrl+alt+j",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "list.focusPageDown (ctrl+alt+j)",
      command: "list.focusPageDown",
    },
    when: "listFocus && !inputFocus && !treestickyScrollFocused",
  },
  {
    key: "alt+f alt+j",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "jumpToNextSnippetPlaceholder (alt+f alt+j)",
      command: "jumpToNextSnippetPlaceholder",
    },
    when: "hasNextTabstop && inSnippetMode && textInputFocus",
  },
  {
    key: "alt+f alt+k",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "jumpToPrevSnippetPlaceholder (alt+f alt+k)",
      command: "jumpToPrevSnippetPlaceholder",
    },
    when: "hasPrevTabstop && inSnippetMode && textInputFocus",
  },
  //#endregion

  //#region 左クリック系
  {
    key: "m",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "list.select (m)",
      command: "list.select",
    },
    when: "listFocus && !inputFocus && !treestickyScrollFocused",
  },
  // ==========================================================
  // 1. 各種UI・ポップアップの確定系 (alt+m)
  // ==========================================================
  // サジェスト（入力補完）の確定
  {
    key: "alt+m",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "acceptSelectedSuggestion (alt+m)",
      command: "acceptSelectedSuggestion",
    },
    when: "acceptSuggestionOnEnter && suggestWidgetHasFocusedSuggestion && suggestWidgetVisible && suggestionMakesTextEdit && textInputFocus",
  },
  // クイックフィックス（コードアクション）の確定
  {
    key: "alt+m",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "acceptSelectedCodeAction (alt+m)",
      command: "acceptSelectedCodeAction",
    },
    when: "codeActionMenuVisible",
  },
  // ファイル/シンボルのリネーム確定
  {
    key: "alt+m",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "acceptRenameInput (alt+m)",
      command: "acceptRenameInput",
    },
    when: "editorFocus && renameInputVisible && !isComposing",
  },
  // クイックオープン（コマンドパレット等）の決定
  {
    key: "alt+m",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "workbench.action.acceptSelectedQuickOpenItem (alt+m)",
      command: "workbench.action.acceptSelectedQuickOpenItem",
    },
    when: "inQuickOpen",
  },

  // ==========================================================
  // 2. リスト・エクスプローラー操作系
  // ==========================================================
  // 定義・参照Peekリスト：決定してPeekを閉じる (alt+m)
  {
    key: "alt+m",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "openReferenceAndClose (alt+m)",
      command: "runCommands",
      commandArgs: {
        commands: ["openReference", "closeReferenceSearch"],
      },
    },
    when: "listFocus && referenceSearchVisible && !inputFocus",
  },
  // エクスプローラー（ファイル）：プレビューしてフォーカス維持 (alt+m)
  {
    key: "alt+m",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "filesExplorer.openFilePreserveFocus (alt+m)",
      command: "filesExplorer.openFilePreserveFocus",
    },
    when: "filesExplorerFocus && !explorerResourceIsFolder && !inputFocus",
  },
  // エクスプローラー：開いてサイドバーを閉じる (shift+alt+m)
  {
    key: "shift+alt+m",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "openAndCloseSidebar (shift+alt+m)",
      command: "runCommands",
      commandArgs: {
        commands: ["list.select", "workbench.action.closeSidebar"],
      },
    },
    when: "filesExplorerFocus && !inputFocus",
  },
  // 通常の汎用リスト（検索結果パネルやアウトライン等）：通常の決定 (alt+m)
  {
    key: "alt+m",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "list.select (alt+m)",
      command: "list.select",
    },
    when: "!treeElementCanExpand && !treeElementCanCollapse && listFocus && !filesExplorerFocus && !referenceSearchVisible && !inputFocus && !treestickyScrollFocused",
  },
  // 縮小トグル (alt+m)
  {
    key: "alt+m",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "list.toggleExpand (alt+m)",
      command: "list.toggleExpand",
    },
    when: "(treeElementCanExpand || treeElementCanCollapse) && explorerResourceIsFolder && !inputFocus",
  },

  // ==========================================================
  // 3. エディタ内・コードジャンプ系
  // ==========================================================
  // Peekウィジェット表示中：エディタとPeekのフォーカス切替 (shift+alt+m)
  {
    key: "shift+alt+m",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "togglePeekWidgetFocus (shift+alt+m)",
      command: "togglePeekWidgetFocus",
    },
    when: "referenceSearchVisible",
  },
  // 定義をピーク (alt+m)
  {
    key: "alt+m",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "editor.action.peekDefinition (alt+m)",
      command: "editor.action.peekDefinition",
    },
    // 基本条件 + alt+mが補完確定と被るため !suggestWidgetVisible を付与
    when: "editorHasDefinitionProvider && editorTextFocus && !referenceSearchVisible && !inReferenceSearchEditor && !isInEmbeddedEditor && !suggestWidgetVisible",
  },
  // 実装へジャンプ (shift+alt+m)
  {
    key: "shift+alt+m",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "editor.action.goToImplementation (shift+alt+m)",
      command: "editor.action.goToImplementation",
    },
    when: "editorHasImplementationProvider && editorTextFocus && !referenceSearchVisible && !inReferenceSearchEditor && !isInEmbeddedEditor",
  },
  // 参照へジャンプ (ctrl+alt+m)
  {
    key: "ctrl+alt+m",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "editor.action.goToReferences (ctrl+alt+m)",
      command: "editor.action.goToReferences",
    },
    // 基本条件
    when: "editorHasReferenceProvider && editorTextFocus && !referenceSearchVisible && !inReferenceSearchEditor && !isInEmbeddedEditor",
  },
  // 横（分割画面）に定義を開く (alt+f alt+m)
  {
    key: "alt+f alt+m",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "editor.action.revealDefinitionAside (alt+f alt+m)",
      command: "editor.action.revealDefinitionAside",
    },
    when: "editorHasDefinitionProvider && editorTextFocus && !isInEmbeddedEditor",
  },
  //#endregion

  //#region エクスプローラー・ファイル・フォルダ操作系
  {
    key: "alt+e",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "workbench.action.focusActiveEditorGroup (alt+e)",
      command: "workbench.action.focusActiveEditorGroup",
    },
    when: "filesExplorerFocus && !inputFocus",
  },
  {
    key: "alt+e",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "workbench.files.action.focusFilesExplorer:cancelRename (alt+e)",
      command: "workbench.files.action.focusFilesExplorer",
    },
    when: "explorerViewletVisible && filesExplorerFocus && inputFocus",
  },
  {
    key: "alt+n",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "explorer.newFile (alt+n)",
      command: "explorer.newFile",
    },
    when: "filesExplorerFocus && foldersViewVisible && !inputFocus",
  },
  {
    key: "shift+alt+n",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "explorer.newFolder (shift+alt+n)",
      command: "explorer.newFolder",
    },
    when: "filesExplorerFocus && foldersViewVisible && !inputFocus",
  },
  {
    key: "alt+r",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "renameFile (alt+r)",
      command: "renameFile",
    },
    when: "filesExplorerFocus && foldersViewVisible && !explorerResourceIsRoot && !explorerResourceReadonly && !inputFocus",
  },
  {
    key: "alt+f alt+n",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "duplicateAndRenameFile (alt+f alt+n)",
      command: "runCommands",
      commandArgs: {
        commands: ["filesExplorer.copy", "filesExplorer.paste", "renameFile"],
      },
    },
    when: "filesExplorerFocus && foldersViewVisible && !explorerResourceIsRoot && !explorerResourceReadonly && !inputFocus",
  },
  {
    key: "alt+f alt+y",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "filesExplorer.copy (alt+f alt+y)",
      command: "filesExplorer.copy",
    },
    when: "filesExplorerFocus && foldersViewVisible && !explorerResourceIsRoot && !inputFocus",
  },
  {
    key: "alt+f alt+p",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "filesExplorer.paste (alt+f alt+p)",
      command: "filesExplorer.paste",
    },
    when: "filesExplorerFocus && foldersViewVisible && !explorerResourceReadonly && !inputFocus",
  },
  {
    key: "alt+f alt+d",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "filesExplorer.cut (alt+f alt+d)",
      command: "filesExplorer.cut",
    },
    when: "!explorerResourceCut && filesExplorerFocus && foldersViewVisible && !explorerResourceIsRoot && !explorerResourceReadonly && !inputFocus",
  },
  {
    key: "alt+f alt+d",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "filesExplorer.cancelCut (alt+f alt+d)",
      command: "filesExplorer.cancelCut",
    },
    when: "explorerResourceCut && filesExplorerFocus && foldersViewVisible && !inputFocus",
  },
  {
    key: "alt+y",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "copyFileName (alt+y)",
      command: "runCommands",
      commandArgs: {
        commands: [
          "renameFile",
          "editor.action.selectAll",
          "editor.action.clipboardCopyAction",
          "workbench.files.action.focusFilesExplorer",
        ],
      },
    },
    when: "filesExplorerFocus && !inputFocus",
  },
  {
    key: "shift+alt+y",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "copyRelativeFilePath (shift+alt+y)",
      command: "copyRelativeFilePath",
    },
    when: "filesExplorerFocus && !inputFocus",
  },
  {
    key: "ctrl+alt+y",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "copyFilePath (ctrl+alt+y)",
      command: "copyFilePath",
    },
    when: "filesExplorerFocus && !inputFocus",
  },
  //#endregion

  //#region 閉じる・キャンセル系
  {
    key: "alt+e",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "removeSecondaryCursors (alt+e)",
      command: "removeSecondaryCursors",
    },
    when: "editorHasMultipleSelections && textInputFocus",
  },
  {
    key: "alt+e",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "cancelSelection (alt+e)",
      command: "cancelSelection",
    },
    when: "editorHasSelection && textInputFocus",
  },
  {
    key: "alt+e",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "leaveSnippet (alt+e)",
      command: "leaveSnippet",
    },
    when: "inSnippetMode && textInputFocus",
  },
  {
    key: "alt+e",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "hideSuggestWidget (alt+e)",
      command: "hideSuggestWidget",
    },
    when: "suggestWidgetVisible && textInputFocus",
  },
  {
    key: "alt+e",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "hideCodeActionWidget (alt+e)",
      command: "hideCodeActionWidget",
    },
    when: "codeActionMenuVisible",
  },
  {
    key: "alt+e",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "quickInput.hide (alt+e)",
      command: "quickInput.hide",
    },
    when: "inQuickInput",
  },
  {
    key: "alt+e",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "closeFindWidget (alt+e)",
      command: "closeFindWidget",
    },
    when: "editorFocus && findWidgetVisible && !isComposing",
  },
  {
    key: "alt+e",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "editor.action.cancelSelectionAnchor (alt+e)",
      command: "editor.action.cancelSelectionAnchor",
    },
    when: "editorTextFocus && selectionAnchorSet",
  },
  {
    key: "alt+e",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "editor.action.inlineSuggest.hide (alt+e)",
      command: "editor.action.inlineSuggest.hide",
    },
    when: "inlineSuggestVisible && textInputFocus",
  },
  {
    key: "alt+e",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "closeEditorHover (alt+e)",
      command: "closeEditorHover",
    },
    when: "editorHoverVisible",
  },
  {
    key: "alt+e",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "closeMarkersNavigation (alt+e)",
      command: "closeMarkersNavigation",
    },
    when: "editorFocus && markersNavigationVisible",
  },
  {
    key: "alt+e",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "closeReferenceSearch (alt+e)",
      command: "closeReferenceSearch",
    },
    when: "referenceSearchVisible",
  },
  {
    key: "alt+e",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "cancelRenameInput (alt+e)",
      command: "cancelRenameInput",
    },
    when: "editorFocus && renameInputVisible",
  },
  //#endregion

  //#region テキスト検索系
  {
    key: "alt+s",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "actions.find (alt+s)",
      command: "actions.find",
    },
    when: "editorFocus || editorIsOpen",
  },
  {
    key: "alt+s",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "closeFindWidget (alt+s)",
      command: "closeFindWidget",
    },
    when: "findWidgetVisible && !isComposing && (findInputFocussed || replaceInputFocussed)",
  },
  {
    key: "shift+alt+s",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "editor.action.startFindReplaceAction (shift+alt+s)",
      command: "editor.action.startFindReplaceAction",
    },
    when: "editorFocus || editorIsOpen",
  },
  {
    key: "alt+k",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "editor.action.previousMatchFindAction (alt+k)",
      command: "editor.action.previousMatchFindAction",
    },
    when: "editorFocus && findInputFocussed",
  },
  {
    key: "alt+j",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "editor.action.nextMatchFindAction (alt+j)",
      command: "editor.action.nextMatchFindAction",
    },
    when: "editorFocus && findInputFocussed",
  },
  // 削除されたキー(alt+w, alt+r, alt+c, alt+l)のリカバリー
  {
    key: "alt+f alt+w",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "toggleSearchEditorWholeWord (alt+f alt+w)",
      command: "toggleSearchEditorWholeWord",
    },
    when: "inSearchEditor && searchInputBoxFocus",
  },
  {
    key: "alt+f alt+w",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "toggleFindWholeWord (alt+f alt+w)",
      command: "toggleFindWholeWord",
    },
    when: "editorFocus",
  },
  {
    key: "alt+f alt+w",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "toggleSearchWholeWord (alt+f alt+w)",
      command: "toggleSearchWholeWord",
    },
    when: "searchViewletFocus",
  },
  {
    key: "alt+f alt+r",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "toggleFindRegex (alt+f alt+r)",
      command: "toggleFindRegex",
    },
    when: "editorFocus",
  },
  {
    key: "alt+f alt+r",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "toggleSearchRegex (alt+f alt+r)",
      command: "toggleSearchRegex",
    },
    when: "searchViewletFocus",
  },
  {
    key: "alt+f alt+r",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "toggleFindRegex (alt+f alt+r)",
      command: "workbench.action.chat.toggleFindRegex",
    },
    when: "chatFindWidgetVisible",
  },
  {
    key: "alt+f alt+c",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "toggleFindCaseSensitive (alt+f alt+c)",
      command: "toggleFindCaseSensitive",
    },
    when: "editorFocus",
  },
  {
    key: "alt+f alt+c",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "toggleSearchCaseSensitive (alt+f alt+c)",
      command: "toggleSearchCaseSensitive",
    },
    when: "searchViewletFocus",
  },
  {
    key: "alt+f alt+c",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "toggleFindCaseSensitive (alt+f alt+c)",
      command: "workbench.action.chat.toggleFindCaseSensitive",
    },
    when: "chatFindWidgetVisible",
  },
  {
    key: "alt+f alt+l",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "toggleFindInSelection (alt+f alt+l)",
      command: "toggleFindInSelection",
    },
    when: "editorFocus",
  },
  //#endregion

  //#region コード構造系
  {
    key: "alt+8",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "editor.toggleFold (alt+8)",
      command: "editor.toggleFold",
    },
    when: "editorTextFocus && foldingEnabled",
  },
  {
    key: "shift+alt+8",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "editor.toggleFoldRecursively (shift+alt+8)",
      command: "editor.toggleFoldRecursively",
    },
    when: "editorTextFocus && foldingEnabled",
  },
  {
    key: "alt+9",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "editor.foldAll (alt+9)",
      command: "editor.foldAll",
    },
    when: "editorTextFocus && foldingEnabled",
  },
  {
    key: "shift+alt+9",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "editor.unfoldAll (shift+alt+9)",
      command: "editor.unfoldAll",
    },
    when: "editorTextFocus && foldingEnabled",
  },
  {
    key: "alt+f alt+f",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "editor.action.formatDocument (alt+f alt+f)",
      command: "editor.action.formatDocument",
    },
    when: "editorHasDocumentFormattingProvider && editorTextFocus && !editorReadonly && !inCompositeEditor",
  },
  {
    key: "alt+f alt+f",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "editor.action.formatDocument.none (alt+f alt+f)",
      command: "editor.action.formatDocument.none",
    },
    when: "editorTextFocus && !editorHasDocumentFormattingProvider && !editorReadonly",
  },
  //#endregion

  //#region コード実行系
  {
    key: "alt+f alt+enter",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "code-runner.run (alt+f alt+enter)",
      command: "code-runner.run",
    },
    when: "editorTextFocus",
  },
  {
    key: "shift+alt+f shift+alt+enter",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "code-runner.stop (shift+alt+f shift+alt+enter)",
      command: "code-runner.stop",
    },
  },
  //#endregion

  //#region エディタ・画面分割系
  {
    key: "alt+w",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "workbench.action.closeActiveEditor (alt+w)",
      command: "workbench.action.closeActiveEditor",
    },
  },
  {
    key: "shift+alt+w",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "workbench.action.reopenClosedEditor (shift+alt+w)",
      command: "workbench.action.reopenClosedEditor",
    },
  },
  {
    key: "alt+t",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "workbench.action.terminal.toggleTerminal (alt+t)",
      command: "workbench.action.terminal.toggleTerminal",
    },
    when: "terminal.active",
  },
  {
    key: "ctrl+alt+t",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "workbench.action.terminal.toggleTerminal (alt+t)",
      command: "workbench.action.terminal.toggleTerminal",
    },
    when: "terminal.active",
  },
  {
    key: "shift+alt+t",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "workbench.action.focusActiveEditorGroup (shift+alt+t)",
      command: "workbench.action.focusActiveEditorGroup",
    },
    when: "terminalFocus",
  },
  {
    key: "shift+alt+t",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "workbench.action.terminal.focus (shift+alt+t)",
      command: "workbench.action.terminal.focus",
    },
    when: "!terminalFocus",
  },
  {
    key: "alt+q",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "workbench.action.quickOpen (alt+q)",
      command: "workbench.action.quickOpen",
    },
  },
  {
    key: "alt+q",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "quickOpenSelectNextAndAccept (alt+q)",
      command: "runCommands",
      commandArgs: {
        commands: [
          "workbench.action.quickOpenSelectNext",
          "workbench.action.acceptSelectedQuickOpenItem",
        ],
      },
    },
    when: "inQuickOpen",
  },
  {
    key: "shift+alt+q",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "workbench.action.showCommands (shift+alt+q)",
      command: "workbench.action.showCommands",
    },
  },
  {
    key: "alt+0",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "workbench.action.nextEditorInGroup (alt+0)",
      command: "workbench.action.nextEditorInGroup",
    },
  },
  {
    key: "shift+alt+0",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "workbench.action.previousEditorInGroup (shift+alt+0)",
      command: "workbench.action.previousEditorInGroup",
    },
  },
  {
    key: "ctrl+alt+0",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "workbench.action.lastEditorInGroup (ctrl+alt+0)",
      command: "workbench.action.lastEditorInGroup",
    },
  },
  {
    key: "alt+'",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "workbench.action.closeGroup (alt+')",
      command: "workbench.action.closeGroup",
    },
  },
  {
    key: "shift+alt+'",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "workbench.action.splitEditor (shift+alt+')",
      command: "workbench.action.splitEditor",
    },
  },
  {
    key: "alt+-",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "workbench.action.focusRightGroup (alt+-)",
      command: "workbench.action.focusRightGroup",
    },
  },
  {
    key: "shift+alt+-",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "workbench.action.focusLeftGroup (shift+alt+-)",
      command: "workbench.action.focusLeftGroup",
    },
  },
  {
    key: "ctrl+alt+-",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "workbench.action.focusBelowGroup (ctrl+alt+-)",
      command: "workbench.action.focusBelowGroup",
    },
  },
  {
    key: "ctrl+shift+alt+-",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "workbench.action.focusAboveGroup (ctrl+shift+alt+-)",
      command: "workbench.action.focusAboveGroup",
    },
  },
  //#endregion

  //#region サイドバー系
  // --- エクスプローラー (Explorer) ---
  {
    key: "alt+f alt+e",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "workbench.action.toggleSidebarVisibility (alt+f alt+e)",
      command: "workbench.action.toggleSidebarVisibility",
    },
    when: "sideBarFocus && activeViewlet == 'workbench.view.explorer'",
  },
  {
    key: "alt+f alt+e",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "workbench.view.explorer (alt+f alt+e)",
      command: "workbench.view.explorer",
    },
    when: "!sideBarFocus || activeViewlet != 'workbench.view.explorer'",
  },
  // --- ソース管理 (SCM / Git) ---
  {
    key: "alt+f alt+g",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "workbench.action.toggleSidebarVisibility (alt+f alt+g)",
      command: "workbench.action.toggleSidebarVisibility",
    },
    when: "activeViewlet == 'workbench.view.scm' && sideBarVisible",
  },
  {
    key: "alt+f alt+g",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "workbench.view.scm (alt+f alt+g)",
      command: "workbench.view.scm",
    },
    when: "activeViewlet != 'workbench.view.scm' || !sideBarVisible",
  },
  // --- 検索 (Find in Files) ---
  {
    key: "alt+f alt+s",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "workbench.action.toggleSidebarVisibility (alt+f alt+s)",
      command: "workbench.action.toggleSidebarVisibility",
    },
    when: "activeViewlet == 'workbench.view.search' && sideBarVisible",
  },
  {
    key: "alt+f alt+s",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "workbench.action.findInFiles (alt+f alt+s)",
      command: "workbench.action.findInFiles",
    },
    when: "activeViewlet != 'workbench.view.search' || !sideBarVisible",
  },
  // --- 置換 ---
  {
    key: "shift+alt+f shift+alt+s",
    command: "myTracker.trackAndRun",
    args: {
      keyName:
        "workbench.action.toggleSidebarVisibility (shift+alt+f shift+alt+s)",
      command: "workbench.action.toggleSidebarVisibility",
    },
    when: "activeViewlet == 'workbench.view.search' && sideBarVisible",
  },
  {
    key: "shift+alt+f shift+alt+s",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "workbench.action.replaceInFiles (shift+alt+f shift+alt+s)",
      command: "workbench.action.replaceInFiles",
    },
    when: "activeViewlet != 'workbench.view.search' || !sideBarVisible",
  },
  // --- 右サイドバー ---
  {
    key: "alt+f alt+b",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "workbench.action.toggleAuxiliaryBar (alt+f alt+b)",
      command: "workbench.action.toggleAuxiliaryBar",
    },
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
    key: "alt+c",
    command: "-toggleSearchCaseSensitive",
    when: "searchViewletFocus",
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
    key: "ctrl+alt+n",
    command: "-code-runner.run",
  },
  {
    key: "ctrl+alt+b",
    command: "-workbench.action.toggleAuxiliaryBar",
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

  //#region デフォルト基本ショートカット追跡
  // 貼り付け
  {
    key: "ctrl+v",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "editor.action.clipboardPasteAction (ctrl+v)",
      command: "editor.action.clipboardPasteAction",
    },
  },
  // コピー
  {
    key: "ctrl+c",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "editor.action.clipboardCopyAction (ctrl+c)",
      command: "editor.action.clipboardCopyAction",
    },
  },
  // 全選択
  {
    key: "ctrl+a",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "editor.action.selectAll (ctrl+a)",
      command: "editor.action.selectAll",
    },
  },
  // 次の一致を選択に追加
  {
    key: "ctrl+d",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "editor.action.addSelectionToNextFindMatch (ctrl+d)",
      command: "editor.action.addSelectionToNextFindMatch",
    },
    when: "editorFocus",
  },
  // 保存
  {
    key: "ctrl+s",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "workbench.action.files.save (ctrl+s)",
      command: "workbench.action.files.save",
    },
  },
  // 切り取り
  {
    key: "ctrl+x",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "editor.action.clipboardCutAction (ctrl+x)",
      command: "editor.action.clipboardCutAction",
    },
  },
  // 元に戻す (Undo)
  {
    key: "ctrl+z",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "undo (ctrl+z)",
      command: "undo",
    },
  },
  // やり直し (Redo)
  {
    key: "ctrl+y",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "redo (ctrl+y)",
      command: "redo",
    },
  },
  // エディタを閉じる
  {
    key: "ctrl+w",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "workbench.action.closeActiveEditor (ctrl+w)",
      command: "workbench.action.closeActiveEditor",
    },
  },
  // ビューのクイックオープン (Quick Open View)
  {
    key: "ctrl+q",
    command: "myTracker.trackAndRun",
    args: {
      keyName: "workbench.action.quickOpenView (ctrl+q)",
      command: "workbench.action.quickOpenView",
    },
  },
  {
    key: "ctrl+alt+m",
    command: "-code-runner.stop",
  },
  //#endregion

  // --- 自動追加検出用セパレーター（GUI等でキーバインドを追加した際に下部へ追記される目印） ---
  {
    key: "-",
  },
];

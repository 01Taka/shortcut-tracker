# Shortcut Tracker

VS Code 上のショートカット実行回数や連続入力（キーシーケンス）を計測・集計する拡張機能です。

## `keybindings.json` の記述形式

計測対象のショートカットは `command` に `"myTracker.trackAndRun"` を指定し、`args` に実行コマンドと計測用のメタデータを記述します。

### `args` プロパティ仕様

```ts
interface KeybindingEntry {
  key: string;
  command: "myTracker.trackAndRun";
  args: TrackArgs;
  when?: string;
}

interface TrackArgs {
  /** 統計表示時に末尾へ `(key)` として付与されるキー表記（例: `"alt+h"`, `"shift+alt+k"`） */
  key?: string;
  /** 統計上のベース名。省略時は `command`（配列の場合は `"runCommands"`）を使用。指定時は `command` より優先 */
  keyName?: string;
  /** ベース名の後ろに `:nameSuffix` として連結されるサフィックス（例: `"up"`, `"selection"`） */
  nameSuffix?: string;
  /** 実際に実行する VS Code コマンド ID。配列を渡すと `runCommands`（`{ commands: [...] }`）として実行 */
  command: string | unknown[];
  /** `command` 実行時に渡す引数 */
  commandArgs?: unknown;
}
```

### 統計記録名の生成ルール

`myTracker.trackAndRun` は以下の規則で記録名を生成します。

1. **ベース名**: `keyName` が指定されていれば `keyName`、省略時は `command`
2. **サフィックス**: `nameSuffix` が指定されていれば `${ベース名}:${nameSuffix}`
3. **キー表記**: `key` が指定されていれば `${サフィックス適用後} (${key})`

| 設定パターン | 生成される記録名 |
| --- | --- |
| `command` + `key` のみ | `command (key)` |
| `command` + `nameSuffix` + `key` | `command:nameSuffix (key)` |
| `keyName` + `command` + `key` | `keyName (key)` |
| `keyName` + `nameSuffix` + `command` + `key` | `keyName:nameSuffix (key)` |

---

### 記述例

#### 1. 単発コマンド（`keyName` 省略）

```jsonc
{
  "key": "alt+h",
  "command": "myTracker.trackAndRun",
  "args": {
    "key": "alt+h",
    "command": "cursorLeft"
  }
}
```
→ `"cursorLeft (alt+h)"` として記録されます。

#### 2. `nameSuffix` と `commandArgs` を指定する例

```jsonc
{
  "key": "shift+alt+k",
  "command": "myTracker.trackAndRun",
  "args": {
    "key": "shift+alt+k",
    "nameSuffix": "up",
    "command": "editorScroll",
    "commandArgs": {
      "to": "up",
      "by": "halfPage"
    }
  }
}
```
→ `"editorScroll:up (shift+alt+k)"` として記録されます。

#### 3. `runCommands` を配列ショートハンドで記述する例

```jsonc
{
  "key": "ctrl+alt+r",
  "command": "myTracker.trackAndRun",
  "args": {
    "key": "ctrl+alt+r",
    "keyName": "focusAndTop",
    "command": [
      "workbench.action.focusActiveEditorGroup",
      "cursorTop"
    ]
  }
}
```
→ `runCommands`（`{ commands: ["workbench.action.focusActiveEditorGroup", "cursorTop"] }`）として実行され、`"focusAndTop (ctrl+alt+r)"` として記録されます（`keyName` 省略時は `"runCommands (ctrl+alt+r)"`）。

---

## JSON フォーマット機能

コマンドパレットから **`ShortcutStatus Format Keybindings JSON`**（`myTracker.formatKeybindingsJson`）を実行すると、アクティブエディタで開いている JSON / JSONC ファイル内の `myTracker.trackAndRun` エントリを自動整形します（コメントや既存レイアウトは保持されます）。

### 変換ルール

1. **ルート `key` の反映**: エントリのルートにある `key` プロパティで `args.key` を上書きします。
2. **完成済み `keyName` の分解**: `args.keyName` が `"editorScroll:up (shift+alt+k)"` のような形式の場合、末尾の `(key)` を削除し、最初の `:` で `keyName` と `nameSuffix` に分割します（既に `args.nameSuffix` が指定されている場合は既存値を優先）。
3. **冗長な `keyName` の省略**: 分割後（または元）の `keyName` が `command` と一致する場合、`args.keyName` を省略します。
4. **プロパティ順序の統一**: `key` → `keyName` → `nameSuffix` → `command` → `commandArgs` の順に整形します。

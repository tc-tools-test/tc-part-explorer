# TC Part Explorer – Web Extension (prototype)

Trimble Connect 3D Viewer の右側メニューにボタンを追加する拡張機能の雏形です。
WPF 版（Desktop API）と同じ機能を Workspace API で実装しています。

- Name / Profile / Material を全オブジェクトから読み込み
- リアルタイム検索
- 行クリック → 3D ビューで選択 + ズーム

## ファイル

| ファイル | 内容 |
|---|---|
| `manifest.json` | 拡張機能の登録情報（タイトル・アイコン・URL） |
| `index.html` / `style.css` / `app.js` | パネルに表示されるページ本体 |
| `icon.png` | 右側メニューのアイコン（48×48） |

## 手順

### 1. HTTPS でホスティング

Trimble Connect は **HTTPS** の URL しか読み込めません。手軽な方法:

- **GitHub Pages**: このフォルダをリポジトリに push → Settings → Pages を有効化
- Azure Static Web Apps / Netlify / 社内 IIS（HTTPS 証明書つき）でも可

### 2. `manifest.json` の URL を書き換え

`YOUR-HOST/tc-part-explorer/` を実際の公開 URL に置換します。
ブラウザで `https://.../manifest.json` を直接開いて JSON が表示されることを確認してください。

### 3. プロジェクトに登録（Web 版で実施）

1. ブラウザで https://web.connect.trimble.com を開き、対象プロジェクトに入る
2. **設定 → 拡張機能（Extensions）** を開く
3. カスタム拡張機能の追加で `manifest.json` の URL を入力
4. 有効化（プロジェクト管理者権限が必要）

### 4. 確認

1. Web 版で 3D Viewer を開き、右側メニューにアイコンが出るか確認
2. 同じプロジェクトを **デスクトップ版** で開き直し、同じアイコンが出るか確認
   （出ない場合はデスクトップ版を最新に更新）

## デバッグ

- パネル内で右クリック → 「検証」で DevTools を開ける（Web 版のブラウザで行うのが簡単）
- `app.js` を修正 → 再デプロイ → パネルを開き直すと反映
  （キャッシュが残る場合は `index.html` の `app.js?v=2` のようにクエリを付ける）

## 今後の拡張案

- `viewer.onSelectionChanged` イベントで、3D 側の選択を表に反映（双方向連動）
- 検索結果をまとめて選択 / 色付け（`api.viewer.setObjectState`）
- CSV 出力
- 大規模モデル向けに仮想スクロール

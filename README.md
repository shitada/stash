# stash

Web 記事、動画、ドキュメントなど、さまざまな資料の要約ページを蓄積・公開するための個人用リポジトリです。
気になった情報を後から読み返しやすい形に整理し、GitHub Pages で公開しています。

## 公開サイト

`main` ブランチのルートを GitHub Pages で配信しています。

- ランディング: <https://shitada.github.io/stash/>
- レポート例: <https://shitada.github.io/stash/reports/tw-future-of-software-engineering-ja.html>

## 構成

- `index.html` ― 公開ランディングページ
- `reports/` ― 資料ごとのレポートや要約 HTML
- `images/` ― 要約ページなどで使用する画像
  - `images/copilot-troubleshooting/` ― GitHub Copilot 関連のスクリーンショット
- `.nojekyll` ― GitHub Pages の Jekyll 処理を無効化

## 運用メモ

- 要約は元資料の内容を整理したものであり、正確な情報や詳細は必ず原典を参照してください。
- 内容は予告なく更新・整理・移動・削除することがあります。
- 公開リポジトリのため、機密情報やプライベートな画像は置かないこと。
- `images/` 以下に置いたファイルは生 URL（`raw.githubusercontent.com` や Pages URL）で参照できます。

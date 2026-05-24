---
name: content-summarizer
description: "Use when the user asks to summarize, recap, or digest external content (YouTube videos, web articles, PDFs, podcasts, transcripts, pasted text) into a saved HTML report under reports/. Triggers include 要約, まとめ, summarize, recap, digest, transcript, 文字起こし, YouTube 要約, レポート化. Procedure: detect source type, fetch the actual content (for YouTube use yt-dlp; for web use fetch_webpage; for local files read directly), STOP if content cannot be obtained, then produce a faithful no-omission Japanese summary HTML rich in tables and diagrams (Mermaid for flows/sequences) with a sticky left sidebar TOC that scroll-spies the current section, source metadata header (URL/author/published date/etc.), and a fixed unofficial-summary disclaimer in the footer. Output is saved to reports/. Cleans up temporary work files."
argument-hint: "<URL or file path> [要約言語]"
---

# Content Summarizer (to HTML Report)

外部コンテンツ（YouTube 動画、Web 記事、PDF、トランスクリプト、貼り付けテキストなど）を取得し、忠実な日本語要約（必要に応じて他言語）を、**表・図を多用した読みやすい単一 HTML レポート** として `reports/` 配下に保存するためのワークフロー。

## When to Use

- 「この動画を要約して HTML にして」「この記事をまとめて」と言われたとき
- YouTube URL、記事 URL、PDF、`.srt`/`.vtt` 字幕、`.txt` 原稿などを渡され、要約 HTML が欲しいと明示／示唆されたとき
- 「省略せず」「内容を全部」など、忠実度を重視した要約が求められたとき

## When NOT to Use

- 単純な質問への回答（要約 HTML 化を求めていない）
- 既存の要約 HTML を微修正するだけのとき（直接編集で十分）
- バイナリ・著作権保護コンテンツの全文転載要求（要約として扱い、丸写しはしない）

## Hard Rules

1. **取得できなければ止める。** ソースの本文・字幕・テキストを実取得できない場合、推測で書かない。理由を簡潔に説明して停止し、代替手段（手動貼り付け、字幕アップロード等）を提案する。
2. **省略しない要約をデフォルトにする。** 主要トピックを 1 つも落とさない。冗長表現は圧縮してよいが、論点・固有名詞・発表事項・例示は残す。
3. **出力は単一 HTML、保存先は `reports/`**。ファイル名は `kebab-case` で内容を表す英語名（例: `andrew-ng-future-of-ai-coding.html`）。
4. **表と図で必ず視覚化する。** 比較・分類・対応関係は **表**、フロー／プロセス／シーケンス／状態遷移／関係図は **Mermaid**、それ以外の単純な装飾（バッジ・カウンタ・カード・矢印 1 本など）は **生 HTML/CSS** で表現する。全文がプレーンな段落になっているレポートは不可。
5. **左サイドバーに目次を常設し、スクロールスパイで現在地をハイライトする。** デスクトップ幅では本文の左横に固定表示、モバイル幅では上部の折りたたみメニューに切り替える。テンプレート内蔵の `IntersectionObserver` を使うこと。
6. **ソースのメタデータを冒頭に簡潔にまとめる。** URL、著者／登壇者、公開日、媒体／チャンネル、ライセンス表記、所要時間／文字数など、取得できたものを **メタ情報カード** として配置する。長くなりすぎないよう 1 行 1 項目で、最大 8 項目程度。
7. **フッターに以下の免責文を必ず入れる。**
   > 本レポートは、上記の出典元コンテンツを参照し、内容を省略せず日本語で要約・再構成した非公式まとめです。記述に誤りがある場合は出典元の表現が正となります。
8. **スタイルは既存に合わせる。** リポジトリ既存の [index.html](../../../index.html) と同じ CSS 変数・ダーク/ライト両対応・日本語フォントスタックを踏襲する。下の [HTML テンプレート](#html-テンプレート) を出発点に使う。
9. **作業用一時ファイルは削除する。** `.tmp/` などに置いた中間ファイル（字幕・素テキスト等）は要約完成後に削除する。

## Procedure

### 1. ソースの種別を判定する

| 種別 | 判定 | 取得方法 |
|------|------|----------|
| YouTube | `youtube.com/watch?v=` または `youtu.be/` を含む | **yt-dlp**（下記コマンド） |
| 一般 Web ページ | その他の URL | `fetch_webpage` |
| ローカルファイル | パスが渡された | `read_file` |
| 貼り付けテキスト | 本文を直接渡された | そのまま使用 |
| PDF | `.pdf` パス／URL | ローカルなら `pdftotext`、URL ならダウンロード後変換 |
| 音声・動画ファイル（字幕なし） | `.mp3`/`.mp4` 等 | 字幕がなければ `whisper.cpp` 等での文字起こしが必要 |

### 2. コンテンツとメタデータを取得する

メタデータは要約本文と同じくらい重要。後段でヘッダーカードに表示するため、取得時に必ず控える。

#### 2-a. YouTube の場合（**必ず yt-dlp を使う**）

外部 Web サービスやサードパーティのトランスクリプトサイトには **依存しない**。理由：ログイン要求／ブロック／レート制限／品質低下が頻発する。

前提チェック・インストール：

```sh
which yt-dlp || brew install yt-dlp
```

メタデータと字幕を一度に取得（推奨）：

```sh
mkdir -p .tmp && cd .tmp
# メタデータ JSON
yt-dlp --skip-download --write-info-json -o "%(id)s.%(ext)s" "<YouTube URL>"
# 字幕（原語最優先。日本語自動翻訳は HTTP 429 で失敗しやすい）
yt-dlp --skip-download \
       --write-auto-subs --write-subs \
       --sub-langs "<lang>-orig,<lang>,ja" \
       --convert-subs srt \
       -o "%(id)s.%(ext)s" \
       "<YouTube URL>"
```

`<ID>.info.json` から以下を抽出してヘッダーカードに反映：

| キー | 用途 |
|------|------|
| `title` | レポートタイトル |
| `uploader` / `channel` | 著者／チャンネル |
| `upload_date` (YYYYMMDD) | 公開日 |
| `duration` (秒) | 所要時間（`hh:mm:ss` に整形） |
| `webpage_url` | 出典 URL |
| `description` | 概要（長い場合は冒頭 1〜2 行のみ） |
| `tags` / `categories` | タグ／カテゴリ（多すぎる場合は最大 5 件） |
| `view_count` | 視聴回数（任意） |

SRT からタイムコードと重複を除いた素テキストへ整形：

```sh
grep -vE '^\s*$|^[0-9]+$|-->' <ID>.<lang>.srt | awk '!seen[$0]++' > transcript.txt
```

字幕がそもそも存在しない動画は、ユーザーに「字幕なしのため取得不可。`whisper.cpp` 等での音声書き起こしが必要」と伝えて **停止** する。勝手に書き起こしまで自走しない。

#### 2-b. Web ページの場合

`fetch_webpage` を使う。あわせて以下のメタタグ／構造化データを拾って控える：

| 取得元 | 内容 |
|--------|------|
| `<title>` / `og:title` | タイトル |
| `<meta name="author">` / `article:author` / 構造化データ `author` | 著者 |
| `<meta property="article:published_time">` / `datePublished` | 公開日 |
| `<meta property="og:site_name">` | 媒体名 |
| `<meta name="description">` / `og:description` | 概要 |
| `<link rel="canonical">` | 正規 URL |

ログイン壁・ペイウォール・JS レンダリングで本文が取れない場合は **停止** し、ユーザーに本文の貼り付けを依頼する。

#### 2-c. ローカルファイル／PDF／貼り付けテキストの場合

`read_file`（または `pdftotext` 経由）で全文を読む。長大なら章単位で読む。メタデータは取れる範囲で（PDF なら `/Title`・`/Author`・`/CreationDate`）。

### 3. 取得確認

- 取得した本文の語数／行数を必ず確認する。極端に短い／本文以外（ナビ、フッター、エラーメッセージ）が多い場合は失敗とみなして停止する。
- ここで停止判断を誤ると、ハルシネーション要約が生成される。

### 4. 構成を設計する（図と表をどこに置くか）

要約を書き始める前に、次を必ず決める。

| 要素 | 表現手段 | 例 |
|------|----------|-----|
| 比較・分類・対応関係 | **表** | 旧 API vs 新 API、Before/After、選択肢比較 |
| プロセス・手順・フロー | **Mermaid `flowchart`** | 開発フロー、判断分岐 |
| 時系列・登場人物のやり取り | **Mermaid `sequenceDiagram`** | API 呼び出し順、人物間のやり取り |
| 状態遷移 | **Mermaid `stateDiagram-v2`** | ステータス遷移 |
| 階層・分類ツリー | **Mermaid `graph TD`** または表 | 組織図、概念ツリー |
| 数値の強調 | **生 HTML の `.stat-card`** | 「10〜100 倍」「1:8 → 1:1」など |
| 重要な引用・発表 | **`<blockquote>` / `.callout`** | 発表本文、印象的なフレーズ |
| 主要トピックの俯瞰 | **`.grid-cards`** | 章ごとの 1 行サマリ |

各セクションに最低 1 つは「視覚要素（表 or 図 or カード or 引用）」を入れる、を目安にする。

### 5. レポート本文を構成する

下記構造を基準に組み立てる（不要な節は省略可、追加は自由）。

1. **左サイドバー**：見出しを反映した目次（スクロールスパイ）
2. **ページヘッダー**：タイトル、サブタイトル、出典 URL、取得手段バッジ
3. **メタ情報カード**：著者、公開日、媒体、所要時間、タグ等（最大 8 項目）
4. **3 行サマリ（TL;DR）**
5. **章別の本文セクション**（時系列または論理順、原文の主要トピックを **省略せず** 反映、各章に表 or 図 or カードを最低 1 つ）
6. **クロージング／まとめ**
7. **フッター**：免責文（Hard Rule #7 の文言）、出典 URL、生成日

### 6. HTML を保存する

- 保存先：`reports/<kebab-case-title>.html`
- 文字コード：UTF-8、`<html lang="ja">`（要約言語が日本語の場合）
- `prefers-color-scheme` でダーク／ライト両対応
- 既存 [index.html](../../../index.html) と同じカラートークンを使う
- Mermaid は CDN から読み込み（`https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.esm.min.mjs`）。`initialize({ startOnLoad: true, theme: 'dark' or 'default' })` をダーク／ライト判定で切り替える。

下の [HTML テンプレート](#html-テンプレート) をそのまま土台にする。

### 7. 後片付け

```sh
rm -rf .tmp
```

ユーザーに「中間ファイルを削除しました」と一行で報告する。残したい意向が事前にあれば残す。

### 8. ユーザーへの最終報告

- 生成ファイルへの相対パスリンク（例: `reports/<name>.html`）
- ソース取得手段（yt-dlp / fetch_webpage / 手動貼り付け 等）
- セクション数または見出し一覧
- 含めた表／Mermaid 図の数
- 削除した一時ファイルの有無

## HTML テンプレート

このリポジトリの既存スタイル（[index.html](../../../index.html)）と一致するベース。サイドバー目次（スクロールスパイ付き）、Mermaid サポート、メタ情報カード、免責フッターを内蔵。プレースホルダ `{{...}}` を置き換えて使用する。

```html
<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="color-scheme" content="light dark" />
<title>{{タイトル}}</title>
<meta name="description" content="{{1〜2 行の概要}}" />
<style>
  :root {
    --bg: #0e1116; --bg-elev: #161b22; --border: #2a3240;
    --text: #e6edf3; --text-dim: #9aa6b2; --accent: #f97316; --link: #60a5fa;
    --sidebar-w: 260px; --content-max: 880px;
    --radius: 14px; --shadow: 0 6px 24px rgba(0,0,0,.35);
  }
  @media (prefers-color-scheme: light) {
    :root {
      --bg: #f8fafc; --bg-elev: #ffffff; --border: #e2e8f0;
      --text: #0f172a; --text-dim: #475569; --accent: #ea580c; --link: #2563eb;
      --shadow: 0 6px 24px rgba(15,23,42,.08);
    }
  }
  * { box-sizing: border-box; }
  html, body { background: var(--bg); color: var(--text); scroll-behavior: smooth; }
  body {
    margin: 0;
    font-family: "Hiragino Kaku Gothic ProN", "Yu Gothic UI", "Noto Sans JP", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    line-height: 1.85;
  }
  a { color: var(--link); text-decoration: none; }
  a:hover { text-decoration: underline; }

  /* レイアウト：左サイドバー + メイン */
  .layout { display: grid; grid-template-columns: var(--sidebar-w) 1fr; gap: 0; min-height: 100vh; }
  @media (max-width: 900px) { .layout { grid-template-columns: 1fr; } }

  /* サイドバー目次 */
  aside.sidebar {
    position: sticky; top: 0; align-self: start;
    height: 100vh; overflow-y: auto;
    border-right: 1px solid var(--border);
    background: var(--bg-elev);
    padding: 24px 18px;
  }
  aside.sidebar .toc-title {
    font-size: 12px; letter-spacing: .12em; text-transform: uppercase;
    color: var(--text-dim); margin: 0 0 10px;
  }
  aside.sidebar ol { list-style: none; padding: 0; margin: 0; }
  aside.sidebar li { margin: 2px 0; }
  aside.sidebar a {
    display: block; padding: 6px 10px;
    border-left: 2px solid transparent;
    color: var(--text-dim); font-size: 13.5px; line-height: 1.45;
    border-radius: 0 6px 6px 0;
    transition: color .15s, border-color .15s, background .15s;
  }
  aside.sidebar a:hover { color: var(--text); background: rgba(127,127,127,.06); text-decoration: none; }
  aside.sidebar a.active {
    color: var(--accent); border-left-color: var(--accent);
    background: rgba(127,127,127,.08); font-weight: 600;
  }
  aside.sidebar li.lvl-3 a { padding-left: 22px; font-size: 12.5px; }

  @media (max-width: 900px) {
    aside.sidebar { position: static; height: auto; border-right: none; border-bottom: 1px solid var(--border); }
    aside.sidebar details > summary { cursor: pointer; padding: 4px 0; }
  }

  main { max-width: var(--content-max); margin: 0 auto; padding: 48px 24px 96px; }

  header.page { border-bottom: 1px solid var(--border); padding-bottom: 24px; margin-bottom: 24px; }
  header.page .eyebrow { color: var(--accent); font-size: 13px; letter-spacing: .08em; text-transform: uppercase; font-weight: 700; }
  header.page h1 { margin: 8px 0 12px; font-size: clamp(24px, 3.4vw, 34px); line-height: 1.35; }
  header.page .lead { color: var(--text-dim); margin: 0; }

  /* メタ情報カード */
  .meta-card {
    background: var(--bg-elev); border: 1px solid var(--border);
    border-radius: var(--radius); padding: 16px 20px; margin: 20px 0 32px;
    display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 8px 24px; font-size: 14px;
  }
  .meta-card dt { color: var(--text-dim); font-size: 12px; letter-spacing: .04em; }
  .meta-card dd { margin: 0 0 6px; color: var(--text); }
  .meta-card .badges { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; }
  .badge {
    display: inline-block; padding: 2px 8px; border-radius: 999px;
    background: var(--bg); border: 1px solid var(--border);
    font-size: 12px; color: var(--text-dim);
  }

  /* TL;DR / コールアウト */
  .tldr, .callout {
    background: var(--bg-elev); border: 1px solid var(--border);
    border-radius: var(--radius); padding: 16px 22px; margin: 24px 0;
  }
  .tldr h2 { margin: 0 0 10px; font-size: 16px; color: var(--accent); letter-spacing: .04em; }
  .callout strong { color: var(--accent); }

  /* セクション */
  section { margin: 40px 0; scroll-margin-top: 24px; }
  section h2 { font-size: 22px; margin: 0 0 14px; padding-bottom: 8px; border-bottom: 2px solid var(--accent); display: inline-block; }
  section h3 { font-size: 17px; margin: 24px 0 8px; color: var(--accent); }

  ul, ol { margin: 12px 0; padding-left: 22px; }
  li { margin: 6px 0; }

  blockquote {
    border-left: 3px solid var(--accent);
    margin: 16px 0; padding: 6px 16px; color: var(--text-dim);
    background: var(--bg-elev); border-radius: 0 var(--radius) var(--radius) 0;
  }

  code { background: var(--bg-elev); border: 1px solid var(--border); padding: 1px 6px; border-radius: 6px; font-size: 0.92em; }
  pre code { display: block; padding: 12px 14px; overflow-x: auto; }

  /* 表 */
  table {
    width: 100%; border-collapse: collapse; margin: 16px 0;
    background: var(--bg-elev); border-radius: var(--radius); overflow: hidden;
  }
  th, td { padding: 10px 14px; border-bottom: 1px solid var(--border); text-align: left; vertical-align: top; font-size: 14.5px; }
  thead th { background: rgba(127,127,127,.06); color: var(--text-dim); font-size: 13px; letter-spacing: .04em; text-transform: uppercase; }
  tbody tr:last-child td { border-bottom: none; }

  /* 数値カード */
  .stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin: 18px 0; }
  .stat-card { background: var(--bg-elev); border: 1px solid var(--border); border-radius: var(--radius); padding: 14px 16px; }
  .stat-card .num { font-size: 26px; font-weight: 700; color: var(--accent); line-height: 1.2; }
  .stat-card .label { color: var(--text-dim); font-size: 12.5px; margin-top: 4px; }

  /* 章サマリーカード */
  .grid-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; margin: 18px 0; }
  .grid-cards .card { background: var(--bg-elev); border: 1px solid var(--border); border-radius: var(--radius); padding: 14px 16px; }
  .grid-cards .card h4 { margin: 0 0 6px; font-size: 14px; color: var(--accent); }
  .grid-cards .card p { margin: 0; font-size: 13.5px; color: var(--text-dim); }

  /* Mermaid */
  .mermaid {
    background: var(--bg-elev); border: 1px solid var(--border);
    border-radius: var(--radius); padding: 16px; margin: 18px 0;
    text-align: center; overflow-x: auto;
  }

  footer.page {
    margin-top: 64px; padding-top: 20px;
    border-top: 1px solid var(--border);
    color: var(--text-dim); font-size: 13px;
  }
  footer.page .disclaimer { font-size: 12.5px; opacity: .9; }
</style>
</head>
<body>
<div class="layout">

  <aside class="sidebar" aria-label="目次">
    <p class="toc-title">目次</p>
    <ol id="toc">
      <!-- JS で自動生成。フォールバックとして手動でも書いてよい -->
    </ol>
  </aside>

  <main>
    <header class="page">
      <div class="eyebrow">{{カテゴリ / 著者}}</div>
      <h1>{{タイトル}}</h1>
      <p class="lead">{{1〜2 行のサブタイトル／概要}}</p>
    </header>

    <dl class="meta-card" aria-label="出典メタデータ">
      <div><dt>出典</dt><dd><a href="{{SOURCE_URL}}" target="_blank" rel="noopener">{{SOURCE_LABEL}}</a></dd></div>
      <div><dt>著者 / 登壇者</dt><dd>{{AUTHOR}}</dd></div>
      <div><dt>公開日</dt><dd>{{PUBLISHED_DATE}}</dd></div>
      <div><dt>媒体 / チャンネル</dt><dd>{{PUBLISHER}}</dd></div>
      <div><dt>所要時間 / 文字数</dt><dd>{{DURATION_OR_LENGTH}}</dd></div>
      <div><dt>取得手段</dt><dd>{{FETCH_METHOD}}</dd></div>
      <div style="grid-column: 1 / -1;">
        <dt>タグ</dt>
        <dd class="badges">
          <span class="badge">{{TAG_1}}</span>
          <span class="badge">{{TAG_2}}</span>
        </dd>
      </div>
    </dl>

    <div class="tldr">
      <h2>3 行サマリ</h2>
      <ul>
        <li>{{要点 1}}</li>
        <li>{{要点 2}}</li>
        <li>{{要点 3}}</li>
      </ul>
    </div>

    <section id="s1">
      <h2>1. {{セクション見出し}}</h2>
      <p>{{本文}}</p>

      <!-- 表の例 -->
      <table>
        <thead><tr><th>項目</th><th>説明</th></tr></thead>
        <tbody>
          <tr><td>{{A}}</td><td>{{B}}</td></tr>
        </tbody>
      </table>

      <!-- 数値カードの例 -->
      <div class="stat-grid">
        <div class="stat-card"><div class="num">{{値}}</div><div class="label">{{ラベル}}</div></div>
      </div>
    </section>

    <section id="s2">
      <h2>2. {{プロセスを含むセクション}}</h2>

      <!-- Mermaid フローチャート -->
      <div class="mermaid">
flowchart LR
  A[アイデア] --> B[プロトタイプ作成]
  B --> C[ユーザフィードバック]
  C --> D[改善]
  D --> B
      </div>

      <!-- Mermaid シーケンス図 -->
      <div class="mermaid">
sequenceDiagram
  participant U as User
  participant A as Agent
  participant H as Context Hub
  U->>A: タスク指示
  A->>H: 最新ドキュメント要求
  H-->>A: 最新 API 仕様
  A-->>U: 正しい呼び出しコード
      </div>
    </section>

    <footer class="page">
      <p class="disclaimer">
        本レポートは、上記の出典元コンテンツを参照し、内容を省略せず日本語で要約・再構成した非公式まとめです。記述に誤りがある場合は出典元の表現が正となります。
      </p>
      <p>
        出典: <a href="{{SOURCE_URL}}" target="_blank" rel="noopener">{{SOURCE_URL}}</a> ／ 取得手段: {{FETCH_METHOD}} ／ 生成日: {{GENERATED_DATE}}
      </p>
    </footer>
  </main>
</div>

<script type="module">
  // Mermaid（ダーク/ライト連動）
  import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.esm.min.mjs';
  const prefersDark = matchMedia('(prefers-color-scheme: dark)').matches;
  mermaid.initialize({ startOnLoad: true, theme: prefersDark ? 'dark' : 'default', securityLevel: 'loose' });
</script>

<script>
  // 目次自動生成 + スクロールスパイ
  (function () {
    const toc = document.getElementById('toc');
    const sections = document.querySelectorAll('main section[id]');
    const links = new Map();

    sections.forEach((sec) => {
      const h2 = sec.querySelector('h2');
      if (!h2) return;
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = '#' + sec.id;
      a.textContent = h2.textContent.trim();
      li.appendChild(a);
      toc.appendChild(li);
      links.set(sec.id, a);

      // h3 もサブ項目として並べる
      sec.querySelectorAll('h3').forEach((h3, i) => {
        if (!h3.id) h3.id = sec.id + '-h3-' + i;
        const subLi = document.createElement('li');
        subLi.className = 'lvl-3';
        const subA = document.createElement('a');
        subA.href = '#' + h3.id;
        subA.textContent = h3.textContent.trim();
        subLi.appendChild(subA);
        toc.appendChild(subLi);
        links.set(h3.id, subA);
      });
    });

    // 監視対象は section と h3
    const targets = [
      ...document.querySelectorAll('main section[id]'),
      ...document.querySelectorAll('main h3[id]')
    ];

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const a = links.get(entry.target.id);
        if (!a) return;
        if (entry.isIntersecting) {
          links.forEach((l) => l.classList.remove('active'));
          a.classList.add('active');
        }
      });
    }, { rootMargin: '-30% 0px -65% 0px', threshold: 0 });

    targets.forEach((t) => observer.observe(t));
  })();
</script>
</body>
</html>
```

## 失敗時の対応

| 症状 | 対応 |
|------|------|
| YouTube が字幕ブロック (HTTP 429) | 別の言語を試す（原語推奨）。それでも失敗ならユーザーに通知して停止。 |
| 字幕が存在しない動画 | 停止。`whisper.cpp` 等での音声書き起こしを提案。自動では進めない。 |
| Web ページがログイン／JS 必須 | 停止。本文の貼り付けを依頼。 |
| `yt-dlp` 未インストール | `brew install yt-dlp` で導入。失敗したら `pipx install yt-dlp` を提案。 |
| 取得本文が極端に短い | 失敗とみなし停止。ハルシネーション要約を生成しない。 |
| メタデータがほぼ取れない | 取れた項目のみ表示し、取れなかった項目はカードから省く（プレースホルダ `未取得` を残さない）。 |

## Anti-patterns（やってはいけないこと）

- ソース未取得のまま「タイトルから推測」して要約を書く
- YouTube に対してサードパーティ Web サービスを優先する（`tactiq.io`、`youtubetranscript.com` 等はブロック多発）
- 取得した本文をそのまま全文転載する（要約であって複製ではない）
- 出力 HTML をリポジトリの既存 CSS と完全に違うデザインで作る
- 表も図も無く、長い段落だけが並んだレポートにする
- サイドバー目次やスクロールスパイを省略する
- 免責フッター（Hard Rule #7）を入れ忘れる
- `.tmp/` を残したまま完了報告する

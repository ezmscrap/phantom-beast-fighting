# 幻獣闘技 SPA

ふわふわ盤友会(@ff_boardgames)さまが制作されたボードゲーム「幻獣闘技」を、TypeScript + React + Vite で SPA 化した二人用オンラインボードゲームです。ファンアート的な実装であり、公式の許諾等は得られていません。作者: いずむ(@ezmscrap)

## 主な特徴

- 6×5 の戦場、サイコロ置き場、残存兵種一覧、エネルギートークンを含む UI をブラウザ内で再現。
- 先行決定から勝利判定まで 16 ステップ・11 独立手順をモーダルとハイライトで案内。
- `@react-three/fiber` + `@react-three/cannon` による 3D ダイス演出。停止後は上向きの面を解析し、兵種別移動可能数を自動算出します。
- デバッグモードではサイコロのサイズ/生成高さ/インパルスをリアルタイムに調整可能。
- 主要ルールや仕様は [docs/specification.md](docs/specification.md) に簡易メモを残しています。

## 技術アーキテクチャ

| 分類 | 内容 |
| --- | --- |
| フロントエンド | React 19 + TypeScript + Vite |
| 3D/物理 | `three` を直接利用した自前の `DiceEngine` と、`cannon-es` を用いた物理制御 (`src/lib/diceEngine/`) |
| UI レイヤー | React Hooks とコンポーネント分割（`PlayerSidebar`、`DiceRollStage` など） |
| 状態管理 | カスタム Hook (`useGameState` → `useUnitLogic` / `useMovementLogic` / `useActionPlanLogic`) |
| スタイル | シングル CSS (`src/App.css`, `src/index.css`) |
| 効果音/アイコン | Springin’ Sound Stock、Material Symbols Outlined |

## ディレクトリ構成（抜粋）

```
src/
├── App.tsx                         # SPA 本体（各カスタム Hook を統合）
├── components/
│   ├── board/                      # 盤面 UI（GameBoard / DiceTray）
│   ├── dice/
│   │   ├── DiceRollStage.tsx       # 3D ダイス演出のラッパー
│   │   ├── DiceResultsSummary.tsx  # 結果サマリ
│   │   └── types.ts                # DiceVisual 型
│   ├── debug/DiceDebugPanel.tsx    # デバッグ UI（サブグループ化済み）
│   ├── sidebar/PlayerSidebar.tsx   # プレイヤー状況・手順パネル
│   └── modals/...                  # モーダル群
├── lib/diceEngine/                 # 自前の 3D ダイス実装
│   ├── DiceEngine.ts               # 公開 API
│   ├── physics.ts                  # Three.js / cannon-es のセットアップ
│   ├── textures.ts                 # サイ面テクスチャ生成
│   ├── notation.ts                 # `Xd6` 表記のパース/生成
│   └── orientation.ts / utils.ts   # 姿勢処理・共通ユーティリティ
├── logic/actions/                  # 手順判定・ロール開始など
├── state/game/                     # useGameState を構成するロジック別 Hook
├── constants.ts / types.ts         # 定数・型定義
└── main.tsx / App.css / index.css  # エントリーポイントとスタイル
```

## セットアップ & スクリプト

```bash
npm install             # 依存関係のインストール
npm run dev             # 開発サーバ (http://localhost:5173 など)
npm run build           # 型チェック + 本番ビルド
npm run preview         # ビルド済み成果物をローカルで確認
```

GitHub Pages などサブディレクトリ配信する場合は Vite の `base` を指定します。

**例:**

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/pbf/',   // 例: https://<user>.github.io/pbf/ で配信する場合
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 2000,
  },
})
```

## デバッグモード / 表示

`src/config.ts` の `appConfig.diceDebug.enabled` を `true` にすると、以下の機能が有効になります。

- **ダイスロールデバッグ**: `DiceDebugPanel` が表示され、サイコロのサイズ/生成高さ/投擲インパルス/接触パラメータ/投擲方向などをリアルタイムに変更できます。更新は `DiceEngine` に即反映されます。
- **デバッグ情報表示**: `appConfig.gameDebug.showStatus` によって `nextActions` のデバッグ表示を制御できます。ロジック上の状態確認に便利です。
- **テストプレイ用初期化**: プレイヤー名・配置ユニットをデバッグ用にセットし、手順をアクションフェーズにスキップします。

## 既知の注意点 / リファクタリング

- `App.tsx` に状態が集中しているため、リファクタリング時は副作用 (`useEffect`) やモーダル状態の依存関係に注意。
- 仕様の抜粋は [docs/specification.md](docs/specification.md) を参照し、不明点は該当ソースを確認してください。
- TODO や改善案を [docs/todo.md](docs/todo.md) に記録しています。

## 謝辞 / クレジット

- **原作**: [ふわふわ盤友会](https://x.com/ff_boardgames) 「幻獣闘技」。
- **ダイスロール実装の参考**: MIT ライセンスの [@3d-dice/dice-box-threejs](https://github.com/3d-dice/dice-box-threejs) のアルゴリズム・表記を参考にしつつ、当リポジトリではコード/定数を新規実装しました。
- **サウンド**: [Springin’ Sound Stock](https://www.springin.org/sound-stock/)。詳細は下表参照。
- **アイコン**: Material Symbols Outlined（Swords / Auto Fix High / Chess）。

| 用途 | 音源名 (カテゴリ) | ファイル |
| --- | --- | --- |
| 剣士攻撃 | 剣ぶつかり合い3（戦闘#剣・刀） | `public/audio/sword_attack.mp3` |
| 魔術師攻撃 | 魔法詠唱2（戦闘#魔法） | `public/audio/mage_attack.mp3` |
| 策士攻撃 | 銃を構える（戦闘） | `public/audio/tactician_attack.mp3` |
| ドラゴン移動 | 地響き3短（環境音） | `public/audio/dragon_move.mp3` |
| グリフォン移動 | 強風3（生活） | `public/audio/griffin_move.mp3` |
| ユニコーン移動 | 足音3（生活） | `public/audio/unicorn_move.mp3` |
| ボタン押下 | スイッチ1（ボタン・システム） | `public/audio/button_click.mp3` |
| ラジオ選択 | 仕掛け作動2（ボタン・システム） | `public/audio/radio_select.mp3` |
| ユニット/ダイス配置 | カードを置く（生活） | `public/audio/card_place.mp3` |
| 単独ダイスロール | 大きいシングルダイス2（生活#サイコロ） | `public/audio/dice_single.mp3` |
| 複数ダイスロール | 大きいダブルダイス2（生活#サイコロ） | `public/audio/dice_multi.mp3` |
| キャンセル | キャンセル（ボタン・システム） | `public/audio/cancel.mp3` |
| サイコロ面 | Material Symbols Outlined (Swords / Auto Fix High / Chess) | `public/icons/*.svg` |

ライセンス・利用方法の詳細は [Springin’ Sound Stock ガイドライン](https://www.springin.org/sound-stock/guideline/) を参照してください。

## 貢献について

PR / Issue は歓迎します。仕様上ファンアートであることをご理解のうえ、以下を意識してください。
- 仕様の変更は [docs/specification.md](docs/specification.md) を更新した上で PR を送付。
- 大規模なリファクタリングは [docs/todo.md](docs/todo.md) に記載された注意点を確認してください。

---
© 2025 いずむ(@ezmscrap). Fan implementation of「幻獣闘技」。

## ライセンス

本リポジトリは [MIT License](./LICENSE) で配布されています。

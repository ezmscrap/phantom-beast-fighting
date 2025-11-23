# 関数仕様リファレンス

主要ロジックの機能・引数・戻り値をまとめています。型は TypeScript の定義に準じます。

## `computeLegalMoves(unit, board, wrap)`
- **役割**: 指定ユニットが現在位置から移動可能なボードセルを計算します。
- **引数**
  - `unit: Unit` – 位置と種別を含むユニット。`unit.position` が未定義の場合は移動不可です。
  - `board: Map<BoardCell, Unit>` – 盤面に配置されているユニット情報。衝突判定に使用します。
  - `wrap: boolean` – 魔術師系のように端から端へループ移動するかどうか。
- **戻り値**: `BoardCell[]` – 到達可能なセル一覧。自軍ユニットとの衝突を除外し、グリフォンの跳躍やナイト移動など兵種ごとのルールを反映します。
- **注意**: 列ラベル (A〜E) や行番号 (1〜6) は `columns`/`rows` 定数から取得しています。

## `startDiceRoll(player, action, dice)`
- **役割**: 指定プレイヤーの行動で使用するサイコロを描画用ステートにセットし、ダイス演出を開始します。
- **引数**
  - `player: PlayerId` – 行動中のプレイヤー (`'A'` or `'B'`).
  - `action: 'standard' | 'strategy' | 'comeback'` – 選択された行動種別。UI やサイコロ配置に影響します。
  - `dice: DiceType[]` – 実際に投げ込むサイコロの種類配列。現在は種類のみ渡し、出目は物理演算結果から取得します。
- **戻り値**: `void`
- **副作用**: `diceOverlay` ステートに `dice` をセットし、`movementState` の `budget` を初期化。`DiceRollerOverlay` が結果を通知すると `movementState` が更新されます。

## `handleMiniBoardClick(cell)`
- **役割**: 配置用ミニ盤面やユニット入れ替えモードでセルがクリックされた際の処理をまとめます。
- **引数**
  - `cell: BoardCell` – プレイヤーが選択したセル ID。
- **処理**: 配置対象ユニットが選択されている場合は `handlePlaceUnit` を呼び出し、入れ替えモード中であれば選択済みユニットの座標交換を行います。
- **戻り値**: `void`
- **補足**: `placementState` により配置/入れ替えを判別。UI モーダルの状態に応じて動作します。

## `DiceMesh` コンポーネント
- **役割**: 個々のサイコロメッシュを描画・物理制御します。停止時に上向き面を解析して `onResult` コールバックで返します。
- **主な props**
  - `type: DiceType` – 銀/金サイコロを判別。面の配列 (`SILVER_FACES`, `GOLD_FACES`) を切り替えます。
  - `settings: DebugDiceSettings` – サイズ・生成高さ・インパルスの強さなどを制御。
  - `onResult(faceIndex, result)` – 停止後に呼び出されるコールバック。上位で tallies 集計に使用。
- **内部変数**
  - `velocity`, `angularVelocity`: Cannon API から購読した現在の速度/角速度。
  - `resolvedRef`: 出目検出が一度だけ実行されるように制御。
  - `stillFrames`: しきい値以下で停止しているフレーム数。

## `handleDiceResolve(updatedDice, tallies)`
- **役割**: `DiceRollerOverlay` から確定した出目情報を受け取り、アプリ全体のステート (`diceOverlay`, `movementState.budget`) を更新します。
- **引数**
  - `updatedDice: DiceVisual[]` – faceIndex/result が埋められた最新ダイス情報。
  - `tallies: MovementBudget` – 兵種別移動可能数。
- **戻り値**: `void`
- **補足**: `useCallback` で memoize されており、`DiceRollerOverlay` の `onResolve` にそのまま渡されています。

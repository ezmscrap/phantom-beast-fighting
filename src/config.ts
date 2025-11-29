import type { DiceType } from './types'

type DebugDiceOption = 'silver1' | 'gold1' | 'silver2' | 'mixedSG' | 'mixedSSG'

interface DiceDebugConfig {
  enabled: boolean
  /** デバッグ用のサイコロ種類（日本語UI用に記憶） */
  preset: DebugDiceOption
  /** サイコロの一辺サイズ（メートル換算） */
  dieSize: number
  /** サイコロ生成時の高さ。高くすると空中滞在時間が伸びる */
  spawnHeight: number
  /** 投げ込み時の力。数値を大きくすると壁まで届きやすくなる */
  impulse: {
    x: number
    y: number
    z: number
    torque: number
    minHorizontal: number
  }
  /** 同時投擲時の横方向広がり量 */
  launchSpread: number
  /** アイコンではなく数値表示に切り替えるデバッグモード */
  numericMode: boolean
  /** サイコロの質量と減衰。軽くすると跳ねやすくなる */
  body: {
    mass: number
    linearDamping: number
    angularDamping: number
  }
  /** 床/壁との摩擦・反発係数。跳ね返り方を調整する */
  contact: {
    floorFriction: number
    floorRestitution: number
    wallFriction: number
    wallRestitution: number
  }
  /** 投げ込み開始位置（XZ平面）。 */
  launchOrigin: {
    x: number
    z: number
  }
  /** 投げる方向ベクトル。対角線に向けるなら大きく負のXと正のZなど */
  launchVector: {
    x: number
    z: number
  }
}

interface GameDebugConfig {
  /** ゲームステータス（nextActionsなど）をUI上に表示するデバッグモード */
  showStatus: boolean
}

export interface AppConfig {
  diceDebug: DiceDebugConfig
  gameDebug: GameDebugConfig
}

export const appConfig: AppConfig = {
  diceDebug: {
    enabled: false,
    preset: 'mixedSSG',
    dieSize: 0.5,
    spawnHeight: 6,
    impulse: {
      x: 24,
      y: 18,
      z: 24,
      torque: 40,
      minHorizontal: 600,
    },
    launchSpread: 1.1,
    numericMode: false,
    body: {
      mass: 0.35,
      linearDamping: 0.03,
      angularDamping: 0.02,
    },
    contact: {
      floorFriction: 0.08,
      floorRestitution: 0.75,
      wallFriction: 0.04,
      wallRestitution: 0.55,
    },
    launchOrigin: {
      x: 2.8,
      z: -2.8,
    },
    launchVector: {
      x: -1500,
      z: 1500,
    },
  },
  gameDebug: {
    showStatus: false,
  },
}

export const resolvePresetDice = (preset: DebugDiceOption): DiceType[] => {
  switch (preset) {
    case 'silver1':
      return ['silver']
    case 'gold1':
      return ['gold']
    case 'silver2':
      return ['silver', 'silver']
    case 'mixedSG':
      return ['silver', 'gold']
    case 'mixedSSG':
      return ['silver', 'silver', 'gold']
    default:
      return ['silver']
  }
}

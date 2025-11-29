/**
 * 銀/金ダイスの出目ラベル分布とマッピング関数。
 * 銀ダイス: 剣3 / 魔2 / 策1。
 * 金ダイス: 剣1 / 魔3 / 策2。
 */
export const SILVER_D6_LABELS = ['剣', '剣', '剣', '魔', '魔', '策'] as const
export const GOLD_D6_LABELS = ['剣', '魔', '魔', '魔', '策', '策'] as const

export type BeastLabel = (typeof SILVER_D6_LABELS)[number]

const clampValue = (value: number) => {
  if (!Number.isInteger(value) || value < 1 || value > 6) {
    throw new Error(`ダイス出目が範囲外です: ${value}`)
  }
  return value - 1
}

/** 銀ダイスの数値(1-6)を兵種ラベルに変換する */
export const mapSilverD6 = (value: number): BeastLabel => {
  const index = clampValue(value)
  return SILVER_D6_LABELS[index]
}

/** 金ダイスの数値(1-6)を兵種ラベルに変換する */
export const mapGoldD6 = (value: number): BeastLabel => {
  const index = clampValue(value)
  return GOLD_D6_LABELS[index]
}

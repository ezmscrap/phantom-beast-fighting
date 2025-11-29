import type { DiceType } from '../../types'

export interface DiceRollPlan {
  id: string
  type: DiceType
  targetValue?: number
}

interface ParsedGroup {
  type: DiceType
  count: number
}

export const parseNotation = (notation: string): { groups: ParsedGroup[]; predetermined: number[] } => {
  if (!notation) return { groups: [], predetermined: [] }
  const [groupPart, predeterminedPart] = notation.split('@')
  const groups: ParsedGroup[] = []
  groupPart
    .split('+')
    .map((value) => value.trim())
    .filter(Boolean)
    .forEach((chunk) => {
      const match = chunk.match(/^(\d+)d6(?:_(silver|gold))?$/i)
      if (!match) {
        throw new Error(`Unsupported dice notation: ${chunk}`)
      }
      const [, countText, typeText] = match
      const count = Number(countText)
      const type = (typeText?.toLowerCase() ?? 'silver') as DiceType
      groups.push({ type, count })
    })
  const predetermined = predeterminedPart
    ? predeterminedPart
        .split(',')
        .map((value) => Number(value.trim()))
        .filter((value) => Number.isFinite(value) && value > 0)
    : []
  return { groups, predetermined }
}

export const buildNotation = (plan: DiceRollPlan[]): string => {
  if (!plan.length) return ''
  const counts: Record<DiceType, number> = { silver: 0, gold: 0 }
  plan.forEach((entry) => {
    counts[entry.type] += 1
  })
  const groups = (Object.keys(counts) as DiceType[])
    .filter((type) => counts[type] > 0)
    .map((type) => `${counts[type]}d6_${type}`)
  const predetermined = plan.every((entry) => typeof entry.targetValue === 'number')
    ? plan.map((entry) => entry.targetValue).join(',')
    : ''
  return predetermined ? `${groups.join('+')}@${predetermined}` : groups.join('+')
}

export const planFromNotation = (notation: string): DiceRollPlan[] => {
  const { groups, predetermined } = parseNotation(notation)
  const plan: DiceRollPlan[] = []
  let index = 0
  groups.forEach(({ type, count }) => {
    Array.from({ length: count }).forEach(() => {
      const targetValue = predetermined[index]
      plan.push({
        id: `die-${index}`,
        type,
        targetValue: Number.isFinite(targetValue) ? targetValue : undefined,
      })
      index += 1
    })
  })
  return plan
}

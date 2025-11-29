import type { ActionType, PlayerId, ProcedureStep } from '../../types'

const actionMap: Partial<Record<ProcedureStep, ActionType>> = {
  8: 'standard',
  9: 'strategy',
  10: 'comeback',
  13: 'standard',
  14: 'strategy',
  15: 'comeback',
}

const actionLabels: Record<ActionType, string> = {
  standard: '通常アクション',
  strategy: '作戦アクション',
  comeback: '起死回生アクション',
}

export const getActionTypeForStep = (step: ProcedureStep): ActionType | null => actionMap[step] ?? null

export const getActionLabel = (action: ActionType) => actionLabels[action]

export const getStepActionInfo = (step: ProcedureStep) => {
  const type = getActionTypeForStep(step)
  return type ? { type, label: actionLabels[type] } : null
}

export const getActivePlayerForStep = (step: ProcedureStep, leadingPlayer: PlayerId): PlayerId => {
  switch (step) {
    case 2:
    case 4:
    case 6:
    case 7:
    case 8:
    case 9:
    case 10:
    case 11:
      return leadingPlayer
    case 3:
    case 5:
    case 12:
    case 13:
    case 14:
    case 15:
    case 16:
      return leadingPlayer === 'A' ? 'B' : 'A'
    default:
      return leadingPlayer
  }
}

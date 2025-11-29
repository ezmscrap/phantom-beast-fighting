import { playAudio } from '../../audio'
import type { MovementBudget } from '../../types'
import type { DiceVisual } from './types'

const DICE_LABEL: Record<DiceVisual['type'], string> = {
  silver: '銀',
  gold: '金',
}

interface DiceResultsSummaryProps {
  dice: DiceVisual[]
  tallies: MovementBudget
  numericMode: boolean
  settled: boolean
  onClose: () => void
}

export const DiceResultsSummary = ({ dice, tallies, numericMode, settled, onClose }: DiceResultsSummaryProps) => (
  <div className="dice-overlay__summary">
    {numericMode ? (
      <div className="dice-results-list">
        {dice.map((die) => (
          <p key={die.id}>
            {DICE_LABEL[die.type]}: {die.faceIndex != null ? die.faceIndex + 1 : '---'}
          </p>
        ))}
      </div>
    ) : (
      <p>剣士: {tallies.swordsman} / 魔術師: {tallies.mage} / 策士: {tallies.tactician}</p>
    )}
    {settled ? (
      <button
        className="primary"
        onClick={() => {
          playAudio('button')
          onClose()
        }}
      >
        結果を適用する
      </button>
    ) : (
      <p>ロール中...</p>
    )}
  </div>
)

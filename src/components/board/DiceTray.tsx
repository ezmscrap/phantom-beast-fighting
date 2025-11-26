import type { DiceSlotState } from '../../types'

interface DiceTrayProps {
  diceSlots: DiceSlotState[]
  onSlotClick: (slotId: DiceSlotState['id']) => void
}

export const DiceTray = ({ diceSlots, onSlotClick }: DiceTrayProps) => (
  <div className="dice-tray">
    <h3>サイコロ群置き場</h3>
    <div className="dice-slots">
      {diceSlots.map((slot) => (
        <button
          key={slot.id}
          className={`dice-slot ${slot.die ?? 'empty'}`}
          onClick={() => onSlotClick(slot.id)}
        >
          <span>{slot.id}</span>
          <strong>{slot.die ? (slot.die === 'silver' ? '銀' : '金') : '未配置'}</strong>
        </button>
      ))}
    </div>
  </div>
)

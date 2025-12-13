import { Modal } from '../Modal'
import { baseDisplayNames, classDisplayNames } from '../../constants'
import { playAudio } from '../../audio'
import type {
  MiniBoardState,
  PlacementState,
  PlayerId,
  PlayerState,
  ProcedureStep,
  Unit,
} from '../../types'

interface UnitPlacementModalProps {
  placementState: PlacementState | null
  players: Record<PlayerId, PlayerState>
  activePlacementUnits: Unit[]
  onSelectUnit: (unitId: string) => void
  onToggleSwap: (enabled: boolean) => void
  onOpenMiniBoard: (state: MiniBoardState) => void
  onClose: () => void
  creationRemaining: Record<2 | 3 | 4, number>
  onRequestCreation: (player: PlayerId, step: ProcedureStep) => void
}

export const UnitPlacementModal = ({
  placementState,
  players,
  activePlacementUnits,
  onSelectUnit,
  onToggleSwap,
  onOpenMiniBoard,
  onClose,
  creationRemaining,
  onRequestCreation,
}: UnitPlacementModalProps) => (
  <Modal title="ユニット配置" isOpen={Boolean(placementState)} onClose={onClose}>
    {placementState ? (
      <div className="unit-placement-modal">
        <p>{players[placementState.player].name}の配置前ユニットを選択</p>
        {(() => {
          const tag = placementState.stepTag
          const canCreateMore =
            tag && tag >= 2 && tag <= 4 && creationRemaining[tag as 2 | 3 | 4] > 0
          if (canCreateMore) {
            return (
              <button
                className="ghost"
                onClick={() => {
                  playAudio('button')
                  onRequestCreation(placementState.player, tag as ProcedureStep)
                }}
              >
                新しくユニットを作成する
              </button>
            )
          }
          if (activePlacementUnits.length === 0) {
            return (
              <button
                className="ghost"
                onClick={() => {
                  playAudio('button')
                  onClose()
                }}
              >
                手順を終了する
              </button>
            )
          }
          return null
        })()}
        <div className="unit-selection">
          {activePlacementUnits.length === 0 ? (
            <>
              <p>配置前のユニットはありません。</p>
              {placementState.swapMode ? (
                <>
                  <p>入れ替えたい配置済みユニットを2体選択してください。</p>
                  <button
                    onClick={() => {
                      playAudio('button')
                      onOpenMiniBoard({ mode: 'swap', player: placementState.player })
                    }}
                  >
                    ミニ配置面を開く
                  </button>
                  <button
                    className="ghost"
                    onClick={() => {
                      playAudio('button')
                      onToggleSwap(false)
                    }}
                  >
                    入れ替えを中止
                  </button>
                </>
              ) : (
                <button
                  onClick={() => {
                    playAudio('button')
                    onToggleSwap(true)
                    onOpenMiniBoard({ mode: 'swap', player: placementState.player })
                  }}
                >
                  配置済みユニットを入れ替える
                </button>
              )}
            </>
          ) : (
            activePlacementUnits.map((unit) => (
              <button
                key={unit.id}
                onClick={() => {
                  playAudio('button')
                  onSelectUnit(unit.id)
                }}
              >
                {baseDisplayNames[unit.base]}
                {classDisplayNames[unit.role]}
              </button>
            ))
          )}
        </div>
        <p>ユニットを選ぶとミニ配置面が表示され、そこから配置場所を決定できます。</p>
      </div>
    ) : null}
  </Modal>
)

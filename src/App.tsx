import { useCallback, useEffect, useMemo } from 'react'
import {
  baseDisplayNames,
  classDisplayNames,
  columns,
  rows,
  stepDescriptions,
} from './constants'
import type { BoardCell, MovementBudget, PlayerId, ProcedureStep, Unit } from './types'
import './App.css'
import { DiceRollerOverlay, type DiceVisual } from './components/DiceRollerOverlay'
import { DiceRedistributionModal } from './components/modals/DiceRedistributionModal'
import { UnitCreationModal } from './components/modals/UnitCreationModal'
import { UnitPlacementModal } from './components/modals/UnitPlacementModal'
import { MiniBoardModal } from './components/modals/MiniBoardModal'
import { ActionSelectionModal } from './components/modals/ActionSelectionModal'
import { PlayerSetupModal } from './components/modals/PlayerSetupModal'
import { useGameState, createUnitLabel } from './state/gameState'
import { useDiceState } from './state/diceState'
import { useDiceRoller } from './hooks/useDiceRoller'
import { appConfig } from './config'
import { getActivePlayerForStep, getStepActionInfo, canAdvanceStep, executeAction, startDiceRoll } from './logic/actions'

function App() {
  const {
    players,
    units,
    step,
    leadingPlayer,
    placementState,
    movementState,
    actionSelection,
    nextActions,
    pendingCreations,
    creationRequest,
    creationSelection,
    miniBoardState,
    nameStage,
    nameDrafts,
    nameLocks,
    initiativeChoice,
    victor,
    boardMap,
    remainingByClass,
    activePlacementUnits,
    currentPlacementTargets,
    activeMovementUnits,
    setPlayers,
    setUnits,
    setStep,
    setLeadingPlayer,
    setNameStage,
    setNameDrafts,
    setNameLocks,
    setInitiativeChoice,
    setCreationRequest,
    setCreationSelection,
    setPlacementState,
    setMiniBoardState,
    setMovementState,
    setActionSelection,
    setNextActions,
    handleCreateUnit,
    handleSelectUnitForMovement,
    handleMoveUnit,
    handleActionSelection,
    confirmAction,
    handleMiniBoardClick,
    cancelMiniBoard,
    handleSwapSelection,
    placementSelectionHandler,
    goToNextStep,
    resetGame,
  } = useGameState()

  const {
    diceSlots,
    dicePlacementStage,
    diceRedistribution,
    redistributionChoice,
    setRedistributionChoice,
    setDiceRedistribution,
    setDiceSlots,
    placeDie,
    gatherDiceTypes,
    completeRedistribution,
    resetDiceState,
  } = useDiceState()

  const {
    overlay: diceOverlay,
    debugSettings,
    setDebugSettings,
    launchRoll,
    closeOverlay,
    handleResolve: updateDiceOverlay,
    relaunchWithDebugSettings,
  } = useDiceRoller()

  const activeStepPlayer = getActivePlayerForStep(step, leadingPlayer)

  const pendingPlacementCount = useMemo(
    () => units.filter((unit) => unit.owner === activeStepPlayer && unit.status === 'preDeployment').length,
    [units, activeStepPlayer],
  )

  const canProceed = canAdvanceStep({
    step,
    diceRedistribution,
    placementState,
    pendingCreations,
    dicePlacementStage,
    movementState,
    nextActions,
    activeStepPlayer,
  })

  const openPlacementModal = useCallback(
    (player: PlayerId) => {
      setPlacementState({ player, swapMode: false, swapSelection: [] })
    },
    [setPlacementState],
  )

  const handleDiceSlotClick = (slotId: 'R1' | 'R2' | 'R3') => {
    if (step !== 6 || dicePlacementStage >= 3) return
    placeDie(slotId)
  }

  const handleDiceResolve = useCallback(
    (updatedDice: DiceVisual[], tallies: MovementBudget) => {
      updateDiceOverlay(updatedDice, tallies)
      setMovementState((prev) => (prev ? { ...prev, budget: { ...tallies } } : prev))
    },
    [updateDiceOverlay, setMovementState],
  )

  const confirmDiceResult = () => {
    closeOverlay()
    setMovementState((state) => {
      if (!state) return state
      const noBudget = state.budget.swordsman === 0 && state.budget.mage === 0 && state.budget.tactician === 0
      if (noBudget) {
        setNextActions((prev) => ({ ...prev, [state.player]: null }))
        return null
      }
      return { ...state, locked: false }
    })
  }

  const handleExecuteAction = (currentStep: ProcedureStep) => {
    executeAction({
      step: currentStep,
      activePlayer: activeStepPlayer,
      nextActions,
      movementState,
      diceSlots,
      gatherDiceTypes,
      onStartRoll: (player, action, dice) =>
        startDiceRoll({
          player,
          action,
          dice,
          launchRoll,
          onMovementStart: (state) => setMovementState(state),
        }),
      setDiceSlots,
      openRedistribution: setDiceRedistribution,
      setRedistributionChoice,
    })
  }

  const renderCellContent = (cell: BoardCell) => {
    const unit = boardMap.get(cell)
    if (!unit) return null
    return (
      <div className={`piece piece--${unit.owner}`}>
        <span>{baseDisplayNames[unit.base][0]}</span>
        <small>{classDisplayNames[unit.role][0]}</small>
      </div>
    )
  }

  useEffect(() => {
    if (step < 2 || step > 5) return
    const remaining = pendingCreations[step as 2 | 3 | 4 | 5]
    if (remaining === 0 && pendingPlacementCount === 0) {
      goToNextStep()
    }
  }, [step, pendingCreations, pendingPlacementCount, goToNextStep])

  const renderProcedureControls = () => {
    if (step === 1) {
      return <p>プレイヤー名と先行を決定してください。</p>
    }
    if (step >= 2 && step <= 5) {
      const remaining = pendingCreations[step as 2 | 3 | 4 | 5]
      const hasPlacementCandidates = pendingPlacementCount > 0
      return (
        <>
          <p>
            残り{remaining}回、{players[activeStepPlayer].name}がユニット作成→配置を行います。
          </p>
          {remaining > 0 ? (
            <>
              <button
                onClick={() => {
                  setCreationRequest({ player: activeStepPlayer, step })
                  setCreationSelection({})
                }}
              >
                次のユニット作成
              </button>
              <button disabled={!hasPlacementCandidates} onClick={() => openPlacementModal(activeStepPlayer)}>
                既存ユニットを配置
              </button>
            </>
          ) : hasPlacementCandidates ? (
            <button onClick={() => openPlacementModal(activeStepPlayer)}>既存ユニットを配置</button>
          ) : (
            <p>必要回数を達成しました。</p>
          )}
        </>
      )
    }
    if (step === 6) {
      return (
        <p>
          銀→銀→金の順でR1〜R3に配置します。残り:{3 - dicePlacementStage}個
        </p>
      )
    }
    if (step === 7 || step === 12) {
      const player = activeStepPlayer
      if (players[player].energy === 0) {
        return (
          <>
            <p>エネルギー0のため通常アクションになります。</p>
            {nextActions[player] !== 'standard' ? (
              <button onClick={() => setNextActions((prev) => ({ ...prev, [player]: 'standard' }))}>
                通常アクションで進む
              </button>
            ) : null}
          </>
        )
      }
      return (
        <>
          <p>次アクションをラジオボタンで決定してください。</p>
          <button onClick={() => handleActionSelection(player, nextActions[player] ?? 'standard')}>
            選択モーダルを開く
          </button>
        </>
      )
    }
    const actionInfo = getStepActionInfo(step)
    if (actionInfo) {
      const player = activeStepPlayer
      if (nextActions[player] !== actionInfo.type) {
        return <p>指定されたアクションが選択されていません。前の手順で選択をやり直してください。</p>
      }
      return (
        <>
          <p>{actionInfo.label}を実行します。</p>
          <button onClick={() => handleExecuteAction(step)}>ダイスを使用して開始</button>
        </>
      )
    }
    if (step === 11 || step === 16) {
      return <p>勝利条件を確認し、必要であれば決着手順を実行してください。</p>
    }
    return null
  }

  const handleNameDraftChange = (player: PlayerId, value: string) => {
    setNameDrafts((prev) => ({ ...prev, [player]: value }))
  }

  const handleLockName = (player: PlayerId) => {
    setNameLocks((prev) => ({ ...prev, [player]: true }))
  }

  const toggleSwapMode = (enabled: boolean) => {
    setPlacementState((prev) => (prev ? { ...prev, swapMode: enabled, swapSelection: [] } : prev))
  }

  const handleCreationConfirm = () => {
    if (!creationRequest || !creationSelection.base || !creationSelection.role) return
    handleCreateUnit(creationRequest.player, creationSelection.base, creationSelection.role, creationRequest.step)
    setCreationRequest(null)
    setCreationSelection({})
  }

  const handleResetGame = () => {
    resetGame()
    resetDiceState()
    closeOverlay()
  }

  useEffect(() => {
    if (!appConfig.diceDebug.enabled) return
    setDebugSettings({
      dieSize: appConfig.diceDebug.dieSize,
      spawnHeight: appConfig.diceDebug.spawnHeight,
      impulse: { ...appConfig.diceDebug.impulse },
    })
    setPlayers({
      A: {
        id: 'A',
        name: 'テストA',
        color: 'white',
        energy: 0,
        baseCards: { dragon: 0, griffin: 0, unicorn: 0 },
        classCards: { tactician: 0, mage: 0, swordsman: 0 },
      },
      B: {
        id: 'B',
        name: 'テストB',
        color: 'black',
        energy: 0,
        baseCards: { dragon: 0, griffin: 0, unicorn: 0 },
        classCards: { tactician: 0, mage: 0, swordsman: 0 },
      },
    })
    const debugUnits: Unit[] = [
      { id: 'dbg-A1', owner: 'A', base: 'dragon', role: 'mage', status: 'deployed', position: 'A2' },
      { id: 'dbg-A2', owner: 'A', base: 'unicorn', role: 'mage', status: 'deployed', position: 'B2' },
      { id: 'dbg-A3', owner: 'A', base: 'griffin', role: 'swordsman', status: 'deployed', position: 'C2' },
      { id: 'dbg-A4', owner: 'A', base: 'unicorn', role: 'swordsman', status: 'deployed', position: 'D2' },
      { id: 'dbg-A5', owner: 'A', base: 'griffin', role: 'tactician', status: 'deployed', position: 'E2' },
      { id: 'dbg-B1', owner: 'B', base: 'dragon', role: 'mage', status: 'deployed', position: 'A5' },
      { id: 'dbg-B2', owner: 'B', base: 'unicorn', role: 'mage', status: 'deployed', position: 'B5' },
      { id: 'dbg-B3', owner: 'B', base: 'griffin', role: 'swordsman', status: 'deployed', position: 'C5' },
      { id: 'dbg-B4', owner: 'B', base: 'unicorn', role: 'swordsman', status: 'deployed', position: 'D5' },
      { id: 'dbg-B5', owner: 'B', base: 'griffin', role: 'tactician', status: 'deployed', position: 'E5' },
    ]
    setUnits(debugUnits)
    setLeadingPlayer('A')
    setStep(8)
    relaunchWithDebugSettings()
  }, [
    setDebugSettings,
    setPlayers,
    setUnits,
    setLeadingPlayer,
    setStep,
    relaunchWithDebugSettings,
  ])

  return (
    <div className="app-shell">
      <header>
        <h1>Phantom Beast Fighting</h1>
        <p>オンライン専用二人用ボードゲーム</p>
      </header>
      <main className="board-layout">
        <section className="board-area">
          <div className="board-grid">
            {rows.map((row) => (
              <div key={row} className="board-row">
                {columns.map((column) => {
                  const cell = `${column}${row}` as BoardCell
                  const occupant = boardMap.get(cell)
                  const highlight = (movementState?.selectedUnitId && movementState.destinations.includes(cell)) || false
                  const swapSelectable = Boolean(placementState?.swapMode) && occupant && occupant.owner === placementState?.player
                  const swapSelected = swapSelectable && placementState?.swapSelection.includes(occupant?.id ?? '')
                  return (
                    <button
                      key={cell}
                      className={`board-cell ${highlight ? 'highlight' : ''} ${swapSelected ? 'swap-selected' : ''}`}
                      onClick={() => {
                        if (placementState?.swapMode) {
                          if (swapSelectable && occupant) {
                            handleSwapSelection(occupant.id)
                          }
                          return
                        }
                        if (movementState) {
                          if (movementState.selectedUnitId && movementState.destinations.includes(cell)) {
                            handleMoveUnit(cell)
                            return
                          }
                          if (
                            !movementState.selectedUnitId &&
                            occupant &&
                            occupant.owner === movementState.player &&
                            movementState.budget[occupant.role] > 0
                          ) {
                            handleSelectUnitForMovement(occupant)
                            return
                          }
                        }
                      }}
                    >
                      {renderCellContent(cell)}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
          <div className="dice-tray">
            <h3>サイコロ群置き場</h3>
            <div className="dice-slots">
              {diceSlots.map((slot) => (
                <button
                  key={slot.id}
                  className={`dice-slot ${slot.die ?? 'empty'}`}
                  onClick={() => handleDiceSlotClick(slot.id)}
                >
                  <span>{slot.id}</span>
                  <strong>{slot.die ? (slot.die === 'silver' ? '銀' : '金') : '未配置'}</strong>
                </button>
              ))}
            </div>
          </div>
        </section>
        <aside className="sidebar">
          {(['A', 'B'] as PlayerId[]).map((playerId) => (
            <section key={playerId} className="player-panel">
              <header>
                <h2>
                  {players[playerId].name} <small>{playerId === leadingPlayer ? '（先行）' : ''}</small>
                </h2>
              </header>
              <div className="energy-track">
                {[3, 2, 1].map((threshold, index) => (
                  <span key={threshold} className={`token ${players[playerId].energy >= threshold ? 'lit' : ''}`} aria-label={`T${3 - index}`} />
                ))}
                <p>エネルギー: {players[playerId].energy}</p>
              </div>
              <div className="class-counts">
                {(Object.keys(classDisplayNames) as (keyof typeof classDisplayNames)[]).map((role) => (
                  <div key={role} className="count-row">
                    <span>{classDisplayNames[role]}</span>
                    <strong>{remainingByClass[playerId]?.[role] ?? 0}</strong>
                  </div>
                ))}
              </div>
              <div className="card-counts">
                <p>ユニット作成用カード</p>
                <ul>
                  {(Object.keys(baseDisplayNames) as (keyof typeof baseDisplayNames)[]).map((base) => (
                    <li key={base}>
                      {baseDisplayNames[base]}: {players[playerId].baseCards[base]}
                    </li>
                  ))}
                </ul>
                <ul>
                  {(Object.keys(classDisplayNames) as (keyof typeof classDisplayNames)[]).map((role) => (
                    <li key={role}>
                      {classDisplayNames[role]}: {players[playerId].classCards[role]}
                    </li>
                  ))}
                </ul>
              </div>
              <button disabled={![7, 12].includes(step) || actionSelection?.player === playerId} onClick={() => handleActionSelection(playerId, 'standard')}>
                次アクション選択
              </button>
            </section>
          ))}
          <section className="procedure-panel">
            <h2>現在の手順</h2>
            <p>
              手順{step}: {stepDescriptions[step]}
            </p>
            <p>対象プレイヤー: {players[activeStepPlayer].name}</p>
            <div className="procedure-actions">{renderProcedureControls()}</div>
            <button disabled={!canProceed} onClick={goToNextStep}>
              手順完了
            </button>
          </section>
          {movementState ? (
            <section className="movement-panel">
              <h3>兵種別移動可能数</h3>
              <ul>
                <li>剣士: {movementState.budget.swordsman}</li>
                <li>魔術師: {movementState.budget.mage}</li>
                <li>策士: {movementState.budget.tactician}</li>
              </ul>
              <p>{players[movementState.player].name}の移動を完了してください。</p>
              <div className="unit-selection">
                {activeMovementUnits.map((unit) => (
                  <button key={unit.id} onClick={() => handleSelectUnitForMovement(unit)}>
                    {createUnitLabel(unit)}
                  </button>
                ))}
              </div>
            </section>
          ) : null}
        </aside>
      </main>

      <PlayerSetupModal
        isOpen={step === 1 && !victor}
        nameStage={nameStage}
        nameDrafts={nameDrafts}
        nameLocks={nameLocks}
        initiativeChoice={initiativeChoice}
        onDraftChange={handleNameDraftChange}
        onLockName={handleLockName}
        onChangeStage={setNameStage}
        onSelectInitiative={setInitiativeChoice}
        onConfirmInitiative={() => {
          setPlayers((prev) => ({
            A: { ...prev.A, name: nameDrafts.A },
            B: { ...prev.B, name: nameDrafts.B },
          }))
          setLeadingPlayer(initiativeChoice)
          setStep(2)
        }}
      />

      <ActionSelectionModal
        selection={actionSelection}
        players={players}
        onSelect={handleActionSelection}
        onConfirm={confirmAction}
        onCancel={() => setActionSelection(null)}
      />

      <UnitPlacementModal
        placementState={placementState}
        players={players}
        activePlacementUnits={activePlacementUnits}
        onSelectUnit={placementSelectionHandler}
        onToggleSwap={toggleSwapMode}
        onOpenMiniBoard={(state) => setMiniBoardState(state)}
        onClose={() => setPlacementState(null)}
      />

      <MiniBoardModal
        miniBoardState={miniBoardState}
        placementState={placementState}
        boardMap={boardMap}
        currentPlacementTargets={currentPlacementTargets}
        onCellClick={handleMiniBoardClick}
        onCancel={cancelMiniBoard}
      />

      <UnitCreationModal
        request={creationRequest}
        players={players}
        selection={creationSelection}
        onSelectBase={(base) => setCreationSelection((prev) => ({ ...prev, base }))}
        onSelectRole={(role) => setCreationSelection((prev) => ({ ...prev, role }))}
        onConfirm={handleCreationConfirm}
        onCancel={() => {
          setCreationRequest(null)
          setCreationSelection({})
        }}
      />

      <DiceRedistributionModal
        state={diceRedistribution}
        choice={redistributionChoice}
        onSelect={setRedistributionChoice}
        onConfirm={completeRedistribution}
        onCancel={() => setDiceRedistribution(null)}
      />

      {appConfig.diceDebug.enabled ? (
        <section className="debug-panel">
          <h3>ダイスデバッグ設定</h3>
          <label>
            サイコロサイズ ({debugSettings.dieSize.toFixed(2)})
            <input
              type="range"
              min="0.2"
              max="1.2"
              step="0.05"
              value={debugSettings.dieSize}
              onChange={(e) =>
                setDebugSettings((prev) => ({ ...prev, dieSize: parseFloat(e.target.value) || prev.dieSize }))
              }
            />
          </label>
          <label>
            生成高さ ({debugSettings.spawnHeight.toFixed(2)})
            <input
              type="range"
              min="3"
              max="10"
              step="0.1"
              value={debugSettings.spawnHeight}
              onChange={(e) =>
                setDebugSettings((prev) => ({
                  ...prev,
                  spawnHeight: parseFloat(e.target.value) || prev.spawnHeight,
                }))
              }
            />
          </label>
          {(['x', 'y', 'z', 'torque', 'minHorizontal'] as const).map((axis) => (
            <label key={axis}>
              インパルス {axis} ({debugSettings.impulse[axis].toFixed(2)})
              <input
                type="range"
                min={axis === 'y' ? 3 : 0}
                max={axis === 'y' ? 12 : 15}
                step="0.1"
                value={debugSettings.impulse[axis]}
                onChange={(e) => {
                  const value = parseFloat(e.target.value) || debugSettings.impulse[axis]
                  setDebugSettings((prev) => ({
                    ...prev,
                    impulse: { ...prev.impulse, [axis]: value },
                  }))
                }}
              />
            </label>
          ))}
          <button onClick={relaunchWithDebugSettings}>現在の設定で再投擲</button>
        </section>
      ) : null}

      {diceOverlay ? (
        <DiceRollerOverlay
          dice={diceOverlay.dice}
          tallies={diceOverlay.tallies}
          visible
          onClose={confirmDiceResult}
          settings={diceOverlay.debugSettings ?? debugSettings}
          onResolve={handleDiceResolve}
        />
      ) : null}

      {victor ? (
        <div className="victory-overlay">
          <div className="victory-banner">{players[victor].name}の勝利</div>
          <button onClick={handleResetGame}>再度ゲームを開始</button>
        </div>
      ) : null}
    </div>
  )
}

export default App

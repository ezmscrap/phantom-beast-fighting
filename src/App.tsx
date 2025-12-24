import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react'
import type { ActionType, BoardCell, MovementBudget, PlayerId, ProcedureStep, Unit } from './types'
import './App.css'
import type { DiceVisual } from './components/dice/types'
import { DiceRedistributionModal } from './components/modals/DiceRedistributionModal'
import { UnitCreationModal } from './components/modals/UnitCreationModal'
import { UnitPlacementModal } from './components/modals/UnitPlacementModal'
import { MiniBoardModal } from './components/modals/MiniBoardModal'
import { ActionSelectionModal } from './components/modals/ActionSelectionModal'
import { PlayerSetupModal } from './components/modals/PlayerSetupModal'
import { DiceTray } from './components/board/DiceTray'
import { GameBoard } from './components/board/GameBoard'
import { Modal } from './components/Modal'
import { PlayerSidebar } from './components/sidebar/PlayerSidebar'
import { useGameState } from './state/gameState'
import { useDiceRoller } from './hooks/useDiceRoller'
import { appConfig, resolvePresetDice } from './config'
import { getActivePlayerForStep, getStepActionInfo, canAdvanceStep, executeAction, startDiceRoll } from './logic/actions'
import { playAudio } from './audio'
import { DiceDebugPanel } from './components/debug/DiceDebugPanel'
import { MatchSetupModal } from './components/modals/MatchSetupModal'

const DiceRollerOverlay = lazy(async () => {
  const module = await import('./components/DiceRollerOverlay')
  return { default: module.DiceRollerOverlay }
})

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
    creationRemaining,
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
    swapRestrictionWarning,
    dismissSwapRestrictionWarning,
    logs,
    downloadLogs,
    handleLogUpload,
    canReplay,
    handleReplayLogs,
    uploadLogsAndReplay,
    isLogPanelCollapsed,
    toggleLogPanel,
    isLogReplaying,
    matchMode,
    onlineRole,
    userName,
    setUserName,
    peerInfo,
    localPlayerId,
    startLocalMatch,
    startSpectatorMode,
    startOnlineMatch,
    connectMatchPeer,
    confirmLeadingPlayer,
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
  } = useGameState()

  const {
    overlay: diceOverlay,
    debugSettings,
    setDebugSettings,
    launchRoll,
    closeOverlay,
    handleResolve: updateDiceOverlay,
  } = useDiceRoller()
  const [rollSessionId, setRollSessionId] = useState(() => Date.now().toString())
  const showNextActionsDebug = appConfig.gameDebug.showStatus

  const activeStepPlayer = getActivePlayerForStep(step, leadingPlayer)

  const pendingPlacementCount = useMemo(
    () => units.filter((unit) => unit.owner === activeStepPlayer && unit.status === 'preDeployment').length,
    [units, activeStepPlayer],
  )

  const tentativePlacementCount = useMemo(
    () => units.filter((unit) => unit.owner === activeStepPlayer && unit.status === 'tentative').length,
    [units, activeStepPlayer],
  )
  const interactionsLocked =
    matchMode === 'spectator' || (matchMode === 'online' && onlineRole ? onlineRole !== localPlayerId : false)

  const canProceed =
    step === 0
      ? false
      : canAdvanceStep({
          step,
          diceRedistribution,
          placementState,
          pendingCreations: creationRemaining,
          pendingPlacementCount,
          dicePlacementStage,
          movementState,
          nextActions,
          activeStepPlayer,
        })

  const openPlacementModal = useCallback(
    (player: PlayerId) => {
      if (interactionsLocked) return
      playAudio('button')
      setPlacementState({ player, swapMode: false, swapSelection: [], stepTag: step })
    },
    [setPlacementState, step, interactionsLocked],
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
    playAudio('button')
    closeOverlay()
    setMovementState((state) => {
      if (!state) return state
      const noBudget = state.budget.swordsman === 0 && state.budget.mage === 0 && state.budget.tactician === 0
      if (noBudget) {
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
          launchRoll: (types) => {
            const result = launchRoll(types)
            setRollSessionId(Date.now().toString())
            return result
          },
          onMovementStart: (state) => setMovementState(state),
        }),
      setDiceSlots,
      openRedistribution: setDiceRedistribution,
      setRedistributionChoice,
    })
  }

  const debugNextActions = useMemo(
    () => `nextActions: A=${nextActions.A ?? 'null'}, B=${nextActions.B ?? 'null'}`,
    [nextActions],
  )

  useEffect(() => {
    if (![2, 3, 4].includes(step)) return
    const remaining = creationRemaining[step as 2 | 3 | 4]
    if (remaining === 0 && pendingPlacementCount === 0 && tentativePlacementCount === 0) {
      goToNextStep()
    }
  }, [step, creationRemaining, pendingPlacementCount, tentativePlacementCount, goToNextStep])

  useEffect(() => {
    if (step !== 5) return
    goToNextStep()
  }, [step, goToNextStep])

  /**
   * 作戦手順(8,9,10,13,14,15)の開始時に、選択されたアクションと一致しなければスキップする。
   */
  useEffect(() => {
    const actionMap: Partial<Record<ProcedureStep, ActionType>> = {
      8: 'standard',
      9: 'strategy',
      10: 'comeback',
      13: 'standard',
      14: 'strategy',
      15: 'comeback',
    }
    const requiredAction = actionMap[step]
    if (!requiredAction) return
    const expectedPlayer = activeStepPlayer
    if (movementState || diceOverlay) return
    if (nextActions[expectedPlayer] !== requiredAction) {
      goToNextStep()
    }
  }, [step, nextActions, activeStepPlayer, movementState, diceOverlay, goToNextStep])

  /**
   * エネルギー決定手順(7,12)でエネルギー0の場合、自動で通常アクションにセットして進行する。
   * nextActionsに値が入っている場合は尊重し、nullならstandardをセットして先へ進む。
   */
  useEffect(() => {
    if (step !== 7 && step !== 12) return
    const player = activeStepPlayer
    if (players[player].energy > 0) return
    if (nextActions[player] === null) {
      setNextActions((prev) => ({ ...prev, [player]: 'standard' }))
    }
    goToNextStep()
  }, [step, activeStepPlayer, players, nextActions, setNextActions, goToNextStep])

  useEffect(() => {
    if (step !== 11 && step !== 16) return
    if (movementState || diceOverlay) return
    const player = activeStepPlayer
    if (victor?.player !== player) {
      goToNextStep()
    }
  }, [step, movementState, diceOverlay, activeStepPlayer, victor, goToNextStep])

  const isCreationStep = [2, 3, 4].includes(step)
  const isEnergySelectionStep = step === 7 || step === 12
  const isDicePlacementStep = step === 6

  const renderProcedureControls = () => {
    if (step === 0) {
      return <p>対戦形式決定手順を完了してください。</p>
    }
    if (step === 1) {
      return <p>プレイヤー名と先行を決定してください。</p>
    }
    if ([2, 3, 4].includes(step)) {
      const remaining = creationRemaining[step as 2 | 3 | 4]
      const hasPlacementCandidates = pendingPlacementCount > 0
      return (
        <>
          <p>
            残り{remaining}回、{players[activeStepPlayer].name}がユニット作成→配置を行います。
          </p>
          {remaining > 0 ? (
            <>
              <button
                disabled={interactionsLocked}
                onClick={() => {
                  playAudio('button')
                  setCreationRequest({ player: activeStepPlayer, step })
                  setCreationSelection({})
                }}
              >
                次のユニット作成
              </button>
              <button
                disabled={!hasPlacementCandidates || interactionsLocked}
                onClick={() => openPlacementModal(activeStepPlayer)}
              >
                既存ユニットを配置
              </button>
            </>
          ) : hasPlacementCandidates ? (
            <button disabled={interactionsLocked} onClick={() => openPlacementModal(activeStepPlayer)}>
              既存ユニットを配置
            </button>
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
              <button
                disabled={interactionsLocked}
                onClick={() => {
                  playAudio('button')
                  setNextActions((prev) => ({ ...prev, [player]: 'standard' }))
                }}
              >
                通常アクションで進む
              </button>
            ) : null}
          </>
        )
      }
      return (
        <>
          <p>次アクションをラジオボタンで決定してください。</p>
          <button
            disabled={interactionsLocked}
            onClick={() => {
              playAudio('button')
              handleActionSelection(player, nextActions[player] ?? 'standard')
            }}
          >
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
          <button
            disabled={interactionsLocked}
            onClick={() => {
              playAudio('button')
              handleExecuteAction(step)
            }}
          >
            ダイスを使用して開始
          </button>
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
    if (interactionsLocked) return
    if (!creationRequest || !creationSelection.base || !creationSelection.role) return
    handleCreateUnit(creationRequest.player, creationSelection.base, creationSelection.role, creationRequest.step)
    setCreationRequest(null)
    setCreationSelection({})
  }

  const safePlacementSelection = useCallback(
    (unitId: string) => {
      if (interactionsLocked) return
      placementSelectionHandler(unitId)
    },
    [interactionsLocked, placementSelectionHandler],
  )

  const safeSwapSelection = useCallback(
    (unitId: string) => {
      if (interactionsLocked) return
      handleSwapSelection(unitId)
    },
    [interactionsLocked, handleSwapSelection],
  )

  const safeMiniBoardClick = useCallback(
    (cell: BoardCell) => {
      if (interactionsLocked) return
      handleMiniBoardClick(cell)
    },
    [interactionsLocked, handleMiniBoardClick],
  )

  const handleOpenCreationRequest = useCallback(
    (player: PlayerId, stepTag: ProcedureStep) => {
      if (interactionsLocked) return
      if (![2, 3, 4].includes(stepTag)) return
      setCreationRequest({ player, step: stepTag })
      setCreationSelection({})
    },
    [setCreationRequest, interactionsLocked],
  )

  const handleDebugRoll = useCallback(() => {
    playAudio('button')
    const diceTypes = resolvePresetDice(appConfig.diceDebug.preset)
    startDiceRoll({
      player: leadingPlayer,
      action: 'standard',
      dice: diceTypes,
      launchRoll: (types) => {
        const result = launchRoll(types)
        setRollSessionId(Date.now().toString())
        return result
      },
      onMovementStart: (state) => setMovementState(state),
    })
  }, [leadingPlayer, launchRoll])

  const handleResetGame = () => {
    playAudio('button')
    resetGame()
    closeOverlay()
  }

  useEffect(() => {
    if (!appConfig.diceDebug.enabled) return
    setDebugSettings({
      dieSize: appConfig.diceDebug.dieSize,
      spawnHeight: appConfig.diceDebug.spawnHeight,
      impulse: { ...appConfig.diceDebug.impulse },
      launchSpread: appConfig.diceDebug.launchSpread,
      numericMode: appConfig.diceDebug.numericMode,
      body: { ...appConfig.diceDebug.body },
      contact: { ...appConfig.diceDebug.contact },
      launchOrigin: { ...appConfig.diceDebug.launchOrigin },
      launchVector: { ...appConfig.diceDebug.launchVector },
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
  }, [
    setDebugSettings,
    setPlayers,
    setUnits,
    setLeadingPlayer,
    setStep,
  ])

  return (
    <div className="app-shell">
      <header>
        <h1>Phantom Beast Fighting</h1>
        <p>オンライン専用二人用ボードゲーム</p>
      </header>
      {matchMode ? (
        <div className="connection-info">
          <span>
            対戦形式:
            {matchMode === 'local' ? '1ブラウザで対戦' : matchMode === 'online' ? '通信で対戦' : '観戦'}
          </span>
          <span>通信用ID: {peerInfo.id ?? '取得中...'}</span>
          <span>接続状況: {peerInfo.status}</span>
        </div>
      ) : null}
      <main className="board-layout">
        <section className="board-area">
          <DiceTray diceSlots={diceSlots} onSlotClick={handleDiceSlotClick} highlight={isDicePlacementStep} />
      <GameBoard
        boardMap={boardMap}
        movementState={movementState}
        placementState={placementState}
        onSwapSelection={safeSwapSelection}
        onSelectUnitForMovement={handleSelectUnitForMovement}
        onMoveUnit={handleMoveUnit}
        interactionLocked={interactionsLocked}
      />
        </section>
        <PlayerSidebar
          players={players}
          leadingPlayer={leadingPlayer}
          activePlayer={activeStepPlayer}
          step={step}
          remainingByClass={remainingByClass}
          actionSelection={actionSelection}
          onActionSelect={(player) => handleActionSelection(player, 'standard')}
          renderProcedureControls={renderProcedureControls}
          canProceed={canProceed}
          onCompleteStep={goToNextStep}
          isCreationStep={isCreationStep}
          isEnergySelectionStep={isEnergySelectionStep}
        movementState={movementState}
        activeMovementUnits={activeMovementUnits}
        onSelectUnitForMovement={handleSelectUnitForMovement}
        logs={logs}
        onDownloadLogs={downloadLogs}
        onUploadLogs={handleLogUpload}
        canReplayLogs={canReplay}
        onReplayLogs={handleReplayLogs}
        logPanelCollapsed={isLogPanelCollapsed}
        onToggleLogPanel={toggleLogPanel}
        isReplayingLogs={isLogReplaying}
      />
      </main>

      {showNextActionsDebug ? <div className="debug-next-actions">{debugNextActions}</div> : null}

      <MatchSetupModal
        isOpen={step === 0}
        userName={userName}
        activeMode={matchMode}
        peerInfo={peerInfo}
        onUserNameChange={setUserName}
        onStartLocal={startLocalMatch}
        onStartOnline={startOnlineMatch}
        onStartSpectator={startSpectatorMode}
        onConnect={connectMatchPeer}
      />

      <PlayerSetupModal
        isOpen={step === 1 && !victor && (matchMode === 'local' || (matchMode === 'online' && onlineRole === 'A'))}
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
          confirmLeadingPlayer(initiativeChoice)
          setStep(2)
        }}
        onUploadAndReplayLogs={uploadLogsAndReplay}
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
        onSelectUnit={safePlacementSelection}
        onToggleSwap={toggleSwapMode}
        onOpenMiniBoard={(state) => setMiniBoardState(state)}
        onClose={() => setPlacementState(null)}
        creationRemaining={creationRemaining}
        onRequestCreation={handleOpenCreationRequest}
        interactionLocked={interactionsLocked}
      />

      <MiniBoardModal
        miniBoardState={miniBoardState}
        placementState={placementState}
        boardMap={boardMap}
        currentPlacementTargets={currentPlacementTargets}
        onCellClick={safeMiniBoardClick}
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

      <Modal title="警告" isOpen={swapRestrictionWarning} onClose={dismissSwapRestrictionWarning}>
        <p>既に位置が確定されたユニットです。</p>
      </Modal>

      <DiceRedistributionModal
        state={diceRedistribution}
        choice={redistributionChoice}
        onSelect={setRedistributionChoice}
        onConfirm={completeRedistribution}
        onCancel={() => setDiceRedistribution(null)}
      />

      <DiceDebugPanel
        enabled={appConfig.diceDebug.enabled}
        settings={debugSettings}
        onChange={(updater) => setDebugSettings((prev) => updater(prev))}
        onDebugRoll={handleDebugRoll}
      />

      <Suspense fallback={null}>
        {diceOverlay ? (
          <DiceRollerOverlay
            dice={diceOverlay.dice}
            tallies={diceOverlay.tallies}
            visible
            onClose={confirmDiceResult}
            onResolve={handleDiceResolve}
            rollSessionId={rollSessionId}
            debugSettings={diceOverlay.debugSettings ?? debugSettings}
          />
        ) : null}
      </Suspense>

      {victor ? (
        <div className="victory-overlay">
          <div className="victory-headline">{players[victor.player].name}の勝利</div>
          <p className="victory-subtitle">
            {victor.reason === 'tactician'
              ? '敵策士を捕らえた'
              : victor.reason === 'mage'
                ? 'すべての敵魔術師を盤面から追い出した'
                : 'すべての敵剣士を無力化した'}
          </p>
          <button onClick={handleResetGame}>再度ゲームを開始</button>
          <button
            className="ghost"
            onClick={() => {
              playAudio('button')
              downloadLogs()
            }}
          >
            今回の闘技のログをダウンロード
          </button>
        </div>
      ) : null}

      {isLogReplaying ? (
        <div className="log-replay-overlay">
          <div className="log-replay-overlay__content">ログの再生中</div>
        </div>
      ) : null}
    </div>
  )
}

export default App

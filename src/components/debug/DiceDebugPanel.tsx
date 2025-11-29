import type { DebugDiceSettings } from '../../types'

export interface DiceDebugPanelProps {
  settings: DebugDiceSettings
  enabled: boolean
  onChange: (updater: (prev: DebugDiceSettings) => DebugDiceSettings) => void
  onDebugRoll: () => void
}

export const DiceDebugPanel = ({ settings, enabled, onChange, onDebugRoll }: DiceDebugPanelProps) => {
  if (!enabled) return null

  const updateSettings = (updater: (prev: DebugDiceSettings) => DebugDiceSettings) => onChange(updater)

  return (
    <section className="debug-panel">
      <h3>ダイスデバッグ設定</h3>
      <label>
        サイコロサイズ ({settings.dieSize.toFixed(2)})
        <input
          type="range"
          min="0.2"
          max="1.2"
          step="0.05"
          value={settings.dieSize}
          onChange={(e) =>
            updateSettings((prev) => ({ ...prev, dieSize: parseFloat(e.target.value) || prev.dieSize }))
          }
        />
      </label>
      <label>
        生成高さ ({settings.spawnHeight.toFixed(2)})
        <input
          type="range"
          min="3"
          max="25"
          step="0.1"
          value={settings.spawnHeight}
          onChange={(e) =>
            updateSettings((prev) => ({
              ...prev,
              spawnHeight: parseFloat(e.target.value) || prev.spawnHeight,
            }))
          }
        />
      </label>
      {(['x', 'y', 'z', 'torque', 'minHorizontal'] as const).map((axis) => (
        <label key={axis}>
          インパルス {axis} ({settings.impulse[axis].toFixed(2)})
          <input
            type="range"
            min={axis === 'y' ? 3 : 0}
            max={axis === 'y' ? 20 : 250000000000000000000000000}
            step="0.1"
            value={settings.impulse[axis]}
            onChange={(e) => {
              const value = parseFloat(e.target.value) || settings.impulse[axis]
              updateSettings((prev) => ({
                ...prev,
                impulse: { ...prev.impulse, [axis]: value },
              }))
            }}
          />
        </label>
      ))}
      <label>
        同時投擲時の広がり ({settings.launchSpread.toFixed(2)})
        <input
          type="range"
          min="0"
          max="2"
          step="0.05"
          value={settings.launchSpread}
          onChange={(e) =>
            updateSettings((prev) => ({
              ...prev,
              launchSpread: parseFloat(e.target.value) || prev.launchSpread,
            }))
          }
        />
      </label>
      <label className="debug-panel__checkbox">
        <input
          type="checkbox"
          checked={settings.numericMode}
          onChange={(e) => updateSettings((prev) => ({ ...prev, numericMode: e.target.checked }))}
        />
        出目を数字表示にし、一覧で確認する
      </label>
      <p className="debug-panel__note">質量と減衰（軽くするほど跳ね返りやすくなります）</p>
      <label>
        質量 ({settings.body.mass.toFixed(2)})
        <input
          type="range"
          min="0.2"
          max="1"
          step="0.01"
          value={settings.body.mass}
          onChange={(e) =>
            updateSettings((prev) => ({
              ...prev,
              body: { ...prev.body, mass: parseFloat(e.target.value) || prev.body.mass },
            }))
          }
        />
      </label>
      <label>
        線形減衰 ({settings.body.linearDamping.toFixed(2)})
        <input
          type="range"
          min="0"
          max="0.2"
          step="0.005"
          value={settings.body.linearDamping}
          onChange={(e) =>
            updateSettings((prev) => ({
              ...prev,
              body: {
                ...prev.body,
                linearDamping: parseFloat(e.target.value) || prev.body.linearDamping,
              },
            }))
          }
        />
      </label>
      <label>
        角減衰 ({settings.body.angularDamping.toFixed(2)})
        <input
          type="range"
          min="0"
          max="0.15"
          step="0.005"
          value={settings.body.angularDamping}
          onChange={(e) =>
            updateSettings((prev) => ({
              ...prev,
              body: {
                ...prev.body,
                angularDamping: parseFloat(e.target.value) || prev.body.angularDamping,
              },
            }))
          }
        />
      </label>
      <p className="debug-panel__note">床/壁との摩擦・反発係数</p>
      <label>
        床の摩擦 ({settings.contact.floorFriction.toFixed(2)})
        <input
          type="range"
          min="0"
          max="0.5"
          step="0.01"
          value={settings.contact.floorFriction}
          onChange={(e) =>
            updateSettings((prev) => ({
              ...prev,
              contact: {
                ...prev.contact,
                floorFriction: parseFloat(e.target.value) || prev.contact.floorFriction,
              },
            }))
          }
        />
      </label>
      <label>
        床の反発係数 ({settings.contact.floorRestitution.toFixed(2)})
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={settings.contact.floorRestitution}
          onChange={(e) =>
            updateSettings((prev) => ({
              ...prev,
              contact: {
                ...prev.contact,
                floorRestitution: parseFloat(e.target.value) || prev.contact.floorRestitution,
              },
            }))
          }
        />
      </label>
      <label>
        壁の摩擦 ({settings.contact.wallFriction.toFixed(2)})
        <input
          type="range"
          min="0"
          max="0.5"
          step="0.01"
          value={settings.contact.wallFriction}
          onChange={(e) =>
            updateSettings((prev) => ({
              ...prev,
              contact: {
                ...prev.contact,
                wallFriction: parseFloat(e.target.value) || prev.contact.wallFriction,
              },
            }))
          }
        />
      </label>
      <label>
        壁の反発係数 ({settings.contact.wallRestitution.toFixed(2)})
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={settings.contact.wallRestitution}
          onChange={(e) =>
            updateSettings((prev) => ({
              ...prev,
              contact: {
                ...prev.contact,
                wallRestitution: parseFloat(e.target.value) || prev.contact.wallRestitution,
              },
            }))
          }
        />
      </label>
      <p className="debug-panel__note">投げ込み開始位置/方向（XZ）</p>
      <label>
        開始位置 X ({settings.launchOrigin.x.toFixed(1)})
        <input
          type="number"
          step="0.5"
          min="-10"
          max="10"
          value={settings.launchOrigin.x}
          onChange={(e) =>
            updateSettings((prev) => ({
              ...prev,
              launchOrigin: { ...prev.launchOrigin, x: parseFloat(e.target.value) || prev.launchOrigin.x },
            }))
          }
        />
      </label>
      <label>
        開始位置 Z ({settings.launchOrigin.z.toFixed(1)})
        <input
          type="number"
          step="0.5"
          min="-10"
          max="10"
          value={settings.launchOrigin.z}
          onChange={(e) =>
            updateSettings((prev) => ({
              ...prev,
              launchOrigin: { ...prev.launchOrigin, z: parseFloat(e.target.value) || prev.launchOrigin.z },
            }))
          }
        />
      </label>
      <label>
        投げる方向 X ({settings.launchVector.x.toFixed(0)})
        <input
          type="number"
          step="10"
          min="-1500"
          max="0"
          value={settings.launchVector.x}
          onChange={(e) =>
            updateSettings((prev) => ({
              ...prev,
              launchVector: { ...prev.launchVector, x: parseFloat(e.target.value) || prev.launchVector.x },
            }))
          }
        />
      </label>
      <label>
        投げる方向 Z ({settings.launchVector.z.toFixed(0)})
        <input
          type="number"
          step="10"
          min="0"
          max="1500"
          value={settings.launchVector.z}
          onChange={(e) =>
            updateSettings((prev) => ({
              ...prev,
              launchVector: { ...prev.launchVector, z: parseFloat(e.target.value) || prev.launchVector.z },
            }))
          }
        />
      </label>
      <button onClick={onDebugRoll}>現在の設定で再投擲</button>
    </section>
  )
}

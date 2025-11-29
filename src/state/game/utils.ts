import type { PlayerId, Unit } from '../../types'

export const collectDeployedUnitIds = (units: Unit[], player: PlayerId) =>
  units.filter((unit) => unit.owner === player && unit.status === 'deployed').map((unit) => unit.id)

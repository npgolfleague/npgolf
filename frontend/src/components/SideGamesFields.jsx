import { SIDE_GAME_DESCRIPTIONS } from '../utils/sideGames'

// Build the editable list for a tournament form.
// defaults: league defaults [{ game_type, label, enabled, fee_9, fee_18 }]
// current:  tournament games [{ game_type, fee, collected }] or null for a new tournament
export const buildSideGameRows = (defaults, current, numberOfHoles) => {
  const nine = Number(numberOfHoles) === 9
  return defaults.map((d) => {
    const existing = current ? current.find((g) => g.game_type === d.game_type) : null
    return {
      game_type: d.game_type,
      label: d.label,
      enabled: current ? Boolean(existing) : Boolean(d.enabled),
      fee: existing ? existing.fee : (nine ? d.fee_9 : d.fee_18),
      collected: existing?.collected ?? ''
    }
  })
}

export const SideGamesFields = ({ games, onChange, showCollected = false }) => {
  if (!games || games.length === 0) return null

  const update = (gameType, field, value) => {
    onChange(games.map((g) => (g.game_type === gameType ? { ...g, [field]: value } : g)))
  }

  return (
    <div className="mt-6 border-t border-gray-200 pt-4">
      <h2 className="text-lg font-semibold text-gray-800 mb-1">Side Games</h2>
      <p className="text-sm text-gray-500 mb-3">
        Optional bets from the same scores. Players opt in on the Players screen.
      </p>
      <div className="space-y-3">
        {games.map((game) => (
          <div key={game.game_type} className="border border-gray-200 rounded p-3">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={game.enabled}
                onChange={(e) => update(game.game_type, 'enabled', e.target.checked)}
                className="w-5 h-5 mt-0.5 shrink-0 accent-blue-600"
              />
              <div>
                <span className="font-medium text-gray-800">{game.label}</span>
                <p className="text-xs text-gray-500">{SIDE_GAME_DESCRIPTIONS[game.game_type]}</p>
              </div>
            </label>
            {game.enabled && (
              <div className={`grid gap-3 mt-3 pl-8 ${showCollected ? 'grid-cols-2' : 'grid-cols-1 sm:grid-cols-2'}`}>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fee ($)</label>
                  <input
                    type="number"
                    value={game.fee}
                    onChange={(e) => update(game.game_type, 'fee', parseFloat(e.target.value) || 0)}
                    step="0.01"
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                {showCollected && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Collected ($, optional)</label>
                    <input
                      type="number"
                      value={game.collected}
                      onChange={(e) => update(game.game_type, 'collected', e.target.value)}
                      placeholder="Paid × fee"
                      step="0.01"
                      min="0"
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default SideGamesFields

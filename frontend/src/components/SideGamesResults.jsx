import { formatMoney, formatSigned, segmentLabel, segmentOrder } from '../utils/sideGames'

const teamsFrom = (results) => {
  const byTeam = new Map()
  for (const r of results.filter((row) => row.game_type === 'blind_draw')) {
    if (!byTeam.has(r.team_no)) {
      byTeam.set(r.team_no, { team_no: r.team_no, score: r.score, is_winner: r.is_winner, prize_each: r.prize_money, players: [] })
    }
    byTeam.get(r.team_no).players.push(r.name)
  }
  return [...byTeam.values()].sort((a, b) => b.score - a.score || a.team_no - b.team_no)
}

const Card = ({ title, pot, children }) => (
  <div className="bg-white rounded-lg p-4 shadow">
    <div className="flex items-baseline justify-between mb-3">
      <h3 className="text-lg font-bold text-gray-900">{title}</h3>
      {pot != null && <span className="text-sm text-gray-500">Pot {formatMoney(pot)}</span>}
    </div>
    {children}
  </div>
)

// Side-game results once the tournament is completed (results exist), or a
// note listing the games that are on before then.
export const SideGamesResults = ({ sideGames }) => {
  const games = sideGames?.games || []
  const results = sideGames?.results || []
  if (games.length === 0) return null

  const potFor = (gameType) => games.find((g) => g.game_type === gameType)?.pot ?? null

  if (results.length === 0) {
    return (
      <div className="mt-6 bg-teal-50 border border-teal-200 rounded-lg p-4">
        <h2 className="font-semibold text-teal-900 mb-1">Side Games</h2>
        <p className="text-sm text-teal-800">
          {games.map((g) => `${g.label} (${g.paid_count} in)`).join(' • ')}
        </p>
        <p className="text-sm text-teal-700 mt-1">Results are worked out when the tournament is completed.</p>
      </div>
    )
  }

  const teams = teamsFrom(results)
  const nassau = results.filter((r) => r.game_type === 'quota_nassau')
  const nassauSegments = [...new Set(nassau.map((r) => r.segment))].sort((a, b) => segmentOrder(a) - segmentOrder(b))
  const birdies = results
    .filter((r) => r.game_type === 'birdie_pot')
    .sort((a, b) => b.shares - a.shares || a.name.localeCompare(b.name))
  const hasBirdiePot = results.some((r) => r.game_type === 'birdie_pot')

  return (
    <div className="mt-6 bg-teal-50 border border-teal-200 rounded-lg p-6">
      <h2 className="text-2xl font-bold text-teal-900 mb-4">Side Games</h2>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {teams.length > 0 && (
          <Card title="Blind Draw Partners" pot={potFor('blind_draw')}>
            <ul className="divide-y divide-gray-100">
              {teams.map((team) => (
                <li key={team.team_no} className={`py-2 flex items-center justify-between gap-3 ${team.is_winner ? 'font-semibold text-teal-800' : 'text-gray-700'}`}>
                  <span className="min-w-0">
                    {team.is_winner && <span aria-hidden="true">🏆 </span>}
                    {team.players.join(' & ')}
                  </span>
                  <span className="whitespace-nowrap text-right">
                    {formatSigned(team.score)}
                    {team.prize_each > 0 && <span className="block text-xs">{formatMoney(team.prize_each)} each</span>}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {nassau.length > 0 && (
          <Card title="Quota Nassau" pot={potFor('quota_nassau')}>
            <ul className="divide-y divide-gray-100">
              {nassauSegments.map((segment) => {
                const winners = nassau.filter((r) => r.segment === segment && r.is_winner)
                return (
                  <li key={segment} className="py-2">
                    <div className="flex items-center justify-between text-sm text-gray-500">
                      <span>{segmentLabel(segment)}</span>
                      {winners[0] && <span>{formatSigned(winners[0].score)}</span>}
                    </div>
                    <div className="flex items-center justify-between gap-3 font-semibold text-teal-800">
                      <span className="min-w-0">{winners.map((w) => w.name).join(', ')}</span>
                      {winners[0]?.prize_money > 0 && (
                        <span className="whitespace-nowrap">{formatMoney(winners[0].prize_money)}{winners.length > 1 ? ' each' : ''}</span>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          </Card>
        )}

        {hasBirdiePot && (
          <Card title="Birdie Pot" pot={potFor('birdie_pot')}>
            {birdies.every((r) => !r.shares) ? (
              <p className="text-sm text-gray-600">No birdies this round.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {birdies.filter((r) => r.shares > 0).map((r) => (
                  <li key={r.player_id} className="py-2 flex items-center justify-between gap-3">
                    <span className="min-w-0 text-gray-800">{r.name}</span>
                    <span className="whitespace-nowrap text-sm text-gray-500">{r.shares} {r.shares === 1 ? 'share' : 'shares'}</span>
                    <span className="whitespace-nowrap font-semibold text-teal-800">{formatMoney(r.prize_money)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
      </div>
    </div>
  )
}

export default SideGamesResults

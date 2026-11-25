import { useCallback, useContext, useEffect, useRef, useState } from 'react'
import { nassauAPI } from '../api'
import { AuthContext } from '../context/AuthContext'
import { betLabel, betStatus, dollars, strokesNote } from '../utils/matchPlay'

const REFRESH_MS = 30000
const initials = (name) => String(name || '').trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()

const HoleStrip = ({ match }) => {
  const short = match.names.map(initials)
  const labels = short[0] === short[1] ? match.names.map(n => String(n).slice(0, 4)) : short
  return (
    <div className="mt-2">
      {[match.holes.slice(0, 9), match.holes.slice(9)].map((nine, i) => (
        <table key={i} className="w-full table-fixed border-collapse text-center text-xs mb-2">
          <caption className="sr-only">{i === 0 ? 'Front 9' : 'Back 9'}, hole by hole</caption>
          <tbody>
            <tr className="text-gray-500">
              <th scope="row" className="w-11 text-left font-normal">Hole</th>
              {nine.map(h => <th scope="col" key={h.hole} className="font-normal">{h.hole}</th>)}
            </tr>
            {match.mine && [0, 1].map(side => (
              <tr key={side} className="text-gray-700">
                <th scope="row" className="text-left font-normal">{labels[side]}</th>
                {nine.map(h => (
                  <td key={h.hole}>
                    {h.scores ? h.scores[side] : '·'}
                    {h.strokes[side] > 0 && <span className="text-fairway-800">{'*'.repeat(h.strokes[side])}</span>}
                  </td>
                ))}
              </tr>
            ))}
            <tr className="font-semibold">
              <th scope="row" className="text-left font-normal text-gray-500">Won</th>
              {nine.map(h => (
                <td key={h.hole} className={h.result === 1 ? 'bg-fairway-100 text-fairway-800' : h.result === -1 ? 'bg-amber-100 text-amber-900' : 'text-gray-400'}>
                  {h.result === null ? '' : h.result === 0 ? '–' : labels[h.result === 1 ? 0 : 1]}
                </td>
              ))}
            </tr>
            <tr className="text-gray-700">
              <th scope="row" className="text-left font-normal text-gray-500">Up</th>
              {nine.map(h => (
                <td key={h.hole} className={h.running > 0 ? 'bg-fairway-100 text-fairway-800' : h.running < 0 ? 'bg-amber-100 text-amber-900' : ''}>
                  {h.running === null ? '' : h.running === 0 ? 'AS' : Math.abs(h.running)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      ))}
      <p className="text-xs text-gray-600">
        “Up” is holes ahead over the whole round ({labels[0]} green, {labels[1]} amber; AS is all square).
        {match.mine && match.strokes.count > 0 ? ' * is a stroke received.' : ''}
      </p>
    </div>
  )
}

const Terms = ({ match }) => {
  const parts = []
  if (match.amounts) parts.push(`${dollars(match.amounts.front)} front, ${dollars(match.amounts.back)} back, ${dollars(match.amounts.overall)} overall`)
  if (match.use_handicaps) {
    const who = match.strokes.receiver
    parts.push(who === null ? 'handicaps equal, no strokes' : `${match.names[who]} gets ${match.strokes.count} stroke${match.strokes.count === 1 ? '' : 's'}`)
    if (match.handicaps) parts.push(`handicaps: ${match.names[0]} ${match.handicaps[0]}, ${match.names[1]} ${match.handicaps[1]}`)
  }
  if (match.auto_press) parts.push('automatic presses')
  if (match.carry_halved) parts.push('halved matches carry over')
  if (parts.length === 0) return null
  return <p className="text-xs text-gray-600 mt-1">{parts.join(' · ')}</p>
}

const NetLine = ({ match }) => {
  if (!match.mine) return null
  const w = match.net >= 0 ? 0 : 1
  return (
    <div className="flex justify-between gap-3 border-t border-gray-200 pt-1 text-sm font-semibold">
      <span className="text-gray-700">{match.decided ? 'Final' : 'So far'}</span>
      <span className="text-right text-gray-900">
        {match.net === 0 ? 'Even' : `${match.names[1 - w]} owes ${match.names[w]} ${dollars(match.net)}`}
      </span>
    </div>
  )
}

const MatchCard = ({ match, userId, canAdmin, busy, onAnswer, onRemove }) => {
  const [confirming, setConfirming] = useState(false)
  const challenged = match.status === 'pending' && match.player_b === userId
  const canRemove = canAdmin || (match.mine && !challenged && (match.status !== 'accepted' || !match.started))
  const note = {
    pending: challenged ? `${match.names[0]} has challenged you. Answer before either of you has a score.` : `Waiting for ${match.names[1]} to accept.`,
    declined: `${match.names[1]} declined this match.`,
    expired: 'Not accepted before play started, so this match is off.'
  }[match.status]

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
      <div className="text-sm font-semibold text-gray-900">{match.names[0]} vs {match.names[1]}</div>
      <Terms match={match} />
      {note && <p className="text-sm text-gray-700 mt-1">{note}</p>}
      {challenged && (
        <div className="mt-2 flex gap-2">
          <button type="button" disabled={busy} onClick={() => onAnswer(match.id, 'accept')} className="flex-1 min-h-[44px] rounded-lg bg-green-600 font-semibold text-white disabled:opacity-50">Accept</button>
          <button type="button" disabled={busy} onClick={() => onAnswer(match.id, 'decline')} className="flex-1 min-h-[44px] rounded-lg border-2 border-red-300 font-semibold text-red-700 disabled:opacity-50">Decline</button>
        </div>
      )}
      {match.status === 'accepted' && (
        <div className="mt-2">
          {match.bets.map(bet => (
            <div key={`${bet.key}-${bet.press}`} className={`flex justify-between gap-3 border-t border-gray-200 py-1 text-sm ${bet.press ? 'pl-3' : ''}`}>
              <span className="text-gray-600">
                {betLabel(bet)}
                {bet.amount !== undefined && <span className="ml-1 text-xs text-gray-500">{dollars(bet.amount)}</span>}
              </span>
              <span className={`text-right whitespace-nowrap ${bet.winner !== null ? 'font-semibold text-emerald-700' : 'text-gray-800'}`}>{betStatus(bet, match.names)}</span>
            </div>
          ))}
          <NetLine match={match} />
          <details className="mt-1 text-sm">
            <summary className="cursor-pointer py-2 font-semibold text-fairway-800">Hole by hole</summary>
            <HoleStrip match={match} />
          </details>
        </div>
      )}
      {canRemove && (confirming ? (
        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
          <span>Remove this match?</span>
          <button type="button" disabled={busy} onClick={() => onRemove(match.id)} className="min-h-[44px] px-3 font-semibold text-red-700">Remove</button>
          <button type="button" onClick={() => setConfirming(false)} className="min-h-[44px] px-3 font-semibold text-gray-700">Keep</button>
        </div>
      ) : (
        <button type="button" onClick={() => setConfirming(true)} className="min-h-[44px] text-sm font-semibold text-red-600" aria-label={`Remove the match between ${match.names[0]} and ${match.names[1]}`}>
          Remove{canAdmin && !(match.mine && !match.started) ? ' (admin)' : ''}
        </button>
      ))}
    </div>
  )
}

// The signed-in player's totals, when they have more than one match.
const SettleUp = ({ matches, userId }) => {
  const rows = matches.filter(m => m.mine && m.status === 'accepted').map(m => {
    const side = m.player_a === userId ? 0 : 1
    return { id: m.id, name: m.names[1 - side], net: side === 0 ? m.net : -m.net }
  })
  if (rows.length < 2) return null
  const total = Math.round(rows.reduce((sum, r) => sum + r.net, 0) * 100) / 100
  const text = (n) => (n === 0 ? 'Even' : n > 0 ? `You win ${dollars(n)}` : `You owe ${dollars(n)}`)
  return (
    <div className="rounded-lg border border-fairway-600 bg-white px-3 py-2 mb-3">
      <h3 className="text-sm font-semibold text-fairway-800">Your matches so far</h3>
      {rows.map(r => (
        <div key={r.id} className="flex justify-between gap-3 py-1 text-sm"><span>{r.name}</span><span>{text(r.net)}</span></div>
      ))}
      <div className="flex justify-between gap-3 border-t pt-1 text-sm font-semibold"><span>Total</span><span>{text(total)}</span></div>
    </div>
  )
}

const BLANK = { opponent_id: '', amount_front: '5', amount_back: '5', amount_overall: '5', use_handicaps: false, handicap_a: '', handicap_b: '', auto_press: false, carry_halved: false }

const ProposeForm = ({ opponents, busy, onPropose }) => {
  const [form, setForm] = useState(BLANK)
  const set = (name, value) => setForm(prev => ({ ...prev, [name]: value }))
  const opponent = opponents.find(p => String(p.id) === form.opponent_id)
  const input = 'w-full min-h-[44px] rounded-lg border border-fairway-600/30 bg-white px-3 py-2 text-sm'
  const label = 'block text-xs font-semibold text-fairway-800 mb-1'

  const submit = async () => {
    const ok = await onPropose({ ...form, opponent_id: Number(form.opponent_id) })
    if (ok) setForm(BLANK)
  }

  return (
    <div className="mt-2 space-y-3">
      <div>
        <label htmlFor="nassau-opponent" className={label}>Opponent</label>
        <select id="nassau-opponent" className={input} value={opponent ? form.opponent_id : ''} onChange={(e) => set('opponent_id', e.target.value)}>
          <option value="">Choose anyone in this round…</option>
          {opponents.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[['amount_front', 'Front 9 ($)'], ['amount_back', 'Back 9 ($)'], ['amount_overall', 'Overall ($)']].map(([name, text]) => (
          <div key={name}>
            <label htmlFor={`nassau-${name}`} className={label}>{text}</label>
            <input id={`nassau-${name}`} type="number" min="0" step="0.01" className={input} value={form[name]} onChange={(e) => set(name, e.target.value)} />
          </div>
        ))}
      </div>
      {[
        ['use_handicaps', 'Use handicaps'],
        ['auto_press', 'Automatic presses (2 down starts a new bet on the rest of that nine, for the same amount)'],
        ['carry_halved', 'Carry over halved matches (front to back, back to overall)']
      ].map(([name, text]) => (
        <div key={name}>
          <label className="flex items-start gap-2 text-sm text-gray-800">
            <input type="checkbox" className="mt-0.5 h-4 w-4" checked={form[name]} onChange={(e) => set(name, e.target.checked)} />
            {text}
          </label>
          {name === 'use_handicaps' && form.use_handicaps && (
            <div className="mt-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="nassau-hcp-a" className={label}>Your handicap</label>
                  <input id="nassau-hcp-a" type="number" step="1" min="-10" max="54" className={input} value={form.handicap_a} onChange={(e) => set('handicap_a', e.target.value)} />
                </div>
                <div>
                  <label htmlFor="nassau-hcp-b" className={label}>{opponent?.name || 'Opponent'}’s handicap</label>
                  <input id="nassau-hcp-b" type="number" step="1" min="-10" max="54" className={input} value={form.handicap_b} onChange={(e) => set('handicap_b', e.target.value)} />
                </div>
              </div>
              <p className="text-xs text-gray-600 mt-1">{strokesNote(form.handicap_a, form.handicap_b, opponent?.name || 'Your opponent')}</p>
            </div>
          )}
        </div>
      ))}
      <button type="button" disabled={busy || !opponent} onClick={submit} className="w-full min-h-[44px] rounded-lg bg-fairway-600 px-4 text-sm font-semibold text-white disabled:opacity-50">
        Send challenge
      </button>
    </div>
  )
}

// Individual Nassau match play for one 18-hole round.
//   mode 'entry' (Score Entry): propose, accept and follow your own matches
//   mode 'board' (Leaderboard): everyone's accepted matches
// refreshKey: change it to reload, e.g. after saving a hole.
export const NassauMatches = ({ tournament, players = [], mode, refreshKey }) => {
  const { user } = useContext(AuthContext)
  const userId = Number(user?.id)
  const tournamentId = tournament?.id
  const eligible = Number(tournament?.number_of_holes) === 18
  const [data, setData] = useState({ matches: [], can_admin: false })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  // Only the newest request may update the list
  const requestRef = useRef(0)

  const load = useCallback(async () => {
    const request = ++requestRef.current
    try {
      const res = await nassauAPI.list(tournamentId)
      if (request === requestRef.current) setData(res.data)
    } catch (err) {
      console.error('Failed to load Nassau matches:', err)
    }
  }, [tournamentId])

  useEffect(() => {
    setData({ matches: [], can_admin: false })
    setError('')
    setShowForm(false)
    if (!eligible) return
    const timer = setInterval(() => { if (!document.hidden) load() }, REFRESH_MS)
    return () => { clearInterval(timer); requestRef.current += 1 }
  }, [load, eligible])

  useEffect(() => { if (eligible) load() }, [load, eligible, refreshKey])

  if (!eligible) return null

  const run = async (call) => {
    const request = ++requestRef.current
    setBusy(true)
    setError('')
    try {
      const res = await call()
      if (request === requestRef.current) setData(res.data)
      return true
    } catch (err) {
      setError(err.response?.data?.error || 'Could not save. Check your connection and try again.')
      load()
      return false
    } finally {
      setBusy(false)
    }
  }

  const shown = mode === 'entry' ? data.matches.filter(m => m.mine) : data.matches
  const cards = shown.map(m => (
    <MatchCard
      key={m.id}
      match={m}
      userId={userId}
      canAdmin={data.can_admin}
      busy={busy}
      onAnswer={(id, action) => run(() => nassauAPI.answer(tournamentId, id, action))}
      onRemove={(id) => run(() => nassauAPI.remove(tournamentId, id))}
    />
  ))
  const problem = error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>

  if (mode === 'board') {
    if (cards.length === 0) return null
    return (
      <section className="mt-6 bg-fairway-50 border border-fairway-600/30 rounded-lg p-4 sm:p-6">
        <h2 className="text-2xl font-bold text-fairway-800 mb-1">Nassau Matches</h2>
        <p className="text-sm text-fairway-800 mb-3">A hole counts once both players have finished it. Dollar amounts show only on your own matches.</p>
        {problem}
        <SettleUp matches={data.matches} userId={userId} />
        <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-2">{cards}</div>
      </section>
    )
  }

  const inRound = players.some(p => Number(p.id) === userId)
  const taken = new Set(shown.filter(m => m.status !== 'declined').map(m => (m.player_a === userId ? m.player_b : m.player_a)))
  const opponents = players
    .filter(p => Number(p.id) !== userId && !taken.has(Number(p.id)) && p.attending_status !== 'no')
    .sort((a, b) => String(a.name).localeCompare(String(b.name)))

  return (
    <section className="bg-white rounded-lg shadow p-4 mb-4 border border-fairway-600/30">
      <h2 className="text-sm font-semibold text-fairway-800">Individual Nassau Match Play</h2>
      <p className="text-xs text-gray-600 mt-1">
        Two players, three matches: front 9, back 9 and the whole round. Your opponent can be in any foursome and must accept before either of you has a score.
      </p>
      {cards.length > 0 && <div className="mt-3 space-y-3">{cards}</div>}
      {inRound ? (
        <details className="mt-2" open={showForm} onToggle={(e) => setShowForm(e.currentTarget.open)}>
          <summary className="cursor-pointer py-2 text-sm font-semibold text-fairway-800">Challenge a player</summary>
          <ProposeForm
            key={tournamentId}
            opponents={opponents}
            busy={busy}
            onPropose={async (match) => {
              const ok = await run(() => nassauAPI.propose(tournamentId, match))
              if (ok) setShowForm(false)
              return ok
            }}
          />
        </details>
      ) : (
        <p className="text-xs text-gray-600 mt-2">You aren’t playing in this round, so you can’t set up a match.</p>
      )}
      {problem}
    </section>
  )
}

export default NassauMatches

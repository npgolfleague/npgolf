import { useCallback, useContext, useEffect, useState } from 'react'
import { AuthContext } from '../context/AuthContext'
import { ToastContext } from '../context/ToastContext'
import { leaguesAPI } from '../api'
import { isAdminCapable } from '../utils/roles'
import { formatDateOnly } from '../utils/date'

const money = (n) => `$${(Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const apiError = (err, fallback) => err?.response?.data?.error || fallback

const StatusBadge = ({ status, isCurrent }) => {
  if (isCurrent && status !== 'closed') {
    return <span className="rounded-full bg-fairway-100 px-2 py-0.5 text-xs font-semibold text-fairway-800">Current</span>
  }
  if (status === 'closed') {
    return <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-700">Archived</span>
  }
  return <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">Open</span>
}

// Start New Season: shows the pre-checks, the carry-over options, then runs the rollover.
const RolloverPanel = ({ leagueId, onDone, onCancel }) => {
  const { addToast } = useContext(ToastContext)
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [form, setForm] = useState({
    new_season_year: '',
    quota_mode: 'keep',
    quota_18: '',
    quota_9: '',
    carry_pots: false,
    move_unplayed: true
  })

  useEffect(() => {
    let cancelled = false
    leaguesAPI.getRolloverPreview(leagueId)
      .then((res) => {
        if (cancelled) return
        setPreview(res.data)
        setForm((f) => ({ ...f, new_season_year: String(res.data.next_season_year) }))
      })
      .catch((err) => addToast(apiError(err, 'Failed to check the season'), 'error'))
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [leagueId, addToast])

  const set = (key) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm((f) => ({ ...f, [key]: value }))
  }

  const oldYear = preview?.season?.season_year
  const confirmWord = String(oldYear || '')
  const canSubmit = preview?.can_rollover && confirmText.trim() === confirmWord && !submitting

  const submit = async (e) => {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    try {
      const payload = {
        new_season_year: Number(form.new_season_year),
        quota_mode: form.quota_mode,
        carry_pots: form.carry_pots,
        move_unplayed: form.move_unplayed
      }
      if (form.quota_mode === 'set') {
        payload.quota_18 = form.quota_18 === '' ? null : Number(form.quota_18)
        payload.quota_9 = form.quota_9 === '' ? null : Number(form.quota_9)
      }
      const res = await leaguesAPI.rolloverSeason(leagueId, payload)
      addToast(`${res.data.closed_season_year} archived. The ${res.data.new_season_year} season has started.`, 'success')
      onDone(res.data)
    } catch (err) {
      addToast(apiError(err, 'Failed to start the new season'), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div className="rounded-lg border border-slate-200 bg-white p-6">Checking the season…</div>
  if (!preview) return null

  return (
    <form onSubmit={submit} className="space-y-5 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Start a new season</h2>
        <p className="mt-1 text-sm text-slate-600">
          This archives the {oldYear} standings exactly as they are now and starts the new season with every
          player at 0 points and $0. No tournament results are deleted.
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div className="rounded bg-slate-50 p-3"><dt className="text-slate-500">Season</dt><dd className="text-lg font-semibold">{oldYear}</dd></div>
        <div className="rounded bg-slate-50 p-3"><dt className="text-slate-500">Tournaments</dt><dd className="text-lg font-semibold">{preview.completed_count} / {preview.tournament_count} done</dd></div>
        <div className="rounded bg-slate-50 p-3"><dt className="text-slate-500">Players</dt><dd className="text-lg font-semibold">{preview.member_count}</dd></div>
        <div className="rounded bg-slate-50 p-3"><dt className="text-slate-500">Champion</dt><dd className="text-lg font-semibold">{preview.season.champion_name || '—'}</dd></div>
      </dl>

      {preview.blockers.length > 0 && (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
          <p className="font-semibold">Fix these before starting a new season:</p>
          <ul className="mt-1 list-disc pl-5">{preview.blockers.map((b) => <li key={b}>{b}</li>)}</ul>
          {preview.in_progress.length > 0 && (
            <ul className="mt-2 pl-5 text-red-700">
              {preview.in_progress.map((t) => <li key={t.id}>{formatDateOnly(t.date)} — {t.course_name}</li>)}
            </ul>
          )}
        </div>
      )}

      {preview.warnings.length > 0 && (
        <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <ul className="list-disc pl-5">{preview.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
        </div>
      )}

      <fieldset className="space-y-3" disabled={!preview.can_rollover}>
        <label className="block text-sm">
          <span className="font-medium text-slate-700">New season year</span>
          <input type="number" min={Number(oldYear) + 1} max="2100" value={form.new_season_year} onChange={set('new_season_year')}
            className="mt-1 block w-32 rounded border border-slate-300 px-2 py-1" required />
        </label>

        <div className="text-sm">
          <span className="font-medium text-slate-700">Quotas</span>
          <label className="mt-1 flex items-start gap-2">
            <input type="radio" name="quota_mode" value="keep" checked={form.quota_mode === 'keep'} onChange={set('quota_mode')} className="mt-1" />
            <span>Carry over each player's current quota and quota history (recommended)</span>
          </label>
          <label className="mt-1 flex items-start gap-2">
            <input type="radio" name="quota_mode" value="set" checked={form.quota_mode === 'set'} onChange={set('quota_mode')} className="mt-1" />
            <span>Reset everyone to a starting quota. This clears the rolling quota history for this league; quotas rebuild from the new season's rounds. End-of-season quotas are saved in the archive.</span>
          </label>
          {form.quota_mode === 'set' && (
            <div className="mt-2 flex gap-4 pl-6">
              <label>18-hole <input type="number" min="0" max="99" value={form.quota_18} onChange={set('quota_18')} className="ml-1 w-20 rounded border border-slate-300 px-2 py-1" /></label>
              <label>9-hole <input type="number" min="0" max="99" value={form.quota_9} onChange={set('quota_9')} className="ml-1 w-20 rounded border border-slate-300 px-2 py-1" /></label>
            </div>
          )}
        </div>

        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={form.carry_pots} onChange={set('carry_pots')} className="mt-1" />
          <span>Carry the championship and losers-bracket pots ({money(preview.season.championship_pot)} / {money(preview.season.losers_bracket_pot)}) into the new season. Otherwise they start at $0.</span>
        </label>

        {preview.unplayed.length > 0 && (
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={form.move_unplayed} onChange={set('move_unplayed')} className="mt-1" />
            <span>Move the {preview.unplayed.length} tournament(s) with no scores into the new season</span>
          </label>
        )}

        <p className="text-sm text-slate-600">The player roster, fees and league settings stay as they are.</p>

        <label className="block text-sm">
          <span className="font-medium text-slate-700">Type <strong>{confirmWord}</strong> to confirm</span>
          <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)}
            className="mt-1 block w-32 rounded border border-slate-300 px-2 py-1" autoComplete="off" />
        </label>
      </fieldset>

      <div className="flex gap-3">
        <button type="submit" disabled={!canSubmit}
          className="rounded bg-fairway-600 px-4 py-2 font-semibold text-white hover:bg-fairway-700 disabled:cursor-not-allowed disabled:opacity-50">
          {submitting ? 'Starting…' : `Archive ${oldYear} and start ${form.new_season_year || 'new season'}`}
        </button>
        <button type="button" onClick={onCancel} className="rounded border border-slate-300 px-4 py-2 text-slate-700 hover:bg-slate-50">Cancel</button>
      </div>
    </form>
  )
}

export const Seasons = () => {
  const { user } = useContext(AuthContext)
  const { addToast } = useContext(ToastContext)
  const admin = isAdminCapable(user)
  const [leagueId, setLeagueId] = useState(null)
  const [seasons, setSeasons] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showRollover, setShowRollover] = useState(false)
  const [busy, setBusy] = useState(false)

  const loadSeasons = useCallback(async (selectId) => {
    const current = await leaguesAPI.current()
    const id = current.data.id
    setLeagueId(id)
    const res = await leaguesAPI.getSeasons(id)
    setSeasons(res.data)
    const pick = selectId || res.data.find((s) => s.is_current)?.id || res.data[0]?.id || null
    setSelectedId(pick)
  }, [])

  useEffect(() => {
    loadSeasons()
      .catch((err) => addToast(apiError(err, 'Failed to load seasons'), 'error'))
      .finally(() => setLoading(false))
  }, [loadSeasons, addToast])

  useEffect(() => {
    if (!leagueId || !selectedId) { setDetail(null); return }
    let cancelled = false
    leaguesAPI.getSeason(leagueId, selectedId)
      .then((res) => { if (!cancelled) setDetail(res.data) })
      .catch((err) => addToast(apiError(err, 'Failed to load season'), 'error'))
    return () => { cancelled = true }
  }, [leagueId, selectedId, addToast])

  const downloadCsv = async () => {
    try {
      const res = await leaguesAPI.downloadSeasonCsv(leagueId, selectedId)
      const url = URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `season-${detail.season.season_year}-standings.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      addToast('Failed to download standings', 'error')
    }
  }

  const toggleClosed = async () => {
    const s = detail.season
    const reopen = s.status === 'closed'
    const msg = reopen
      ? `Reopen ${s.season_year}? Its tournaments become editable again. The archived standings are kept until you close it again.`
      : `Close ${s.season_year} again? Its standings will be re-archived from the current results.`
    if (!window.confirm(msg)) return
    setBusy(true)
    try {
      if (reopen) await leaguesAPI.reopenSeason(leagueId, s.id)
      else await leaguesAPI.closeSeason(leagueId, s.id)
      addToast(reopen ? `${s.season_year} reopened` : `${s.season_year} closed and archived`, 'success')
      await loadSeasons(s.id)
      const res = await leaguesAPI.getSeason(leagueId, s.id)
      setDetail(res.data)
    } catch (err) {
      addToast(apiError(err, 'Failed to update season'), 'error')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <div className="p-8">Loading seasons…</div>

  const season = detail?.season
  const showPlayoffCols = detail?.standings?.some((r) => r.playoff_points !== 0)

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Seasons</h1>
          <p className="text-slate-600">Final standings for past seasons, and the season in progress.</p>
        </div>
        {admin && !showRollover && (
          <button onClick={() => setShowRollover(true)} className="rounded bg-fairway-600 px-4 py-2 font-semibold text-white hover:bg-fairway-700">
            Start New Season
          </button>
        )}
      </div>

      {showRollover && leagueId && (
        <RolloverPanel
          leagueId={leagueId}
          onCancel={() => setShowRollover(false)}
          onDone={async (result) => {
            setShowRollover(false)
            await loadSeasons(result.new_season_id)
          }}
        />
      )}

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Seasons">
        {seasons.map((s) => (
          <button key={s.id} role="tab" aria-selected={s.id === selectedId} onClick={() => setSelectedId(s.id)}
            className={`flex items-center gap-2 rounded-lg border px-4 py-2 ${s.id === selectedId ? 'border-fairway-600 bg-fairway-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
            <span className="font-semibold">{s.season_year}</span>
            <StatusBadge status={s.status} isCurrent={s.is_current} />
          </button>
        ))}
      </div>

      {season && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4 rounded-lg border border-slate-200 bg-white p-5">
            <div className="space-y-1">
              <h2 className="text-2xl font-bold">{season.season_year} Season</h2>
              <p className="text-sm text-slate-600">
                {detail.frozen
                  ? `Archived ${season.closed_at ? new Date(season.closed_at).toLocaleDateString() : ''}. These standings are frozen.`
                  : season.status === 'closed' ? 'Closed.' : 'In progress. Standings update as tournaments are completed.'}
              </p>
              {season.status === 'open' && !season.is_current && (
                <p className="text-sm font-medium text-amber-700">This past season is reopened for corrections.</p>
              )}
              <div className="flex flex-wrap gap-4 pt-1 text-sm">
                {season.champion_name && <span>Champion: <strong>{season.champion_name}</strong></span>}
                {season.losers_winner_name && <span>Losers bracket: <strong>{season.losers_winner_name}</strong></span>}
                {(season.championship_pot > 0 || season.losers_bracket_pot > 0) && (
                  <span>Pots: {money(season.championship_pot)} / {money(season.losers_bracket_pot)}</span>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={downloadCsv} className="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50">Download CSV</button>
              {admin && !season.is_current && (
                <button onClick={toggleClosed} disabled={busy} className="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50">
                  {season.status === 'closed' ? 'Reopen season' : 'Close season'}
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">Player</th>
                  <th className="px-3 py-2 text-right">Points</th>
                  {showPlayoffCols && <th className="px-3 py-2 text-right">Playoff</th>}
                  <th className="px-3 py-2 text-right">Played</th>
                  <th className="hidden px-3 py-2 text-right md:table-cell">Quota $</th>
                  <th className="hidden px-3 py-2 text-right md:table-cell">Skins $</th>
                  <th className="hidden px-3 py-2 text-right md:table-cell">CTP $</th>
                  <th className="hidden px-3 py-2 text-right md:table-cell">Side $</th>
                  <th className="px-3 py-2 text-right">Total $</th>
                  {detail.frozen && <th className="hidden px-3 py-2 text-right sm:table-cell">End quota</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {detail.standings.length === 0 && (
                  <tr><td colSpan="11" className="px-3 py-6 text-center text-slate-500">No results yet this season.</td></tr>
                )}
                {detail.standings.map((r) => (
                  <tr key={r.player_id}>
                    <td className="px-3 py-2 text-slate-500">{r.final_rank}</td>
                    <td className="px-3 py-2 font-medium">{r.player_name}</td>
                    <td className="px-3 py-2 text-right">{r.fedex_points.toLocaleString()}</td>
                    {showPlayoffCols && <td className="px-3 py-2 text-right">{r.playoff_points.toLocaleString()}</td>}
                    <td className="px-3 py-2 text-right">{r.tournaments_played}</td>
                    <td className="hidden px-3 py-2 text-right md:table-cell">{money(r.prize_quota)}</td>
                    <td className="hidden px-3 py-2 text-right md:table-cell">{money(r.prize_skins)}</td>
                    <td className="hidden px-3 py-2 text-right md:table-cell">{money(r.prize_ctp)}</td>
                    <td className="hidden px-3 py-2 text-right md:table-cell">{money(r.prize_side_games)}</td>
                    <td className="px-3 py-2 text-right font-semibold">{money(r.prize_money)}</td>
                    {detail.frozen && <td className="hidden px-3 py-2 text-right sm:table-cell">{r.end_quota_18 ?? '—'}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <h3 className="mb-2 font-semibold">Tournaments ({detail.tournaments.length})</h3>
            {detail.tournaments.length === 0 ? (
              <p className="text-sm text-slate-500">No tournaments in this season.</p>
            ) : (
              <ul className="divide-y divide-slate-100 text-sm">
                {detail.tournaments.map((t) => (
                  <li key={t.id} className="flex justify-between py-1.5">
                    <span>{formatDateOnly(t.date)} — {t.course_name}{t.playoff_stage !== 'regular' ? ` (${t.playoff_stage})` : ''}</span>
                    <span className={t.is_completed ? 'text-fairway-700' : 'text-slate-500'}>
                      {t.is_completed ? 'Completed' : t.has_scores ? 'In progress' : 'Scheduled'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

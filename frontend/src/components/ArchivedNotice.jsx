// Shown on pages for a round whose season has been closed.
export const ArchivedNotice = ({ tournament }) => (
  <div className="mb-4 rounded border border-slate-300 bg-slate-100 p-3 text-sm text-slate-700">
    <span className="font-semibold">Archived.</span>{' '}
    The {tournament?.season_year} season is closed, so this round is read-only. An admin can reopen the season on the Seasons page.
  </div>
)

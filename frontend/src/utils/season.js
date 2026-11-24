// A round in a closed season is read-only; the server refuses changes to it.
export const isArchivedRound = (tournament) => tournament?.season_status === 'closed'

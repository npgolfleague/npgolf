import { DEFAULT_POINTS_TABLES, ordinal } from '../utils/pointsTables'

const TABLES = [
  ['weekly', 'Weekly Points', 'Every regular-season round.'],
  ['seed', 'Semifinal Seed Points', 'Given to the qualifiers by their place in the regular season, before the semifinal round.'],
  ['semifinal', 'Semifinal Round Points', 'Added for each qualifier\'s place in the semifinal round.'],
  ['final', 'Final Round Points', 'Added for each finalist\'s place in the final round.'],
  ['losers', 'Losers Bracket Points', 'Players outside the playoff field, in both playoff rounds.']
]
const MAX_PLACES = 50

export const PointsTablesEditor = ({ value, onChange }) => {
  const setTable = (name, table) => onChange({ ...value, [name]: table })

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mt-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-1">FedEx Cup Points</h3>
      <p className="text-sm text-gray-500 mb-4">
        Points by place for this league. The last box in each list also covers every place below it.
        Changes apply to tournaments completed from now on. Finished tournaments keep their points unless they are completed again.
        If a finished final still needs a putt-off, recording the winner uses the new values.
      </p>
      <div className="space-y-6">
        {TABLES.map(([name, label, help]) => {
          const table = value[name]
          const changed = JSON.stringify(table) !== JSON.stringify(DEFAULT_POINTS_TABLES[name])
          return (
            <fieldset key={name} className="border border-gray-200 rounded-lg p-4">
              <legend className="px-1 font-medium text-gray-800">{label}</legend>
              <p className="text-sm text-gray-500 mb-3">{help}</p>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {table.map((points, index) => {
                  const last = index === table.length - 1
                  const id = `points-${name}-${index}`
                  return (
                    <div key={index}>
                      <label htmlFor={id} className="block text-xs font-medium text-gray-700 mb-1">
                        {ordinal(index + 1)}{last ? ' and below' : ''}
                      </label>
                      <input
                        id={id}
                        type="number"
                        min="0"
                        step="1"
                        value={points}
                        onChange={e => setTable(name, table.map((old, i) => (
                          i === index ? (e.target.value === '' ? '' : Number(e.target.value)) : old
                        )))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  )
                })}
              </div>
              <div className="mt-3 flex flex-wrap gap-4 text-sm">
                <button type="button" disabled={table.length >= MAX_PLACES} onClick={() => setTable(name, [...table, table[table.length - 1]])} className="text-blue-600 hover:text-blue-800 disabled:text-gray-400">Add place</button>
                <button type="button" disabled={table.length <= 1} onClick={() => setTable(name, table.slice(0, -1))} className="text-blue-600 hover:text-blue-800 disabled:text-gray-400">Remove last place</button>
                <button type="button" disabled={!changed} onClick={() => setTable(name, [...DEFAULT_POINTS_TABLES[name]])} className="text-blue-600 hover:text-blue-800 disabled:text-gray-400">Use standard points</button>
              </div>
            </fieldset>
          )
        })}
      </div>
    </div>
  )
}

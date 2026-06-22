import { useContext, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { rulesAPI, leaguesAPI } from '../api'
import { AuthContext } from '../context/AuthContext'
import { isAdminCapable } from '../utils/roles'

const DEFAULT_LOCAL_RULES = [
  "Mulligan on first hole played. If your first shot is not a good one you may without penalty play a second shot, with the caveat that you must play the second shot (you don't choose the best one).",
  'Out of Bounds. Balls hit OB can be played as one stoke penalty with no distance penalty. The ball can NOT be played from OB but the ball may be dropped as it would if the penalty area was marked with red stakes. Either two club lengths from where the ball entered the penalty area; or as far back as desired on a line from the hole to the where the ball crossed into the penalty area.',
  "Gimme's there are no gimme's during the championship. During regular season anything within 12 inches can be given. Gimme's must be given by a playing partner (you can't give yourself a putt)."
]

export const Rules = () => {
  const { user } = useContext(AuthContext)
  const canManageRules = isAdminCapable(user)
  const [expandedSection, setExpandedSection] = useState(null)
  const [localRules, setLocalRules] = useState(DEFAULT_LOCAL_RULES)
  const [sections, setSections] = useState([])
  const [currentLeague, setCurrentLeague] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    const fetchRules = async () => {
      try {
        const [rulesResult, leagueResult] = await Promise.allSettled([
          rulesAPI.getCurrent(),
          leaguesAPI.current()
        ])
        const fetchedSections = rulesResult.status === 'fulfilled' ? rulesResult.value.data?.sections : null
        const fetchedRules = rulesResult.status === 'fulfilled' ? rulesResult.value.data?.localRules : null

        if (isMounted) {
          if (leagueResult.status === 'fulfilled') {
            setCurrentLeague(leagueResult.value.data)
          }
          if (Array.isArray(fetchedSections) && fetchedSections.length > 0) {
            setSections(fetchedSections)
          } else if (Array.isArray(fetchedRules) && fetchedRules.length > 0) {
            setLocalRules(fetchedRules)
          }
        }
      } catch (_err) {
        // Keep built-in defaults if league-specific rules are unavailable.
        console.warn('Failed to load league rules, using defaults')
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    fetchRules()

    return () => {
      isMounted = false
    }
  }, [])

  const leagueName = currentLeague?.name || 'Paradise Golf League'
  const cupName = currentLeague?.cup_name || 'Paradise Cup'

  const toggleSection = (section) => {
    setExpandedSection(expandedSection === section ? null : section)
  }

  const renderTextContent = (content) => {
    if (!content) return null
    return content.split('\n').map((line, idx) => (
      <div key={idx} className="text-gray-700">
        {line || <br />}
      </div>
    ))
  }

  const renderSectionContent = (section) => {
    if (section.type === 'text') {
      return <div className="text-gray-700">{renderTextContent(section.content)}</div>
    } else if (section.type === 'list' && Array.isArray(section.items)) {
      return (
        <ol className="list-decimal list-inside space-y-4 text-gray-700">
          {section.items.map((item, idx) => (
            <li key={idx}>{item}</li>
          ))}
        </ol>
      )
    }
    return null
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-8">
          <p className="text-gray-600">Loading rules...</p>
        </div>
      </div>
    )
  }

  // If sections are available, render them
  if (sections.length > 0) {
    return (
      <div className="max-w-5xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-8">
          <div className="flex items-start justify-between gap-4 mb-2">
            <h1 className="text-2xl font-bold text-slate-900">League Rules</h1>
            {canManageRules && (
              <Link
                to="/rules/manage"
                className="shrink-0 inline-flex items-center px-3 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800"
              >
                Edit Rules
              </Link>
            )}
          </div>
          <p className="text-gray-600 mb-8">{leagueName}</p>

          {sections.filter((section) => section.visible !== false).map((section) => (
            <section key={section.id} className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">{section.title}</h2>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                {renderSectionContent(section)}
              </div>
            </section>
          ))}
        </div>
      </div>
    )
  }

  // Fall back to hardcoded layout with local rules
  return (
    <div className="max-w-5xl mx-auto">
      <div className="bg-white rounded-lg shadow-md p-8">
        <div className="flex items-start justify-between gap-4 mb-2">
          <h1 className="text-2xl font-bold text-slate-900">League Rules</h1>
          {canManageRules && (
            <Link
              to="/rules/manage"
              className="shrink-0 inline-flex items-center px-3 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800"
            >
              Edit Rules
            </Link>
          )}
        </div>
        <p className="text-gray-600 mb-8">{leagueName}</p>

        {/* Basic Information */}
        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">League Schedule & Format</h2>
          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-4">
            <p className="text-gray-700 mb-2">
              <strong>When:</strong> Wednesday nights at Eagles Golf Club in Odessa
            </p>
            <p className="text-gray-700 mb-2">
              <strong>Starting:</strong> March 18th
            </p>
            <p className="text-gray-700 mb-2">
              <strong>Finals:</strong> 18 hole round on September 26th
            </p>
            <p className="text-gray-700 mb-2">
              <strong>Tee Time:</strong> Shot gun start at around 5:00 PM each week
            </p>
            <p className="text-gray-700">
              <strong>Cost:</strong> $25.00 league fee + $23.00 per week greens fee
            </p>
          </div>
        </section>

        {/* Local Rules */}
        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Local Rules</h2>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
            <ol className="list-decimal list-inside space-y-4 text-gray-700">
              {localRules.map((rule, idx) => (
                <li key={`${idx}-${rule.slice(0, 20)}`}>{rule}</li>
              ))}
            </ol>
          </div>
        </section>

        {/* Quota Point System */}
        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Quota Point System</h2>
          <p className="text-gray-700 mb-4">
            The Quota Point system awards points based on your scores for each hole. Once you hit double bogey, 
            you pick up and move to the next hole to keep pace of play.
          </p>
          <div className="bg-gradient-to-r from-yellow-50 to-green-50 rounded-lg p-6 mb-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-yellow-600">10</div>
                <div className="text-sm text-gray-700">Albatross</div>
                <div className="text-xs text-gray-500">(Double Eagle)</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-yellow-600">8</div>
                <div className="text-sm text-gray-700">Hole in One</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600">6</div>
                <div className="text-sm text-gray-700">Eagle</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600">4</div>
                <div className="text-sm text-gray-700">Birdie</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600">2</div>
                <div className="text-sm text-gray-700">Par</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-gray-600">1</div>
                <div className="text-sm text-gray-700">Bogey</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-red-600">0</div>
                <div className="text-sm text-gray-700">Double Bogey</div>
              </div>
            </div>
          </div>
        </section>

        {/* Setting Your Quota */}
        <section className="mb-8">
          <button
            onClick={() => toggleSection('quota')}
            className="w-full flex justify-between items-center text-left text-2xl font-semibold text-gray-900 mb-4 hover:text-blue-600 transition-colors"
          >
            <span>Setting Your Quota</span>
            <span className="text-3xl">{expandedSection === 'quota' ? '−' : '+'}</span>
          </button>
          {expandedSection === 'quota' && (
            <div className="bg-gray-50 rounded-lg p-6 mb-4">
              <p className="text-gray-700 mb-4">
                <strong>New Players:</strong> Establish your quota after completing 3 rounds, or we can figure one if you have a handicap.
              </p>
              <p className="text-gray-700 mb-4">
                <strong>Returning Players:</strong> Use your quota from last season.
              </p>
              <p className="text-gray-700 mb-4">
                Your quota is the average of your last 7 quota scores with these rules:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-700 mb-4">
                <li>
                  <strong>Lower Limit:</strong> Quota scores will only post 2 points lower than your quota from the prior week. 
                  (Example: if your quota is 7 and you score a 4, it will be recorded as a 5)
                </li>
                <li>
                  <strong>Upper Limit:</strong> The limit is +2 points if you are over your quota. 
                  (Example: if your quota is 7 and you score an 11, it will be recorded as a 9)
                </li>
                <li>
                  <strong>Anti-Sandbagging:</strong> If you have played less than 7 rounds and have a plus round 
                  (you shoot over your quota), that round will be entered twice when setting your quota.
                </li>
              </ul>
            </div>
          )}
        </section>


        {/* Cup Points */}
        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">{cupName} Points</h2>
          <p className="text-gray-700 mb-4">
            Once you have a quota, you can start earning {cupName} points. Points are earned weekly as follows:
          </p>
          <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-6 mb-4">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="text-center bg-white rounded p-2">
                <div className="text-2xl font-bold text-purple-600">100</div>
                <div className="text-xs text-gray-700">1st Place</div>
              </div>
              <div className="text-center bg-white rounded p-2">
                <div className="text-2xl font-bold text-blue-600">90</div>
                <div className="text-xs text-gray-700">2nd Place</div>
              </div>
              <div className="text-center bg-white rounded p-2">
                <div className="text-2xl font-bold text-blue-600">80</div>
                <div className="text-xs text-gray-700">3rd Place</div>
              </div>
              <div className="text-center bg-white rounded p-2">
                <div className="text-2xl font-bold text-blue-600">70</div>
                <div className="text-xs text-gray-700">4th Place</div>
              </div>
              <div className="text-center bg-white rounded p-2">
                <div className="text-2xl font-bold text-blue-600">60</div>
                <div className="text-xs text-gray-700">5th Place</div>
              </div>
              <div className="text-center bg-white rounded p-2">
                <div className="text-2xl font-bold text-green-600">50</div>
                <div className="text-xs text-gray-700">6th Place</div>
              </div>
              <div className="text-center bg-white rounded p-2">
                <div className="text-2xl font-bold text-green-600">40</div>
                <div className="text-xs text-gray-700">7th Place</div>
              </div>
              <div className="text-center bg-white rounded p-2">
                <div className="text-2xl font-bold text-green-600">30</div>
                <div className="text-xs text-gray-700">8th Place</div>
              </div>
              <div className="text-center bg-white rounded p-2">
                <div className="text-2xl font-bold text-gray-600">20</div>
                <div className="text-xs text-gray-700">9th Place</div>
              </div>
              <div className="text-center bg-white rounded p-2">
                <div className="text-2xl font-bold text-gray-600">10</div>
                <div className="text-xs text-gray-700">10th Place</div>
              </div>
            </div>
            <div className="text-center mt-4 text-gray-700">
              <strong>1 point</strong> for all other competitors who played that week
            </div>
          </div>
          <p className="text-gray-700 text-sm">
            <strong>Ties:</strong> Points are added and divided between tied players. 
            (Example: Two players tied for 2nd get (90+80)/2 = 85 points each, next player gets 4th place points)
          </p>
        </section>

        {/* Playoffs */}
        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Championship Playoffs - September 26th</h2>
          <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 mb-4">
            <p className="text-gray-700 mb-2">
              The 18-hole Saturday round will be treated as 2 separate 9-hole rounds for playoff purposes.
            </p>
          </div>
          
          <div className="space-y-4">
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-3">First 9 Holes - Semi-Finals</h3>
              <ul className="list-disc list-inside space-y-2 text-gray-700">
                <li>Top 8 point leaders + ties from regular season qualify</li>
                <li>Points are reset: 100, 90, 80, 70, 60, 50, 40, 30 (1st through 8th place)</li>
              </ul>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Second 9 Holes - Championship</h3>
              <ul className="list-disc list-inside space-y-2 text-gray-700">
                <li>Top 4 + ties from the semi-finals compete</li>
                <li>{cupName} points carried over from first 9 holes</li>
                <li>1st place points doubled to 200 (2nd: 90, 3rd: 80, 4th: 70)</li>
                <li><strong>Win the last 9 holes = Win the championship!</strong></li>
              </ul>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Tie Breakers</h3>
              <p className="text-gray-700">
                Championship tie only (other places split pots):
              </p>
              <ol className="list-decimal list-inside space-y-1 text-gray-700 ml-4 mt-2">
                <li>Highest ranked player from regular season</li>
                <li>If still tied: 20ft putt off on practice green</li>
              </ol>
            </div>
          </div>
        </section>

        {/* Rain Out Rules */}
        <section className="mb-8">
          <button
            onClick={() => toggleSection('rainout')}
            className="w-full flex justify-between items-center text-left text-2xl font-semibold text-gray-900 mb-4 hover:text-blue-600 transition-colors"
          >
            <span>Rain Out Rules</span>
            <span className="text-3xl">{expandedSection === 'rainout' ? '−' : '+'}</span>
          </button>
          {expandedSection === 'rainout' && (
            <div className="bg-gray-50 rounded-lg p-6 mb-4">
              <p className="text-gray-700 mb-2 italic">Note: Rain out rules to be voted on.</p>
              <ul className="list-disc list-inside space-y-2 text-gray-700">
                <li>Various contingency plans for rain delays</li>
                <li>If all backup dates are rained out, player with most regular season points wins</li>
              </ul>
            </div>
          )}
        </section>

        {/* Losers Bracket */}
        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Losers Bracket</h2>
          <div className="bg-gray-50 rounded-lg p-6">
            <p className="text-gray-700 mb-4">
              For players who don't qualify for the playoffs, compete in the losers bracket!
            </p>
            <div className="flex justify-around text-center">
              <div>
                <div className="text-3xl font-bold text-green-600">$30</div>
                <div className="text-sm text-gray-700">1st Place</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-blue-600">$20</div>
                <div className="text-sm text-gray-700">2nd Place</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-purple-600">$10</div>
                <div className="text-sm text-gray-700">3rd Place</div>
              </div>
            </div>
            <p className="text-gray-700 text-sm mt-4">
              Based on highest score over quota for combined playoff weeks
            </p>
          </div>
        </section>

        {/* Costs and Prize Money */}
        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Costs & Prize Money</h2>
          
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Required Fees</h3>
              <ul className="space-y-2 text-gray-700">
                <li><strong>$25.00</strong> - One-time league fee for the season</li>
                <li><strong>$23.00</strong> - Weekly greens fee (paid each week you play)</li>
                <li><strong>$3.00</strong> - Hole-in-one/Double Eagle pool (from league fee)</li>
              </ul>
              <p className="text-sm text-gray-600 mt-3">
                Hole-in-one pool is currently $0 (capped at $500)
              </p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Season Prize Distribution</h3>
              <div className="space-y-2 text-gray-700">
                <div className="flex justify-between">
                  <span>1st Place</span>
                  <strong>60%</strong>
                </div>
                <div className="flex justify-between">
                  <span>2nd Place</span>
                  <strong>20%</strong>
                </div>
                <div className="flex justify-between">
                  <span>3rd Place</span>
                  <strong>10%</strong>
                </div>
                <div className="flex justify-between">
                  <span>Golf Hat & Closest to Pin</span>
                  <strong>10%</strong>
                </div>
              </div>
            </div>

            <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Optional Weekly Pools</h3>
              <ul className="space-y-2 text-gray-700">
                <li><strong>Pins & Skins pot is split 60/40</strong> - 60% skins, 40% closest-to-pin</li>
                <li><strong>9-hole example:</strong> $5 optional fee = $3 skins + $2 closest-to-pin (from each paid player)</li>
              </ul>
              <p className="text-sm text-gray-600 mt-3 italic">
                All optional pools collected before tee off - participation not required
              </p>
            </div>
          </div>
        </section>

        {/* Footer */}
        <div className="bg-blue-600 text-white rounded-lg p-6 text-center">
          <p className="text-lg font-semibold mb-2">Good Luck This Season!</p>
          <p className="text-sm opacity-90">See you on the course every Wednesday at 5:00 PM</p>
        </div>
      </div>
    </div>
  )
}

export default Rules

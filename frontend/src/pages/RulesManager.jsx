import { useContext, useEffect, useMemo, useState } from 'react'
import { AuthContext } from '../context/AuthContext'
import { rulesAPI } from '../api'
import { isAdminCapable } from '../utils/roles'

const DEFAULT_SECTIONS = [
  {
    id: 'schedule',
    title: 'League Schedule & Format',
    visible: true,
    type: 'text',
    content: 'Wednesday nights at Eagles Golf Club in Odessa\n\nStarting: March 18th\nFinals: 18 hole round on September 26th\nTee Time: Shot gun start at around 5:00 PM each week\nCost: $25.00 league fee + $23.00 per week greens fee'
  },
  {
    id: 'localRules',
    title: 'Local Rules',
    visible: true,
    type: 'list',
    items: [
      "Mulligan on first hole played. If your first shot is not a good one you may without penalty play a second shot, with the caveat that you must play the second shot (you don't choose the best one).",
      'Out of Bounds. Balls hit OB can be played as one stoke penalty with no distance penalty. The ball can NOT be played from OB but the ball may be dropped as it would if the penalty area was marked with red stakes. Either two club lengths from where the ball entered the penalty area; or as far back as desired on a line from the hole to the where the ball crossed into the penalty area.',
      "Gimme's there are no gimme's during the championship. During regular season anything within 12 inches can be given. Gimme's must be given by a playing partner (you can't give yourself a putt)."
    ]
  },
  {
    id: 'quotaPoints',
    title: 'Quota Point System',
    visible: true,
    type: 'text',
    content: 'The Quota Point system awards points based on your scores for each hole. Once you hit double bogey, you pick up and move to the next hole to keep pace of play.'
  },
  {
    id: 'costsPrizes',
    title: 'Costs & Prize Money',
    visible: true,
    type: 'text',
    content: 'Required Fees:\n$25.00 - One-time league fee for the season\n$23.00 - Weekly greens fee (paid each week you play)\n$3.00 - Hole-in-one/Double Eagle pool (from league fee)\n\nSeason Prize Distribution:\n1st Place: 60%\n2nd Place: 20%\n3rd Place: 10%\nGolf Hat & Closest to Pin: 10%'
  }
]

export const RulesManager = () => {
  const { user } = useContext(AuthContext)
  const canManage = isAdminCapable(user)

  const [drafts, setDrafts] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [publishingId, setPublishingId] = useState(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const [editingId, setEditingId] = useState(null)
  const [title, setTitle] = useState('')
  const [effectiveFrom, setEffectiveFrom] = useState('')
  const [effectiveTo, setEffectiveTo] = useState('')
  const [sections, setSections] = useState(DEFAULT_SECTIONS)

  const publishedRuleset = useMemo(
    () => drafts.find((d) => d.status === 'published') || null,
    [drafts]
  )

  const activeDraft = useMemo(
    () => (editingId ? drafts.find((d) => Number(d.id) === Number(editingId)) : null),
    [drafts, editingId]
  )

  const resetForm = () => {
    setEditingId(null)
    setTitle('')
    setEffectiveFrom('')
    setEffectiveTo('')
    setSections(JSON.parse(JSON.stringify(DEFAULT_SECTIONS)))
  }

  const loadDrafts = async () => {
    try {
      setLoading(true)
      setError('')
      const response = await rulesAPI.listDrafts()
      setDrafts(Array.isArray(response.data) ? response.data : [])
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load rules drafts')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (canManage) {
      loadDrafts()
    } else {
      setLoading(false)
    }
  }, [canManage])

  const beginEdit = (draft) => {
    setEditingId(draft.id)
    setTitle(draft.title || '')
    setEffectiveFrom(draft.effective_from ? String(draft.effective_from).slice(0, 10) : '')
    setEffectiveTo(draft.effective_to ? String(draft.effective_to).slice(0, 10) : '')

    const content = draft.content_json || {}
    if (Array.isArray(content.sections) && content.sections.length > 0) {
      setSections(JSON.parse(JSON.stringify(content.sections)))
    } else if (Array.isArray(content.localRules)) {
      // Convert old format to new format
      const converted = JSON.parse(JSON.stringify(DEFAULT_SECTIONS))
      converted.forEach(s => {
        if (s.id === 'localRules') {
          s.items = content.localRules
        }
      })
      setSections(converted)
    } else {
      setSections(JSON.parse(JSON.stringify(DEFAULT_SECTIONS)))
    }
    setMessage('')
    setError('')
  }

  const updateSection = (sectionId, field, value) => {
    setSections((prev) =>
      prev.map((s) =>
        s.id === sectionId
          ? {
              ...s,
              [field]: value
            }
          : s
      )
    )
  }

  const updateSectionItem = (sectionId, idx, value) => {
    setSections((prev) =>
      prev.map((s) =>
        s.id === sectionId && Array.isArray(s.items)
          ? {
              ...s,
              items: s.items.map((item, i) => (i === idx ? value : item))
            }
          : s
      )
    )
  }

  const addSectionItem = (sectionId) => {
    setSections((prev) =>
      prev.map((s) =>
        s.id === sectionId && Array.isArray(s.items)
          ? {
              ...s,
              items: [...s.items, '']
            }
          : s
      )
    )
  }

  const removeSectionItem = (sectionId, idx) => {
    setSections((prev) =>
      prev.map((s) =>
        s.id === sectionId && Array.isArray(s.items)
          ? {
              ...s,
              items: s.items.filter((_, i) => i !== idx)
            }
          : s
      )
    )
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    setMessage('')

    if (!title.trim()) {
      setSaving(false)
      setError('Title is required')
      return
    }

    if (!sections || sections.length === 0) {
      setSaving(false)
      setError('At least one rule section is required')
      return
    }

    const payload = {
      title: title.trim(),
      sections: sections.filter(s => s.visible).map(s => {
        const section = { ...s }
        if (Array.isArray(section.items)) {
          section.items = section.items.map(item => (typeof item === 'string' ? item.trim() : '')).filter(item => item.length > 0)
        }
        delete section.gridItems
        return section
      }),
      effective_from: effectiveFrom || null,
      effective_to: effectiveTo || null
    }

    try {
      if (editingId) {
        await rulesAPI.updateDraft(editingId, payload)
        setMessage('Draft updated successfully')
      } else {
        await rulesAPI.createDraft(payload)
        setMessage('Draft created successfully')
      }
      await loadDrafts()
      resetForm()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save rules draft')
    } finally {
      setSaving(false)
    }
  }

  const handlePublish = async (id) => {
    try {
      setPublishingId(id)
      setError('')
      setMessage('')
      await rulesAPI.publishDraft(id)
      await loadDrafts()
      if (editingId && Number(editingId) === Number(id)) {
        resetForm()
      }
      setMessage('Rules published successfully')
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to publish rules draft')
    } finally {
      setPublishingId(null)
    }
  }

  if (!canManage) {
    return (
      <div className="max-w-5xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-8">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Rules Manager</h1>
          <p className="text-red-600">Admin access is required to manage league rules.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto">
      <section className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Rules Manager</h1>
        <p className="text-gray-600 mb-6">Create drafts and publish rules for the current league context.</p>

        {error && <div className="mb-4 p-3 rounded border border-red-200 bg-red-50 text-red-700">{error}</div>}
        {message && <div className="mb-4 p-3 rounded border border-green-200 bg-green-50 text-green-700">{message}</div>}

        <form onSubmit={handleSave} className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2"
              placeholder="Spring 2026 Rules"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Effective From</label>
              <input type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} className="w-full border border-gray-300 rounded px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Effective To</label>
              <input type="date" value={effectiveTo} onChange={(e) => setEffectiveTo(e.target.value)} className="w-full border border-gray-300 rounded px-3 py-2" />
            </div>
          </div>

          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-900">Rule Sections</h3>
            {sections.map((section) => (
              <div key={section.id} className="border border-gray-200 rounded-lg p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Section Title</label>
                    <input
                      type="text"
                      value={section.title}
                      onChange={(e) => updateSection(section.id, 'title', e.target.value)}
                      className="w-full border border-gray-300 rounded px-3 py-2"
                    />
                  </div>
                  <div className="pt-6 flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={`visible-${section.id}`}
                      checked={section.visible}
                      onChange={(e) => updateSection(section.id, 'visible', e.target.checked)}
                      className="w-4 h-4"
                    />
                    <label htmlFor={`visible-${section.id}`} className="text-sm font-medium text-gray-700 cursor-pointer">
                      Display
                    </label>
                  </div>
                </div>

                {section.type === 'text' && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Content</label>
                    <textarea
                      value={section.content || ''}
                      onChange={(e) => updateSection(section.id, 'content', e.target.value)}
                      className="w-full border border-gray-300 rounded px-3 py-2 font-mono text-sm"
                      rows="4"
                      placeholder="Enter section content (use line breaks for multiple paragraphs)"
                    />
                  </div>
                )}

                {section.type === 'list' && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Items</label>
                    <div className="space-y-2">
                      {Array.isArray(section.items) &&
                        section.items.map((item, idx) => (
                          <div key={`${section.id}-item-${idx}`} className="flex gap-2">
                            <input
                              type="text"
                              value={item}
                              onChange={(e) => updateSectionItem(section.id, idx, e.target.value)}
                              className="flex-1 border border-gray-300 rounded px-3 py-2"
                              placeholder={`Item ${idx + 1}`}
                            />
                            <button
                              type="button"
                              onClick={() => removeSectionItem(section.id, idx)}
                              disabled={Array.isArray(section.items) && section.items.length <= 1}
                              className="px-3 py-2 rounded border border-gray-300 text-gray-700 disabled:opacity-50"
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => addSectionItem(section.id)}
                      className="mt-2 text-sm px-3 py-1 rounded bg-slate-100 hover:bg-slate-200"
                    >
                      + Add item
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="px-4 py-2 rounded bg-fairway-700 text-white disabled:opacity-60">
              {saving ? 'Saving...' : editingId ? 'Update Draft' : 'Create Draft'}
            </button>
            {editingId && (
              <button type="button" onClick={resetForm} className="px-4 py-2 rounded border border-gray-300">
                Cancel Edit
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold text-slate-900 mb-4">Drafts and Published Rules</h2>

        {loading ? (
          <p className="text-gray-600">Loading rulesets...</p>
        ) : drafts.length === 0 ? (
          <p className="text-gray-600">No rulesets yet for this league.</p>
        ) : (
          <div className="space-y-3">
            {publishedRuleset && (
              <div className="p-3 rounded border border-green-200 bg-green-50">
                <p className="text-sm font-semibold text-green-700">Currently Published</p>
                <p className="font-medium text-slate-900">{publishedRuleset.title}</p>
              </div>
            )}

            {drafts.map((draft) => {
              const content = draft.content_json || {}
              const draftSections = Array.isArray(content.sections) ? content.sections : []
              const isDraft = draft.status === 'draft'
              const isEditingThis = Number(editingId) === Number(draft.id)

              return (
                <div key={draft.id} className="border border-gray-200 rounded p-3">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <p className="font-semibold text-slate-900">{draft.title}</p>
                      <p className="text-xs text-gray-500">Status: {draft.status}</p>
                      {draftSections.length > 0 && <p className="text-xs text-gray-500">{draftSections.length} sections</p>}
                    </div>
                    {isDraft && (
                      <div className="flex gap-2">
                        <button onClick={() => beginEdit(draft)} className="text-sm px-2 py-1 rounded border border-gray-300">
                          {isEditingThis ? 'Editing' : 'Edit'}
                        </button>
                        <button
                          onClick={() => handlePublish(draft.id)}
                          disabled={publishingId === draft.id}
                          className="text-sm px-2 py-1 rounded bg-fairway-700 text-white disabled:opacity-60"
                        >
                          {publishingId === draft.id ? 'Publishing...' : 'Publish'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {activeDraft && (
          <p className="mt-4 text-xs text-gray-500">Editing draft ID {activeDraft.id}</p>
        )}
      </section>
    </div>
  )
}

export default RulesManager

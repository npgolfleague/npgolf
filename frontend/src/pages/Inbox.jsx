import { useState, useEffect } from 'react'
import { emailsAPI, playersAPI } from '../api'

export function Inbox() {
  const [emails, setEmails] = useState([])
  const [selectedEmail, setSelectedEmail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCompose, setShowCompose] = useState(false)
  const [allPlayers, setAllPlayers] = useState([])
  const [compose, setCompose] = useState({ subject: '', body: '', recipient_type: 'active', player_ids: [], custom_emails: '' })
  const [attachment, setAttachment] = useState(null)
  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState(null)

  useEffect(() => {
    loadEmails()
    playersAPI.list().then(r => setAllPlayers(r.data.filter(p => p.active && p.email))).catch(() => {})
  }, [])

  const handleSendEmail = async () => {
    setSending(true)
    setSendResult(null)
    try {
      const fd = new FormData()
      fd.append('subject', compose.subject)
      fd.append('body', compose.body)
      fd.append('recipient_type', compose.recipient_type)
      if (compose.recipient_type === 'specific') fd.append('player_ids', JSON.stringify(compose.player_ids))
      if (compose.recipient_type === 'custom') fd.append('custom_emails', compose.custom_emails)
      if (attachment) fd.append('attachment', attachment)
      const res = await emailsAPI.send(fd)
      setSendResult(res.data)
      if (res.data.sent > 0) {
        setShowCompose(false)
        setCompose({ subject: '', body: '', recipient_type: 'active', player_ids: [], custom_emails: '' })
        setAttachment(null)
      }
    } catch (err) {
      setSendResult({ error: err.response?.data?.error || 'Failed to send' })
    } finally {
      setSending(false)
    }
  }

  const loadEmails = async () => {
    try {
      setLoading(true)
      const response = await emailsAPI.list()
      setEmails(response.data)
    } catch (err) {
      setError('Failed to load emails')
      console.error('Error loading emails:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleEmailClick = async (email) => {
    try {
      const response = await emailsAPI.get(email.id)
      setSelectedEmail(response.data)
      
      if (!email.is_read) {
        await emailsAPI.markRead(email.id, true)
        setEmails(emails.map(e => 
          e.id === email.id ? { ...e, is_read: true } : e
        ))
      }
    } catch (err) {
      console.error('Error loading email:', err)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this email?')) return
    
    try {
      await emailsAPI.delete(id)
      setEmails(emails.filter(e => e.id !== id))
      if (selectedEmail?.id === id) {
        setSelectedEmail(null)
      }
    } catch (err) {
      setError('Failed to delete email')
      console.error('Error deleting email:', err)
    }
  }

  const unreadCount = emails.filter(e => !e.is_read).length

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading...</div>
  }

  return (
    <div className="space-y-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Inbox</h1>
        <p className="text-slate-500 text-sm mt-1">Incoming league emails</p>
      </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setShowCompose(true); setSendResult(null) }}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
          >
            ✉️ Send Mail
          </button>
          <button
            onClick={loadEmails}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            🔄 Refresh
          </button>
        </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Email List */}
        <div className="lg:col-span-1 bg-white rounded-lg shadow overflow-hidden">
          <div className="divide-y divide-gray-200 max-h-[600px] overflow-y-auto">
            {emails.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <p>No emails received yet</p>
                <p className="text-sm mt-2">Emails sent to mail@npgolf.net will appear here</p>
              </div>
            ) : (
              emails.map(email => (
                <div
                  key={email.id}
                  onClick={() => handleEmailClick(email)}
                  className={`p-4 cursor-pointer hover:bg-gray-50 transition ${
                    selectedEmail?.id === email.id ? 'bg-blue-50' : ''
                  } ${!email.is_read ? 'bg-blue-50/50 border-l-4 border-l-blue-600' : ''}`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <div className="font-semibold text-gray-900 truncate">
                      {email.from_name || email.from_email}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(email.id)
                      }}
                      className="text-red-600 hover:text-red-800 text-sm ml-2"
                    >
                      ×
                    </button>
                  </div>
                  <div className="text-sm text-gray-600 truncate mb-1">
                    {email.subject || '(No subject)'}
                  </div>
                  <div className="text-xs text-gray-500">
                    {new Date(email.received_at).toLocaleString()}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Email Content */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow">
          {selectedEmail ? (
            <div className="p-6">
              <div className="border-b pb-4 mb-4">
                <h2 className="text-xl font-bold text-gray-900 mb-2">
                  {selectedEmail.subject || '(No subject)'}
                </h2>
                <div className="text-sm text-gray-600 space-y-1">
                  <div>
                    <span className="font-semibold">From:</span>{' '}
                    {selectedEmail.from_name ? (
                      <>{selectedEmail.from_name} &lt;{selectedEmail.from_email}&gt;</>
                    ) : (
                      selectedEmail.from_email
                    )}
                  </div>
                  <div>
                    <span className="font-semibold">To:</span> {selectedEmail.to_email}
                  </div>
                  <div>
                    <span className="font-semibold">Date:</span>{' '}
                    {new Date(selectedEmail.received_at).toLocaleString()}
                  </div>
                </div>
              </div>

              <div className="prose max-w-none">
                {selectedEmail.html ? (
                  <div dangerouslySetInnerHTML={{ __html: selectedEmail.html }} />
                ) : (
                  <pre className="whitespace-pre-wrap font-sans text-gray-700">
                    {selectedEmail.text}
                  </pre>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500 p-8">
              <div className="text-center">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <p className="mt-2">Select an email to view</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Compose Modal */}
      {showCompose && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-4 border-b">
              <h2 className="text-lg font-bold">Compose Email</h2>
              <button onClick={() => setShowCompose(false)} className="text-gray-500 hover:text-gray-800 text-2xl leading-none">&times;</button>
            </div>
            <div className="p-4 space-y-4">
              {sendResult && (
                <div className={`p-3 rounded text-sm ${sendResult.error ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                  {sendResult.error || `✓ Sent: ${sendResult.sent}, Failed: ${sendResult.failed}`}
                </div>
              )}
              <div>
                <label className="block text-sm font-semibold mb-1">Recipients</label>
                <select
                  className="w-full p-2 border rounded-lg"
                  value={compose.recipient_type}
                  onChange={e => setCompose(c => ({ ...c, recipient_type: e.target.value }))}
                >
                  <option value="active">All Active Players (email allowed)</option>
                  <option value="specific">Specific Players</option>
                  <option value="custom">Enter Email Addresses</option>
                </select>
              </div>
              {compose.recipient_type === 'specific' && (
                <div>
                  <label className="block text-sm font-semibold mb-1">Select Players</label>
                  <div className="border rounded-lg max-h-40 overflow-y-auto p-2 space-y-1">
                    {allPlayers.map(p => (
                      <label key={p.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 p-1 rounded">
                        <input
                          type="checkbox"
                          checked={compose.player_ids.includes(p.id)}
                          onChange={e => setCompose(c => ({
                            ...c,
                            player_ids: e.target.checked
                              ? [...c.player_ids, p.id]
                              : c.player_ids.filter(id => id !== p.id)
                          }))}
                        />
                        {p.name} <span className="text-gray-400 text-xs">{p.email}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              {compose.recipient_type === 'custom' && (
                <div>
                  <label className="block text-sm font-semibold mb-1">Email Addresses <span className="font-normal text-gray-500">(comma or newline separated)</span></label>
                  <textarea
                    className="w-full p-2 border rounded-lg text-sm"
                    rows={3}
                    placeholder="email1@example.com, email2@example.com"
                    value={compose.custom_emails}
                    onChange={e => setCompose(c => ({ ...c, custom_emails: e.target.value }))}
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-semibold mb-1">Subject</label>
                <input
                  type="text"
                  className="w-full p-2 border rounded-lg"
                  placeholder="Subject"
                  value={compose.subject}
                  onChange={e => setCompose(c => ({ ...c, subject: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Message</label>
                <textarea
                  className="w-full p-2 border rounded-lg"
                  rows={8}
                  placeholder="Write your message here..."
                  value={compose.body}
                  onChange={e => setCompose(c => ({ ...c, body: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Attachment <span className="font-normal text-gray-500">(optional)</span></label>
                <input
                  type="file"
                  className="w-full text-sm"
                  onChange={e => setAttachment(e.target.files[0] || null)}
                />
                {attachment && <p className="text-xs text-gray-500 mt-1">📎 {attachment.name}</p>}
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleSendEmail}
                  disabled={sending || !compose.subject || !compose.body}
                  className="flex-1 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50"
                >
                  {sending ? 'Sending...' : '✉️ Send'}
                </button>
                <button
                  onClick={() => setShowCompose(false)}
                  className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

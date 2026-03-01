import { useState, useEffect } from 'react'
import { emailsAPI } from '../api'

export function Inbox() {
  const [emails, setEmails] = useState([])
  const [selectedEmail, setSelectedEmail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadEmails()
  }, [])

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
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">
          Inbox {unreadCount > 0 && (
            <span className="ml-2 text-sm bg-blue-600 text-white px-2 py-1 rounded-full">
              {unreadCount} new
            </span>
          )}
        </h1>
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
    </div>
  )
}

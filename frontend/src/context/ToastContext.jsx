import { createContext, useState, useCallback, useEffect } from 'react'
import { X } from 'lucide-react'

export const ToastContext = createContext()

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev, { id, message, type }])

    // Auto-dismiss after 4 seconds
    const timer = setTimeout(() => {
      removeToast(id)
    }, 4000)

    return { id, clear: () => clearTimeout(timer) }
  }, [])

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id))
  }, [])

  const getToastClasses = (type) => {
    switch (type) {
      case 'success':
        return 'bg-fairway-600 text-white'
      case 'error':
        return 'bg-red-600 text-white'
      case 'info':
      default:
        return 'bg-slate-700 text-white'
    }
  }

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium animate-in fade-in slide-in-from-bottom-4 pointer-events-auto ${getToastClasses(
              toast.type
            )}`}
          >
            <span>{toast.message}</span>
            <button
              onClick={() => removeToast(toast.id)}
              className="ml-auto shrink-0 hover:opacity-80 transition"
              aria-label="Close notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

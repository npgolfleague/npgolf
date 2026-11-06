import { useEffect, useState } from 'react'
import { systemAPI } from '../api'

// Fetched once per page load and shared by every component that asks.
let versionRequest = null

export function useAppVersion() {
  const [info, setInfo] = useState(null)

  useEffect(() => {
    let active = true
    if (!versionRequest) {
      versionRequest = systemAPI.version()
        .then((res) => res.data)
        .catch(() => {
          versionRequest = null
          return null
        })
    }
    versionRequest.then((data) => {
      if (active) setInfo(data)
    })
    return () => { active = false }
  }, [])

  return info
}

// "v0.1.0 · a1b2c3d"
export function formatVersionShort(info) {
  if (!info) return ''
  return [info.version && `v${info.version}`, info.commit].filter(Boolean).join(' · ')
}

export function formatDateTime(value) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit'
  })
}

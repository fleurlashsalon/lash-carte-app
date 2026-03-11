const STORAGE_KEY = 'lash-score-records'

function safeParse(json) {
  try {
    return JSON.parse(json)
  } catch {
    return null
  }
}

export function getRecords() {
  const raw = localStorage.getItem(STORAGE_KEY)
  const parsed = safeParse(raw)
  if (!Array.isArray(parsed)) return []
  return parsed
    .filter((r) => r && typeof r === 'object')
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
}

export function saveRecord(record) {
  const prev = getRecords()
  const next = [record, ...prev.filter((r) => r.id !== record.id)].sort(
    (a, b) => (b.createdAt || 0) - (a.createdAt || 0),
  )
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  return next
}

export function deleteRecord(id) {
  const prev = getRecords()
  const next = prev.filter((r) => r.id !== id)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  return next
}


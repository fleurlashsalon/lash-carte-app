const STORAGE_KEY = 'lash-score-records'
const PIN_STORAGE_KEY = 'lash-score-pin'
const PURCHASE_SUPPRESS_KEY = 'lash-score-purchase-suppressions'

export function getPurchaseSuppressionsMap() {
  try {
    const raw = localStorage.getItem(PURCHASE_SUPPRESS_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const out = {}
    for (const [k, v] of Object.entries(parsed)) {
      if (!Array.isArray(v)) continue
      out[k] = [...new Set(v.map((x) => String(x ?? '').trim()).filter(Boolean))]
    }
    return out
  } catch {
    return {}
  }
}

export function savePurchaseSuppressionsMap(map) {
  try {
    localStorage.setItem(PURCHASE_SUPPRESS_KEY, JSON.stringify(map || {}))
  } catch (e) {
    console.error('savePurchaseSuppressionsMap', e)
  }
}

export function clearPurchaseSuppressions() {
  try {
    localStorage.removeItem(PURCHASE_SUPPRESS_KEY)
  } catch {
    // ignore
  }
}

/** アプリのPIN（パスワード）を強制的に 0000 に戻す */
export function forceResetPinToDefault() {
  localStorage.setItem(PIN_STORAGE_KEY, '0000')
}

/** 保存されているPINを取得（未設定時は 0000） */
export function getAppPin() {
  return localStorage.getItem(PIN_STORAGE_KEY) || '0000'
}

// TODO: 後でご自身の Apps Script /exec URL に差し替えてください
export const GOOGLE_SCRIPT_URL = 'REPLACE_WITH_YOUR_APPS_SCRIPT_EXEC_URL'

export function isGoogleConfigured() {
  return Boolean(GOOGLE_SCRIPT_URL) && !GOOGLE_SCRIPT_URL.includes('REPLACE_WITH')
}

export function getRecords() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([]))
      return []
    }
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([]))
      return []
    }
    return parsed.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
  } catch (error) {
    console.error('getRecords error:', error)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([]))
    } catch {
      // ignore
    }
    return []
  }
}

export function saveRecord(record) {
  const prev = getRecords()
  const exists = prev.some((x) => x.id === record.id)
  const next = exists
    ? prev.map((x) => (x.id === record.id ? record : x))
    : [record, ...prev]

  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  return next.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
}

export function deleteRecord(id) {
  const prev = getRecords()
  const next = prev.filter((x) => x.id !== id)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  return next
}

/** 蓄積データを一括置換（CSVインポート用） */
export function replaceRecords(records) {
  const next = Array.isArray(records) ? records : []
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  return next
}

/** 保存データ（履歴/画像含む）を全削除 */
export function clearAllRecords() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch (e) {
    console.error('clearAllRecords error:', e)
  }
  // 次回以降のnull参照防止
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([]))
  } catch {
    // ignore
  }
  return []
}

async function postToGoogle(payload) {
  if (!isGoogleConfigured()) {
    throw new Error('GOOGLE_SCRIPT_URL が未設定です')
  }

  const response = await fetch(GOOGLE_SCRIPT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body: JSON.stringify(payload),
  })

  const text = await response.text()
  let json = null
  try {
    json = JSON.parse(text)
  } catch {
    json = { status: 'error', message: text }
  }

  if (!response.ok) {
    const message = json?.message || `HTTP ${response.status}`
    throw new Error(message)
  }

  return json
}

export async function saveToGoogle(data) {
  return postToGoogle(data)
}

export async function savePdfToGoogle(data) {
  return postToGoogle({
    type: 'pdf',
    ...data,
  })
}

/*
==============================
Fleur Lash 用 Apps Script（完成版サンプル）
==============================

前提:
- デプロイ: ウェブアプリ（実行ユーザー: 自分 / アクセス: 全員）
- 受信: Content-Type: text/plain;charset=utf-8
- Sheets: customers / records / photos（photos は拡張用）
- customer は customerId をキーに upsert
- record は append
- pdf は PDF_FOLDER_ID に保存

// ★ここを必ず差し替え
const SHEET_ID = 'REPLACE_WITH_YOUR_SHEET_ID'
const PDF_FOLDER_ID = 'REPLACE_WITH_YOUR_PDF_FOLDER_ID'

function jsonOutput(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON)
}

function ensureSheet_(ss, name) {
  return ss.getSheetByName(name) || ss.insertSheet(name)
}

function getHeaders_(sheet) {
  const range = sheet.getRange(1, 1, 1, Math.max(1, sheet.getLastColumn()))
  const values = range.getValues()
  return (values[0] || []).map(String)
}

function ensureHeaders_(sheet, headers) {
  const existing = getHeaders_(sheet).filter(Boolean)
  if (existing.length) return existing
  sheet.getRange(1, 1, 1, headers.length).setValues([headers])
  return headers
}

function upsertCustomer_(sheet, customer) {
  const headers = ensureHeaders_(sheet, [
    'customerId',
    'name',
    'nameKana',
    'birthday',
    'address',
    'updatedAt',
    'createdAt',
  ])

  const idCol = headers.indexOf('customerId') + 1
  const lastRow = sheet.getLastRow()
  const now = Date.now()

  if (lastRow < 2) {
    const row = headers.map((h) => {
      if (h === 'customerId') return customer.customerId || ''
      if (h === 'name') return customer.name || ''
      if (h === 'nameKana') return customer.nameKana || ''
      if (h === 'birthday') return customer.birthday || ''
      if (h === 'address') return customer.address || ''
      if (h === 'updatedAt') return now
      if (h === 'createdAt') return now
      return ''
    })
    sheet.appendRow(row)
    return { action: 'insert', row: sheet.getLastRow() }
  }

  const ids = sheet.getRange(2, idCol, lastRow - 1, 1).getValues().map((r) => String(r[0] || ''))
  const idx = ids.findIndex((x) => x === String(customer.customerId || ''))

  if (idx === -1) {
    const row = headers.map((h) => {
      if (h === 'customerId') return customer.customerId || ''
      if (h === 'name') return customer.name || ''
      if (h === 'nameKana') return customer.nameKana || ''
      if (h === 'birthday') return customer.birthday || ''
      if (h === 'address') return customer.address || ''
      if (h === 'updatedAt') return now
      if (h === 'createdAt') return now
      return ''
    })
    sheet.appendRow(row)
    return { action: 'insert', row: sheet.getLastRow() }
  }

  const rowNumber = idx + 2
  const existingRow = sheet.getRange(rowNumber, 1, 1, headers.length).getValues()[0]
  const createdAtIndex = headers.indexOf('createdAt')

  const row = headers.map((h, i) => {
    if (h === 'customerId') return customer.customerId || ''
    if (h === 'name') return customer.name || ''
    if (h === 'nameKana') return customer.nameKana || ''
    if (h === 'birthday') return customer.birthday || ''
    if (h === 'address') return customer.address || ''
    if (h === 'updatedAt') return now
    if (h === 'createdAt') return createdAtIndex >= 0 ? existingRow[createdAtIndex] || now : now
    return existingRow[i] ?? ''
  })

  sheet.getRange(rowNumber, 1, 1, headers.length).setValues([row])
  return { action: 'update', row: rowNumber }
}

function appendRecord_(sheet, rec) {
  const headers = ensureHeaders_(sheet, [
    'recordId',
    'customerId',
    'date',
    'menu',
    'structureScore',
    'lifestyleScore',
    'conditionScore',
    'structureRank',
    'lifestyleRank',
    'conditionRank',
    'rawJson',
    'createdAt',
  ])

  const now = Date.now()
  const row = headers.map((h) => {
    if (h === 'recordId') return rec.recordId || ''
    if (h === 'customerId') return rec.customerId || ''
    if (h === 'date') return rec.date || ''
    if (h === 'menu') return rec.menu || ''
    if (h === 'structureScore') return rec.structureScore ?? 0
    if (h === 'lifestyleScore') return rec.lifestyleScore ?? 0
    if (h === 'conditionScore') return rec.conditionScore ?? 0
    if (h === 'structureRank') return rec.structureRank || ''
    if (h === 'lifestyleRank') return rec.lifestyleRank || ''
    if (h === 'conditionRank') return rec.conditionRank || ''
    if (h === 'rawJson') return JSON.stringify(rec.raw || {})
    if (h === 'createdAt') return now
    return ''
  })

  sheet.appendRow(row)
  return { action: 'append', row: sheet.getLastRow() }
}

function savePdf_(base64Pdf, fileName) {
  const bytes = Utilities.base64Decode(base64Pdf)
  const blob = Utilities.newBlob(bytes, 'application/pdf', fileName || 'carte.pdf')
  const folder = DriveApp.getFolderById(PDF_FOLDER_ID)
  const file = folder.createFile(blob)
  return { fileId: file.getId(), fileName: file.getName() }
}

function doPost(e) {
  try {
    const raw = e?.postData?.contents || ''
    const payload = JSON.parse(raw)

    const ss = SpreadsheetApp.openById(SHEET_ID)
    const customersSheet = ensureSheet_(ss, 'customers')
    const recordsSheet = ensureSheet_(ss, 'records')
    ensureSheet_(ss, 'photos')

    if (payload.type === 'customer') {
      const result = upsertCustomer_(customersSheet, {
        customerId: payload.customerId,
        name: payload.name,
        nameKana: payload.nameKana,
        birthday: payload.birthday,
        address: payload.address,
      })
      return jsonOutput({ status: 'ok', type: 'customer', ...result })
    }

    if (payload.type === 'record') {
      const result = appendRecord_(recordsSheet, payload)
      return jsonOutput({ status: 'ok', type: 'record', ...result })
    }

    if (payload.type === 'pdf') {
      const saved = savePdf_(payload.base64Pdf, payload.fileName)
      return jsonOutput({ status: 'ok', type: 'pdf', ...saved })
    }

    return jsonOutput({ status: 'error', message: 'Unknown type' })
  } catch (err) {
    return jsonOutput({ status: 'error', message: String(err && err.message ? err.message : err) })
  }
}
*/
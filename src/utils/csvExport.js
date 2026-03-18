export function escapeCsvValue(value) {
  if (value == null) return '""'

  let s = ''
  if (typeof value === 'string') {
    s = value
  } else if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    s = String(value)
  } else if (value instanceof Date) {
    s = value.toISOString()
  } else {
    // 配列/オブジェクト等はCSVセルとして安全な文字列にする
    try {
      s = JSON.stringify(value)
    } catch {
      s = String(value)
    }
  }

  // ダブルクォートは "" にエスケープ
  const escaped = s.replace(/"/g, '""')
  // 常にダブルクォートで囲む（カンマ/改行/クォート含みでも安全）
  return `"${escaped}"`
}

export function buildCsv(rows, headers) {
  const hs = Array.isArray(headers) ? headers.map(String) : []
  const rs = Array.isArray(rows) ? rows : []

  const headerLine = hs.map(escapeCsvValue).join(',')
  const dataLines = rs.map((row) => {
    const obj = row && typeof row === 'object' ? row : {}
    return hs.map((h) => escapeCsvValue(obj[h])).join(',')
  })

  // 1行目: ヘッダー / 2行目以降: データ
  return [headerLine, ...dataLines].join('\r\n')
}

export function downloadCsv(fileName, csvContent) {
  const content = String(csvContent ?? '')
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' }) // UTF-8 BOM付き
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // クリック直後にrevokeすると環境によって0バイトになるため、少し遅延させる
  window.setTimeout(() => URL.revokeObjectURL(url), 1500)
}

export function exportScoreSheetCsv({ rows, headers, fileName }) {
  const rs = Array.isArray(rows) ? rows : []
  const hs = Array.isArray(headers) ? headers : []

  console.log('[CSV export] source rows:', rs)

  if (!rs.length) {
    alert('出力データがありません')
    return false
  }
  if (!hs.length) {
    alert('出力項目（ヘッダー）がありません')
    return false
  }

  const csv = buildCsv(rs, hs)
  console.log('[CSV export] csv content:', csv)

  downloadCsv(fileName, csv)
  return true
}


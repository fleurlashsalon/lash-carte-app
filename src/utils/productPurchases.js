/**
 * 施術詳細の「商品」チェックから基本情報の購入一覧用データを組み立てる
 * ext / perm / browWax はメニューに依存せず集約
 */

/** 表示順 */
export const PRODUCT_LABEL_ORDER = [
  'ラッシュアディクト',
  'D1',
  'M3',
  'N4',
  'BK',
  'リンクルクリーム',
]

export const PRODUCT_DETAIL_BLOCK_IDS = ['ext', 'perm', 'browWax']

export function collectProductLabelsFromTreatmentDetails(treatmentDetails) {
  if (!treatmentDetails) return []

  const chosen = new Set()
  for (const blockId of PRODUCT_DETAIL_BLOCK_IDS) {
    const arr = treatmentDetails[blockId]?.products
    if (!Array.isArray(arr)) continue
    for (const v of arr) {
      const s = String(v ?? '').trim()
      if (s) chosen.add(s)
    }
  }
  return PRODUCT_LABEL_ORDER.filter((label) => chosen.has(label))
}

/** 購入一覧の非表示設定キー（storage と App で共通） */
export function getPurchaseCustomerKey(customerId, customerName) {
  const cid = String(customerId || '').trim()
  const name = String(customerName || '').trim()
  if (cid) return `ID:${cid}`
  if (name) return `NOID:${name}`
  return ''
}

function recordMatchesCustomer(rec, { customerId, customerName }) {
  const cid = String(customerId || '').trim()
  const name = String(customerName || '').trim()
  const rid = String(rec?.customerId ?? '').trim()
  if (cid) return rid === cid
  if (!name) return false
  return !rid && String(rec?.customerName ?? '').trim() === name
}

/**
 * @param {Set<string>} [suppressedLabels] 基本情報から隠す商品名（ユーザー削除）
 * @returns {{ label: string, line: string }[]} line 例: ラッシュアディクト（2025/03/15）
 */
export function buildProductPurchaseRows({
  records,
  customerId,
  customerName,
  treatmentDetails,
  visitDate,
  suppressedLabels = new Set(),
}) {
  const latestByProduct = new Map()
  const list = Array.isArray(records) ? records : []
  const sameCustomer = list.filter((r) => recordMatchesCustomer(r, { customerId, customerName }))

  const sorted = [...sameCustomer].sort((a, b) => {
    const da = String(a.visitDate || '')
    const db = String(b.visitDate || '')
    if (da !== db) return da.localeCompare(db)
    return (a.createdAt || 0) - (b.createdAt || 0)
  })

  for (const rec of sorted) {
    const labels = collectProductLabelsFromTreatmentDetails(rec.treatmentDetails)
    const vd = String(rec.visitDate || '').trim()
    for (const label of labels) {
      if (vd) latestByProduct.set(label, vd)
    }
  }

  const draftLabels = collectProductLabelsFromTreatmentDetails(treatmentDetails)
  const draftSet = new Set(draftLabels)
  const visit = String(visitDate || '').trim()

  const union = new Set([...latestByProduct.keys(), ...draftSet])
  const rows = []

  for (const label of PRODUCT_LABEL_ORDER) {
    if (!union.has(label)) continue
    if (suppressedLabels.has(label)) continue
    const showDate = draftSet.has(label)
      ? visit || latestByProduct.get(label) || ''
      : latestByProduct.get(label) || ''
    rows.push({
      label,
      line: showDate ? `${label}（${showDate}）` : label,
    })
  }

  return rows
}

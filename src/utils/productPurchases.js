/**
 * 施術メニュー詳細の「商品」multiselect から、基本情報ヘッダー表示用の購入ラベル一覧を導出する
 */
import { MENU_DETAIL_BLOCKS } from './treatmentFormDefs.js'

export const PRODUCT_LABEL_ORDER = [
  'ラッシュアディクト',
  'D1',
  'M3',
  'N4',
  'BK',
  'リンクルクリーム',
]

export function getSelectedProductLabelsFromTreatment(menuType, treatmentDetails) {
  const blocks = menuType ? MENU_DETAIL_BLOCKS[menuType] : null
  if (!blocks?.length || !treatmentDetails) return []

  const chosen = new Set()
  for (const blockId of blocks) {
    const arr = treatmentDetails[blockId]?.products
    if (!Array.isArray(arr)) continue
    for (const v of arr) {
      const s = String(v ?? '').trim()
      if (s) chosen.add(s)
    }
  }
  return PRODUCT_LABEL_ORDER.filter((label) => chosen.has(label))
}

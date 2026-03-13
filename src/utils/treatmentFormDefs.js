/**
 * 施術メニューとメニューごとの表示ブロック定義
 * フォームは定義オブジェクトベースで管理する
 */

/** 施術メニュー一覧（表示順） */
export const TREATMENT_MENU_OPTIONS = [
  { value: 'エクステ', label: 'エクステ' },
  { value: 'まつ毛パーマ', label: 'まつ毛パーマ' },
  { value: '眉毛ワックス', label: '眉毛ワックス' },
  { value: '&Healthy', label: '&Healthy' },
  { value: 'ExLift', label: 'ExLift' },
  { value: 'エクステ×眉毛ワックス', label: 'エクステ×眉毛ワックス' },
  { value: 'まつ毛パーマ×眉毛ワックス', label: 'まつ毛パーマ×眉毛ワックス' },
  { value: 'エクステワックス', label: 'エクステワックス' },
  { value: 'まつ毛パーマワックス', label: 'まつ毛パーマワックス' },
]

/** メニューごとに表示する詳細ブロック（blockId の配列） */
export const MENU_DETAIL_BLOCKS = {
  'エクステ': ['ext'],
  'まつ毛パーマ': ['perm'],
  '眉毛ワックス': ['browWax'],
  '&Healthy': ['ext', 'perm'],
  'ExLift': ['ext', 'perm'],
  'エクステ×眉毛ワックス': ['ext', 'browWax'],
  'まつ毛パーマ×眉毛ワックス': ['perm', 'browWax'],
  'エクステワックス': ['ext', 'browWax'],
  'まつ毛パーマワックス': ['perm', 'browWax'],
}

/** ブロックの見出しラベル */
export const BLOCK_LABELS = {
  ext: 'エクステ詳細',
  perm: 'まつ毛パーマ詳細',
  browWax: '眉毛ワックス詳細',
}

/** フィールド定義: type = 'text' | 'select' | 'multiselect' */
export const EXT_DETAIL_FIELDS = [
  { id: 'upperCount', label: '上本数', type: 'text' },
  { id: 'lowerCount', label: '下本数', type: 'text' },
  {
    id: 'lashType',
    label: '毛質',
    type: 'select',
    options: [
      { value: 'フラット', label: 'フラット' },
      { value: 'セーブル', label: 'セーブル' },
    ],
  },
  {
    id: 'design',
    label: 'デザイン',
    type: 'select',
    options: [
      { value: '中央', label: '中央' },
      { value: '目尻', label: '目尻' },
      { value: 'MIX', label: 'MIX' },
    ],
  },
  {
    id: 'thickness',
    label: '太さ',
    type: 'select',
    options: [
      { value: '0.15mm', label: '0.15mm' },
      { value: '0.2mm', label: '0.2mm' },
    ],
  },
  {
    id: 'curls',
    label: 'カール',
    type: 'multiselect',
    options: [
      { value: 'Jカール', label: 'Jカール' },
      { value: 'Cカール', label: 'Cカール' },
      { value: 'Dカール', label: 'Dカール' },
      { value: 'DDカール', label: 'DDカール' },
    ],
  },
  {
    id: 'lengths',
    label: '長さ',
    type: 'multiselect',
    options: [
      { value: '6mm', label: '6mm' },
      { value: '7mm', label: '7mm' },
      { value: '8mm', label: '8mm' },
      { value: '9mm', label: '9mm' },
      { value: '10mm', label: '10mm' },
      { value: '11mm', label: '11mm' },
      { value: '12mm', label: '12mm' },
      { value: '13mm', label: '13mm' },
      { value: '14mm', label: '14mm' },
    ],
  },
  {
    id: 'glue',
    label: 'グルー',
    type: 'select',
    options: [
      { value: 'NOMA', label: 'NOMA' },
      { value: 'LED', label: 'LED' },
    ],
  },
  {
    id: 'remove',
    label: 'リムーブ',
    type: 'select',
    options: [
      { value: 'あり', label: 'あり' },
      { value: 'なし', label: 'なし' },
    ],
  },
  {
    id: 'options',
    label: 'オプション',
    type: 'multiselect',
    options: [
      { value: 'ケラチンTR', label: 'ケラチンTR' },
      { value: 'アイSP', label: 'アイSP' },
      { value: 'ティント', label: 'ティント' },
      { value: 'アイクリーム', label: 'アイクリーム' },
      { value: 'アイパック', label: 'アイパック' },
    ],
  },
  {
    id: 'products',
    label: '商品',
    type: 'multiselect',
    options: [
      { value: 'ラッシュアディクト', label: 'ラッシュアディクト' },
      { value: 'D1', label: 'D1' },
      { value: 'M3', label: 'M3' },
      { value: 'N4', label: 'N4' },
      { value: 'BK', label: 'BK' },
      { value: 'リンクルクリーム', label: 'リンクルクリーム' },
    ],
  },
]

export const PERM_DETAIL_FIELDS = [
  {
    id: 'menu',
    label: 'メニュー',
    type: 'select',
    options: [
      { value: 'まつげパーマ', label: 'まつげパーマ' },
      { value: 'ラッシュリフト', label: 'ラッシュリフト' },
      { value: 'メーテル', label: 'メーテル' },
      { value: '韓ドル', label: '韓ドル' },
    ],
  },
  {
    id: 'rod',
    label: 'ロッド',
    type: 'select',
    options: [
      { value: 'ペッタ', label: 'ペッタ' },
      { value: 'シェル', label: 'シェル' },
      { value: 'Cカール', label: 'Cカール' },
      { value: '水餃子', label: '水餃子' },
      { value: '猫', label: '猫' },
      { value: 'リボン', label: 'リボン' },
      { value: 'ハンサム', label: 'ハンサム' },
      { value: '韓ドル', label: '韓ドル' },
      { value: 'メーテル', label: 'メーテル' },
      { value: 'アイドール', label: 'アイドール' },
    ],
  },
  {
    id: 'sizes',
    label: 'サイズ',
    type: 'multiselect',
    options: [
      { value: 'XS', label: 'XS' },
      { value: 'S', label: 'S' },
      { value: 'M', label: 'M' },
      { value: 'M1', label: 'M1' },
      { value: 'L', label: 'L' },
      { value: 'XL', label: 'XL' },
      { value: 'XXL', label: 'XXL' },
    ],
  },
  { id: 'processingTime1', label: '放置時間（1液）', type: 'text' },
  { id: 'processingTime2', label: '放置時間（2液）', type: 'text' },
  {
    id: 'options',
    label: 'オプション',
    type: 'multiselect',
    options: [
      { value: 'ケラチンTR', label: 'ケラチンTR' },
      { value: 'アイSP', label: 'アイSP' },
      { value: 'ティント', label: 'ティント' },
      { value: 'シンプル', label: 'シンプル' },
      { value: 'アイパック', label: 'アイパック' },
      { value: 'アイクリーム', label: 'アイクリーム' },
    ],
  },
  {
    id: 'products',
    label: '商品',
    type: 'multiselect',
    options: [
      { value: 'ラッシュアディクト', label: 'ラッシュアディクト' },
      { value: 'D1', label: 'D1' },
      { value: 'M3', label: 'M3' },
      { value: 'N4', label: 'N4' },
      { value: 'BK', label: 'BK' },
      { value: 'リンクルクリーム', label: 'リンクルクリーム' },
    ],
  },
]

export const BROW_WAX_DETAIL_FIELDS = [
  { id: 'type', label: 'タイプ', type: 'text', placeholder: '眉' },
  {
    id: 'skinType',
    label: '肌質',
    type: 'select',
    options: [
      { value: 'デリケート', label: 'デリケート' },
      { value: '油性', label: '油性' },
      { value: '普通', label: '普通' },
      { value: '強い', label: '強い' },
    ],
  },
  {
    id: 'finishImage',
    label: '仕上がりイメージ',
    type: 'select',
    options: [
      { value: 'ナチュラル', label: 'ナチュラル' },
      { value: 'オトナっぽい', label: 'オトナっぽい' },
      { value: 'キュート', label: 'キュート' },
      { value: 'クール', label: 'クール' },
    ],
  },
  {
    id: 'options',
    label: 'オプション',
    type: 'multiselect',
    options: [
      { value: 'アイクリーム', label: 'アイクリーム' },
      { value: 'アイパック', label: 'アイパック' },
    ],
  },
  {
    id: 'products',
    label: '商品',
    type: 'multiselect',
    options: [
      { value: 'ラッシュアディクト', label: 'ラッシュアディクト' },
      { value: 'D1', label: 'D1' },
      { value: 'M3', label: 'M3' },
      { value: 'N4', label: 'N4' },
      { value: 'BK', label: 'BK' },
      { value: 'リンクルクリーム', label: 'リンクルクリーム' },
    ],
  },
]

export const BLOCK_FIELDS = {
  ext: EXT_DETAIL_FIELDS,
  perm: PERM_DETAIL_FIELDS,
  browWax: BROW_WAX_DETAIL_FIELDS,
}

/** 新フォーム（メニュー別詳細）を表示するメニューか */
export function isNewTreatmentMenu(menu) {
  return menu && Object.prototype.hasOwnProperty.call(MENU_DETAIL_BLOCKS, menu)
}

/** ブロック内のフィールドラベルを取得（表示用） */
export function getFieldLabel(blockId, fieldId) {
  const fields = BLOCK_FIELDS[blockId] || []
  const f = fields.find((x) => x.id === fieldId)
  return f ? f.label : fieldId
}

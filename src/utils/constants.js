export const MENU_OPTIONS = [
  // エクステ系
  { label: 'フラットラッシュ', value: 'フラットラッシュ' },
  { label: 'セーブル', value: 'セーブル' },
  { label: '＆healthy', value: '＆healthy' },
  { label: 'ExLift', value: 'ExLift' },
  // パーマ系
  { label: 'パーマ', value: 'パーマ' },
  { label: 'ラッシュリフト', value: 'ラッシュリフト' },
  { label: 'シンプリ', value: 'シンプリ' },
  { label: 'シンプリラッシュリフト', value: 'シンプリラッシュリフト' },
  { label: 'マスカラパーマ', value: 'マスカラパーマ' },
  { label: 'ケラチンパーマ', value: 'ケラチンパーマ' },
]

export const EXTENSION_MENUS = ['フラットラッシュ', 'セーブル', '＆healthy', 'ExLift']
export const PERM_MENUS = [
  'パーマ',
  'ラッシュリフト',
  'シンプリ',
  'シンプリラッシュリフト',
  'マスカラパーマ',
  'ケラチンパーマ',
]

export const STRUCTURE_QUESTIONS = [
  {
    key: 'eyeShape',
    label: '目の形',
    options: [
      { label: '二重/切れ/たれ/つり', value: 5 },
      { label: '出目', value: 4 },
      { label: '奥二重', value: 3 },
      { label: 'ほほ高', value: 2 },
      { label: '一重', value: 1 },
    ],
  },
  {
    key: 'eyelid',
    label: 'まぶた',
    options: [
      { label: '薄目', value: 5 },
      { label: 'やや薄目', value: 4 },
      { label: '標準', value: 3 },
      { label: 'やや厚め', value: 2 },
      { label: '厚め', value: 1 },
    ],
  },
  {
    key: 'lashDirection',
    label: '毛の向き',
    options: [
      { label: '上向き', value: 5 },
      { label: '水平', value: 4 },
      { label: '下向き', value: 3 },
      { label: '外、内向き', value: 2 },
      { label: 'うねりまつ毛', value: 1 },
    ],
  },
  {
    key: 'asymmetry',
    label: '左右差',
    options: [
      { label: 'なし', value: 5 },
      { label: '多少', value: 3 },
      { label: '多い', value: 1 },
    ],
  },
]

export const LIFESTYLE_QUESTIONS_COMMON = [
  {
    key: 'sleepPosture',
    label: '寝姿勢',
    options: [
      { label: '仰向け', value: 5 },
      { label: '横向き', value: 3 },
      { label: 'うつ伏せ', value: 1 },
    ],
  },
  {
    key: 'makeup',
    label: 'メイク',
    options: [
      { label: 'コーティング', value: 5 },
      { label: 'しない', value: 4 },
      { label: 'マスカラ', value: 2 },
      { label: 'ビューラー', value: 1 },
    ],
  },
  {
    key: 'faceWash',
    label: '洗顔',
    options: [
      { label: 'ノンオイル', value: 5 },
      { label: 'フォーム', value: 4 },
      { label: 'ジェル', value: 3 },
      { label: 'ふき取り', value: 2 },
      { label: 'オイル', value: 1 },
    ],
  },
]

export const WORK_ENV_EXTENSIONS = {
  key: 'workEnvironment',
  label: '仕事環境（エクステ）',
  options: [
    { label: '室内', value: 5 },
    { label: 'マスク', value: 4 },
    { label: '外仕事', value: 3 },
    { label: '油分/粉塵', value: 2 },
    { label: '高温多湿', value: 1 },
  ],
}

export const WORK_ENV_PERM = {
  key: 'workEnvironment',
  label: '仕事環境（パーマ）',
  options: [
    { label: '室内', value: 5 },
    { label: '油分/粉塵', value: 4 },
    { label: 'マスク', value: 3 },
    { label: '外仕事', value: 2 },
    { label: '高温多湿', value: 1 },
  ],
}

export const CONDITION_QUESTIONS = [
  {
    key: 'thickness',
    label: '毛の太さ',
    options: [
      { label: '太い', value: 5 },
      { label: 'やや太い', value: 4 },
      { label: '標準', value: 3 },
      { label: 'やや細い', value: 2 },
      { label: '細い', value: 1 },
    ],
  },
  {
    key: 'density',
    label: '密度',
    options: [
      { label: '多い', value: 5 },
      { label: 'やや多い', value: 4 },
      { label: '標準', value: 3 },
      { label: 'やや少ない', value: 2 },
      { label: '少ない', value: 1 },
    ],
  },
  {
    key: 'turnover',
    label: '生え変わり',
    options: [
      { label: '少ない', value: 5 },
      { label: 'やや少ない', value: 4 },
      { label: '標準', value: 3 },
      { label: 'やや多い', value: 2 },
      { label: '多い', value: 1 },
    ],
  },
  {
    key: 'moisture',
    label: '水分量',
    options: [
      { label: '標準', value: 5 },
      { label: '乾燥気味', value: 4 },
      { label: '乾燥', value: 3 },
      { label: '油性', value: 2 },
      { label: '油分過多', value: 1 },
    ],
  },
  {
    key: 'habit',
    label: '生え癖',
    options: [
      { label: 'なし', value: 5 },
      { label: '部分的', value: 3 },
      { label: '多い', value: 1 },
    ],
  },
]

export const MAX_SCORES = {
  structure: 20,
  lifestyle: 23,
  condition: 25,
}


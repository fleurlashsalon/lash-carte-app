/**
 * jsPDF に日本語フォントを登録する（12pt で出力）
 * jsPDF は TTF の unicode cmap 等に厳しいため、互換性の高い順に試す。
 * 1. public/fonts/NotoSansJP-Regular.ttf
 * 2. CDN の Noto Sans JP（変数フォントは失敗することがあるためフォールバック）
 * 3. public/fonts/Meiryo.ttf（環境によっては「フォントが正しくない」となる場合あり）
 */

let cached = null

const FONT_OPTIONS = [
  { url: '/fonts/NotoSansJP-Regular.ttf', vfsName: 'NotoSansJP-Regular.ttf', faceName: 'NotoSansJP' },
  {
    url: 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/notosansjp/NotoSansJP%5Bwght%5D.ttf',
    vfsName: 'NotoSansJP-Regular.ttf',
    faceName: 'NotoSansJP',
  },
  { url: '/fonts/Meiryo.ttf', vfsName: 'Meiryo.ttf', faceName: 'Meiryo' },
]

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return typeof btoa !== 'undefined' ? btoa(binary) : null
}

async function fetchFontAsBase64(url) {
  const res = await fetch(url, { mode: 'cors' })
  if (!res.ok) return null
  const buffer = await res.arrayBuffer()
  return arrayBufferToBase64(buffer)
}

function registerFont(doc, opt, base64) {
  doc.addFileToVFS(opt.vfsName, base64)
  doc.addFont(opt.vfsName, opt.faceName, 'normal')
  doc.addFont(opt.vfsName, opt.faceName, 'bold')
  doc.setFont(opt.faceName, 'normal')
  doc.setFontSize(12)
}

/**
 * 日本語フォントを jsPDF に登録し、12pt でフォントを設定する
 * @param {import('jspdf').jsPDF} doc
 * @returns {Promise<string|null>} 使用したフォント名、失敗時は null
 */
export async function loadJapaneseFont(doc) {
  if (!doc || typeof doc.addFileToVFS !== 'function') return null

  if (cached) {
    try {
      registerFont(doc, cached, cached.base64)
      return cached.faceName
    } catch (e) {
      cached = null
    }
  }

  for (const opt of FONT_OPTIONS) {
    try {
      const base64 = await fetchFontAsBase64(opt.url)
      if (!base64) continue
      registerFont(doc, opt, base64)
      cached = { base64, vfsName: opt.vfsName, faceName: opt.faceName }
      return opt.faceName
    } catch (e) {
      console.warn('loadJapaneseFont:', opt.faceName, opt.url, e)
      continue
    }
  }

  return null
}

export const PDF_BODY_FONT_SIZE = 12

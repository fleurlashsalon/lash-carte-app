import { useEffect, useMemo, useRef, useState } from 'react'
import { toPng } from 'html-to-image'
import { jsPDF } from 'jspdf'
import SectionCard from './components/SectionCard.jsx'
import BasicInfoForm from './components/BasicInfoForm.jsx'
import HorizontalRadioGroup from './components/HorizontalRadioGroup.jsx'
import ScoreSummary from './components/ScoreSummary.jsx'
import RadarScoreChart from './components/RadarScoreChart.jsx'
import HistoryList from './components/HistoryList.jsx'
import ImageUploadField from './components/ImageUploadField.jsx'
import {
  CONDITION_QUESTIONS,
  LIFESTYLE_QUESTIONS_COMMON,
  STRUCTURE_QUESTIONS,
  WORK_ENV_EXTENSIONS,
  WORK_ENV_PERM,
} from './utils/constants.js'
import { createId, getTodayString, isExtensionMenu, isPermMenu } from './utils/helpers.js'
import {
  getConditionRank,
  getConditionScore,
  getLifestyleRank,
  getLifestyleScore,
  getStructureRank,
  getStructureScore,
  normalizeScore,
} from './utils/scoring.js'
import {
  deleteRecord,
  getRecords,
  isGoogleConfigured,
  replaceRecords,
  savePdfToGoogle,
  saveRecord,
  saveToGoogle,
} from './utils/storage.js'
import { loadJapaneseFont } from './utils/pdfFont.js'

const INITIAL_FORM = {
  eyeShape: undefined,
  eyelid: undefined,
  lashDirection: undefined,
  asymmetry: undefined,
  workEnvironment: undefined,
  sleepPosture: undefined,
  makeup: undefined,
  faceWash: undefined,
  ledChecked: false,
  thickness: undefined,
  density: undefined,
  turnover: undefined,
  moisture: undefined,
  habit: undefined,
}

function dataUrlToBase64(dataUrl) {
  return dataUrl.split(',')[1]
}

export default function App() {
  const [customerId, setCustomerId] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerKana, setCustomerKana] = useState('')
  const [birthday, setBirthday] = useState('')
  const [address, setAddress] = useState('')
  const [visitDate, setVisitDate] = useState(getTodayString())
  const [menuType, setMenuType] = useState('')
  const [formValues, setFormValues] = useState(INITIAL_FORM)
  const [images, setImages] = useState([])
  const [errors, setErrors] = useState({})
  const [records, setRecords] = useState([])
  const [currentId, setCurrentId] = useState(null)
  const [currentCreatedAt, setCurrentCreatedAt] = useState(null)
  const [searchText, setSearchText] = useState('')
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [compareIds, setCompareIds] = useState([])
  const [imageModalRecord, setImageModalRecord] = useState(null)
  const [csvMenuOpen, setCsvMenuOpen] = useState(false)
  const csvInputRef = useRef(null)
  const customerNameRef = useRef(customerName)
  const HISTORY_PAGE_SIZE = 10
  const [historyPage, setHistoryPage] = useState(1)

  useEffect(() => {
    setRecords(getRecords())
  }, [])

  function getCustomerIdFromRecord(rec) {
    return String(rec.customerId || '').trim()
  }

  /** 顧客ID未入力時用: A-00001, A-00002, ... の次の番号を採番 */
  function getNextAutoCustomerId() {
    const used = records
      .map((r) => String(r.customerId || '').trim())
      .filter((id) => /^A-\d+$/.test(id))
    const numbers = used.map((id) => parseInt(id.replace(/^A-/, ''), 10)).filter((n) => !Number.isNaN(n))
    const next = numbers.length ? Math.max(...numbers) + 1 : 1
    return `A-${String(next).padStart(5, '0')}`
  }

  /** お客様名で既存顧客を検索（直近の履歴1件を返す） */
  function findExistingCustomerByName(name) {
    const n = String(name || '').trim()
    if (!n) return null
    const matches = records.filter((r) => (r.customerName || '').trim() === n)
    if (!matches.length) return null
    const sorted = [...matches].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    return sorted[0]
  }

  const menuFlags = useMemo(() => {
    return {
      isPerm: isPermMenu(menuType),
      isExt: isExtensionMenu(menuType),
    }
  }, [menuType])

  const structureScore = useMemo(() => getStructureScore(formValues), [formValues])
  const lifestyleScore = useMemo(() => getLifestyleScore(formValues), [formValues])
  const conditionScore = useMemo(() => getConditionScore(formValues), [formValues])

  const structureRank = useMemo(() => getStructureRank(structureScore), [structureScore])
  const lifestyleRank = useMemo(() => getLifestyleRank(lifestyleScore), [lifestyleScore])
  const conditionRank = useMemo(() => getConditionRank(conditionScore), [conditionScore])

  const chartData = useMemo(() => {
    return [
      { subject: '構造', score: normalizeScore(structureScore, 20) },
      { subject: 'ライフスタイル', score: normalizeScore(lifestyleScore, 23) },
      { subject: '状態', score: normalizeScore(conditionScore, 25) },
    ]
  }, [structureScore, lifestyleScore, conditionScore])

  const customerList = useMemo(() => {
    const map = new Map()

    records.forEach((rec) => {
      const id = getCustomerIdFromRecord(rec)
      if (!id) return
      if (!map.has(id)) {
        map.set(id, {
          customerId: id,
          customerName: rec.customerName || '',
          customerKana: rec.customerKana || '',
          birthday: rec.birthday || '',
          address: rec.address || '',
        })
      }
    })

    return Array.from(map.values())
  }, [records])

  // 検索テキストが顧客IDと完全一致している場合のみ、そのIDをマッチとして扱う
  const matchedCustomerId = useMemo(() => {
    const keyword = searchText.trim().toLowerCase()
    if (!keyword) return ''
    const hit = customerList.find((c) => (c.customerId || '').toLowerCase() === keyword)
    return hit?.customerId || ''
  }, [customerList, searchText])

  const searchedCustomers = useMemo(() => {
    const keyword = searchText.trim().toLowerCase()
    if (!keyword) return []

    const idMatches = customerList.filter((c) => {
      const id = (c.customerId || '').toLowerCase()
      return id === keyword
    })
    if (idMatches.length) return idMatches

    // ID完全一致がなければ氏名/カナの部分一致で検索
    return customerList.filter((c) => {
      const name = (c.customerName || '').toLowerCase()
      const kana = (c.customerKana || '').toLowerCase()
      return name.includes(keyword) || kana.includes(keyword)
    })
  }, [customerList, searchText])

  const visibleRecords = useMemo(() => {
    const id = matchedCustomerId
    if (!id) return []

    const sorted = [...records].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    return sorted.filter((rec) => getCustomerIdFromRecord(rec) === id)
  }, [records, matchedCustomerId])

  const historyTotalPages = Math.max(1, Math.ceil(visibleRecords.length / HISTORY_PAGE_SIZE))
  const paginatedRecords = useMemo(() => {
    const start = (historyPage - 1) * HISTORY_PAGE_SIZE
    return visibleRecords.slice(start, start + HISTORY_PAGE_SIZE)
  }, [visibleRecords, historyPage])

  useEffect(() => {
    setHistoryPage(1)
  }, [matchedCustomerId, visibleRecords.length])

  const compareRecords = useMemo(() => {
    return visibleRecords.filter((rec) => compareIds.includes(rec.id))
  }, [visibleRecords, compareIds])

  const compareChartData = useMemo(() => {
    if (!compareRecords.length) return []

    return [
      { subject: '構造' },
      { subject: 'ライフスタイル' },
      { subject: '状態' },
    ].map((row) => {
      const next = { ...row }

      compareRecords.slice(0, 3).forEach((rec, index) => {
        const key = `series_${index}`

        if (row.subject === '構造') next[key] = normalizeScore(rec.structureScore || 0, 20)
        if (row.subject === 'ライフスタイル') next[key] = normalizeScore(rec.lifestyleScore || 0, 23)
        if (row.subject === '状態') next[key] = normalizeScore(rec.conditionScore || 0, 25)
      })

      return next
    })
  }, [compareRecords])

  const compareSeries = useMemo(() => {
    return compareRecords.slice(0, 3).map((rec, index) => ({
      key: `series_${index}`,
      name: `${rec.visitDate || '日付未設定'} / ${rec.menuType || '未選択'}`,
    }))
  }, [compareRecords])

  function updateBasicInfo(patch) {
    if (Object.prototype.hasOwnProperty.call(patch, 'customerId')) setCustomerId(patch.customerId)
    if (Object.prototype.hasOwnProperty.call(patch, 'customerName')) setCustomerName(patch.customerName)
    if (Object.prototype.hasOwnProperty.call(patch, 'customerKana')) setCustomerKana(patch.customerKana)
    if (Object.prototype.hasOwnProperty.call(patch, 'birthday')) setBirthday(patch.birthday)
    if (Object.prototype.hasOwnProperty.call(patch, 'address')) setAddress(patch.address)
    if (Object.prototype.hasOwnProperty.call(patch, 'visitDate')) setVisitDate(patch.visitDate)

    if (Object.prototype.hasOwnProperty.call(patch, 'menuType')) {
      const nextMenu = patch.menuType
      const prevIsPerm = isPermMenu(menuType)
      const prevIsExt = isExtensionMenu(menuType)
      const nextIsPerm = isPermMenu(nextMenu)
      const nextIsExt = isExtensionMenu(nextMenu)

      setMenuType(nextMenu)

      setFormValues((prev) => {
        const switchedCategory = prevIsPerm !== nextIsPerm || prevIsExt !== nextIsExt
        if (!switchedCategory) return prev
        return { ...prev, workEnvironment: undefined }
      })
    }

    setErrors((prev) => ({
      ...prev,
      ...Object.fromEntries(Object.keys(patch).map((k) => [k, undefined])),
    }))
  }

  function setAnswer(key, value) {
    setFormValues((prev) => ({ ...prev, [key]: value }))
  }

  function validate() {
    const next = {}

    if (!customerName.trim()) next.customerName = 'お客様名を入力してください'

    const id = customerId.trim()
    const name = customerName.trim()
    if (id && name) {
      const existingWithSameId = records.filter(
        (r) => getCustomerIdFromRecord(r) === id && r.id !== currentId,
      )
      if (existingWithSameId.length > 0) {
        const registeredName = (existingWithSameId[0].customerName || '').trim()
        if (registeredName && registeredName !== name) {
          next.customerName = '使用済みの顧客IDです、お客様名を確認してください'
        }
      }
    }

    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleSave() {
    if (!validate()) return

    let effectiveCustomerId = customerId.trim()
    if (!effectiveCustomerId && customerName.trim()) {
      const existing = findExistingCustomerByName(customerName)
      if (existing) {
        const msg = `お客様名「${customerName.trim()}」は顧客ID「${existing.customerId}」で登録済みです。\nこのお客様の情報を読み込みますか？\n\nOK → 情報を読み込む\nキャンセル → そのまま新規登録（新しい顧客IDを採番）`
        if (window.confirm(msg)) {
          handleLoadBasicInfoOnly(existing)
          return
        }
      }
      effectiveCustomerId = getNextAutoCustomerId()
      setCustomerId(effectiveCustomerId)
    }

    // 毎回新しい履歴として保存する（過去履歴を上書きしない）
    const id = createId()
    const createdAt = Date.now()

    const record = {
      id,
      customerId: effectiveCustomerId,
      customerName: customerName.trim(),
      customerKana: customerKana?.trim?.() || '',
      birthday: birthday || '',
      address: address?.trim?.() || '',
      visitDate: visitDate || '',
      menuType: menuType || '',
      formValues,
      structureScore,
      structureRank,
      lifestyleScore,
      lifestyleRank,
      conditionScore,
      conditionRank,
      images: images || [],
      createdAt,
    }

    const next = saveRecord(record)
    setRecords(next)
    setCurrentId(id)
    setCurrentCreatedAt(createdAt)
    setSelectedCustomerId(record.customerId)

    if (!isGoogleConfigured()) {
      alert('ローカル保存が完了しました（Google保存は未設定です）')
      return
    }

    try {
      await saveToGoogle({
        type: 'customer',
        customerId: record.customerId,
        name: customerName.trim(),
        nameKana: record.customerKana,
        birthday: record.birthday,
        address: record.address,
      })

      await saveToGoogle({
        type: 'record',
        recordId: id,
        customerId: record.customerId,
        date: record.visitDate,
        menu: record.menuType,
        structureScore,
        lifestyleScore,
        conditionScore,
        structureRank,
        lifestyleRank,
        conditionRank,
        raw: {
          customerId: record.customerId,
          customerName: record.customerName,
          customerKana: record.customerKana,
          birthday: record.birthday,
          address: record.address,
          visitDate: record.visitDate,
          menuType: record.menuType,
          formValues,
          imagesCount: (record.images || []).length,
        },
      })

      if (record.images?.length) {
        for (const img of record.images) {
          await saveToGoogle({
            type: 'photo',
            recordId: id,
            customerId: record.customerId,
            visitDate: record.visitDate,
            fileName: img.name || 'photo.png',
            mimeType: img.type || 'image/png',
            base64Image: String(img.dataUrl || '').split(',')[1] || '',
          })
        }
      }

      alert('ローカル保存とGoogle保存が完了しました')
    } catch (error) {
      console.error('Google保存エラー:', error)
      alert('ローカル保存は完了しましたが、Google保存に失敗しました')
    }
  }

  async function handlePdfExport() {
    try {
      const currentChartNode = document.getElementById('pdf-current-chart')
      const compareChartNode = document.getElementById('pdf-compare-chart')

      const doc = new jsPDF('p', 'mm', 'a4')
      let y = 16

      const pdfFontName = await loadJapaneseFont(doc)
      if (!pdfFontName) {
        console.warn('日本語フォントを読み込めませんでした。PDFの文字が正しく表示されない場合があります。public/fonts/ に Meiryo.ttf または NotoSansJP-Regular.ttf を配置してください。')
      }

      const fontForPdf = pdfFontName || 'helvetica'
      doc.setFont(fontForPdf, 'bold')
      doc.setFontSize(18)
      doc.text('FleurLash Carte', 14, y)
      y += 10

      doc.setFont(fontForPdf, 'normal')
      doc.setFontSize(12)
      doc.text(`顧客ID: ${customerId || ''}`, 14, y)
      y += 7
      doc.text(`氏名: ${customerName || ''}`, 14, y)
      y += 7
      doc.text(`氏名（カナ）: ${customerKana || ''}`, 14, y)
      y += 7
      doc.text(`生年月日: ${birthday || ''}`, 14, y)
      y += 7
      doc.text(`住所: ${address || ''}`, 14, y)
      y += 7
      doc.text(`施術日: ${visitDate || ''}`, 14, y)
      y += 7
      doc.text(`施術メニュー: ${menuType || ''}`, 14, y)
      y += 10

      if (currentChartNode) {
        const currentPng = await toPng(currentChartNode, {
          cacheBust: true,
          backgroundColor: '#ffffff',
          pixelRatio: 3,
        })
        doc.setFont(fontForPdf, 'bold')
        doc.text('現在のレーダーチャート', 14, y)
        y += 4
        doc.addImage(currentPng, 'PNG', 14, y, 180, 78)
        y += 86
      }

      if (compareChartNode && compareRecords.length) {
        if (y > 180) {
          doc.addPage()
          y = 16
        }

        const comparePng = await toPng(compareChartNode, {
          cacheBust: true,
          backgroundColor: '#ffffff',
          pixelRatio: 3,
        })

        doc.setFont(fontForPdf, 'bold')
        doc.text('過去比較レーダーチャート', 14, y)
        y += 4
        doc.addImage(comparePng, 'PNG', 14, y, 180, 78)
        y += 86
      }

      const imagesNode = document.getElementById('pdf-images')
      if (imagesNode && images.length) {
        if (y > 180) {
          doc.addPage()
          y = 16
        }

        const imagesPng = await toPng(imagesNode, {
          cacheBust: true,
          backgroundColor: '#ffffff',
          pixelRatio: 2,
        })
        doc.setFont(fontForPdf, 'bold')
        doc.text('画像', 14, y)
        y += 4
        doc.addImage(imagesPng, 'PNG', 14, y, 180, 78)
      }

      const pdfDataUri = doc.output('datauristring')
      const base64Pdf = dataUrlToBase64(pdfDataUri)
      const safeName = (customerName || 'customer').replace(/[\\/:*?"<>|]/g, '_')
      const fileName = `${safeName}_${visitDate || 'nodate'}.pdf`

      // ローカルPDF出力（必ず動く）
      doc.save(fileName)

      // Google Drive保存（設定されている場合のみ）
      if (isGoogleConfigured()) {
        const result = await savePdfToGoogle({
          customerId: selectedCustomerId || customerId.trim() || '',
          fileName,
          base64Pdf,
        })

        if (result?.status === 'ok') {
          alert(`PDF出力（ローカル）とGoogle Drive保存が完了しました\n${result.fileName}`)
        } else {
          alert('PDFはローカル出力しましたが、Google Drive保存に失敗しました')
        }
      } else {
        alert('PDFをローカルに出力しました（Google Drive保存は未設定です）')
      }
    } catch (error) {
      console.error('PDF export error:', error)
      alert('PDF出力またはGoogle Drive保存に失敗しました')
    }
  }

  function handleRefresh() {
    setCustomerId('')
    setCustomerName('')
    setCustomerKana('')
    setBirthday('')
    setAddress('')
    setVisitDate(getTodayString())
    setMenuType('')
    setFormValues(INITIAL_FORM)
    setImages([])
    setErrors({})
    setCurrentId(null)
    setCurrentCreatedAt(null)
    setSelectedCustomerId('')
    setCompareIds([])
  }

  function handleLoad(rec) {
    setCustomerId(rec.customerId || '')
    setCustomerName(rec.customerName || '')
    setCustomerKana(rec.customerKana || '')
    setBirthday(rec.birthday || '')
    setAddress(rec.address || '')
    setVisitDate(rec.visitDate || getTodayString())
    setMenuType(rec.menuType || '')
    setFormValues({ ...INITIAL_FORM, ...(rec.formValues || {}) })
    setImages(Array.isArray(rec.images) ? rec.images : [])
    setErrors({})
    setCurrentId(rec.id)
    setCurrentCreatedAt(rec.createdAt || Date.now())
    setSelectedCustomerId(getCustomerIdFromRecord(rec))
    setCompareIds([])
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  /** 登録済み同名ポップアップでYESのとき：基本情報のみ反映（スコア・ラジオ・画像は反映しない） */
  function handleLoadBasicInfoOnly(rec) {
    setCustomerId(rec.customerId || '')
    setCustomerName(rec.customerName || '')
    setCustomerKana(rec.customerKana || '')
    setBirthday(rec.birthday || '')
    setAddress(rec.address || '')
    setVisitDate(rec.visitDate || getTodayString())
    setMenuType(rec.menuType || '')
    setFormValues(INITIAL_FORM)
    setImages([])
    setErrors({})
    setSelectedCustomerId(getCustomerIdFromRecord(rec))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleDelete(id) {
    const next = deleteRecord(id)
    setRecords(next)
    setCompareIds((prev) => prev.filter((x) => x !== id))
    if (currentId === id) {
      handleRefresh()
    }
  }

  function handleSelectCustomer(customerIdValue) {
    setSelectedCustomerId(customerIdValue)
    setCompareIds([])
  }

  /** お客様名の入力が離れたとき、登録済み同名なら読み込み確認 */
  function handleCustomerNameBlur() {
    const name = customerName.trim()
    if (!name) return
    const existing = findExistingCustomerByName(name)
    if (!existing) return
    if (currentId === existing.id) return
    const msg = `お客様名「${name}」は顧客ID「${existing.customerId}」で登録済みです。\nこのお客様の情報を読み込みますか？\n\nOK → 情報を読み込む\nキャンセル → そのまま入力続行（新規登録）`
    if (window.confirm(msg)) {
      handleLoadBasicInfoOnly(existing)
    }
  }

  /** お客様名を入力した時点で、登録済み同名ならポップアップ（3ms デバウンス） */
  customerNameRef.current = customerName
  useEffect(() => {
    const id = setTimeout(() => {
      const name = customerNameRef.current.trim()
      if (!name) return
      const existing = findExistingCustomerByName(name)
      if (!existing) return
      if (currentId === existing.id) return
      const msg = `お客様名「${name}」は顧客ID「${existing.customerId}」で登録済みです。\nこのお客様の情報を読み込みますか？\n\nOK → 情報を読み込む\nキャンセル → そのまま入力続行（新規登録）`
      if (window.confirm(msg)) {
        handleLoadBasicInfoOnly(existing)
      }
    }, 3)
    return () => clearTimeout(id)
  }, [customerName, records, currentId])

  function handleToggleCompare(id) {
    setCompareIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((x) => x !== id)
      }

      if (prev.length >= 3) {
        alert('比較は最大3件までです')
        return prev
      }

      return [...prev, id]
    })
  }

  function handleOpenImages(rec) {
    setImageModalRecord(rec)
  }

  function handleCloseImages() {
    setImageModalRecord(null)
  }

  function buildCsv(rows, headers) {
    const escape = (value) => {
      const v = value == null ? '' : String(value)
      const escaped = v.replace(/"/g, '""')
      return `"${escaped}"`
    }
    const headerLine = headers.map(escape).join(',')
    const dataLines = rows.map((row) => headers.map((h) => escape(row[h])).join(','))
    const csv = [headerLine, ...dataLines].join('\r\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    return URL.createObjectURL(blob)
  }

  function handleExportCsv(mode) {
    if (!records.length) {
      alert('エクスポートできる履歴がありません')
      return
    }

    let rows = []
    let headers = []
    const now = new Date()
    const ts = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(
      now.getDate(),
    ).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(
      now.getMinutes(),
    ).padStart(2, '0')}`
    let fileName = `fleur-carte-${mode}-${ts}.csv`

    if (mode === 'byCustomer') {
      const map = new Map()
      const sorted = [...records].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      sorted.forEach((r) => {
        const id = r.customerId || ''
        if (!id || map.has(id)) return
        const count = records.filter((x) => x.customerId === id).length
        map.set(id, {
          customerId: id,
          customerName: r.customerName || '',
          customerKana: r.customerKana || '',
          birthday: r.birthday || '',
          address: r.address || '',
          lastVisitDate: r.visitDate || '',
          lastMenuType: r.menuType || '',
          lastStructureScore: r.structureScore ?? '',
          lastLifestyleScore: r.lifestyleScore ?? '',
          lastConditionScore: r.conditionScore ?? '',
          recordCount: count,
        })
      })
      rows = Array.from(map.values())
      headers = [
        'customerId',
        'customerName',
        'customerKana',
        'birthday',
        'address',
        'lastVisitDate',
        'lastMenuType',
        'lastStructureScore',
        'lastLifestyleScore',
        'lastConditionScore',
        'recordCount',
      ]
    } else if (mode === 'byCustomerDate') {
      rows = records
        .slice()
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
        .map((r) => ({
          customerId: r.customerId || '',
          visitDate: r.visitDate || '',
          menuType: r.menuType || '',
          structureScore: r.structureScore ?? '',
          lifestyleScore: r.lifestyleScore ?? '',
          conditionScore: r.conditionScore ?? '',
          structureRank: r.structureRank ?? '',
          lifestyleRank: r.lifestyleRank ?? '',
          conditionRank: r.conditionRank ?? '',
          imagesCount: Array.isArray(r.images) ? r.images.length : 0,
        }))
      headers = [
        'customerId',
        'visitDate',
        'menuType',
        'structureScore',
        'lifestyleScore',
        'conditionScore',
        'structureRank',
        'lifestyleRank',
        'conditionRank',
        'imagesCount',
      ]
    } else if (mode === 'all') {
      rows = records
        .slice()
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
        .map((r) => ({
          id: r.id,
          customerId: r.customerId || '',
          customerName: r.customerName || '',
          customerKana: r.customerKana || '',
          birthday: r.birthday || '',
          address: r.address || '',
          visitDate: r.visitDate || '',
          menuType: r.menuType || '',
          structureScore: r.structureScore ?? '',
          lifestyleScore: r.lifestyleScore ?? '',
          conditionScore: r.conditionScore ?? '',
          structureRank: r.structureRank ?? '',
          lifestyleRank: r.lifestyleRank ?? '',
          conditionRank: r.conditionRank ?? '',
          imagesCount: Array.isArray(r.images) ? r.images.length : 0,
          formValuesJson: JSON.stringify(r.formValues || {}),
          createdAt: r.createdAt || '',
        }))
      headers = [
        'id',
        'customerId',
        'customerName',
        'customerKana',
        'birthday',
        'address',
        'visitDate',
        'menuType',
        'structureScore',
        'lifestyleScore',
        'conditionScore',
        'structureRank',
        'lifestyleRank',
        'conditionRank',
        'imagesCount',
        'formValuesJson',
        'createdAt',
      ]
    } else {
      return
    }

    const url = buildCsv(rows, headers)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    setCsvMenuOpen(false)
  }

  function parseCsvLine(line) {
    const s = line.replace(/\r$/, '')
    const fields = []
    let i = 0
    let current = ''
    while (i < s.length) {
      if (s[i] === '"') {
        i++
        current = ''
        while (i < s.length) {
          if (s[i] === '"' && s[i + 1] === '"') {
            current += '"'
            i += 2
          } else if (s[i] === '"') {
            i++
            break
          } else {
            current += s[i]
            i++
          }
        }
        fields.push(current)
      } else if (s[i] === ',') {
        fields.push(current)
        current = ''
        i++
      } else {
        current += s[i]
        i++
      }
    }
    fields.push(current)
    return fields
  }

  function parseCsv(text) {
    const t = text.replace(/^\uFEFF/, '')
    const lines = t.split(/\r?\n/).filter((line) => line.trim())
    if (!lines.length) return { headers: [], rows: [] }
    const headers = parseCsvLine(lines[0])
    const rows = lines.slice(1).map((line) => {
      const values = parseCsvLine(line)
      const row = {}
      headers.forEach((h, i) => {
        row[h] = values[i] !== undefined ? values[i] : ''
      })
      return row
    })
    return { headers, rows }
  }

  function csvRowToRecord(row) {
    const num = (v) => (v === '' || v == null ? undefined : Number(v))
    let formValues = {}
    if (row.formValuesJson) {
      try {
        formValues = JSON.parse(row.formValuesJson) || {}
      } catch {
        formValues = {}
      }
    }
    return {
      id: row.id && String(row.id).trim() ? row.id : createId(),
      customerId: String(row.customerId || '').trim(),
      customerName: String(row.customerName || '').trim(),
      customerKana: String(row.customerKana || '').trim(),
      birthday: String(row.birthday || '').trim(),
      address: String(row.address || '').trim(),
      visitDate: String(row.visitDate || '').trim(),
      menuType: String(row.menuType || '').trim(),
      structureScore: num(row.structureScore) ?? 0,
      lifestyleScore: num(row.lifestyleScore) ?? 0,
      conditionScore: num(row.conditionScore) ?? 0,
      structureRank: String(row.structureRank || '').trim() || undefined,
      lifestyleRank: String(row.lifestyleRank || '').trim() || undefined,
      conditionRank: String(row.conditionRank || '').trim() || undefined,
      formValues,
      images: [],
      createdAt: row.createdAt ? Number(row.createdAt) || Date.now() : Date.now(),
    }
  }

  function handleImportCsv(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const text = String(reader.result || '')
        const { headers, rows } = parseCsv(text)
        if (!rows.length) {
          alert('CSVにデータ行がありません')
          e.target.value = ''
          return
        }
        const imported = rows.map((r) => csvRowToRecord(r))
        const existing = getRecords()
        const byId = new Map(existing.map((rec) => [rec.id, rec]))
        imported.forEach((rec) => byId.set(rec.id, rec))
        const merged = Array.from(byId.values()).sort(
          (a, b) => (b.createdAt || 0) - (a.createdAt || 0),
        )
        replaceRecords(merged)
        setRecords(merged)
        setCsvMenuOpen(false)
        alert(`${imported.length}件をインポートしました。`)
      } catch (err) {
        console.error(err)
        alert('CSVの読み込みに失敗しました。形式を確認してください。')
      }
      e.target.value = ''
    }
    reader.readAsText(file, 'UTF-8')
  }

  const workEnvQuestion = menuFlags.isPerm
    ? WORK_ENV_PERM
    : menuFlags.isExt
      ? WORK_ENV_EXTENSIONS
      : null

  return (
    <div className="appShell">
      <header className="appHeader">
        <div>
          <div className="appTitle">Fleur Lash カルテ管理</div>
          <div className="appSubtitle">保存 / 顧客検索 / 履歴 / 比較(最大3件) / 画像 / PDF</div>
        </div>
        <div className="headerActions">
          <button type="button" className="btn primary" onClick={handleSave}>
            保存
          </button>
          <div className="csvMenuWrap">
            <button
              type="button"
              className="btn"
              onClick={() => setCsvMenuOpen((o) => !o)}
            >
              CSV
            </button>
            {csvMenuOpen && (
              <div className="csvMenu">
                <button
                  type="button"
                  className="btn small"
                  onClick={() => handleExportCsv('byCustomer')}
                >
                  顧客ID毎
                </button>
                <button
                  type="button"
                  className="btn small"
                  onClick={() => handleExportCsv('byCustomerDate')}
                >
                  顧客ID+日付毎
                </button>
                <button
                  type="button"
                  className="btn small"
                  onClick={() => handleExportCsv('all')}
                >
                  全件
                </button>
                <input
                  ref={csvInputRef}
                  type="file"
                  accept=".csv"
                  style={{ display: 'none' }}
                  onChange={handleImportCsv}
                />
                <button
                  type="button"
                  className="btn small"
                  onClick={() => csvInputRef.current?.click()}
                >
                  インポート
                </button>
              </div>
            )}
          </div>
          <button type="button" className="btn" onClick={handlePdfExport}>
            PDF出力
          </button>
          <button type="button" className="btn" onClick={handleRefresh}>
            リフレッシュ
          </button>
        </div>
      </header>

      <main className="layout">
        <div className="colLeft">
          <SectionCard title="基本情報" subtitle="保存必須: 顧客ID・お客様名（それ以外は未入力でもOK）">
            <BasicInfoForm
              customerId={customerId}
              customerName={customerName}
              customerKana={customerKana}
              birthday={birthday}
              address={address}
              visitDate={visitDate}
              menuType={menuType}
              onChange={updateBasicInfo}
              onCustomerNameBlur={handleCustomerNameBlur}
              errors={errors}
            />
          </SectionCard>

          <SectionCard title="画像アップロード" subtitle="jpg / jpeg / png（複数可）">
            <div id="pdf-images">
              <ImageUploadField images={images} onChange={setImages} />
            </div>
          </SectionCard>

          <SectionCard title="【1】目元構造">
            <div className="qList">
              {STRUCTURE_QUESTIONS.map((q) => (
                <HorizontalRadioGroup
                  key={q.key}
                  name={q.key}
                  label={q.label}
                  options={q.options}
                  value={formValues[q.key]}
                  onChange={(v) => setAnswer(q.key, v)}
                />
              ))}
            </div>
          </SectionCard>

          <SectionCard
            title="【2】ライフスタイル"
            subtitle="メニューによって「仕事環境」の選択肢が切り替わります"
          >
            <div className="qList">
              {workEnvQuestion ? (
                <HorizontalRadioGroup
                  name={workEnvQuestion.key}
                  label={workEnvQuestion.label}
                  options={workEnvQuestion.options}
                  value={formValues.workEnvironment}
                  onChange={(v) => setAnswer('workEnvironment', v)}
                />
              ) : (
                <div className="mutedText">施術メニューを選択すると「仕事環境」が表示されます。</div>
              )}

              {LIFESTYLE_QUESTIONS_COMMON.map((q) => (
                <HorizontalRadioGroup
                  key={q.key}
                  name={q.key}
                  label={q.label}
                  options={q.options}
                  value={formValues[q.key]}
                  onChange={(v) => setAnswer(q.key, v)}
                />
              ))}

              <div className="fieldRow">
                <div className="fieldLabel">
                  <div className="fieldLabelText">LED</div>
                  <div className="fieldHint">チェックあり = +3 / チェックなし = 0</div>
                </div>
                <label className="checkPill">
                  <input
                    type="checkbox"
                    checked={Boolean(formValues.ledChecked)}
                    onChange={(e) => setAnswer('ledChecked', e.target.checked)}
                  />
                  <span>チェックあり</span>
                </label>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="【3】まつ毛状態">
            <div className="qList">
              {CONDITION_QUESTIONS.map((q) => (
                <HorizontalRadioGroup
                  key={q.key}
                  name={q.key}
                  label={q.label}
                  options={q.options}
                  value={formValues[q.key]}
                  onChange={(v) => setAnswer(q.key, v)}
                />
              ))}
            </div>
          </SectionCard>
        </div>

        <div className="colRight">
          <SectionCard
            title="【4】スコア"
            subtitle={currentId ? '編集中（保存で上書き）' : '未保存'}
            right={<div className="pill">{menuType ? `メニュー：${menuType}` : 'メニュー未選択'}</div>}
          >
            <ScoreSummary
              structureScore={structureScore}
              structureRank={structureRank}
              lifestyleScore={lifestyleScore}
              lifestyleRank={lifestyleRank}
              conditionScore={conditionScore}
              conditionRank={conditionRank}
            />
            <div id="pdf-current-chart">
              <RadarScoreChart data={chartData} />
            </div>
          </SectionCard>

          <SectionCard title="顧客検索" subtitle="顧客ID優先 / 氏名・カナも検索できます">
            <div className="field">
              <input
                className="textInput"
                type="text"
                value={searchText}
                placeholder="顧客ID / 氏名 / カナで検索"
                onChange={(e) => setSearchText(e.target.value)}
              />
            </div>

            {!searchText.trim() ? (
              <div className="mutedText" style={{ marginTop: '8px' }}>
                顧客ID または 氏名・カナを入力して検索してください。
              </div>
            ) : (
              <div className="customerSelectList">
                {searchedCustomers.length ? (
                  searchedCustomers.map((c) => (
                    <button
                      key={c.customerId}
                      type="button"
                      className={`customerSelectButton ${selectedCustomerId === c.customerId ? 'isActive' : ''}`}
                      onClick={() => handleSelectCustomer(c.customerId)}
                    >
                      <div className="customerRowTop">
                        <div className="customerName">{c.customerName || '名称未設定'}</div>
                        <div className="customerId">{c.customerId}</div>
                      </div>
                      <div className="mutedText">{c.customerKana || 'カナ未登録'}</div>
                    </button>
                  ))
                ) : (
                  <div className="mutedText">該当顧客がありません。</div>
                )}
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="履歴一覧"
            subtitle={
              selectedCustomerId
                ? '選択中の顧客履歴 / 比較は最大3件まで'
                : '顧客を選択すると該当履歴が表示されます'
            }
          >
            <HistoryList
              records={paginatedRecords}
              onLoad={handleLoad}
              onDelete={handleDelete}
              compareIds={compareIds}
              onToggleCompare={handleToggleCompare}
                onOpenImages={handleOpenImages}
            />
            {visibleRecords.length > HISTORY_PAGE_SIZE && (
              <div className="historyPagination">
                <span className="historyPaginationInfo">
                  {visibleRecords.length}件中 {(historyPage - 1) * HISTORY_PAGE_SIZE + 1}–{Math.min(historyPage * HISTORY_PAGE_SIZE, visibleRecords.length)}件目
                </span>
                <div className="historyPaginationControls">
                  <button
                    type="button"
                    className="btn small"
                    disabled={historyPage <= 1}
                    onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                  >
                    前へ
                  </button>
                  <span className="historyPaginationPages">
                    {Array.from({ length: historyTotalPages }, (_, i) => i + 1).map((p) => (
                      <button
                        key={p}
                        type="button"
                        className={`btn small ${historyPage === p ? 'primary' : ''}`}
                        onClick={() => setHistoryPage(p)}
                      >
                        {p}
                      </button>
                    ))}
                  </span>
                  <button
                    type="button"
                    className="btn small"
                    disabled={historyPage >= historyTotalPages}
                    onClick={() => setHistoryPage((p) => Math.min(historyTotalPages, p + 1))}
                  >
                    次へ
                  </button>
                </div>
              </div>
            )}
          </SectionCard>

          <SectionCard title="比較チャート" subtitle="履歴一覧で比較にチェックした最大3件を重ねて表示">
            <div id="pdf-compare-chart">
              {compareRecords.length ? (
                <>
                  <RadarScoreChart compareData={compareChartData} compareSeries={compareSeries} />
                  <div className="qList" style={{ marginTop: '10px' }}>
                    {compareRecords.slice(0, 3).map((rec) => (
                      <div key={rec.id} className="scoreLine">
                        <span>{rec.visitDate || '日付未設定'}</span>
                        <span>{rec.menuType || 'メニュー未選択'}</span>
                        <span>構造 {rec.structureScore ?? 0} ({rec.structureRank ?? '-'})</span>
                        <span>生活 {rec.lifestyleScore ?? 0} ({rec.lifestyleRank ?? '-'})</span>
                        <span>状態 {rec.conditionScore ?? 0} ({rec.conditionRank ?? '-'})</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="mutedText">比較したい履歴を1〜3件選択してください。</div>
              )}
            </div>
          </SectionCard>
        </div>
      </main>

      {imageModalRecord && (
        <div className="imageModalOverlay" onClick={handleCloseImages}>
          <div className="imageModal" onClick={(e) => e.stopPropagation()}>
            <div className="imageModalHeader">
              <div>
                <div className="imageModalTitle">{imageModalRecord.customerName || '名称未設定'}</div>
                <div className="imageModalSubtitle">
                  {imageModalRecord.customerId || ''} / {imageModalRecord.visitDate || ''}
                </div>
              </div>
              <button type="button" className="btn small" onClick={handleCloseImages}>
                閉じる
              </button>
            </div>
            <div className="imageModalBody">
              {Array.isArray(imageModalRecord.images) && imageModalRecord.images.length ? (
                <div className="imageModalGrid">
                  {imageModalRecord.images.map((img) => (
                    <div key={img.id} className="imageTile">
                      <div className="imagePreview">
                        <img
                          src={img.dataUrl}
                          alt={img.fileName || 'upload'}
                          onError={(e) => {
                            e.currentTarget.style.display = 'none'
                            const parent = e.currentTarget.parentElement
                            if (parent) parent.classList.add('imageError')
                          }}
                        />
                      </div>
                      <div className="imageMeta">
                        <div className="imageName" title={img.fileName}>
                          {img.fileName || 'image'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mutedText">画像を読み込めませんでした。</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
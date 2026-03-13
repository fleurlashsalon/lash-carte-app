import { useEffect, useMemo, useRef, useState } from 'react'
import { toPng } from 'html-to-image'
import { jsPDF } from 'jspdf'
import SectionCard from './components/SectionCard.jsx'
import BasicInfoForm from './components/BasicInfoForm.jsx'
import TreatmentDetailForm from './components/TreatmentDetailForm.jsx'
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
import { MENU_DETAIL_BLOCKS, isNewTreatmentMenu, getFieldLabel } from './utils/treatmentFormDefs.js'
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
  memo: '',
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
  const [phone, setPhone] = useState('')
  const [treatmentDetails, setTreatmentDetails] = useState({
    ext: {},
    perm: {},
    browWax: {},
  })
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
  const [imageManagerOpen, setImageManagerOpen] = useState(false)
  const [imageManagerActiveRecordId, setImageManagerActiveRecordId] = useState('')
  const [imageToolsMenuOpen, setImageToolsMenuOpen] = useState(false)
  const [imageStorageInfoOpen, setImageStorageInfoOpen] = useState(false)
  const [storageViewerOpen, setStorageViewerOpen] = useState(false)
  const [customerListOpen, setCustomerListOpen] = useState(false)
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
      const name = String(rec.customerName || '').trim()
      const key = id ? id : name ? `NOID:${name}` : ''
      if (!key) return

      if (!map.has(key)) {
        map.set(key, {
          customerKey: key,
          customerId: id, // 空の場合あり
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

  // 履歴一覧の対象: 顧客選択があればそれを優先、なければ検索の完全一致ID
  const activeCustomerIdForHistory = useMemo(() => {
    const selected = String(selectedCustomerId || '').trim()
    if (selected) return selected
    return matchedCustomerId
  }, [matchedCustomerId, selectedCustomerId])

  const searchedCustomers = useMemo(() => {
    const keyword = searchText.trim().toLowerCase()
    if (!keyword) return []

    const idMatches = customerList.filter((c) => {
      const id = (c.customerId || '').toLowerCase()
      return id === keyword
    })
    if (idMatches.length) return idMatches

    // ID完全一致がなければ、顧客ID/氏名/カナの部分一致で検索
    return customerList.filter((c) => {
      const id = (c.customerId || '').toLowerCase()
      const name = (c.customerName || '').toLowerCase()
      const kana = (c.customerKana || '').toLowerCase()
      return id.includes(keyword) || name.includes(keyword) || kana.includes(keyword)
    })
  }, [customerList, searchText])

  const visibleRecords = useMemo(() => {
    const id = activeCustomerIdForHistory
    if (!id) return []

    const sorted = [...records].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    if (String(id).startsWith('NOID:')) {
      const name = String(id).slice('NOID:'.length)
      return sorted.filter((rec) => !getCustomerIdFromRecord(rec) && String(rec.customerName || '').trim() === name)
    }
    return sorted.filter((rec) => getCustomerIdFromRecord(rec) === id)
  }, [records, activeCustomerIdForHistory])

  const historyTotalPages = Math.max(1, Math.ceil(visibleRecords.length / HISTORY_PAGE_SIZE))
  const paginatedRecords = useMemo(() => {
    const start = (historyPage - 1) * HISTORY_PAGE_SIZE
    return visibleRecords.slice(start, start + HISTORY_PAGE_SIZE)
  }, [visibleRecords, historyPage])

  useEffect(() => {
    setHistoryPage(1)
  }, [activeCustomerIdForHistory, visibleRecords.length])

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
      name: `${rec.visitDate || '日付未設定'} / ${rec.treatmentMenu || rec.menuType || '未選択'}`,
    }))
  }, [compareRecords])

  function updateBasicInfo(patch) {
    if (Object.prototype.hasOwnProperty.call(patch, 'customerId')) setCustomerId(patch.customerId)
    if (Object.prototype.hasOwnProperty.call(patch, 'customerName')) setCustomerName(patch.customerName)
    if (Object.prototype.hasOwnProperty.call(patch, 'customerKana')) setCustomerKana(patch.customerKana)
    if (Object.prototype.hasOwnProperty.call(patch, 'birthday')) setBirthday(patch.birthday)
    if (Object.prototype.hasOwnProperty.call(patch, 'address')) setAddress(patch.address)
    if (Object.prototype.hasOwnProperty.call(patch, 'visitDate')) setVisitDate(patch.visitDate)
    if (Object.prototype.hasOwnProperty.call(patch, 'phone')) setPhone(patch.phone)
    if (Object.prototype.hasOwnProperty.call(patch, 'treatmentMenu')) {
      setMenuType(patch.treatmentMenu)
    }
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

  function handleTreatmentDetailChange(blockId, fieldId, value) {
    setTreatmentDetails((prev) => ({
      ...prev,
      [blockId]: {
        ...(prev[blockId] || {}),
        [fieldId]: value,
      },
    }))
  }

  function setAnswer(key, value) {
    setFormValues((prev) => ({ ...prev, [key]: value }))
  }

  function validate() {
    const next = {}

    if (!customerName.trim()) next.customerName = 'お客様名を入力してください'
    if (!menuType) next.treatmentMenu = '施術メニューを選択してください'

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
      phone: phone?.trim?.() || '',
      birthday: birthday || '',
      address: address?.trim?.() || '',
      visitDate: visitDate || '',
      menuType: menuType || '',
      treatmentMenu: menuType || '',
      treatmentDetails: treatmentDetails || { ext: {}, perm: {}, browWax: {} },
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
          phone: record.phone,
          birthday: record.birthday,
          address: record.address,
          visitDate: record.visitDate,
          menuType: record.menuType,
          treatmentMenu: record.treatmentMenu,
          treatmentDetails: record.treatmentDetails,
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
      doc.text(`電話番号: ${phone || ''}`, 14, y)
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
    setPhone('')
    setBirthday('')
    setAddress('')
    setVisitDate(getTodayString())
    setMenuType('')
    setTreatmentDetails({ ext: {}, perm: {}, browWax: {} })
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
    setPhone(rec.phone || '')
    setBirthday(rec.birthday || '')
    setAddress(rec.address || '')
    setVisitDate(rec.visitDate || getTodayString())
    setMenuType(rec.treatmentMenu || rec.menuType || '')
    const td = rec.treatmentDetails
    setTreatmentDetails({
      ext: td?.ext && typeof td.ext === 'object' ? td.ext : {},
      perm: td?.perm && typeof td.perm === 'object' ? td.perm : {},
      browWax: td?.browWax && typeof td.browWax === 'object' ? td.browWax : {},
    })
    setFormValues({ ...INITIAL_FORM, ...(rec.formValues || {}) })
    setImages(Array.isArray(rec.images) ? rec.images : [])
    setErrors({})
    setCurrentId(rec.id)
    setCurrentCreatedAt(rec.createdAt || Date.now())
    const cid = getCustomerIdFromRecord(rec)
    setSelectedCustomerId(cid || (rec.customerName ? `NOID:${String(rec.customerName).trim()}` : ''))
    setCompareIds([])
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  /** 登録済み同名ポップアップでYESのとき：基本情報のみ反映（スコア・ラジオ・画像は反映しない） */
  function handleLoadBasicInfoOnly(rec) {
    setCustomerId(rec.customerId || '')
    setCustomerName(rec.customerName || '')
    setCustomerKana(rec.customerKana || '')
    setPhone(rec.phone || '')
    setBirthday(rec.birthday || '')
    setAddress(rec.address || '')
    setVisitDate(rec.visitDate || getTodayString())
    setMenuType(rec.treatmentMenu || rec.menuType || '')
    setTreatmentDetails({ ext: {}, perm: {}, browWax: {} })
    setFormValues(INITIAL_FORM)
    setImages([])
    setErrors({})
    const cid = getCustomerIdFromRecord(rec)
    setSelectedCustomerId(cid || (rec.customerName ? `NOID:${String(rec.customerName).trim()}` : ''))
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

  const recordsWithImages = useMemo(() => {
    return records
      .filter((r) => Array.isArray(r.images) && r.images.length > 0)
      .slice()
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
  }, [records])

  const activeImageManagerRecord = useMemo(() => {
    if (!imageManagerActiveRecordId) return null
    return recordsWithImages.find((r) => r.id === imageManagerActiveRecordId) || null
  }, [imageManagerActiveRecordId, recordsWithImages])

  function handleOpenImageManager() {
    setImageManagerOpen(true)
    if (!imageManagerActiveRecordId && recordsWithImages.length) {
      setImageManagerActiveRecordId(recordsWithImages[0].id)
    }
  }

  function handleCloseImageManager() {
    setImageManagerOpen(false)
  }

  function handleToggleImageToolsMenu() {
    setImageToolsMenuOpen((o) => !o)
  }

  function handleCloseImageToolsMenu() {
    setImageToolsMenuOpen(false)
  }

  function handleOpenImageStorageInfo() {
    handleCloseImageToolsMenu()
    setImageStorageInfoOpen(true)
  }

  function handleCloseImageStorageInfo() {
    setImageStorageInfoOpen(false)
  }

  function handleOpenStorageViewer() {
    handleCloseImageToolsMenu()
    setStorageViewerOpen(true)
  }

  function handleCloseStorageViewer() {
    setStorageViewerOpen(false)
  }

  function bytesToHuman(bytes) {
    const b = Number(bytes) || 0
    if (b < 1024) return `${b} B`
    const kb = b / 1024
    if (kb < 1024) return `${kb.toFixed(1)} KB`
    const mb = kb / 1024
    return `${mb.toFixed(2)} MB`
  }

  const storageSnapshot = useMemo(() => {
    const key = 'lash-score-records'
    const raw = localStorage.getItem(key) || ''
    const approxBytes = raw.length * 2 // UTF-16 目安
    const imageCount = records.reduce((sum, r) => sum + (Array.isArray(r.images) ? r.images.length : 0), 0)
    return {
      key,
      raw,
      approxBytes,
      recordCount: records.length,
      imageCount,
    }
  }, [records])

  async function handleCopyStorageJson() {
    try {
      const text = storageSnapshot.raw || ''
      if (!text) {
        alert('保存データがありません')
        return
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
        alert('保存データ（JSON）をコピーしました')
        return
      }
      alert('この環境では自動コピーができません。下のJSONを手動でコピーしてください。')
    } catch (e) {
      console.error(e)
      alert('コピーに失敗しました。下のJSONを手動でコピーしてください。')
    }
  }

  function handleDownloadStorageJson() {
    try {
      const text = storageSnapshot.raw || ''
      if (!text) {
        alert('保存データがありません')
        return
      }
      const blob = new Blob([text], { type: 'application/json;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `lash-score-backup-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error(e)
      alert('ダウンロードに失敗しました')
    }
  }

  function handleOpenCustomerList() {
    setCustomerListOpen(true)
  }

  function handleCloseCustomerList() {
    setCustomerListOpen(false)
  }

  function handleDeleteSavedImage(recordId, imageId) {
    const ok = window.confirm('この画像を削除しますか？（元に戻せません）')
    if (!ok) return

    const next = records.map((r) => {
      if (r.id !== recordId) return r
      const imgs = Array.isArray(r.images) ? r.images : []
      return { ...r, images: imgs.filter((img) => img.id !== imageId) }
    })
    replaceRecords(next)
    setRecords(next)

    const stillHas = next.some((r) => r.id === recordId && Array.isArray(r.images) && r.images.length)
    if (!stillHas) {
      const nextWithImages = next
        .filter((r) => Array.isArray(r.images) && r.images.length > 0)
        .slice()
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      setImageManagerActiveRecordId(nextWithImages[0]?.id || '')
    }
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

  function recordToAllRow(r) {
    return {
      id: r.id,
      customerId: r.customerId || '',
      customerName: r.customerName || '',
      customerKana: r.customerKana || '',
      phone: r.phone || '',
      birthday: r.birthday || '',
      address: r.address || '',
      visitDate: r.visitDate || '',
      menuType: r.menuType || r.treatmentMenu || '',
      treatmentMenu: r.treatmentMenu || r.menuType || '',
      treatmentDetailsJson: JSON.stringify(r.treatmentDetails || {}),
      structureScore: r.structureScore ?? '',
      lifestyleScore: r.lifestyleScore ?? '',
      conditionScore: r.conditionScore ?? '',
      structureRank: r.structureRank ?? '',
      lifestyleRank: r.lifestyleRank ?? '',
      conditionRank: r.conditionRank ?? '',
      imagesCount: Array.isArray(r.images) ? r.images.length : 0,
      imagesJson: JSON.stringify(Array.isArray(r.images) ? r.images : []),
      formValuesJson: JSON.stringify(r.formValues || {}),
      createdAt: r.createdAt || '',
    }
  }

  const CSV_HEADERS_ALL = [
    'id',
    'customerId',
    'customerName',
    'customerKana',
    'phone',
    'birthday',
    'address',
    'visitDate',
    'menuType',
    'treatmentMenu',
    'treatmentDetailsJson',
    'structureScore',
    'lifestyleScore',
    'conditionScore',
    'structureRank',
    'lifestyleRank',
    'conditionRank',
    'imagesCount',
    'imagesJson',
    'formValuesJson',
    'createdAt',
  ]

  function handleExportCsvByCustomerIdPrompt() {
    if (!records.length) {
      alert('エクスポートできる履歴がありません')
      return
    }

    const input = window.prompt('エクスポートしたい顧客IDを入力してください（例: A-00001）', customerId.trim() || '')
    const targetId = String(input || '').trim()
    if (!targetId) return

    const subset = records
      .filter((r) => String(r.customerId || '').trim() === targetId)
      .slice()
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))

    if (!subset.length) {
      alert(`顧客ID「${targetId}」の履歴がありません`)
      return
    }

    const rows = subset.map(recordToAllRow)
    const now = new Date()
    const ts = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(
      now.getDate(),
    ).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(
      now.getMinutes(),
    ).padStart(2, '0')}`
    const safeId = targetId.replace(/[\\/:*?"<>|]/g, '_')
    const fileName = `fleur-carte-customer-${safeId}-${ts}.csv`

    const url = buildCsv(rows, CSV_HEADERS_ALL)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    setCsvMenuOpen(false)
  }

  function handleExportCsvByCustomerIdAndDatePrompt() {
    if (!records.length) {
      alert('エクスポートできる履歴がありません')
      return
    }

    const inputId = window.prompt(
      'エクスポートしたい顧客IDを入力してください（例: A-00001）',
      customerId.trim() || '',
    )
    const targetId = String(inputId || '').trim()
    if (!targetId) return

    const inputDate = window.prompt(
      'エクスポートしたい日付を入力してください（例: 2026-03-11）',
      visitDate || '',
    )
    const targetDate = String(inputDate || '').trim()
    if (!targetDate) return

    const subset = records
      .filter(
        (r) =>
          String(r.customerId || '').trim() === targetId &&
          String(r.visitDate || '').trim() === targetDate,
      )
      .slice()
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))

    if (!subset.length) {
      alert(`顧客ID「${targetId}」かつ 日付「${targetDate}」の履歴がありません`)
      return
    }

    const rows = subset.map(recordToAllRow)
    const now = new Date()
    const ts = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(
      now.getDate(),
    ).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(
      now.getMinutes(),
    ).padStart(2, '0')}`
    const safeId = targetId.replace(/[\\/:*?"<>|]/g, '_')
    const safeDate = targetDate.replace(/[\\/:*?"<>|]/g, '_')
    const fileName = `fleur-carte-customer-${safeId}-date-${safeDate}-${ts}.csv`

    const url = buildCsv(rows, CSV_HEADERS_ALL)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    setCsvMenuOpen(false)
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
          menuType: r.menuType || r.treatmentMenu || '',
          treatmentMenu: r.treatmentMenu || r.menuType || '',
          treatmentDetailsJson: JSON.stringify(r.treatmentDetails || {}),
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
        'treatmentMenu',
        'treatmentDetailsJson',
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
        .map(recordToAllRow)
      headers = CSV_HEADERS_ALL
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

    let images = []
    if (row.imagesJson) {
      try {
        const parsed = JSON.parse(row.imagesJson)
        images = Array.isArray(parsed) ? parsed : []
      } catch {
        images = []
      }
    }
    let treatmentDetails = { ext: {}, perm: {}, browWax: {} }
    if (row.treatmentDetailsJson) {
      try {
        const parsed = JSON.parse(row.treatmentDetailsJson)
        if (parsed && typeof parsed === 'object') {
          treatmentDetails = {
            ext: parsed.ext && typeof parsed.ext === 'object' ? parsed.ext : {},
            perm: parsed.perm && typeof parsed.perm === 'object' ? parsed.perm : {},
            browWax: parsed.browWax && typeof parsed.browWax === 'object' ? parsed.browWax : {},
          }
        }
      } catch {
        treatmentDetails = { ext: {}, perm: {}, browWax: {} }
      }
    }

    return {
      id: row.id && String(row.id).trim() ? row.id : createId(),
      customerId: String(row.customerId || '').trim(),
      customerName: String(row.customerName || '').trim(),
      customerKana: String(row.customerKana || '').trim(),
      phone: String(row.phone || '').trim(),
      birthday: String(row.birthday || '').trim(),
      address: String(row.address || '').trim(),
      visitDate: String(row.visitDate || '').trim(),
      menuType: String(row.menuType || row.treatmentMenu || '').trim(),
      treatmentMenu: String(row.treatmentMenu || row.menuType || '').trim(),
      treatmentDetails,
      structureScore: num(row.structureScore) ?? 0,
      lifestyleScore: num(row.lifestyleScore) ?? 0,
      conditionScore: num(row.conditionScore) ?? 0,
      structureRank: String(row.structureRank || '').trim() || undefined,
      lifestyleRank: String(row.lifestyleRank || '').trim() || undefined,
      conditionRank: String(row.conditionRank || '').trim() || undefined,
      formValues,
      images,
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
          <div className="appTitle">Fleur Lash</div>
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
                  onClick={handleExportCsvByCustomerIdPrompt}
                >
                  顧客ID毎
                </button>
                <button
                  type="button"
                  className="btn small"
                  onClick={handleExportCsvByCustomerIdAndDatePrompt}
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
          <div className="csvMenuWrap">
            <button type="button" className="btn" onClick={handleToggleImageToolsMenu}>
              画像確認/削除
            </button>
            {imageToolsMenuOpen && (
              <div className="csvMenu" style={{ top: '100%', right: 0, left: 'auto', flexDirection: 'column' }}>
                <button type="button" className="btn small" onClick={handleOpenImageStorageInfo}>
                  画像の保存場所を表示
                </button>
                <button type="button" className="btn small" onClick={handleOpenStorageViewer}>
                  保存データ（ローカルストレージ）を表示
                </button>
                <button
                  type="button"
                  className="btn small"
                  onClick={() => {
                    handleCloseImageToolsMenu()
                    handleOpenImageManager()
                  }}
                >
                  画像の確認/削除
                </button>
                <button type="button" className="btn small subtle" onClick={handleCloseImageToolsMenu}>
                  閉じる
                </button>
              </div>
            )}
          </div>
          <button type="button" className="btn" onClick={handleOpenCustomerList}>
            顧客一覧
          </button>
          <button type="button" className="btn" onClick={handleRefresh}>
            リフレッシュ
          </button>
        </div>
      </header>

      <main className="layout">
        <div className="colLeft">
          <SectionCard title="基本情報" subtitle="必須: 顧客ID・お客様名・施術メニュー">
            <BasicInfoForm
              customerId={customerId}
              customerName={customerName}
              customerKana={customerKana}
              phone={phone}
              treatmentMenu={menuType}
              visitDate={visitDate}
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

          <SectionCard title="【5】メモ" subtitle="自由入力メモ欄（施術の気づきや注意点など）">
            <textarea
              className="textInput"
              style={{ minHeight: '80px' }}
              value={formValues.memo || ''}
              onChange={(e) => setFormValues((prev) => ({ ...prev, memo: e.target.value }))}
              placeholder="メモを自由に入力してください（施術の気づき・注意点・次回へのメモなど）"
            />
          </SectionCard>

          {isNewTreatmentMenu(menuType) && MENU_DETAIL_BLOCKS[menuType] ? (
            <SectionCard title="施術メニュー詳細" subtitle="メニューに応じた項目を入力">
              {(MENU_DETAIL_BLOCKS[menuType] || []).map((blockId) => (
                <TreatmentDetailForm
                  key={blockId}
                  blockId={blockId}
                  values={treatmentDetails[blockId] || {}}
                  onChange={handleTreatmentDetailChange}
                />
              ))}
            </SectionCard>
          ) : null}

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
                      key={c.customerKey || c.customerId}
                      type="button"
                      className={`customerSelectButton ${selectedCustomerId === (c.customerKey || c.customerId) ? 'isActive' : ''}`}
                      onClick={() => handleSelectCustomer(c.customerKey || c.customerId)}
                    >
                      <div className="customerRowTop">
                        <div className="customerName">{c.customerName || '名称未設定'}</div>
                        <div className="customerId">{c.customerId || 'IDなし'}</div>
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
                        <span>{rec.treatmentMenu || rec.menuType || 'メニュー未選択'}</span>
                        <span>構造 {rec.structureScore ?? 0} ({rec.structureRank ?? '-'})</span>
                        <span>生活 {rec.lifestyleScore ?? 0} ({rec.lifestyleRank ?? '-'})</span>
                        <span>状態 {rec.conditionScore ?? 0} ({rec.conditionRank ?? '-'})</span>
                      </div>
                    ))}
                  </div>
                  {compareRecords.some((r) => r.treatmentDetails && ((r.treatmentDetails.ext && Object.keys(r.treatmentDetails.ext).length > 0) || (r.treatmentDetails.perm && Object.keys(r.treatmentDetails.perm).length > 0) || (r.treatmentDetails.browWax && Object.keys(r.treatmentDetails.browWax).length > 0))) ? (
                    <div className="compareTreatmentDetails" style={{ marginTop: '12px' }}>
                      <div className="inputLabel" style={{ marginBottom: '6px' }}>施術メニュー詳細（比較）</div>
                      {compareRecords.slice(0, 3).map((rec) => (
                        <div key={rec.id} className="treatmentCompareBlock">
                          <div className="treatmentCompareHeader">{rec.visitDate || '-'} / {rec.treatmentMenu || rec.menuType || '-'}</div>
                          {rec.treatmentDetails?.ext && Object.keys(rec.treatmentDetails.ext).length > 0 ? (
                            <div className="treatmentCompareSection">
                              <span className="mutedChip">エクステ:</span>
                              {Object.entries(rec.treatmentDetails.ext).filter(([, v]) => v !== undefined && v !== '' && (Array.isArray(v) ? v.length > 0 : true)).map(([k, v]) => (
                                <span key={k} className="treatmentCompareItem">{getFieldLabel('ext', k)}: {Array.isArray(v) ? v.join(', ') : String(v)}</span>
                              ))}
                            </div>
                          ) : null}
                          {rec.treatmentDetails?.perm && Object.keys(rec.treatmentDetails.perm).length > 0 ? (
                            <div className="treatmentCompareSection">
                              <span className="mutedChip">まつ毛パーマ:</span>
                              {Object.entries(rec.treatmentDetails.perm).filter(([, v]) => v !== undefined && v !== '' && (Array.isArray(v) ? v.length > 0 : true)).map(([k, v]) => (
                                <span key={k} className="treatmentCompareItem">{getFieldLabel('perm', k)}: {Array.isArray(v) ? v.join(', ') : String(v)}</span>
                              ))}
                            </div>
                          ) : null}
                          {rec.treatmentDetails?.browWax && Object.keys(rec.treatmentDetails.browWax).length > 0 ? (
                            <div className="treatmentCompareSection">
                              <span className="mutedChip">眉毛ワックス:</span>
                              {Object.entries(rec.treatmentDetails.browWax).filter(([, v]) => v !== undefined && v !== '' && (Array.isArray(v) ? v.length > 0 : true)).map(([k, v]) => (
                                <span key={k} className="treatmentCompareItem">{getFieldLabel('browWax', k)}: {Array.isArray(v) ? v.join(', ') : String(v)}</span>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : null}
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

      {imageManagerOpen && (
        <div className="imageModalOverlay" onClick={handleCloseImageManager}>
          <div className="imageModal" onClick={(e) => e.stopPropagation()}>
            <div className="imageModalHeader">
              <div>
                <div className="imageModalTitle">保存画像の確認 / 削除</div>
                <div className="imageModalSubtitle">
                  保存済み画像がある履歴: {recordsWithImages.length}件
                </div>
              </div>
              <button type="button" className="btn small" onClick={handleCloseImageManager}>
                閉じる
              </button>
            </div>
            <div className="imageManagerBody">
              <div className="imageManagerSidebar">
                {recordsWithImages.length ? (
                  recordsWithImages.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      className={`imageManagerItem ${imageManagerActiveRecordId === r.id ? 'isActive' : ''}`}
                      onClick={() => setImageManagerActiveRecordId(r.id)}
                    >
                      <div className="imageManagerItemTop">
                        <div className="imageManagerItemName">{r.customerName || '名称未設定'}</div>
                        <div className="imageManagerItemCount">{Array.isArray(r.images) ? r.images.length : 0}枚</div>
                      </div>
                      <div className="imageManagerItemSub">
                        {(r.customerId ? `ID: ${r.customerId}` : 'IDなし') + (r.visitDate ? ` / ${r.visitDate}` : '')}
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="mutedText">保存済み画像がありません。</div>
                )}
              </div>

              <div className="imageManagerMain">
                {activeImageManagerRecord ? (
                  <>
                    <div className="imageManagerMainHeader">
                      <div>
                        <div className="imageModalTitle">
                          {activeImageManagerRecord.customerName || '名称未設定'}
                        </div>
                        <div className="imageModalSubtitle">
                          {activeImageManagerRecord.customerId || 'IDなし'} / {activeImageManagerRecord.visitDate || ''}
                        </div>
                      </div>
                    </div>

                    <div className="imageModalBody">
                      {Array.isArray(activeImageManagerRecord.images) && activeImageManagerRecord.images.length ? (
                        <div className="imageModalGrid">
                          {activeImageManagerRecord.images.map((img) => (
                            <div key={img.id} className="imageTile">
                              <div className="imagePreview">
                                <img src={img.dataUrl} alt={img.fileName || 'upload'} />
                              </div>
                              <div className="imageMeta">
                                <div className="imageName" title={img.fileName}>
                                  {img.fileName || 'image'}
                                </div>
                                <button
                                  type="button"
                                  className="btn small danger"
                                  onClick={() => handleDeleteSavedImage(activeImageManagerRecord.id, img.id)}
                                >
                                  削除
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="mutedText">この履歴には画像がありません。</div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="mutedText">左の一覧から履歴を選択してください。</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {customerListOpen && (
        <div className="imageModalOverlay" onClick={handleCloseCustomerList}>
          <div className="imageModal" onClick={(e) => e.stopPropagation()}>
            <div className="imageModalHeader">
              <div>
                <div className="imageModalTitle">顧客一覧</div>
                <div className="imageModalSubtitle">顧客ID / お客様名（{customerList.length}件）</div>
              </div>
              <button type="button" className="btn small" onClick={handleCloseCustomerList}>
                閉じる
              </button>
            </div>
            <div className="imageModalBody">
              {customerList.length ? (
                <div className="customerSelectList">
                  {[...customerList]
                    .sort((a, b) => {
                      const aid = String(a.customerId || '')
                      const bid = String(b.customerId || '')
                      if (aid && bid) return aid.localeCompare(bid, 'ja')
                      if (aid && !bid) return -1
                      if (!aid && bid) return 1
                      return String(a.customerName || '').localeCompare(String(b.customerName || ''), 'ja')
                    })
                    .map((c) => (
                      <div key={c.customerKey || c.customerId || c.customerName} className="customerSelectButton">
                        <div className="customerRowTop">
                          <div className="customerName">{c.customerName || '名称未設定'}</div>
                          <div className="customerId">{c.customerId || 'IDなし'}</div>
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="mutedText">顧客がまだ登録されていません。</div>
              )}
            </div>
          </div>
        </div>
      )}

      {imageStorageInfoOpen && (
        <div className="imageModalOverlay" onClick={handleCloseImageStorageInfo}>
          <div className="imageModal" onClick={(e) => e.stopPropagation()}>
            <div className="imageModalHeader">
              <div>
                <div className="imageModalTitle">画像の保存場所について</div>
                <div className="imageModalSubtitle">このアプリで保存している画像の場所</div>
              </div>
              <button type="button" className="btn small" onClick={handleCloseImageStorageInfo}>
                閉じる
              </button>
            </div>
            <div className="imageModalBody">
              <div className="mutedText" style={{ lineHeight: 1.7 }}>
                このアプリの画像は、PCのフォルダにファイルとして保存されているわけではありません。ブラウザの保存領域（ローカルストレージ）に保存されています。
                <br />
                そのため、ボタンを押して「画像が入っているフォルダを開く」ことはできません。
                <br />
                画像の確認や削除は、上のメニューから「画像の確認/削除」をご利用ください。
              </div>
            </div>
          </div>
        </div>
      )}

      {storageViewerOpen && (
        <div className="imageModalOverlay" onClick={handleCloseStorageViewer}>
          <div className="imageModal" onClick={(e) => e.stopPropagation()}>
            <div className="imageModalHeader">
              <div>
                <div className="imageModalTitle">保存データ（ローカルストレージ）</div>
                <div className="imageModalSubtitle">
                  key: {storageSnapshot.key} / 履歴 {storageSnapshot.recordCount}件 / 画像 {storageSnapshot.imageCount}枚 / 目安 {bytesToHuman(storageSnapshot.approxBytes)}
                </div>
              </div>
              <button type="button" className="btn small" onClick={handleCloseStorageViewer}>
                閉じる
              </button>
            </div>
            <div className="imageModalBody">
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
                <button type="button" className="btn small" onClick={handleCopyStorageJson}>
                  JSONをコピー
                </button>
                <button type="button" className="btn small" onClick={handleDownloadStorageJson}>
                  JSONをダウンロード
                </button>
              </div>
              {storageSnapshot.raw ? (
                <textarea
                  className="textInput"
                  style={{ minHeight: '260px', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}
                  readOnly
                  value={storageSnapshot.raw}
                />
              ) : (
                <div className="mutedText">保存データがありません。</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
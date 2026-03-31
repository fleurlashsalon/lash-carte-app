import { useEffect, useMemo, useRef, useState } from 'react'
import { toPng } from 'html-to-image'
import { jsPDF } from 'jspdf'
import SectionCard from './components/SectionCard.jsx'
import BasicInfoForm from './components/BasicInfoForm.jsx'
import BasicInfoPurchaseList from './components/BasicInfoPurchaseList.jsx'
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
  clearAllRecords,
  clearPurchaseSuppressions,
  deleteRecord,
  forceResetPinToDefault,
  getPurchaseSuppressionsMap,
  getRecords,
  isGoogleConfigured,
  replaceRecords,
  savePdfToGoogle,
  savePurchaseSuppressionsMap,
  saveRecord,
  saveToGoogle,
} from './utils/storage.js'
import { buildCsv, exportScoreSheetCsv } from './utils/csvExport.js'
import { loadJapaneseFont } from './utils/pdfFont.js'
import {
  buildProductPurchaseRows,
  collectProductLabelsFromTreatmentDetails,
  getPurchaseCustomerKey,
  PRODUCT_DETAIL_BLOCK_IDS,
} from './utils/productPurchases.js'

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
  const [memoModalRecord, setMemoModalRecord] = useState(null)
  /** 名前で基本情報を読み込んだ際、「確認」付きメモの一覧 */
  const [reviewMemoListModal, setReviewMemoListModal] = useState(null)
  /** 顧客キーごとに、基本情報の購入一覧から隠す商品ラベル */
  const [purchaseSuppressionsByCustomer, setPurchaseSuppressionsByCustomer] = useState(() =>
    getPurchaseSuppressionsMap(),
  )
  /** 登録済み顧客の呼び出し確認（ブラウザconfirmではなくアプリ内モーダル） */
  const [customerMatchModal, setCustomerMatchModal] = useState(null)
  /** 任意「確認」チェック（保存時に記録へ含める） */
  const [reviewConfirmChecked, setReviewConfirmChecked] = useState(false)
  /** 保存データ呼び出し時に「確認」が付いていた場合のみ true（手動チェックでは true にしない） */
  const [reviewBangFromSave, setReviewBangFromSave] = useState(false)
  const [imageManagerOpen, setImageManagerOpen] = useState(false)
  const [imageManagerActiveRecordId, setImageManagerActiveRecordId] = useState('')
  const [imageToolsMenuOpen, setImageToolsMenuOpen] = useState(false)
  const [imageExportFrom, setImageExportFrom] = useState('')
  const [imageExportTo, setImageExportTo] = useState('')
  const [imageExportBusy, setImageExportBusy] = useState(false)
  const [customerSearch, setCustomerSearch] = useState({
    customerId: '',
    customerName: '',
    customerKana: '',
    phone: '',
  })
  const [customerSearchResults, setCustomerSearchResults] = useState([])
  const [customerSearchRan, setCustomerSearchRan] = useState(false)
  const [customerListMode, setCustomerListMode] = useState('search') // 'search' | 'list'
  const [customerListPage, setCustomerListPage] = useState(1)
  const [csvRangeOpen, setCsvRangeOpen] = useState(false)
  const [csvRangeFrom, setCsvRangeFrom] = useState('')
  const [csvRangeTo, setCsvRangeTo] = useState('')
  const [csvRangeBusy, setCsvRangeBusy] = useState(false)
  const [customerListOpen, setCustomerListOpen] = useState(false)
  const [csvMenuOpen, setCsvMenuOpen] = useState(false)
  const [showSaveToast, setShowSaveToast] = useState(false)
  const saveToastTimerRef = useRef(null)
  const csvInputRef = useRef(null)
  const suppressExistingNamePopupRef = useRef(false)
  /** 基本情報読込直後は同一照合モーダルが連続で出ないようにする */
  const suppressCustomerMatchUntilRef = useRef(0)
  const lastAutoLoadedCustomerIdRef = useRef('')
  const HISTORY_PAGE_SIZE = 10
  const [historyPage, setHistoryPage] = useState(1)

  useEffect(() => {
    forceResetPinToDefault() // パスワードを強制的に 0000 に戻す
    setRecords(getRecords())
  }, [])

  function getCustomerIdFromRecord(rec) {
    return String(rec.customerId || '').trim()
  }

  /** 同一顧客の履歴のうち「確認」チェックあり＋メモありを新しい順で集める */
  function buildReviewMemoListForCustomer(rec) {
    if (!rec) return []
    const cid = getCustomerIdFromRecord(rec)
    const name = String(rec.customerName || '').trim()
    return records
      .filter((r) => {
        const same = cid
          ? getCustomerIdFromRecord(r) === cid
          : !getCustomerIdFromRecord(r) && String(r.customerName || '').trim() === name
        if (!same) return false
        if (!r.reviewConfirmChecked) return false
        const memo =
          r.formValues && typeof r.formValues.memo === 'string' ? r.formValues.memo.trim() : ''
        return memo.length > 0
      })
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      .map((r) => ({
        id: r.id,
        visitDate: r.visitDate || '',
        treatmentMenu: r.treatmentMenu || r.menuType || '',
        memo:
          r.formValues && typeof r.formValues.memo === 'string' ? r.formValues.memo.trim() : '',
      }))
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

  /** 直近に登録された顧客ID（重複除外、最大5件） */
  function getRecentCustomerIds(limit = 5) {
    const sorted = [...records].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    const seen = new Set()
    const out = []
    for (const r of sorted) {
      const id = String(r?.customerId || '').trim()
      if (!id) continue
      if (seen.has(id)) continue
      seen.add(id)
      out.push(id)
      if (out.length >= limit) break
    }
    return out
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

  function normalizePhoneDigits(s) {
    return String(s || '').replace(/\D/g, '')
  }

  function getCustomerRecordKey(rec) {
    const id = getCustomerIdFromRecord(rec)
    if (id) return `ID:${id}`
    const n = String(rec.customerName || '').trim()
    return n ? `NOID:${n}` : ''
  }

  /**
   * 顧客ID・お客様名・カナ・電話のいずれかが一致する顧客を列挙（顧客ごとに最新履歴1件）
   */
  function findMatchingCustomersForBasicInfo({ customerId: cidIn, customerName, customerKana, phone }) {
    const idQ = String(cidIn || '').trim()
    const nameQ = String(customerName || '').trim()
    const kanaQ = String(customerKana || '').trim()
    const phoneQ = String(phone || '').trim()
    const phoneDigits = normalizePhoneDigits(phoneQ)
    if (!idQ && !nameQ && !kanaQ && !phoneQ && !phoneDigits.length) return []

    const keyToLatest = new Map()
    for (const r of records) {
      const key = getCustomerRecordKey(r)
      if (!key) continue
      const idMatch = idQ && getCustomerIdFromRecord(r) === idQ
      const nameMatch = nameQ && String(r.customerName || '').trim() === nameQ
      const kanaMatch = kanaQ && String(r.customerKana || '').trim() === kanaQ
      const phoneMatch = phoneDigits.length > 0 && normalizePhoneDigits(r.phone) === phoneDigits
      if (!idMatch && !nameMatch && !kanaMatch && !phoneMatch) continue
      const prev = keyToLatest.get(key)
      if (!prev || (r.createdAt || 0) > (prev.createdAt || 0)) {
        keyToLatest.set(key, r)
      }
    }
    return Array.from(keyToLatest.values()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
  }

  function formatCustomerMatchLabel(rec) {
    const id = getCustomerIdFromRecord(rec) || 'IDなし'
    const nm = rec.customerName || '名称未設定'
    const kn = (rec.customerKana || '').trim()
    const ph = (rec.phone || '').trim()
    return `${nm}${kn ? `（${kn}）` : ''} / ID: ${id}${ph ? ` / ${ph}` : ''}`
  }

  const menuFlags = useMemo(() => {
    return {
      isPerm: isPermMenu(menuType),
      isExt: isExtensionMenu(menuType),
    }
  }, [menuType])

  const purchaseRows = useMemo(() => {
    const key = getPurchaseCustomerKey(customerId, customerName)
    const suppressed = new Set(key ? purchaseSuppressionsByCustomer[key] || [] : [])
    return buildProductPurchaseRows({
      records,
      customerId,
      customerName,
      treatmentDetails,
      visitDate,
      suppressedLabels: suppressed,
    })
  }, [records, customerId, customerName, treatmentDetails, visitDate, purchaseSuppressionsByCustomer])

  useEffect(() => {
    const key = getPurchaseCustomerKey(customerId, customerName)
    if (!key) return
    const checked = new Set(collectProductLabelsFromTreatmentDetails(treatmentDetails))
    setPurchaseSuppressionsByCustomer((prev) => {
      const arr = prev[key]
      if (!arr?.length) return prev
      const nextArr = arr.filter((l) => !checked.has(l))
      if (nextArr.length === arr.length) return prev
      const next = { ...prev }
      if (nextArr.length) next[key] = nextArr
      else delete next[key]
      savePurchaseSuppressionsMap(next)
      return next
    })
  }, [treatmentDetails, customerId, customerName])

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
          phone: rec.phone || '',
          birthday: rec.birthday || '',
          address: rec.address || '',
        })
      }
    })

    return Array.from(map.values())
  }, [records])

  const sortedCustomerList = useMemo(() => {
    return [...customerList].sort((a, b) => {
      const aid = String(a.customerId || '')
      const bid = String(b.customerId || '')
      if (aid && bid) return aid.localeCompare(bid, 'ja')
      if (aid && !bid) return -1
      if (!aid && bid) return 1
      return String(a.customerName || '').localeCompare(String(b.customerName || ''), 'ja')
    })
  }, [customerList])

  const CUSTOMER_LIST_PAGE_SIZE = 15
  const customerListTotalPages = Math.max(1, Math.ceil(sortedCustomerList.length / CUSTOMER_LIST_PAGE_SIZE))
  const paginatedCustomerList = useMemo(() => {
    const start = (customerListPage - 1) * CUSTOMER_LIST_PAGE_SIZE
    return sortedCustomerList.slice(start, start + CUSTOMER_LIST_PAGE_SIZE)
  }, [sortedCustomerList, customerListPage])

  useEffect(() => {
    setCustomerListPage((p) => Math.min(p, customerListTotalPages))
  }, [customerListTotalPages])

  // 顧客IDが既に登録済みなら、登録されている基本情報を自動反映
  useEffect(() => {
    const id = String(customerId || '').trim()
    if (!id) {
      lastAutoLoadedCustomerIdRef.current = ''
      return
    }

    const timer = setTimeout(() => {
      // 同じIDでの再反映を抑制（入力中のチラつき防止）
      if (lastAutoLoadedCustomerIdRef.current === id) return

      const hit = records
        .slice()
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
        .find((r) => getCustomerIdFromRecord(r) === id)
      if (!hit) return

      lastAutoLoadedCustomerIdRef.current = id
      suppressExistingNamePopupRef.current = true

      setCustomerName(hit.customerName || '')
      setCustomerKana(hit.customerKana || '')
      setPhone(hit.phone || '')
      setBirthday(hit.birthday || '')
      setAddress(hit.address || '')
      setReviewConfirmChecked(Boolean(hit.reviewConfirmChecked))
      setReviewBangFromSave(Boolean(hit.reviewConfirmChecked))
      setSelectedCustomerId(id)
      setCompareIds([])

      setTimeout(() => {
        suppressExistingNamePopupRef.current = false
      }, 50)
    }, 200)

    return () => clearTimeout(timer)
  }, [customerId, records])

  // 基本情報の入力（顧客ID / お客様名）に合わせて、履歴一覧の表示対象を自動で切り替える
  useEffect(() => {
    const id = String(customerId || '').trim()
    const name = String(customerName || '').trim()

    // 顧客IDがあれば最優先でそのIDの履歴を表示
    if (id) {
      setSelectedCustomerId(id)
      setCompareIds([])
      return
    }

    // 顧客IDが空で、お客様名が既存と完全一致する場合はその顧客の履歴を表示
    if (name) {
      const existing = findExistingCustomerByName(name)
      if (existing) {
        const cid = getCustomerIdFromRecord(existing)
        setSelectedCustomerId(cid || `NOID:${name}`)
        setCompareIds([])
      }
    }
  }, [customerId, customerName, records])

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
    if (Object.prototype.hasOwnProperty.call(patch, 'reviewConfirmChecked')) {
      const v = Boolean(patch.reviewConfirmChecked)
      setReviewConfirmChecked(v)
      if (!v) setReviewBangFromSave(false)
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

  function handleRemovePurchaseLabel(label) {
    setTreatmentDetails((prev) => {
      let changed = false
      const next = { ...prev }
      for (const blockId of PRODUCT_DETAIL_BLOCK_IDS) {
        const block = next[blockId]
        const arr = block?.products
        if (!Array.isArray(arr) || !arr.includes(label)) continue
        changed = true
        next[blockId] = { ...block, products: arr.filter((x) => x !== label) }
      }
      return changed ? next : prev
    })

    const key = getPurchaseCustomerKey(customerId, customerName)
    if (!key) return

    setPurchaseSuppressionsByCustomer((prev) => {
      const existing = prev[key] || []
      if (existing.includes(label)) return prev
      const next = { ...prev, [key]: [...existing, label] }
      savePurchaseSuppressionsMap(next)
      return next
    })
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
          next.customerId = '使用済みの顧客IDです'
        }
      }
    }

    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleSave() {
    if (customerMatchModal) return
    if (!validate()) return

    let effectiveCustomerId = customerId.trim()
    if (!effectiveCustomerId && customerName.trim()) {
      const matches = findMatchingCustomersForBasicInfo({
        customerId: '',
        customerName,
        customerKana,
        phone,
      })
      if (matches.length > 0) {
        setCustomerMatchModal({ mode: 'save', matches })
        return
      }
      effectiveCustomerId = getNextAutoCustomerId()
      setCustomerId(effectiveCustomerId)
    }

    await executeSaveBody(effectiveCustomerId)
  }

  async function executeSaveBody(effectiveCustomerId) {
    // 毎回新しい履歴として保存する（過去履歴を上書きしない）
    const id = createId()
    const createdAt = Date.now()

    const normalizedImages = renameImagesForCustomerAndDate(images || [], customerName.trim(), visitDate || '')

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
      images: normalizedImages,
      createdAt,
      reviewConfirmChecked: Boolean(reviewConfirmChecked),
    }

    const next = saveRecord(record)
    setRecords(next)
    setCurrentId(id)
    setCurrentCreatedAt(createdAt)
    setSelectedCustomerId(record.customerId)
    setImages(normalizedImages)

    // blur/入力中の同名ポップアップ抑止を解除
    setTimeout(() => {
      suppressExistingNamePopupRef.current = false
    }, 50)

    // 画面上部に保存完了トーストを表示
    setShowSaveToast(true)
    if (saveToastTimerRef.current) {
      clearTimeout(saveToastTimerRef.current)
    }
    saveToastTimerRef.current = setTimeout(() => {
      setShowSaveToast(false)
    }, 2500)

    // 保存後は「基本情報」をリフレッシュ（履歴表示の選択中顧客は維持）
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
    setCompareIds([])
    setReviewConfirmChecked(false)
    setReviewBangFromSave(false)
    setReviewMemoListModal(null)
    setCustomerMatchModal(null)

    if (!isGoogleConfigured()) {
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
    setReviewConfirmChecked(false)
    setReviewBangFromSave(false)
    setReviewMemoListModal(null)
    setCustomerMatchModal(null)
  }

  function handleDeleteAllData() {
    const ok = window.confirm('全てのデータが削除されますがよろしいですか？\n（登録したお客様情報・画像・履歴が全て消えます）')
    if (!ok) return
    clearAllRecords()
    clearPurchaseSuppressions()
    setPurchaseSuppressionsByCustomer({})
    setRecords([])
    setImageManagerActiveRecordId('')
    setImageManagerOpen(false)
    setCustomerListOpen(false)
    setCsvMenuOpen(false)
    setCsvRangeOpen(false)
    handleRefresh()
  }

  function handleLoad(rec) {
    // 履歴から再表示する間は、既存お客様名ポップアップを抑制する
    suppressExistingNamePopupRef.current = true
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
    setReviewConfirmChecked(Boolean(rec.reviewConfirmChecked))
    setReviewBangFromSave(Boolean(rec.reviewConfirmChecked))
    window.scrollTo({ top: 0, behavior: 'smooth' })
    // 少し待ってからポップアップを再度有効化
    setTimeout(() => {
      suppressExistingNamePopupRef.current = false
    }, 50)
  }

  /** 登録済み同名ポップアップでYESのとき：基本情報のみ反映（スコア・ラジオ・画像は反映しない） */
  function handleLoadBasicInfoOnly(rec) {
    // 読み込み直後の連続ポップアップを抑止
    suppressExistingNamePopupRef.current = true
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
    setReviewConfirmChecked(Boolean(rec.reviewConfirmChecked))
    setReviewBangFromSave(Boolean(rec.reviewConfirmChecked))
    window.scrollTo({ top: 0, behavior: 'smooth' })

    const reviewMemoItems = buildReviewMemoListForCustomer(rec)
    setMemoModalRecord(null)
    if (reviewMemoItems.length) {
      setReviewMemoListModal({
        customerName: rec.customerName || '',
        customerId: getCustomerIdFromRecord(rec),
        items: reviewMemoItems,
      })
    } else {
      setReviewMemoListModal(null)
    }

    setTimeout(() => {
      suppressExistingNamePopupRef.current = false
      suppressCustomerMatchUntilRef.current = Date.now() + 800
    }, 50)
  }

  function handleCloseReviewMemoList() {
    setReviewMemoListModal(null)
  }

  function handleDelete(id) {
    const next = deleteRecord(id)
    setRecords(next)
    setCompareIds((prev) => prev.filter((x) => x !== id))
    if (currentId === id) {
      handleRefresh()
    }
  }

  function handleDeleteCustomer(customerKey, customerIdValue, customerNameValue) {
    const key = String(customerKey || '').trim()
    const cid = String(customerIdValue || '').trim()
    const name = String(customerNameValue || '').trim()

    const isNoId = key.startsWith('NOID:')
    const label = cid ? `顧客ID「${cid}」` : name ? `お客様名「${name}」` : 'この顧客'

    const targets = records.filter((r) => {
      if (isNoId) {
        const n = key.slice('NOID:'.length)
        return !getCustomerIdFromRecord(r) && String(r.customerName || '').trim() === n
      }
      return getCustomerIdFromRecord(r) === cid
    })

    if (!targets.length) {
      alert('削除対象の履歴が見つかりません')
      return
    }

    const ok = window.confirm(`${label} の履歴 ${targets.length}件 を削除しますか？\n（元に戻せません）`)
    if (!ok) return

    const next = records.filter((r) => !targets.some((t) => t.id === r.id))
    replaceRecords(next)
    setRecords(next)
    setCompareIds([])

    // 選択中顧客が削除対象なら解除
    if (selectedCustomerId === key || (!isNoId && selectedCustomerId === cid)) {
      setSelectedCustomerId('')
    }

    // 編集中の履歴が削除対象ならリフレッシュ
    if (currentId && targets.some((t) => t.id === currentId)) {
      handleRefresh()
    }
  }

  function handleSelectCustomer(customerIdValue) {
    setSelectedCustomerId(customerIdValue)
    setCompareIds([])
  }

  /** 顧客ID・お客様名・カナ・電話のいずれかからフォーカスが外れたとき、登録済みがあればアプリ内モーダルで確認（1回のみ・デバウンスなし） */
  function handleBasicInfoIdentityBlur() {
    if (suppressExistingNamePopupRef.current) return
    if (Date.now() < suppressCustomerMatchUntilRef.current) return

    const idQ = customerId.trim()
    const nameQ = customerName.trim()
    const kanaQ = customerKana.trim()
    const phoneQ = phone.trim()
    if (!idQ && !nameQ && !kanaQ && !phoneQ) return

    const matches = findMatchingCustomersForBasicInfo({
      customerId,
      customerName,
      customerKana,
      phone,
    })
    if (matches.length === 0) return
    if (matches.length === 1 && matches[0].id === currentId) return

    setCustomerMatchModal({ mode: 'blur', matches })
  }

  function handleCustomerMatchPick(rec) {
    setCustomerMatchModal(null)
    handleLoadBasicInfoOnly(rec)
  }

  function handleCustomerMatchCancelBlur(matches) {
    setCustomerMatchModal(null)
    const idTrim = String(customerId || '').trim()
    for (const rec of matches) {
      const cid = getCustomerIdFromRecord(rec)
      if (cid && idTrim === cid) {
        setCustomerId('')
        setSelectedCustomerId('')
        break
      }
    }
  }

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

  function handleOpenMemo(rec) {
    setMemoModalRecord(rec)
  }

  function handleCloseMemo() {
    setMemoModalRecord(null)
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

  function safeFilePart(input) {
    return String(input || '')
      .trim()
      .replace(/[\\/:*?"<>|\u0000-\u001F]/g, '_')
      .replace(/\s+/g, '_')
      .slice(0, 80)
  }

  function getImageExt(img) {
    const t = String(img?.type || '')
    if (t.includes('png')) return 'png'
    if (t.includes('jpeg') || t.includes('jpg')) return 'jpg'
    const dataUrl = String(img?.dataUrl || '')
    const m = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,/)
    const mime = m?.[1] || ''
    if (mime.includes('png')) return 'png'
    if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg'
    return 'jpg'
  }

  function renameImagesForCustomerAndDate(imagesList, customerNameValue, visitDateValue) {
    const list = Array.isArray(imagesList) ? imagesList : []
    const name = safeFilePart(customerNameValue || '名称未設定') || '名称未設定'
    const dateRaw = String(visitDateValue || '').trim()
    const date = /^\d{4}-\d{2}-\d{2}$/.test(dateRaw) ? dateRaw : safeFilePart(dateRaw || '日付未設定') || '日付未設定'

    return list.map((img, idx) => {
      const ext = getImageExt(img)
      const seq = String(idx + 1).padStart(2, '0')
      const nextName = `${name}_${date}_${seq}.${ext}`
      return { ...(img || {}), fileName: nextName }
    })
  }

  function buildImageFileName(rec, img, index) {
    const cid = safeFilePart(rec?.customerId || 'IDなし')
    const name = safeFilePart(rec?.customerName || '名称未設定')
    const date = safeFilePart(
      rec?.visitDate || (rec?.createdAt ? new Date(rec.createdAt).toISOString().slice(0, 10) : ''),
    )
    const ext = getImageExt(img)
    const base = safeFilePart(img?.fileName || `image_${String(index + 1).padStart(2, '0')}.${ext}`)
    const baseNoExt = base.replace(/\.[a-zA-Z0-9]+$/, '')
    return `${date ? date + '_' : ''}${cid}_${name}_${baseNoExt}.${ext}`
  }

  async function dataUrlToBlob(dataUrl) {
    const url = String(dataUrl || '')
    if (!url.startsWith('data:')) return null
    const res = await fetch(url)
    return await res.blob()
  }

  function downloadBlob(fileName, blob) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.setTimeout(() => URL.revokeObjectURL(url), 1500)
  }

  async function writeBlobToFileHandle(handle, blob) {
    const writable = await handle.createWritable()
    await writable.write(blob)
    await writable.close()
  }

  async function pickSaveHandle({ suggestedName, mime, extensions }) {
    try {
      if (window.top !== window.self) {
        alert('この画面（プレビュー/埋め込み表示）では保存先の指定ができません。外部ブラウザで開いてからお試しください。')
        return null
      }
      if (typeof window.showSaveFilePicker !== 'function') {
        return null
      }
      const accept =
        mime && Array.isArray(extensions) && extensions.length ? { [mime]: extensions } : undefined
      const types = accept ? [{ description: '保存', accept }] : undefined
      return await window.showSaveFilePicker({
        suggestedName: suggestedName || undefined,
        types,
      })
    } catch (e) {
      console.warn(e)
      return null
    }
  }

  async function saveBlobToUser({ blob, fileName, mime, extensions }) {
    // 1) File System Access API（対応ブラウザ: Chrome/Edge など）
    const handle = await pickSaveHandle({ suggestedName: fileName, mime, extensions })
    if (handle) {
      await writeBlobToFileHandle(handle, blob)
      return true
    }

    // 2) iOS/iPadOS など: 共有シートで「ファイルに保存」
    try {
      const f = new File([blob], fileName, { type: mime || 'application/octet-stream' })
      if (navigator.canShare && navigator.canShare({ files: [f] }) && navigator.share) {
        await navigator.share({ files: [f], title: fileName })
        return true
      }
    } catch (e) {
      console.warn(e)
    }

    // 3) 最後の手段: 通常ダウンロード（iPadでは「ダウンロード」から保存可能）
    downloadBlob(fileName, blob)
    return true
  }

  async function saveImagesAsZipWithPicker(items, zipName) {
    const { default: JSZip } = await import('jszip')
    const zip = new JSZip()

    for (let i = 0; i < items.length; i++) {
      const { rec, img, index } = items[i]
      // eslint-disable-next-line no-await-in-loop
      const blob = await dataUrlToBlob(img?.dataUrl)
      if (!blob) continue
      const fileName = buildImageFileName(rec, img, index)
      zip.file(fileName, blob)
    }

    const zipBlob = await zip.generateAsync({ type: 'blob' })
    await saveBlobToUser({
      blob: zipBlob,
      fileName: zipName,
      mime: 'application/zip',
      extensions: ['.zip'],
    })
    return true
  }

  function getRecordDateKey(rec) {
    const v = String(rec?.visitDate || '').trim()
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v
    const c = rec?.createdAt ? new Date(rec.createdAt).toISOString().slice(0, 10) : ''
    return c
  }

  async function handleSaveSingleImage(rec, img, index) {
    try {
      setImageExportBusy(true)
      const fileName = buildImageFileName(rec, img, index)
      const ext = getImageExt(img)
      const mime = ext === 'png' ? 'image/png' : 'image/jpeg'
      const blob = await dataUrlToBlob(img?.dataUrl)
      if (!blob) return
      await saveBlobToUser({
        blob,
        fileName,
        mime,
        extensions: [`.${ext}`],
      })
    } catch (e) {
      console.error(e)
      alert('保存に失敗しました')
    } finally {
      setImageExportBusy(false)
    }
  }

  function buildBulkItemsAll() {
    const items = []
    recordsWithImages.forEach((rec) => {
      const imgs = Array.isArray(rec.images) ? rec.images : []
      imgs.forEach((img, index) => {
        items.push({ rec, img, index })
      })
    })
    return items
  }

  function buildBulkItemsByRange() {
    const from = String(imageExportFrom || '').trim()
    const to = String(imageExportTo || '').trim()

    const subset = recordsWithImages.filter((r) => {
      const d = getRecordDateKey(r)
      if (!d) return false
      if (from && d < from) return false
      if (to && d > to) return false
      return true
    })

    const items = []
    subset.forEach((rec) => {
      const imgs = Array.isArray(rec.images) ? rec.images : []
      imgs.forEach((img, index) => {
        items.push({ rec, img, index })
      })
    })
    return items
  }

  async function handleBulkSaveClick(mode) {
    const items = mode === 'range' ? buildBulkItemsByRange() : buildBulkItemsAll()
    if (!items.length) {
      alert('出力データがありません')
      return
    }

    try {
      setImageExportBusy(true)
      const now = new Date()
      const ts = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(
        now.getHours(),
      ).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`
      const from = safeFilePart(imageExportFrom || 'from')
      const to = safeFilePart(imageExportTo || 'to')
      const zipName = mode === 'range' ? `images_${from}-${to}_${ts}.zip` : `images_all_${ts}.zip`

      const ok = await saveImagesAsZipWithPicker(items, zipName)
      if (!ok) return
    } catch (e) {
      console.error(e)
      alert('保存に失敗しました')
    } finally {
      setImageExportBusy(false)
    }
  }

  function handleOpenCustomerList() {
    setCustomerSearch((prev) => ({
      customerId: prev.customerId || '',
      customerName: prev.customerName || '',
      customerKana: prev.customerKana || '',
      phone: prev.phone || '',
    }))
    setCustomerSearchResults([])
    setCustomerSearchRan(false)
    setCustomerListMode('search')
    setCustomerListPage(1)
    setCustomerListOpen(true)
  }

  function handleCloseCustomerList() {
    setCustomerListOpen(false)
  }

  function handleRunCustomerSearch() {
    const qId = String(customerSearch.customerId || '').trim().toLowerCase()
    const qName = String(customerSearch.customerName || '').trim().toLowerCase()
    const qKana = String(customerSearch.customerKana || '').trim().toLowerCase()
    const qPhone = String(customerSearch.phone || '').trim().toLowerCase()

    setCustomerSearchRan(true)

    if (!qId && !qName && !qKana && !qPhone) {
      setCustomerSearchResults([])
      return
    }

    const results = customerList
      .filter((c) => {
        const id = String(c.customerId || '').toLowerCase()
        const name = String(c.customerName || '').toLowerCase()
        const kana = String(c.customerKana || '').toLowerCase()
        const phone = String(c.phone || '').toLowerCase()
        if (qId && !id.includes(qId)) return false
        if (qName && !name.includes(qName)) return false
        if (qKana && !kana.includes(qKana)) return false
        if (qPhone && !phone.includes(qPhone)) return false
        return true
      })
      .sort((a, b) => {
        const aid = String(a.customerId || '')
        const bid = String(b.customerId || '')
        if (aid && bid) return aid.localeCompare(bid, 'ja')
        if (aid && !bid) return -1
        if (!aid && bid) return 1
        return String(a.customerName || '').localeCompare(String(b.customerName || ''), 'ja')
      })

    setCustomerSearchResults(results)
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

  function exportCsvOrAlert({ rows, headers, fileName }) {
    return exportScoreSheetCsv({ rows, headers, fileName })
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
      reviewConfirmChecked: Boolean(r.reviewConfirmChecked),
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
    'reviewConfirmChecked',
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
    const sourceRecords = records
    if (!sourceRecords.length) {
      alert('エクスポートできる履歴がありません')
      return
    }

    const input = window.prompt('エクスポートしたい顧客IDを入力してください（例: A-00001）', customerId.trim() || '')
    const targetId = String(input || '').trim()
    if (!targetId) return

    const subset = sourceRecords
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

    const ok = exportCsvOrAlert({ rows, headers: CSV_HEADERS_ALL, fileName })
    if (!ok) return
    setCsvMenuOpen(false)
  }

  function handleExportCsvByCustomerIdAndDatePrompt() {
    const sourceRecords = records
    if (!sourceRecords.length) {
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

    const subset = sourceRecords
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

    const ok = exportCsvOrAlert({ rows, headers: CSV_HEADERS_ALL, fileName })
    if (!ok) return
    setCsvMenuOpen(false)
  }

  function getRecordDateForExport(rec) {
    const v = String(rec?.visitDate || '').trim()
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v
    if (rec?.createdAt) return new Date(rec.createdAt).toISOString().slice(0, 10)
    return ''
  }

  function handleExportCsvByDateRangePrompt() {
    const sourceRecords = records
    if (!sourceRecords.length) {
      alert('エクスポートできる履歴がありません')
      return
    }

    const fromInput = window.prompt('開始日を入力してください（例: 2026-03-11）', '')
    const from = String(fromInput || '').trim()
    if (!from) return

    const toInput = window.prompt('終了日を入力してください（例: 2026-03-18）', '')
    const to = String(toInput || '').trim()
    if (!to) return

    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      alert('日付形式が正しくありません（YYYY-MM-DD）')
      return
    }
    if (from > to) {
      alert('開始日が終了日より後になっています')
      return
    }

    const subset = sourceRecords
      .slice()
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      .filter((r) => {
        const d = getRecordDateForExport(r)
        if (!d) return false
        return d >= from && d <= to
      })

    if (!subset.length) {
      alert(`期間「${from}〜${to}」の履歴がありません`)
      return
    }

    const rows = subset.map(recordToAllRow)
    const now = new Date()
    const ts = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(
      now.getHours(),
    ).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`
    const fileName = `fleur-carte-range-${from}-to-${to}-${ts}.csv`

    const ok = exportCsvOrAlert({ rows, headers: CSV_HEADERS_ALL, fileName })
    if (!ok) return
    setCsvMenuOpen(false)
  }

  async function exportCsvDateRangeAsZip({ from, to }) {
    const sourceRecords = records
    if (!sourceRecords.length) {
      alert('エクスポートできる履歴がありません')
      return
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      alert('日付形式が正しくありません（YYYY-MM-DD）')
      return
    }
    if (from > to) {
      alert('開始日が終了日より後になっています')
      return
    }

    const now = new Date()
    const ts = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(
      now.getHours(),
    ).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`
    const zipName = `fleur-carte-csv-${from}-to-${to}-${ts}.zip`

    const subset = sourceRecords
      .slice()
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      .filter((r) => {
        const d = getRecordDateForExport(r)
        if (!d) return false
        return d >= from && d <= to
      })

    if (!subset.length) {
      alert(`期間「${from}〜${to}」の履歴がありません`)
      return
    }

    const rows = subset.map(recordToAllRow)
    const csv = buildCsv(rows, CSV_HEADERS_ALL)
    const csvContent = String(csv ?? '')
    const csvBlob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })

    const { default: JSZip } = await import('jszip')
    const zip = new JSZip()
    zip.file(`fleur-carte-${from}-to-${to}.csv`, csvBlob)
    const zipBlob = await zip.generateAsync({ type: 'blob' })
    await saveBlobToUser({
      blob: zipBlob,
      fileName: zipName,
      mime: 'application/zip',
      extensions: ['.zip'],
    })
  }

  function handleExportCsv(mode) {
    // 画面で使用している保存データ（records state）と参照先を統一
    const sourceRecords = records
    if (!sourceRecords.length) {
      alert('出力データがありません')
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
      const sorted = [...sourceRecords].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      sorted.forEach((r) => {
        const id = r.customerId || ''
        if (!id || map.has(id)) return
        const count = sourceRecords.filter((x) => x.customerId === id).length
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
      rows = sourceRecords
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
      rows = sourceRecords
        .slice()
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
        .map(recordToAllRow)
      headers = CSV_HEADERS_ALL
    } else {
      return
    }

    const ok = exportCsvOrAlert({ rows, headers, fileName })
    if (!ok) return
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
    const bool = (v) => {
      if (v === '' || v == null) return false
      const s = String(v).trim().toLowerCase()
      return s === 'true' || s === '1' || s === 'yes' || s === 'y'
    }
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
      reviewConfirmChecked: bool(row.reviewConfirmChecked),
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
      {showSaveToast && (
        <div className="saveToast">
          <span>保存しました</span>
        </div>
      )}
      <header className="appHeader">
        <div>
          <div className="appTitle">Fleur Lash</div>
        </div>
        <div className="headerActions">
          <button
            type="button"
            className="btn primary"
            onMouseDown={() => {
              // 保存ボタン押下で氏名inputがblurする際の同名ポップアップを抑止（クリックが潰れるのを防ぐ）
              suppressExistingNamePopupRef.current = true
            }}
            onClick={handleSave}
          >
            保存
          </button>
          <div className="csvMenuWrap">
            <button type="button" className="btn" onClick={handleToggleImageToolsMenu}>
              画像
            </button>
            {imageToolsMenuOpen && (
              <div className="csvMenu" style={{ top: '100%', right: 0, left: 'auto', flexDirection: 'column' }}>
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
                  onClick={() => {
                    setCsvMenuOpen(false)
                    setCsvRangeOpen(true)
                    setCsvRangeFrom('')
                    setCsvRangeTo('')
                  }}
                >
                  期間出力
                </button>
                <button
                  type="button"
                  className="btn small"
                  onClick={() => handleExportCsv('all')}
                >
                  全件
                </button>
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
            PDF
          </button>
          <button type="button" className="btn" onClick={handleRefresh}>
            リフレッシュ
          </button>
          <button type="button" className="btn danger" onClick={handleDeleteAllData}>
            データ削除
          </button>
        </div>
      </header>

      <main className="layout">
        <div className="colLeft">
          <SectionCard
            title="基本情報"
            titleRight={
              reviewBangFromSave && reviewConfirmChecked ? (
                <span className="basicInfoReviewBang" title="保存時に「確認」が付いたデータを表示中">
                  !
                </span>
              ) : null
            }
            right={
              <label className="basicInfoConfirmCheck">
                <input
                  type="checkbox"
                  checked={reviewConfirmChecked}
                  onChange={(e) => updateBasicInfo({ reviewConfirmChecked: e.target.checked })}
                />
                <span>確認</span>
              </label>
            }
          >
            <BasicInfoForm
              customerId={customerId}
              customerName={customerName}
              customerKana={customerKana}
              phone={phone}
              treatmentMenu={menuType}
              visitDate={visitDate}
              onChange={updateBasicInfo}
              onIdentityFieldsBlur={handleBasicInfoIdentityBlur}
              errors={errors}
            />
            <BasicInfoPurchaseList rows={purchaseRows} onRemove={handleRemovePurchaseLabel} />
          </SectionCard>

          <SectionCard title="画像アップロード" subtitle="jpg / jpeg / png（複数可）">
            <div id="pdf-images">
              <ImageUploadField
                images={images}
                onChange={(next) => {
                  setImages((prev) => {
                    const arr = typeof next === 'function' ? next(prev) : next
                    return renameImagesForCustomerAndDate(arr, customerName.trim(), visitDate || '')
                  })
                }}
              />
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
              onOpenMemo={handleOpenMemo}
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

      {memoModalRecord && (
        <div className="imageModalOverlay" onClick={handleCloseMemo}>
          <div className="imageModal" onClick={(e) => e.stopPropagation()}>
            <div className="imageModalHeader">
              <div>
                <div className="imageModalTitle">{memoModalRecord.customerName || '名称未設定'}</div>
                <div className="imageModalSubtitle">
                  {memoModalRecord.customerId || ''} / {memoModalRecord.visitDate || ''}
                  {memoModalRecord.reviewConfirmChecked &&
                  memoModalRecord.formValues &&
                  String(memoModalRecord.formValues.memo || '').trim() ? (
                    <span className="reviewMemoModalTag"> ・要確認</span>
                  ) : null}
                </div>
              </div>
              <button type="button" className="btn small" onClick={handleCloseMemo}>
                閉じる
              </button>
            </div>
            <div className="imageModalBody">
              <textarea
                className="textInput"
                style={{ minHeight: '200px' }}
                readOnly
                value={
                  memoModalRecord.formValues && typeof memoModalRecord.formValues.memo === 'string'
                    ? memoModalRecord.formValues.memo
                    : ''
                }
              />
            </div>
          </div>
        </div>
      )}

      {reviewMemoListModal && reviewMemoListModal.items?.length ? (
        <div className="imageModalOverlay" onClick={handleCloseReviewMemoList}>
          <div className="imageModal" onClick={(e) => e.stopPropagation()}>
            <div className="imageModalHeader">
              <div>
                <div className="imageModalTitle">要確認メモ一覧</div>
                <div className="imageModalSubtitle">
                  {reviewMemoListModal.customerName || '名称未設定'}
                  {reviewMemoListModal.customerId ? ` / ID: ${reviewMemoListModal.customerId}` : ''}
                  <span className="reviewMemoModalTag">（過去に「確認」付きで保存されたメモ）</span>
                </div>
              </div>
              <button type="button" className="btn small" onClick={handleCloseReviewMemoList}>
                閉じる
              </button>
            </div>
            <div className="imageModalBody">
              <div className="reviewMemoListScroll">
                {reviewMemoListModal.items.map((item) => (
                  <div key={item.id} className="reviewMemoListItem">
                    <div className="reviewMemoListMeta">
                      {item.visitDate || '日付未設定'} ・ {item.treatmentMenu || 'メニュー未設定'}
                    </div>
                    <div className="reviewMemoListText">{item.memo}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {customerMatchModal && customerMatchModal.matches?.length ? (
        <div
          className="imageModalOverlay"
          onClick={() => {
            if (customerMatchModal.mode === 'blur') {
              handleCustomerMatchCancelBlur(customerMatchModal.matches)
            } else {
              setCustomerMatchModal(null)
            }
          }}
        >
          <div className="imageModal customerMatchModal" onClick={(e) => e.stopPropagation()}>
            <div className="imageModalHeader">
              <div>
                <div className="imageModalTitle">
                  {customerMatchModal.matches.length > 1
                    ? customerMatchModal.mode === 'blur'
                      ? '複数のお客様が一致しました'
                      : '複数の登録済みが見つかりました'
                    : customerMatchModal.mode === 'blur'
                      ? '登録済みのお客様が見つかりました'
                      : '登録済みお客様との一致'}
                </div>
                <div className="imageModalSubtitle">
                  {customerMatchModal.mode === 'blur'
                    ? customerMatchModal.matches.length > 1
                      ? '呼び出すお客様を選んでください。キャンセルはそのまま入力を続けます。'
                      : 'このお客様の基本情報を読み込みますか？'
                    : '読み込むか、新規の顧客IDを採番して保存するか選んでください。'}
                </div>
              </div>
              <button
                type="button"
                className="btn small"
                onClick={() => {
                  if (customerMatchModal.mode === 'blur') {
                    handleCustomerMatchCancelBlur(customerMatchModal.matches)
                  } else {
                    setCustomerMatchModal(null)
                  }
                }}
              >
                {customerMatchModal.mode === 'blur' ? 'キャンセル' : '閉じる'}
              </button>
            </div>
            <div className="imageModalBody">
              <div className="customerMatchModalStack">
                {customerMatchModal.matches.map((rec) => (
                  <button
                    key={rec.id}
                    type="button"
                    className="btn primary customerMatchPickBtn"
                    onClick={() => handleCustomerMatchPick(rec)}
                  >
                    {formatCustomerMatchLabel(rec)} を読み込む
                  </button>
                ))}
                {customerMatchModal.mode === 'save' ? (
                  <div className="customerMatchSaveActions">
                    <button
                      type="button"
                      className="btn"
                      onClick={() => {
                        setCustomerMatchModal(null)
                        const newId = getNextAutoCustomerId()
                        setCustomerId(newId)
                        void executeSaveBody(newId)
                      }}
                    >
                      新規顧客として保存（採番）
                    </button>
                    <p className="mutedText" style={{ margin: 0, fontSize: 12 }}>
                      上記いずれでもない場合は新規採番して保存できます。
                    </p>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="btn subtle"
                    onClick={() => handleCustomerMatchCancelBlur(customerMatchModal.matches)}
                  >
                    キャンセル（そのまま直接入力）
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

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
              <div className="imageModalHeaderRight">
                <div className="imageManagerRange">
                  <input
                    type="date"
                    className="textInput"
                    value={imageExportFrom}
                    onChange={(e) => setImageExportFrom(e.target.value)}
                  />
                  <span className="mutedText">〜</span>
                  <input
                    type="date"
                    className="textInput"
                    value={imageExportTo}
                    onChange={(e) => setImageExportTo(e.target.value)}
                  />
                  <button
                    type="button"
                    className="btn small"
                    onClick={() => handleBulkSaveClick('range')}
                    disabled={imageExportBusy}
                  >
                    期間保存
                  </button>
                  <button
                    type="button"
                    className="btn small"
                    onClick={() => handleBulkSaveClick('all')}
                    disabled={imageExportBusy}
                  >
                    画像一括保存
                  </button>
                  <button type="button" className="btn small" onClick={handleCloseImageManager}>
                    閉じる
                  </button>
                </div>
              </div>
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
                      <div className="imageManagerHeaderTop">
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
                          {activeImageManagerRecord.images.map((img, index) => (
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
                                  className="btn small"
                                  disabled={imageExportBusy}
                                  onClick={() => handleSaveSingleImage(activeImageManagerRecord, img, index)}
                                >
                                  保存
                                </button>
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
                <div className="imageModalTitle">顧客検索</div>
                <div className="imageModalSubtitle">
                  直近の顧客ID（過去5件）：{getRecentCustomerIds(5).length ? getRecentCustomerIds(5).join(' / ') : 'なし'}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <div className="mutedText" style={{ fontSize: 12, fontWeight: 800 }}>
                  登録済み顧客{customerList.length}名
                </div>
                <button type="button" className="btn small" onClick={handleCloseCustomerList}>
                  閉じる
                </button>
              </div>
            </div>
            <div className="imageModalBody">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'flex-end', marginBottom: '12px' }}>
                <div className="field" style={{ minWidth: 180, flex: '1 1 180px' }}>
                  <label className="inputLabel">顧客ID</label>
                  <input
                    className="textInput"
                    value={customerSearch.customerId}
                    onChange={(e) => setCustomerSearch((p) => ({ ...p, customerId: e.target.value }))}
                    placeholder="例) A-00001"
                  />
                </div>
                <div className="field" style={{ minWidth: 180, flex: '1 1 180px' }}>
                  <label className="inputLabel">お客様名</label>
                  <input
                    className="textInput"
                    value={customerSearch.customerName}
                    onChange={(e) => setCustomerSearch((p) => ({ ...p, customerName: e.target.value }))}
                    placeholder="例) 山田 花子"
                  />
                </div>
                <div className="field" style={{ minWidth: 180, flex: '1 1 180px' }}>
                  <label className="inputLabel">氏名（カナ）</label>
                  <input
                    className="textInput"
                    value={customerSearch.customerKana}
                    onChange={(e) => setCustomerSearch((p) => ({ ...p, customerKana: e.target.value }))}
                    placeholder="例) ヤマダ"
                  />
                </div>
                <div className="field" style={{ minWidth: 180, flex: '1 1 180px' }}>
                  <label className="inputLabel">電話番号</label>
                  <input
                    className="textInput"
                    value={customerSearch.phone}
                    onChange={(e) => setCustomerSearch((p) => ({ ...p, phone: e.target.value }))}
                    placeholder="例) 090"
                  />
                </div>
                <button type="button" className="btn" onClick={handleRunCustomerSearch}>
                  検索
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    setCustomerListMode((m) => (m === 'list' ? 'search' : 'list'))
                    setCustomerListPage(1)
                  }}
                >
                  {customerListMode === 'list' ? '検索表示' : '一覧表示'}
                </button>
              </div>

              {customerListMode === 'list' ? (
                sortedCustomerList.length ? (
                  <>
                    <div className="customerSelectList">
                      {paginatedCustomerList.map((c) => (
                        <div key={c.customerKey || c.customerId || c.customerName} className="customerSelectButton">
                          <div className="customerRowTop">
                            <div className="customerName">{c.customerName || '名称未設定'}</div>
                            <div className="customerId">{c.customerId || 'IDなし'}</div>
                            <button
                              type="button"
                              className="btn small danger"
                              onClick={() => handleDeleteCustomer(c.customerKey || c.customerId, c.customerId, c.customerName)}
                              style={{ marginLeft: '8px' }}
                            >
                              削除
                            </button>
                          </div>
                          <div className="mutedText" style={{ marginTop: 6 }}>
                            {c.customerKana || 'カナ未登録'} / {c.phone || '電話未登録'}
                          </div>
                        </div>
                      ))}
                    </div>
                    {sortedCustomerList.length > CUSTOMER_LIST_PAGE_SIZE ? (
                      <div className="historyPagination">
                        <span className="historyPaginationInfo">
                          {sortedCustomerList.length}件中 {(customerListPage - 1) * CUSTOMER_LIST_PAGE_SIZE + 1}–
                          {Math.min(customerListPage * CUSTOMER_LIST_PAGE_SIZE, sortedCustomerList.length)}件目
                        </span>
                        <div className="historyPaginationControls">
                          <button
                            type="button"
                            className="btn small"
                            disabled={customerListPage <= 1}
                            onClick={() => setCustomerListPage((p) => Math.max(1, p - 1))}
                          >
                            前へ
                          </button>
                          <span className="historyPaginationPages">
                            {Array.from({ length: customerListTotalPages }, (_, i) => i + 1).map((p) => (
                              <button
                                key={p}
                                type="button"
                                className={`btn small ${customerListPage === p ? 'primary' : ''}`}
                                onClick={() => setCustomerListPage(p)}
                              >
                                {p}
                              </button>
                            ))}
                          </span>
                          <button
                            type="button"
                            className="btn small"
                            disabled={customerListPage >= customerListTotalPages}
                            onClick={() => setCustomerListPage((p) => Math.min(customerListTotalPages, p + 1))}
                          >
                            次へ
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div className="mutedText">顧客がまだ登録されていません。</div>
                )
              ) : customerSearchRan ? (
                customerSearchResults.length ? (
                  <div className="customerSelectList">
                    {customerSearchResults.map((c) => (
                      <div key={c.customerKey || c.customerId || c.customerName} className="customerSelectButton">
                        <div className="customerRowTop">
                          <div className="customerName">{c.customerName || '名称未設定'}</div>
                          <div className="customerId">{c.customerId || 'IDなし'}</div>
                          <button
                            type="button"
                            className="btn small danger"
                            onClick={() => handleDeleteCustomer(c.customerKey || c.customerId, c.customerId, c.customerName)}
                            style={{ marginLeft: '8px' }}
                          >
                            削除
                          </button>
                        </div>
                        <div className="mutedText" style={{ marginTop: 6 }}>
                          {c.customerKana || 'カナ未登録'} / {c.phone || '電話未登録'}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mutedText">該当顧客がありません。</div>
                )
              ) : (
                <div className="mutedText">検索条件を入力して「検索」を押してください。</div>
              )}
            </div>
          </div>
        </div>
      )}

      {csvRangeOpen && (
        <div className="imageModalOverlay" onClick={() => setCsvRangeOpen(false)}>
          <div className="imageModal" onClick={(e) => e.stopPropagation()}>
            <div className="imageModalHeader">
              <div>
                <div className="imageModalTitle">CSV 期間出力（ZIP）</div>
                <div className="imageModalSubtitle">期間内の履歴をCSVにしてZIPで保存します</div>
              </div>
              <button type="button" className="btn small" onClick={() => setCsvRangeOpen(false)} disabled={csvRangeBusy}>
                閉じる
              </button>
            </div>
            <div className="imageModalBody">
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div className="field" style={{ minWidth: 180 }}>
                  <label className="inputLabel">開始日</label>
                  <input
                    type="date"
                    className="textInput"
                    value={csvRangeFrom}
                    onChange={(e) => setCsvRangeFrom(e.target.value)}
                  />
                </div>
                <div className="field" style={{ minWidth: 180 }}>
                  <label className="inputLabel">終了日</label>
                  <input
                    type="date"
                    className="textInput"
                    value={csvRangeTo}
                    onChange={(e) => setCsvRangeTo(e.target.value)}
                  />
                </div>
                <button
                  type="button"
                  className="btn primary"
                  disabled={csvRangeBusy}
                  onClick={async () => {
                    try {
                      setCsvRangeBusy(true)
                      await exportCsvDateRangeAsZip({ from: csvRangeFrom, to: csvRangeTo })
                      setCsvRangeOpen(false)
                    } catch (e) {
                      console.error(e)
                      alert('保存に失敗しました')
                    } finally {
                      setCsvRangeBusy(false)
                    }
                  }}
                >
                  保存先を指定してZIP保存
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
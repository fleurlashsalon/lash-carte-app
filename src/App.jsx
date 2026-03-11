import { useEffect, useMemo, useState } from 'react'
import SectionCard from './components/SectionCard.jsx'
import BasicInfoForm from './components/BasicInfoForm.jsx'
import HorizontalRadioGroup from './components/HorizontalRadioGroup.jsx'
import ScoreSummary from './components/ScoreSummary.jsx'
import RadarScoreChart from './components/RadarScoreChart.jsx'
import HistoryList from './components/HistoryList.jsx'
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
import { deleteRecord, getRecords, saveRecord } from './utils/storage.js'

const INITIAL_FORM = {
  // structure
  eyeShape: undefined,
  eyelid: undefined,
  lashDirection: undefined,
  asymmetry: undefined,
  // lifestyle
  workEnvironment: undefined,
  sleepPosture: undefined,
  makeup: undefined,
  faceWash: undefined,
  ledChecked: false,
  // condition
  thickness: undefined,
  density: undefined,
  turnover: undefined,
  moisture: undefined,
  habit: undefined,
}

export default function App() {
  const [customerName, setCustomerName] = useState('')
  const [visitDate, setVisitDate] = useState(getTodayString())
  const [menuType, setMenuType] = useState('')
  const [formValues, setFormValues] = useState(INITIAL_FORM)
  const [errors, setErrors] = useState({})
  const [records, setRecords] = useState([])
  const [currentId, setCurrentId] = useState(null)
  const [currentCreatedAt, setCurrentCreatedAt] = useState(null)

  useEffect(() => {
    setRecords(getRecords())
  }, [])

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

  function updateBasicInfo(patch) {
    if (Object.prototype.hasOwnProperty.call(patch, 'customerName')) setCustomerName(patch.customerName)
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
    setErrors((prev) => ({ ...prev, ...Object.fromEntries(Object.keys(patch).map((k) => [k, undefined])) }))
  }

  function setAnswer(key, value) {
    setFormValues((prev) => ({ ...prev, [key]: value }))
  }

  function validate() {
    const next = {}
    if (!customerName.trim()) next.customerName = 'お客様名を入力してください'
    if (!visitDate) next.visitDate = '日付を入力してください'
    if (!menuType) next.menuType = '施術メニューを選択してください'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  function handleSave() {
    if (!validate()) return

    const id = currentId ?? createId()
    const createdAt = currentCreatedAt ?? Date.now()

    const record = {
      id,
      customerName: customerName.trim(),
      visitDate,
      menuType,
      formValues,
      structureScore,
      structureRank,
      lifestyleScore,
      lifestyleRank,
      conditionScore,
      conditionRank,
      createdAt,
    }

    const next = saveRecord(record)
    setRecords(next)
    setCurrentId(id)
    setCurrentCreatedAt(createdAt)
  }

  function handleReset() {
    setCustomerName('')
    setVisitDate(getTodayString())
    setMenuType('')
    setFormValues(INITIAL_FORM)
    setErrors({})
    setCurrentId(null)
    setCurrentCreatedAt(null)
  }

  function handleLoad(rec) {
    setCustomerName(rec.customerName || '')
    setVisitDate(rec.visitDate || getTodayString())
    setMenuType(rec.menuType || '')
    setFormValues({ ...INITIAL_FORM, ...(rec.formValues || {}) })
    setErrors({})
    setCurrentId(rec.id)
    setCurrentCreatedAt(rec.createdAt || Date.now())
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleDelete(id) {
    const next = deleteRecord(id)
    setRecords(next)
    if (currentId === id) {
      handleReset()
    }
  }

  const workEnvQuestion = menuFlags.isPerm ? WORK_ENV_PERM : menuFlags.isExt ? WORK_ENV_EXTENSIONS : null

  return (
    <div className="appShell">
      <header className="appHeader">
        <div>
          <div className="appTitle">カルテスコア可視化</div>
          <div className="appSubtitle">入力 → スコア → レーダー表示 → 保存/履歴</div>
        </div>
        <div className="headerActions">
          <button type="button" className="btn primary" onClick={handleSave}>
            保存
          </button>
          <button type="button" className="btn" onClick={handleReset}>
            リセット
          </button>
        </div>
      </header>

      <main className="layout">
        <div className="colLeft">
          <SectionCard title="基本情報" subtitle="お客様名・日付・施術メニュー">
            <BasicInfoForm
              customerName={customerName}
              visitDate={visitDate}
              menuType={menuType}
              onChange={updateBasicInfo}
              errors={errors}
            />
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
            <RadarScoreChart data={chartData} />
          </SectionCard>

          <SectionCard title="履歴一覧" subtitle="新しい順 / 再表示・削除ができます">
            <HistoryList records={records} onLoad={handleLoad} onDelete={handleDelete} />
          </SectionCard>
        </div>
      </main>
    </div>
  )
}

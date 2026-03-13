import { BLOCK_LABELS, getFieldLabel } from '../utils/treatmentFormDefs.js'

function formatDetailValue(v) {
  if (v === undefined || v === null) return ''
  if (Array.isArray(v)) return v.length ? v.join('・') : ''
  return String(v)
}

function renderBlockDetails(blockId, data) {
  if (!data || typeof data !== 'object') return null
  const entries = Object.entries(data).filter(
    ([, v]) => v !== undefined && v !== '' && (Array.isArray(v) ? v.length > 0 : true),
  )
  if (!entries.length) return null
  const title = BLOCK_LABELS[blockId] || blockId
  return (
    <div key={blockId} className="historyTreatmentBlock">
      <div className="historyTreatmentBlockTitle">{title}</div>
      <div className="historyTreatmentBlockFields">
        {entries.map(([k, v]) => (
          <span key={k} className="historyTreatmentItem">
            {getFieldLabel(blockId, k)}: {formatDetailValue(v)}
          </span>
        ))}
      </div>
    </div>
  )
}

export default function HistoryList({
  records,
  onLoad,
  onDelete,
  compareIds = [],
  onToggleCompare,
  onOpenImages,
  onOpenMemo,
}) {
  if (!records.length) {
    return <div className="mutedText">該当する履歴がありません。</div>
  }

  return (
    <div className="historyList">
      {records.map((rec) => {
        const checked = compareIds.includes(rec.id)
        const hasImages = Array.isArray(rec.images) && rec.images.length > 0
        const memoText =
          rec.formValues && typeof rec.formValues.memo === 'string'
            ? rec.formValues.memo.trim()
            : ''
        const hasMemo = Boolean(memoText)
        const td = rec.treatmentDetails
        const hasExt = td?.ext && Object.keys(td.ext).length > 0
        const hasPerm = td?.perm && Object.keys(td.perm).length > 0
        const hasBrow = td?.browWax && Object.keys(td.browWax).length > 0
        const hasAnyTreatmentDetails = hasExt || hasPerm || hasBrow

        return (
          <div key={rec.id} className="historyCard">
            <div className="historyMain">
              <div className="historyTop">
                <div className="historyName">
                  {rec.customerName || '名称未設定'}
                  {rec.customerKana ? <span className="historyKana">（{rec.customerKana}）</span> : null}
                </div>
                <div className="historyDate">{rec.visitDate}</div>
              </div>

              <div className="historyMeta">
                {rec.customerId ? <span className="mutedChip">ID: {rec.customerId}</span> : null}
                <span className="pill">{rec.treatmentMenu || rec.menuType || '未選択'}</span>
                {rec.birthday ? <span className="mutedChip">生年月日: {rec.birthday}</span> : null}
              </div>

              {hasAnyTreatmentDetails ? (
                <div className="historyTreatmentDetails">
                  {renderBlockDetails('ext', td?.ext)}
                  {renderBlockDetails('perm', td?.perm)}
                  {renderBlockDetails('browWax', td?.browWax)}
                </div>
              ) : null}

              <div className="scoreLine">
                <span>構造 {rec.structureScore ?? 0}</span>
                <span>{rec.structureRank ?? '-'}</span>
                <span>ライフスタイル {rec.lifestyleScore ?? 0}</span>
                <span>{rec.lifestyleRank ?? '-'}</span>
                <span>状態 {rec.conditionScore ?? 0}</span>
                <span>{rec.conditionRank ?? '-'}</span>
              </div>
            </div>

            <div className="historyActions">
              <label className="checkPill">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggleCompare?.(rec.id)}
                />
                <span>比較</span>
              </label>

              {hasImages && (
                <button type="button" className="btn small" onClick={() => onOpenImages?.(rec)}>
                  画像有
                </button>
              )}

              {hasMemo && (
                <button type="button" className="btn small" onClick={() => onOpenMemo?.(rec)}>
                  メモ有
                </button>
              )}

              <button type="button" className="btn small" onClick={() => onLoad(rec)}>
                再表示
              </button>

              <button type="button" className="btn small danger" onClick={() => onDelete(rec.id)}>
                削除
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
export default function HistoryList({
  records,
  onLoad,
  onDelete,
  compareIds = [],
  onToggleCompare,
  onOpenImages,
}) {
  if (!records.length) {
    return <div className="mutedText">該当する履歴がありません。</div>
  }

  return (
    <div className="historyList">
      {records.map((rec) => {
        const checked = compareIds.includes(rec.id)
        const hasImages = Array.isArray(rec.images) && rec.images.length > 0

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
                <span className="pill">{rec.menuType || '未選択'}</span>
                {rec.birthday ? <span className="mutedChip">生年月日: {rec.birthday}</span> : null}
              </div>

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
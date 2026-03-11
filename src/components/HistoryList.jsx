export default function HistoryList({ records, onLoad, onDelete }) {
  if (!records.length) {
    return <div className="mutedText">まだ保存履歴がありません。</div>
  }

  return (
    <div className="historyList">
      {records.map((r) => (
        <div key={r.id} className="historyItem">
          <div className="historyMain">
            <div className="historyTitle">
              <span className="historyName">{r.customerName || '（お客様名なし）'}</span>
              <span className="historyMeta">
                {r.visitDate || '日付未設定'} / {r.menuType || 'メニュー未選択'}
              </span>
            </div>
            <div className="historyScores">
              <div className="miniScore">
                構造 {r.structureScore}/20 <span className={`rankMini rank-${r.structureRank}`}>{r.structureRank}</span>
              </div>
              <div className="miniScore">
                生活 {r.lifestyleScore}/23{' '}
                <span className={`rankMini rank-${r.lifestyleRank}`}>{r.lifestyleRank}</span>
              </div>
              <div className="miniScore">
                状態 {r.conditionScore}/25 <span className={`rankMini rank-${r.conditionRank}`}>{r.conditionRank}</span>
              </div>
            </div>
          </div>

          <div className="historyActions">
            <button type="button" className="btn" onClick={() => onLoad(r)}>
              再表示
            </button>
            <button type="button" className="btn danger" onClick={() => onDelete(r.id)}>
              削除
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}


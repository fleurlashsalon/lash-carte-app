export default function ScoreSummary({
  structureScore,
  structureRank,
  lifestyleScore,
  lifestyleRank,
  conditionScore,
  conditionRank,
}) {
  return (
    <div className="scoreGrid">
      <div className="scoreBox">
        <div className="scoreLabel">構造</div>
        <div className="scoreValue">
          {structureScore}
          <span className="scoreMax">/20</span>
        </div>
        <div className={`rankBadge rank-${structureRank}`}>{structureRank}</div>
      </div>
      <div className="scoreBox">
        <div className="scoreLabel">ライフスタイル</div>
        <div className="scoreValue">
          {lifestyleScore}
          <span className="scoreMax">/23</span>
        </div>
        <div className={`rankBadge rank-${lifestyleRank}`}>{lifestyleRank}</div>
      </div>
      <div className="scoreBox">
        <div className="scoreLabel">状態</div>
        <div className="scoreValue">
          {conditionScore}
          <span className="scoreMax">/25</span>
        </div>
        <div className={`rankBadge rank-${conditionRank}`}>{conditionRank}</div>
      </div>
      <div className="noteText">※レーダーチャートは25点換算表示</div>
    </div>
  )
}


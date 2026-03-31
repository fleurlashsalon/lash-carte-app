/**
 * 基本情報内：購入商品を縦並び＋削除
 */
export default function BasicInfoPurchaseList({ rows, onRemove }) {
  if (!rows?.length) return null

  return (
    <div className="basicInfoPurchaseList">
      <div className="basicInfoPurchaseListHeading">購入</div>
      <ul className="basicInfoPurchaseListItems">
        {rows.map(({ label, line }) => (
          <li key={label} className="basicInfoPurchaseListItem">
            <span className="basicInfoPurchaseListText">{line}</span>
            <button type="button" className="basicInfoPurchaseDelete" onClick={() => onRemove(label)}>
              削除
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

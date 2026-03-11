import { MENU_OPTIONS } from '../utils/constants.js'

export default function BasicInfoForm({
  customerName,
  visitDate,
  menuType,
  onChange,
  errors,
}) {
  return (
    <div className="grid3">
      <div className="field">
        <label className="inputLabel" htmlFor="customerName">
          お客様名
        </label>
        <input
          id="customerName"
          className={`textInput ${errors.customerName ? 'isError' : ''}`}
          type="text"
          value={customerName}
          placeholder="例）山田 花子"
          onChange={(e) => onChange({ customerName: e.target.value })}
        />
        {errors.customerName ? <div className="errorText">{errors.customerName}</div> : null}
      </div>

      <div className="field">
        <label className="inputLabel" htmlFor="visitDate">
          日付
        </label>
        <input
          id="visitDate"
          className={`textInput ${errors.visitDate ? 'isError' : ''}`}
          type="date"
          value={visitDate}
          onChange={(e) => onChange({ visitDate: e.target.value })}
        />
        {errors.visitDate ? <div className="errorText">{errors.visitDate}</div> : null}
      </div>

      <div className="field">
        <label className="inputLabel" htmlFor="menuType">
          施術メニュー
        </label>
        <select
          id="menuType"
          className={`textInput ${errors.menuType ? 'isError' : ''}`}
          value={menuType}
          onChange={(e) => onChange({ menuType: e.target.value })}
        >
          <option value="">未選択</option>
          {MENU_OPTIONS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
        {errors.menuType ? <div className="errorText">{errors.menuType}</div> : null}
      </div>
    </div>
  )
}


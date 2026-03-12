import { MENU_OPTIONS } from '../utils/constants.js'

export default function BasicInfoForm({
  customerId,
  customerName,
  customerKana,
  birthday,
  address,
  visitDate,
  menuType,
  onChange,
  onCustomerNameBlur,
  errors = {},
}) {
  return (
    <div className="grid3 basicInfoGrid">
      <div className="field">
        <label className="inputLabel" htmlFor="customerId">
          顧客ID
        </label>
        <input
          id="customerId"
          className={`textInput ${errors.customerId ? 'isError' : ''}`}
          type="text"
          value={customerId}
          placeholder="例) A-00001（未入力時は自動採番）"
          onChange={(e) => onChange({ customerId: e.target.value })}
        />
        {errors.customerId ? <div className="errorText">{errors.customerId}</div> : null}
      </div>

      <div className="field">
        <label className="inputLabel" htmlFor="customerName">
          お客様名
        </label>
        <input
          id="customerName"
          className={`textInput ${errors.customerName ? 'isError' : ''}`}
          type="text"
          value={customerName}
          placeholder="例) 山田 花子"
          onChange={(e) => onChange({ customerName: e.target.value })}
          onBlur={() => onCustomerNameBlur?.()}
        />
        {errors.customerName ? <div className="errorText">{errors.customerName}</div> : null}
      </div>

      <div className="field">
        <label className="inputLabel" htmlFor="customerKana">
          氏名（カナ）
        </label>
        <input
          id="customerKana"
          className={`textInput ${errors.customerKana ? 'isError' : ''}`}
          type="text"
          value={customerKana}
          placeholder="例) ヤマダ ハナコ"
          onChange={(e) => onChange({ customerKana: e.target.value })}
        />
        {errors.customerKana ? <div className="errorText">{errors.customerKana}</div> : null}
      </div>

      <div className="field fieldBirthday">
        <label className="inputLabel" htmlFor="birthday">
          生年月日
        </label>
        <input
          id="birthday"
          className={`textInput dateInput ${errors.birthday ? 'isError' : ''}`}
          type="date"
          value={birthday}
          onChange={(e) => onChange({ birthday: e.target.value })}
        />
        {errors.birthday ? <div className="errorText">{errors.birthday}</div> : null}
      </div>

      <div className="field fieldSpan2">
        <label className="inputLabel" htmlFor="address">
          住所
        </label>
        <input
          id="address"
          className={`textInput ${errors.address ? 'isError' : ''}`}
          type="text"
          value={address}
          placeholder="例) 兵庫県尼崎市..."
          onChange={(e) => onChange({ address: e.target.value })}
        />
        {errors.address ? <div className="errorText">{errors.address}</div> : null}
      </div>

      <div className="field fieldVisitDate">
        <label className="inputLabel" htmlFor="visitDate">
          日付
        </label>
        <input
          id="visitDate"
          className={`textInput dateInput ${errors.visitDate ? 'isError' : ''}`}
          type="date"
          value={visitDate}
          onChange={(e) => onChange({ visitDate: e.target.value })}
        />
        {errors.visitDate ? <div className="errorText">{errors.visitDate}</div> : null}
      </div>

      <div className="field fieldMenuType">
        <label className="inputLabel" htmlFor="menuType">
          施術メニュー
        </label>
        <select
          id="menuType"
          className={`selectInput ${errors.menuType ? 'isError' : ''}`}
          value={menuType}
          onChange={(e) => onChange({ menuType: e.target.value })}
        >
          <option value="">未選択</option>
          {MENU_OPTIONS.map((menu) => (
            <option key={menu.value} value={menu.value}>
              {menu.label}
            </option>
          ))}
        </select>
        {errors.menuType ? <div className="errorText">{errors.menuType}</div> : null}
      </div>
    </div>
  )
}
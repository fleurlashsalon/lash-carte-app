import { TREATMENT_MENU_OPTIONS } from '../utils/treatmentFormDefs.js'

/**
 * 基本情報フォーム
 * 必須: 顧客ID, お客様名, 施術メニュー
 * 任意: 氏名（カナ）, 電話番号, 施術日（後方互換用）
 */
export default function BasicInfoForm({
  customerId,
  customerName,
  customerKana,
  phone,
  treatmentMenu,
  visitDate,
  onChange,
  /** 顧客ID・お客様名・カナ・電話のいずれかからフォーカスが外れたとき（登録済み照合用） */
  onIdentityFieldsBlur,
  errors = {},
}) {
  // 後方互換: 既存データのメニューが新リストにない場合は先頭に追加して表示
  const menuOptions =
    treatmentMenu && !TREATMENT_MENU_OPTIONS.some((o) => o.value === treatmentMenu)
      ? [{ value: treatmentMenu, label: treatmentMenu }, ...TREATMENT_MENU_OPTIONS]
      : TREATMENT_MENU_OPTIONS

  return (
    <div className="grid3">
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
          onBlur={() => onIdentityFieldsBlur?.()}
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
          onBlur={() => onIdentityFieldsBlur?.()}
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
          onBlur={() => onIdentityFieldsBlur?.()}
        />
        {errors.customerKana ? <div className="errorText">{errors.customerKana}</div> : null}
      </div>

      <div className="field">
        <label className="inputLabel" htmlFor="treatmentMenu">
          施術メニュー
        </label>
        <select
          id="treatmentMenu"
          className={`selectInput ${errors.treatmentMenu ? 'isError' : ''}`}
          value={treatmentMenu}
          onChange={(e) => onChange({ treatmentMenu: e.target.value })}
        >
          <option value="">未選択</option>
          {menuOptions.map((menu) => (
            <option key={menu.value} value={menu.value}>
              {menu.label}
            </option>
          ))}
        </select>
        {errors.treatmentMenu ? <div className="errorText">{errors.treatmentMenu}</div> : null}
      </div>

      <div className="field">
        <label className="inputLabel" htmlFor="phone">
          電話番号
        </label>
        <input
          id="phone"
          className={`textInput ${errors.phone ? 'isError' : ''}`}
          type="tel"
          value={phone}
          placeholder="例) 090-1234-5678"
          onChange={(e) => onChange({ phone: e.target.value })}
          onBlur={() => onIdentityFieldsBlur?.()}
        />
        {errors.phone ? <div className="errorText">{errors.phone}</div> : null}
      </div>

      <div className="field">
        <label className="inputLabel" htmlFor="visitDate">
          施術日（任意）
        </label>
        <input
          id="visitDate"
          className="textInput"
          type="date"
          value={visitDate}
          onChange={(e) => onChange({ visitDate: e.target.value })}
        />
      </div>
    </div>
  )
}

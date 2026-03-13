import { BLOCK_FIELDS, BLOCK_LABELS } from '../utils/treatmentFormDefs.js'

/**
 * 定義に基づいて1ブロック分のフォームを描画（エクステ詳細 / まつ毛パーマ詳細 / 眉毛ワックス詳細）
 */
export default function TreatmentDetailForm({ blockId, values = {}, onChange }) {
  const fields = BLOCK_FIELDS[blockId] || []
  const title = BLOCK_LABELS[blockId] || blockId

  function handleChange(fieldId, value) {
    onChange?.(blockId, fieldId, value)
  }

  return (
    <div className="treatmentDetailBlock">
      <h3 className="treatmentDetailBlockTitle">{title}</h3>
      <div className="treatmentDetailFields">
        {fields.map((field) => {
          const val = values[field.id]
          if (field.type === 'text') {
            return (
              <div key={field.id} className="field">
                <label className="inputLabel" htmlFor={`${blockId}-${field.id}`}>
                  {field.label}
                </label>
                <input
                  id={`${blockId}-${field.id}`}
                  type="text"
                  className="textInput"
                  value={val ?? ''}
                  placeholder={field.placeholder ?? ''}
                  onChange={(e) => handleChange(field.id, e.target.value)}
                />
              </div>
            )
          }
          if (field.type === 'select') {
            return (
              <div key={field.id} className="field">
                <label className="inputLabel" htmlFor={`${blockId}-${field.id}`}>
                  {field.label}
                </label>
                <select
                  id={`${blockId}-${field.id}`}
                  className="selectInput"
                  value={val ?? ''}
                  onChange={(e) => handleChange(field.id, e.target.value)}
                >
                  <option value="">未選択</option>
                  {(field.options || []).map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            )
          }
          if (field.type === 'multiselect') {
            const selected = Array.isArray(val) ? val : []
            return (
              <div key={field.id} className="field">
                <div className="inputLabel">{field.label}</div>
                <div className="checkboxGroup">
                  {(field.options || []).map((opt) => (
                    <label key={opt.value} className="checkPill">
                      <input
                        type="checkbox"
                        checked={selected.includes(opt.value)}
                        onChange={(e) => {
                          const next = e.target.checked
                            ? [...selected, opt.value]
                            : selected.filter((v) => v !== opt.value)
                          handleChange(field.id, next)
                        }}
                      />
                      <span>{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )
          }
          return null
        })}
      </div>
    </div>
  )
}

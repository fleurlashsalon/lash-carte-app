export default function HorizontalRadioGroup({
  name,
  label,
  options,
  value,
  onChange,
  hint,
}) {
  return (
    <div className="fieldRow">
      <div className="fieldLabel">
        <div className="fieldLabelText">{label}</div>
        {hint ? <div className="fieldHint">{hint}</div> : null}
      </div>
      <div className="radioWrap" role="radiogroup" aria-label={label}>
        {options.map((opt) => {
          const id = `${name}-${String(opt.value)}`
          const checked = value === opt.value
          return (
            <label key={id} className={`radioPill ${checked ? 'isChecked' : ''}`}>
              <input
                className="radioInput"
                type="radio"
                name={name}
                value={String(opt.value)}
                checked={checked}
                onChange={() => onChange(opt.value)}
              />
              <span className="radioText">{opt.label}</span>
              <span className="radioScore">{opt.value}</span>
            </label>
          )
        })}
        <button
          type="button"
          className="linkButton"
          onClick={() => onChange(undefined)}
          aria-label={`${label}を未選択に戻す`}
        >
          クリア
        </button>
      </div>
    </div>
  )
}


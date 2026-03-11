export default function SectionCard({ title, subtitle, children, right }) {
  return (
    <section className="card">
      <div className="cardHeader">
        <div className="cardHeaderLeft">
          <h2 className="cardTitle">{title}</h2>
          {subtitle ? <p className="cardSubtitle">{subtitle}</p> : null}
        </div>
        {right ? <div className="cardHeaderRight">{right}</div> : null}
      </div>
      <div className="cardBody">{children}</div>
    </section>
  )
}


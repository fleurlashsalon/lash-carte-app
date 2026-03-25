export default function SectionCard({ title, subtitle, titleRight, children, right }) {
  return (
    <section className="card">
      <div className="cardHeader">
        <div className="cardHeaderLeft">
          <div className="cardTitleRow">
            <h2 className="cardTitle">{title}</h2>
            {titleRight ? <div className="cardTitleRight">{titleRight}</div> : null}
          </div>
          {subtitle ? <p className="cardSubtitle">{subtitle}</p> : null}
        </div>
        {right ? <div className="cardHeaderRight">{right}</div> : null}
      </div>
      <div className="cardBody">{children}</div>
    </section>
  )
}


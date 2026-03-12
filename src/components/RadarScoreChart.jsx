import {
  Legend,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from 'recharts'

// Fleur Lash palette: soft purple / dusty pink / lavender
const COLORS = ['#8e6ad6', '#e7a8b7', '#a8b6ff']

export default function RadarScoreChart({ data = [], compareData = null, compareSeries = [] }) {
  const activeData = compareData?.length ? compareData : data

  if (!activeData?.length) {
    return <div className="mutedText">チャートデータがありません。</div>
  }

  const renderSingle = !compareData?.length

  return (
    <div className="chartWrap">
      <div className="mutedText chartNote">※レーダーチャートは25点換算表示</div>
      <ResponsiveContainer width="100%" height={320}>
        <RadarChart data={activeData}>
          <PolarGrid />
          <PolarAngleAxis dataKey="subject" />
          <PolarRadiusAxis angle={30} domain={[0, 25]} />

          {renderSingle ? (
            <Radar
              name="現在"
              dataKey="score"
              stroke="#2563eb"
              fill="#2563eb"
              fillOpacity={0.2}
            />
          ) : (
            <>
              {compareSeries.map((series, index) => (
                <Radar
                  key={series.key}
                  name={series.name}
                  dataKey={series.key}
                  stroke={COLORS[index % COLORS.length]}
                  fill={COLORS[index % COLORS.length]}
                  fillOpacity={0.08}
                />
              ))}
              <Legend />
            </>
          )}
        </RadarChart>
      </ResponsiveContainer>
    </div>
  )
}
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'

export default function RadarScoreChart({ data }) {
  return (
    <div className="chartWrap" aria-label="スコアレーダーチャート">
      <ResponsiveContainer width="100%" height={320}>
        <RadarChart data={data} outerRadius="70%">
          <PolarGrid />
          <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12 }} />
          <PolarRadiusAxis domain={[0, 25]} tickCount={6} tick={{ fontSize: 11 }} />
          <Tooltip formatter={(v) => [`${Math.round(v * 10) / 10}`, '25点換算']} />
          <Radar
            name="スコア"
            dataKey="score"
            stroke="rgba(59, 130, 246, 0.9)"
            fill="rgba(59, 130, 246, 0.25)"
            strokeWidth={2}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  )
}


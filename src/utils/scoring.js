import { MAX_SCORES } from './constants.js'

function n(v) {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0
}

export function getStructureScore(form) {
  return n(form.eyeShape) + n(form.eyelid) + n(form.lashDirection) + n(form.asymmetry)
}

export function getLifestyleScore(form) {
  const led = form.ledChecked ? 3 : 0
  return (
    n(form.workEnvironment) +
    n(form.sleepPosture) +
    n(form.makeup) +
    n(form.faceWash) +
    led
  )
}

export function getConditionScore(form) {
  return n(form.thickness) + n(form.density) + n(form.turnover) + n(form.moisture) + n(form.habit)
}

export function getStructureRank(score) {
  if (score >= 15) return 'A'
  if (score >= 11) return 'B+'
  if (score >= 7) return 'B'
  return 'C'
}

export function getLifestyleRank(score) {
  if (score >= 17) return 'A'
  if (score >= 13) return 'B+'
  if (score >= 8) return 'B'
  return 'C'
}

export function getConditionRank(score) {
  if (score >= 20) return 'A'
  if (score >= 14) return 'B+'
  if (score >= 8) return 'B'
  return 'C'
}

export function normalizeScore(score, maxScore) {
  const max = n(maxScore) || 1
  const clamped = Math.max(0, Math.min(n(score), max))
  return (clamped / max) * 25
}

export function getMaxScores() {
  return MAX_SCORES
}


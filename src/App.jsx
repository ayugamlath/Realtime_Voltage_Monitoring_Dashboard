import { useEffect, useMemo, useState } from 'react'
import { limitToLast, onValue, orderByChild, query, ref } from 'firebase/database'
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth'
import { database, auth } from './firebase/config'
import { DASHBOARD_CONFIG } from './config/dashboard'
import './App.css'

function App() {
  const [rawSnapshot, setRawSnapshot] = useState(null)
  const [error, setError] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthed, setIsAuthed] = useState(false)
  const [activePhaseMobile, setActivePhaseMobile] = useState('L1')
  const [isMobile, setIsMobile] = useState(() => (typeof window !== 'undefined' ? window.innerWidth <= 640 : false))

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setIsAuthed(true)
      } else {
        signInAnonymously(auth).catch((e) => {
          setError(e.message)
          setIsLoading(false)
        })
      }
    })

    return () => unsubscribe()
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const handleResize = () => setIsMobile(window.innerWidth <= 640)
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    if (!isMobile) {
      setActivePhaseMobile('L1')
    }
  }, [isMobile])

  useEffect(() => {
    if (!isAuthed) return

    const voltageQuery = query(
      ref(database, 'three_phase_data'),
      orderByChild('timestamp'),
      limitToLast(DASHBOARD_CONFIG.sparklinePoints * 2),
    )

    const unsubscribe = onValue(
      voltageQuery,
      (snapshot) => {
        setRawSnapshot(snapshot.val())
        setError(null)
        setIsLoading(false)
      },
      (err) => {
        setError(err.message)
        setIsLoading(false)
      },
    )

    return () => unsubscribe()
  }, [isAuthed])

  const metrics = useMemo(() => computeMetrics(rawSnapshot), [rawSnapshot])

  const statusVariant = useMemo(() => {
    return 'normal'
  }, [error, metrics])

  const statusLabel = {
    normal: 'Stable',
    warning: 'Attention',
    error: 'Offline',
    pending: 'Awaiting Data',
  }[statusVariant]

  const currentVoltage = metrics.current ?? '-'
  const phaseKeys = metrics.phases.map((phase) => phase.key)
  const activePhaseKey = phaseKeys.includes(activePhaseMobile) ? activePhaseMobile : phaseKeys[0]
  const phasesToDisplay = isMobile && activePhaseKey ? metrics.phases.filter((phase) => phase.key === activePhaseKey) : metrics.phases
  const handlePhaseSelect = (key) => setActivePhaseMobile(key)

  return (
    <div className={`app-shell status-${statusVariant}`}>
      <header className="top-bar">
        <div>
          <h1>Real-Time Voltage Monitor</h1>
          <p>Live updates fetched directly from Firebase Realtime Database</p>
        </div>
      </header>

      <main className="dashboard">
        <section className="primary-grid">
          <article className="card current-card">
            <div className="card-header">
              <span className="card-label">Current Voltage</span>
              {Boolean(metrics.target) && (
                <span className="target-label">Target {metrics.target?.toFixed(1)} V</span>
              )}
            </div>
            <div className="current-value">
              <span>{typeof currentVoltage === 'number' ? currentVoltage.toFixed(1) : '--'}</span>
              <span className="unit">Volts</span>
            </div>
            <div className="current-meta">
              <MetricChip label="Average" value={metrics.average} />
              <MetricChip label="Max" value={metrics.max} />
              <MetricChip label="Min" value={metrics.min} />
            </div>
            <Sparkline data={metrics.trend} />
          </article>

          <article className="card chart-card">
            <div className="card-header">
              <span className="card-label">Voltage Stability</span>
              <span className="timestamp">{formatTimestamp(metrics.lastUpdated)}</span>
            </div>
            <div className="gauge">
              <div className="gauge-ring">
                <div
                  className="gauge-fill"
                  style={{ '--stability': `${clampNumber(metrics.stability ?? 0, 0, 100)}%` }}
                />
                <span className="gauge-value">
                  {metrics.stability !== null ? `${Math.round(metrics.stability)}%` : '--'}
                </span>
              </div>
              <div className="gauge-meta">
                <span>Reliability index based on last 30 mins</span>
              </div>
            </div>
          </article>
        </section>

        <section className="secondary-grid">
          <article className="card overview-card">
            <div className="card-header">
              <span className="card-label">System Overview</span>
              {metrics.staleSeverity && (
                <StatusPill size="small" variant={metrics.staleSeverity === 'critical' ? 'error' : 'warning'}>
                  {metrics.staleSeverity === 'critical' ? 'Data Stale' : 'Delayed'}
                </StatusPill>
              )}
            </div>
            <div className="overview-grid">
              <MetricChip size="large" label="Total Current" value={metrics.totalCurrent} />
              <MetricChip size="large" label="Total Power" value={metrics.totalPowerKW} />
              <MetricChip size="large" label="System PF" value={metrics.overallPowerFactor} />
            </div>
          </article>

          <article className="card phases-card">
            <div className="card-header">
              <span className="card-label">Phase Health</span>
            </div>
            {isMobile && (
              <div className="phase-toggle">
                {metrics.phases.map((phase) => (
                  <button
                    key={phase.key}
                    type="button"
                    className={phase.key === activePhaseKey ? 'active' : ''}
                    onClick={() => handlePhaseSelect(phase.key)}
                  >
                    {phase.label}
                  </button>
                ))}
              </div>
            )}
            <div className={`phases-grid${isMobile ? ' phases-grid-mobile' : ''}`}>
              {phasesToDisplay.map((phase) => (
                <div key={phase.key} className={`phase-card phase-${phase.status}`}>
                  <div className="phase-title">{phase.label}</div>
                  <div className="phase-value">
                    {phase.voltage !== null ? phase.voltage.toFixed(1) : '--'}
                    <span>V</span>
                  </div>
                  <div className="phase-meta">
                    <span>{phase.frequency !== null ? `${phase.frequency.toFixed(2)} Hz` : '-- Hz'}</span>
                    <StatusPill size="small" variant={phase.status}>
                      {phase.status === 'critical' ? 'Critical' : phase.status === 'warning' ? 'Attention' : 'Normal'}
                    </StatusPill>
                  </div>
                  <div className="phase-stats">
                    <MetricChip size="small" label="Current" value={phase.current} />
                    <MetricChip size="small" label="Power" value={phase.power} />
                    <MetricChip size="small" label="PF" value={phase.powerFactor} />
                  </div>
                </div>
              ))}
            </div>
          </article>

        </section>

     
      </main>

      {isLoading && (
        <div className="backdrop">
          <div className="loader" />
          <span>Syncing with Firebase…</span>
        </div>
      )}

      {error && (
        <div className="error-banner">
          <strong>Connection issue:</strong> {error}
        </div>
      )}
    </div>
  )
}

function Sparkline({ data }) {
  if (!data?.length) {
    return (
      <div className="sparkline empty">
        <span>No history yet</span>
      </div>
    )
  }

  const width = 320
  const height = 80
  const values = data.map((point) => point.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1

  const points = data
    .map((point, index) => {
      const x = (index / (data.length - 1 || 1)) * width
      const y = height - ((point.value - min) / range) * height
      return `${x},${y}`
    })
    .join(' ')

  return (
    <div className="sparkline">
      <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <polyline points={points} />
      </svg>
    </div>
  )
}

function MetricChip({ label, value, size = 'medium' }) {
  return (
    <div className={`metric-chip metric-${size}`}>
      <span>{label}</span>
      <strong>{value !== null && value !== undefined ? formatMetricValue(label, value) : '--'}</strong>
    </div>
  )
}

function StatusPill({ variant = 'normal', size = 'medium', children }) {
  const normalizedVariant =
    {
      normal: 'normal',
      success: 'normal',
      warning: 'warning',
      attention: 'warning',
      caution: 'warning',
      medium: 'warning',
      error: 'error',
      danger: 'error',
      critical: 'error',
      offline: 'error',
      pending: 'pending',
      loading: 'pending',
      unknown: 'pending',
    }[variant] ?? 'pending'

  return <span className={`status-pill status-${normalizedVariant} status-${size}`}>{children}</span>
}

function EmptyState({ message }) {
  return (
    <div className="empty-state">
      <span>{message}</span>
    </div>
  )
}

function computeMetrics(rawSnapshot) {
  if (!rawSnapshot) {
    return {
      current: null,
      average: null,
      min: null,
      max: null,
      trend: [],
      phases: defaultPhases(),
      lastUpdated: null,
      stability: null,
      alerts: [],
      target: DASHBOARD_CONFIG.nominalVoltage,
      loadPercentage: null,
      loadSeverity: 'pending',
      totalCurrent: null,
      totalPowerKW: null,
      overallPowerFactor: null,
      staleSeverity: null,
    }
  }

  const items = Object.values(rawSnapshot)
    .filter(Boolean)
    .sort((a, b) => Number(a.timestamp || 0) - Number(b.timestamp || 0))

  if (!items.length) {
    return {
      current: null,
      average: null,
      min: null,
      max: null,
      trend: [],
      phases: defaultPhases(),
      lastUpdated: null,
      stability: null,
      alerts: [],
      target: DASHBOARD_CONFIG.nominalVoltage,
      loadPercentage: null,
      loadSeverity: 'pending',
      totalCurrent: null,
      totalPowerKW: null,
      overallPowerFactor: null,
      staleSeverity: null,
    }
  }

  const limited = items.slice(-DASHBOARD_CONFIG.sparklinePoints)
  const latest = limited[limited.length - 1]

  const phasesBase = {
    L1: extractPhase(latest.phase1, 'Phase 1'),
    L2: extractPhase(latest.phase2, 'Phase 2'),
    L3: extractPhase(latest.phase3, 'Phase 3'),
  }

  const alerts = []
  const phases = Object.entries(phasesBase).map(([key, phase]) => {
    const evaluation = assessPhase(phase)
    alerts.push(...evaluation.alerts)
    return { key, ...phase, status: evaluation.status }
  })

  const validVoltages = phases
    .map((phase) => phase.voltage)
    .filter((value) => Number.isFinite(value))

  const currentVoltage = validVoltages.length ? avg(validVoltages) : null

  const trend = limited.map((entry) => {
    const values = [num(entry.phase1?.voltage), num(entry.phase2?.voltage), num(entry.phase3?.voltage)].filter(
      (value) => Number.isFinite(value),
    )

    return {
      timestamp: Number(entry.timestamp) || Date.parse(entry.timestamp),
      value: values.length ? avg(values) : null,
    }
  })

  const filteredTrend = trend.filter((point) => point.value !== null)
  const min = filteredTrend.length ? Math.min(...filteredTrend.map((point) => point.value)) : null
  const max = filteredTrend.length ? Math.max(...filteredTrend.map((point) => point.value)) : null
  const stability = computeStability(filteredTrend)

  const totalCurrent = sum(phases.map((phase) => phase.current))
  const totalPowerW = sum(
    phases.map((phase) => {
      if (Number.isFinite(phase.power)) return phase.power
      if (Number.isFinite(phase.voltage) && Number.isFinite(phase.current)) return phase.voltage * phase.current
      return 0
    }),
  )
  const totalPowerKW = totalPowerW ? totalPowerW / 1000 : null

  const powerFactors = phases.map((phase) => phase.powerFactor).filter((value) => Number.isFinite(value))
  const overallPowerFactor = powerFactors.length ? avg(powerFactors) : null

  const loadPercentage = totalPowerKW
    ? clampNumber((totalPowerKW / DASHBOARD_CONFIG.maxApparentPowerKW) * 100, 0, 999)
    : null
  const loadSeverity = evaluateLoadSeverity(loadPercentage)

  const lastTimestamp = Number(latest.timestamp) || Date.parse(latest.timestamp)
  const { staleSeverity, staleAlert } = evaluateStaleness(lastTimestamp)
  if (staleAlert) alerts.push(staleAlert)

  const structuredAlerts = alerts.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))

  return {
    current: currentVoltage,
    average: currentVoltage,
    min,
    max,
    trend: filteredTrend,
    phases,
    lastUpdated: lastTimestamp,
    stability,
    alerts: structuredAlerts,
    target: DASHBOARD_CONFIG.nominalVoltage,
    loadPercentage,
    loadSeverity,
    totalCurrent,
    totalPowerKW,
    overallPowerFactor,
    staleSeverity,
  }
}

function extractPhase(rawPhase, label) {
  return {
    label,
    voltage: num(rawPhase?.voltage),
    frequency: num(rawPhase?.frequency),
    current: num(rawPhase?.current),
    power: num(rawPhase?.power),
    powerFactor: sanitizePowerFactor(rawPhase?.powerFactor),
  }
}

function assessPhase(phase) {
  return { status: 'normal', alerts: [] }
}

function sanitizePowerFactor(value) {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return null
  return n
}

function evaluateLoadSeverity(loadPercentage) {
  if (!Number.isFinite(loadPercentage)) return 'pending'
  const { warning, critical } = DASHBOARD_CONFIG.thresholds.load
  if (loadPercentage >= critical) return 'critical'
  if (loadPercentage >= warning) return 'warning'
  return 'normal'
}

function loadSeverityLabel(severity) {
  switch (severity) {
    case 'critical':
      return 'Critical'
    case 'warning':
      return 'High Load'
    case 'pending':
      return 'No Data'
    default:
      return 'Nominal'
  }
}

function evaluateStaleness(timestamp) {
  if (!timestamp) {
    return { staleSeverity: 'critical', staleAlert: createAlert('No timestamp in latest sample', 'critical') }
  }
  const age = Date.now() - timestamp
  const tolerance = DASHBOARD_CONFIG.staleDataToleranceMs
  if (age > tolerance * 3) {
    return {
      staleSeverity: 'critical',
      staleAlert: createAlert(`Data stale for ${Math.round(age / 1000)}s`, 'critical', timestamp),
    }
  }
  if (age > tolerance) {
    return {
      staleSeverity: 'warning',
      staleAlert: createAlert(`Data delayed by ${Math.round(age / 1000)}s`, 'warning', timestamp),
    }
  }
  return { staleSeverity: null, staleAlert: null }
}

function defaultPhases() {
  return [
    { key: 'L1', label: 'Phase 1', voltage: null, frequency: null, current: null, power: null, powerFactor: null, status: 'pending' },
    { key: 'L2', label: 'Phase 2', voltage: null, frequency: null, current: null, power: null, powerFactor: null, status: 'pending' },
    { key: 'L3', label: 'Phase 3', voltage: null, frequency: null, current: null, power: null, powerFactor: null, status: 'pending' },
  ]
}

function formatTimestamp(timestamp) {
  if (!timestamp) return 'No timestamp'
  const date = typeof timestamp === 'number' ? new Date(timestamp) : new Date(Number(timestamp) || timestamp)
  if (Number.isNaN(date.getTime())) return 'Invalid timestamp'
  return date.toLocaleString()
}

function formatMetricValue(label, value) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return '--'
  switch (label) {
    case 'Average':
    case 'Max':
    case 'Min':
      return numeric.toFixed(1)
    case 'Voltage':
      return `${numeric.toFixed(1)} V`
    case 'Total Current':
    case 'Current':
      return `${numeric.toFixed(2)} A`
    case 'Total Power':
      return `${numeric.toFixed(1)} kW`
    case 'Power':
      return `${numeric.toFixed(1)} W`
    case 'PF':
    case 'System PF':
      return numeric.toFixed(2)
    default:
      return numeric.toFixed(1)
  }
}

function clampNumber(value, min, max) {
  if (!Number.isFinite(Number(value))) return min
  const numeric = Number(value)
  return Math.min(Math.max(numeric, min), max)
}

function generateId() {
  if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }

  return `alert-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function num(value) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

function avg(values) {
  if (!values.length) return null
  return values.reduce((total, value) => total + value, 0) / values.length
}

function sum(values) {
  return values.reduce((total, value) => (Number.isFinite(value) ? total + value : total), 0)
}

function computeStability(trend) {
  const values = trend.filter((point) => point.value !== null).map((point) => point.value)
  if (values.length < 2) return 100
  const mean = avg(values)
  const variance = avg(values.map((value) => (value - mean) ** 2))
  const normalized = Math.max(0, 100 - Math.min(100, Math.sqrt(variance)))
  return Math.round(normalized)
}

function createAlert(message, severity = 'warning', timestamp = Date.now()) {
  return {
    id: generateId(),
    message,
    severity,
    timestamp,
    resolved: false,
  }
}

function elevateStatus(current, incoming) {
  if (incoming === 'critical') return 'critical'
  if (current === 'critical') return 'critical'
  if (incoming === 'warning') return 'warning'
  return current
}

export default App


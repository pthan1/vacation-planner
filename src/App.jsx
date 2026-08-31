import { useEffect, useMemo, useState } from 'react'
import {
  daysBetween,
  formatHours,
  parseISODate,
  projectVacationPlan,
} from './calculations.js'

const DEFAULT_SETTINGS = {
  currentBalance: 57.85,
  balanceDate: '2026-08-21',
  accrualAmount: 4.6154,
  accrualIntervalDays: 14,
  nextAccrualDate: '2026-09-04',
  cap: 120,
  hoursPerDay: 8,
  reserveDays: 15,
  goalDate: '2027-07-01',
}

const DEFAULT_TRIP = {
  name: '',
  date: '2026-12-01',
  days: 1,
}

function getStoredValue(key, fallback) {
  try {
    const value = localStorage.getItem(key)
    return value ? JSON.parse(value) : fallback
  } catch {
    return fallback
  }
}

function formatDate(value, options = {}) {
  const date = parseISODate(value)
  if (!date) return '—'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
    ...options,
  }).format(date)
}

function formatCompactDate(value) {
  return formatDate(value, { month: 'short', day: 'numeric', year: undefined })
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M4 10h12M11 5l5 5-5 5" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M10 4v12M4 10h12" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M4.5 6h11M8 3.5h4M7 8.5v6M10 8.5v6M13 8.5v6M6 6l.7 10h6.6L14 6" />
    </svg>
  )
}

function PlaneIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m3.5 13.2 7.2 1.5 3.2 5.6 1.7-.5-.8-6.1 4.8-3.2c1.4-.9 1.8-2.2 1.3-2.9-.5-.8-1.9-.7-3.3.2l-4.9 3-5-3.6-1.5.9 3.3 4.6-4.8-1.1-1.2 1.6Z" />
    </svg>
  )
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M5 3v3M15 3v3M3 8h14M4 5h12a1 1 0 0 1 1 1v10H3V6a1 1 0 0 1 1-1Z" />
    </svg>
  )
}

function ForecastChart({ projection, settings }) {
  const width = 920
  const height = 270
  const padding = { top: 24, right: 18, bottom: 40, left: 44 }
  const chartWidth = width - padding.left - padding.right
  const chartHeight = height - padding.top - padding.bottom
  const duration = Math.max(1, daysBetween(settings.balanceDate, settings.goalDate))
  const maxValue = Math.max(
    Number(settings.cap) || 0,
    projection.targetReserve,
    ...projection.timeline.map((point) => point.balance),
    1,
  )
  const yMax = maxValue * 1.15
  const x = (date) =>
    padding.left +
    (Math.max(0, daysBetween(settings.balanceDate, date)) / duration) * chartWidth
  const y = (value) => padding.top + chartHeight - (value / yMax) * chartHeight
  const baseline = padding.top + chartHeight

  let linePath = ''
  projection.timeline.forEach((point, index) => {
    const px = x(point.date)
    const py = y(point.balance)
    if (index === 0) {
      linePath = `M ${px} ${py}`
    } else {
      const previous = projection.timeline[index - 1]
      linePath += ` L ${px} ${y(previous.balance)} L ${px} ${py}`
    }
  })

  const firstPoint = projection.timeline[0]
  const lastPoint = projection.timeline.at(-1)
  const areaPath = `${linePath} L ${x(lastPoint.date)} ${baseline} L ${x(
    firstPoint.date,
  )} ${baseline} Z`
  const targetY = y(projection.targetReserve)
  const capY = y(Number(settings.cap) || 0)
  const tickValues = [0, 0.25, 0.5, 0.75, 1]

  return (
    <div className="chart-shell">
      <svg
        className="forecast-chart"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Vacation balance forecast from ${formatDate(
          settings.balanceDate,
        )} to ${formatDate(settings.goalDate)}`}
      >
        <defs>
          <linearGradient id="balanceArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0d6b5e" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#0d6b5e" stopOpacity="0.015" />
          </linearGradient>
        </defs>

        {[0, 0.5, 1].map((ratio) => {
          const value = maxValue * ratio
          return (
            <g key={ratio}>
              <line
                x1={padding.left}
                x2={width - padding.right}
                y1={y(value)}
                y2={y(value)}
                className="grid-line"
              />
              <text x={padding.left - 10} y={y(value) + 4} className="axis-label">
                {Math.round(value)}h
              </text>
            </g>
          )
        })}

        <line
          x1={padding.left}
          x2={width - padding.right}
          y1={capY}
          y2={capY}
          className="cap-line"
        />
        <text x={width - padding.right} y={capY - 8} textAnchor="end" className="cap-label">
          {formatHours(settings.cap, 0)}h cap
        </text>

        {Math.abs(targetY - capY) > 10 && (
          <line
            x1={padding.left}
            x2={width - padding.right}
            y1={targetY}
            y2={targetY}
            className="target-line"
          />
        )}

        <path d={areaPath} fill="url(#balanceArea)" />
        <path d={linePath} className="balance-line" />

        {projection.timeline
          .filter((point) => point.type === 'vacation')
          .map((point) => (
            <g key={point.id}>
              <circle cx={x(point.date)} cy={y(point.balance)} r="7" className="trip-dot-halo" />
              <circle cx={x(point.date)} cy={y(point.balance)} r="4" className="trip-dot" />
            </g>
          ))}

        <circle
          cx={x(lastPoint.date)}
          cy={y(lastPoint.balance)}
          r="5"
          className={projection.onTrack ? 'end-dot' : 'end-dot end-dot--warning'}
        />

        {tickValues.map((ratio) => {
          const date = new Date(
            parseISODate(settings.balanceDate).getTime() + duration * ratio * 86_400_000,
          )
          const dateValue = date.toISOString().slice(0, 10)
          return (
            <text
              key={ratio}
              x={padding.left + chartWidth * ratio}
              y={height - 10}
              textAnchor={ratio === 0 ? 'start' : ratio === 1 ? 'end' : 'middle'}
              className="date-label"
            >
              {formatCompactDate(dateValue)}
            </text>
          )
        })}
      </svg>
    </div>
  )
}

function NumberField({ label, suffix, help, ...inputProps }) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      <span className="input-with-suffix">
        <input type="number" {...inputProps} />
        {suffix && <span>{suffix}</span>}
      </span>
      {help && <small>{help}</small>}
    </label>
  )
}

function DateField({ label, ...inputProps }) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      <span className="date-input-wrap">
        <input type="date" {...inputProps} />
        <CalendarIcon />
      </span>
    </label>
  )
}

function App() {
  const [settings, setSettings] = useState(() =>
    getStoredValue('vacation-planner-settings', DEFAULT_SETTINGS),
  )
  const [vacations, setVacations] = useState(() =>
    getStoredValue('vacation-planner-trips', []),
  )
  const [tripDraft, setTripDraft] = useState(DEFAULT_TRIP)

  const calculatedVacations = useMemo(
    () =>
      vacations.map((vacation) => ({
        ...vacation,
        hours: Number(vacation.days) * (Number(settings.hoursPerDay) || 0),
      })),
    [vacations, settings.hoursPerDay],
  )

  const projection = useMemo(
    () => projectVacationPlan(settings, calculatedVacations),
    [settings, calculatedVacations],
  )

  useEffect(() => {
    localStorage.setItem('vacation-planner-settings', JSON.stringify(settings))
  }, [settings])

  useEffect(() => {
    localStorage.setItem('vacation-planner-trips', JSON.stringify(vacations))
  }, [vacations])

  const updateSetting = (event) => {
    const { name, value } = event.target
    const dateFields = ['balanceDate', 'nextAccrualDate', 'goalDate']
    if (dateFields.includes(name) && !value) return
    setSettings((current) => ({ ...current, [name]: value }))
  }

  const addVacation = (event) => {
    event.preventDefault()
    const days = Number(tripDraft.days)
    if (!tripDraft.name.trim() || !tripDraft.date || days <= 0) return

    setVacations((current) => [
      ...current,
      {
        id: globalThis.crypto?.randomUUID?.() || `${Date.now()}`,
        name: tripDraft.name.trim(),
        date: tripDraft.date,
        days,
      },
    ])
    setTripDraft((current) => ({ ...current, name: '', days: 1 }))
  }

  const removeVacation = (id) => {
    setVacations((current) => current.filter((vacation) => vacation.id !== id))
  }

  const resetPlan = () => {
    setSettings(DEFAULT_SETTINGS)
    setVacations([])
    setTripDraft(DEFAULT_TRIP)
  }

  const remainingPositive = projection.remainingBudget >= 0
  const remainingDays = Math.abs(projection.daysRemaining)
  const budgetLabel = remainingPositive ? 'Still free to plan' : 'Over your trip budget'
  const sortedVacations = [...calculatedVacations].sort((a, b) => a.date.localeCompare(b.date))
  const outsideWindowCount = calculatedVacations.length - projection.activeVacations.length
  const goalPercent = projection.targetReserve
    ? Math.min(100, (projection.endingBalance / projection.targetReserve) * 100)
    : 100

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Out of Office home">
          <span className="brand__mark"><PlaneIcon /></span>
          <span>OUT OF OFFICE</span>
        </a>
        <div className="topbar__actions">
          <span className={`status-pill ${projection.onTrack ? '' : 'status-pill--warning'}`}>
            <span />
            {projection.onTrack ? 'Goal on track' : `${formatHours(projection.reserveGap)}h short`}
          </span>
          <button type="button" className="text-button" onClick={resetPlan}>Reset plan</button>
        </div>
      </header>

      <main id="top">
        <section className="intro">
          <div>
            <p className="eyebrow">Vacation budget planner</p>
            <h1>Take the time.<br /><em>Keep the hours.</em></h1>
          </div>
          <p className="intro__copy">
            See what you can use before your balance hits the cap—without touching the time
            you’re saving for the big trip.
          </p>
        </section>

        <section className="dashboard-grid" aria-label="Vacation budget summary">
          <article className={`budget-card ${remainingPositive ? '' : 'budget-card--warning'}`}>
            <div className="budget-card__topline">
              <span>{budgetLabel}</span>
              <span className="budget-card__arrow"><ArrowIcon /></span>
            </div>
            <div className="budget-card__number">
              {remainingPositive ? '' : '−'}{formatHours(Math.abs(projection.remainingBudget))}
              <small>hrs</small>
            </div>
            <p>
              {remainingPositive
                ? `${formatHours(remainingDays, 1)} workdays you can add before ${formatDate(settings.goalDate)}.`
                : `${formatHours(remainingDays, 1)} workdays need to come out of the current plan.`}
            </p>
            <div className="budget-card__rule" />
            <div className="budget-card__foot">
              <span>{formatHours(projection.plannedHours)}h planned</span>
              <span>{formatHours(projection.targetReserve)}h reserved</span>
            </div>
          </article>

          <article className="goal-card">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Your goal</p>
                <h2>{formatHours(projection.targetReserve, 0)} hours by {formatDate(settings.goalDate, { year: undefined })}</h2>
              </div>
              <span className="goal-card__days">{formatHours(settings.reserveDays, 0)} days</span>
            </div>

            <div className="goal-progress" aria-label={`${goalPercent}% of reserve goal projected`}>
              <span style={{ width: `${goalPercent}%` }} />
            </div>
            <div className="goal-progress__labels">
              <span>{formatHours(projection.endingBalance)}h projected</span>
              <span>{formatHours(projection.targetReserve)}h target</span>
            </div>

            <div className="metric-row">
              <div>
                <span>Starting balance</span>
                <strong>{formatHours(settings.currentBalance)}h</strong>
              </div>
              <div>
                <span>Accruing before goal</span>
                <strong>+{formatHours(projection.totalAccrued)}h</strong>
              </div>
              <div className={projection.lostHours > 0 ? 'metric--risk' : ''}>
                <span>At risk under current plan</span>
                <strong>{formatHours(projection.lostHours)}h</strong>
              </div>
            </div>
          </article>
        </section>

        <section className="forecast-section">
          <div className="section-heading section-heading--forecast">
            <div>
              <p className="eyebrow">Balance forecast</p>
              <h2>Every hour, accounted for.</h2>
            </div>
            <div className="chart-legend" aria-hidden="true">
              <span><i className="legend-line" /> Balance</span>
              <span><i className="legend-dot" /> Time off</span>
              <span><i className="legend-dash" /> Cap</span>
            </div>
          </div>

          <ForecastChart projection={projection} settings={settings} />

          <div className={`forecast-note ${projection.lostHours > 0 ? 'forecast-note--risk' : ''}`}>
            <span className="forecast-note__icon">{projection.lostHours > 0 ? '!' : '✓'}</span>
            <div>
              <strong>
                {projection.lostHours > 0
                  ? `Your balance first presses against the cap on ${formatDate(projection.firstOverflowDate)}.`
                  : 'Your current plan stays below the cap.'}
              </strong>
              <p>
                {projection.lostHours > 0
                  ? `Plan ${formatHours(projection.lostHours)} more hours before they accrue to keep them from being forfeited.`
                  : 'Nothing is forecast to be forfeited before your goal date.'}
              </p>
            </div>
          </div>

          {projection.vacationShortfall > 0 && (
            <div className="forecast-note forecast-note--warning">
              <span className="forecast-note__icon">!</span>
              <div>
                <strong>One of your trips is scheduled before enough time is available.</strong>
                <p>The plan is short by {formatHours(projection.vacationShortfall)} hours on that trip date.</p>
              </div>
            </div>
          )}
        </section>

        <section className="planning-grid">
          <article className="planner-card">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Plan time off</p>
                <h2>Add a vacation</h2>
              </div>
              <span className="planner-card__icon"><PlusIcon /></span>
            </div>
            <p className="section-description">
              Add time away and your budget, cap risk, and forecast will recalculate instantly.
            </p>

            <form className="trip-form" onSubmit={addVacation}>
              <label className="field field--wide">
                <span className="field__label">What should we call it?</span>
                <input
                  type="text"
                  value={tripDraft.name}
                  onChange={(event) => setTripDraft({ ...tripDraft, name: event.target.value })}
                  placeholder="Long weekend in Seattle"
                  required
                />
              </label>
              <DateField
                label="First day off"
                value={tripDraft.date}
                min={settings.balanceDate}
                max={settings.goalDate}
                onChange={(event) => setTripDraft({ ...tripDraft, date: event.target.value })}
                required
              />
              <NumberField
                label="Workdays"
                suffix="days"
                value={tripDraft.days}
                min="0.25"
                step="0.25"
                onChange={(event) => setTripDraft({ ...tripDraft, days: event.target.value })}
                required
              />
              <div className="trip-form__total">
                <span>Time used</span>
                <strong>{formatHours(Number(tripDraft.days) * Number(settings.hoursPerDay), 1)} hours</strong>
              </div>
              <button className="primary-button" type="submit">
                Add to plan <ArrowIcon />
              </button>
            </form>
          </article>

          <article className="trips-card">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Before your goal</p>
                <h2>Planned time off</h2>
              </div>
              {vacations.length > 0 && (
                <button className="text-button" type="button" onClick={() => setVacations([])}>Clear all</button>
              )}
            </div>

            {sortedVacations.length === 0 ? (
              <div className="empty-state">
                <span><PlaneIcon /></span>
                <h3>Your calendar is wide open.</h3>
                <p>Add your first vacation to see how it changes the forecast.</p>
              </div>
            ) : (
              <div className="trip-list">
                {sortedVacations.map((vacation) => {
                  const isActive = vacation.date >= settings.balanceDate && vacation.date <= settings.goalDate
                  return (
                    <div className="trip-item" key={vacation.id}>
                      <div className="trip-date">
                        <strong>{formatDate(vacation.date, { month: 'short', year: undefined })}</strong>
                        <span>{parseISODate(vacation.date).getUTCDate()}</span>
                      </div>
                      <div className="trip-item__details">
                        <strong>{vacation.name}</strong>
                        <span>
                          {formatHours(vacation.days, vacation.days % 1 ? 2 : 0)} workday{vacation.days === 1 ? '' : 's'}
                          {' · '}{formatHours(vacation.hours, 1)} hours
                        </span>
                        {!isActive && <small>Outside the current planning window</small>}
                      </div>
                      <button
                        type="button"
                        className="icon-button"
                        onClick={() => removeVacation(vacation.id)}
                        aria-label={`Remove ${vacation.name}`}
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
            {outsideWindowCount > 0 && (
              <p className="outside-note">{outsideWindowCount} trip{outsideWindowCount === 1 ? ' is' : 's are'} excluded from this forecast.</p>
            )}
          </article>
        </section>

        <section className="settings-section">
          <div className="settings-intro">
            <p className="eyebrow">The fine print</p>
            <h2>Adjust your plan</h2>
            <p>Change any assumption. The full forecast updates as you type.</p>
          </div>

          <div className="settings-panel">
            <div className="settings-group">
              <h3>Balance</h3>
              <NumberField label="Current balance" suffix="hours" name="currentBalance" value={settings.currentBalance} min="0" step="0.01" onChange={updateSetting} />
              <DateField label="Balance as of" name="balanceDate" value={settings.balanceDate} onChange={updateSetting} />
              <NumberField label="Maximum balance" suffix="hours" name="cap" value={settings.cap} min="0" step="1" onChange={updateSetting} />
            </div>
            <div className="settings-group">
              <h3>Accrual</h3>
              <NumberField label="Earn each cycle" suffix="hours" name="accrualAmount" value={settings.accrualAmount} min="0" step="0.0001" onChange={updateSetting} />
              <NumberField label="Cycle length" suffix="days" name="accrualIntervalDays" value={settings.accrualIntervalDays} min="1" step="1" onChange={updateSetting} />
              <DateField label="Next accrual" name="nextAccrualDate" value={settings.nextAccrualDate} onChange={updateSetting} />
            </div>
            <div className="settings-group">
              <h3>Goal</h3>
              <NumberField label="Hours per workday" suffix="hours" name="hoursPerDay" value={settings.hoursPerDay} min="0.25" step="0.25" onChange={updateSetting} />
              <NumberField label="Days to reserve" suffix="days" name="reserveDays" value={settings.reserveDays} min="0" step="0.5" onChange={updateSetting} />
              <DateField label="Save them by" name="goalDate" value={settings.goalDate} min={settings.balanceDate} onChange={updateSetting} />
            </div>
          </div>
        </section>
      </main>

      <footer>
        <span>OUT OF OFFICE</span>
        <p>Your plan is saved automatically in this browser.</p>
      </footer>
    </div>
  )
}

export default App

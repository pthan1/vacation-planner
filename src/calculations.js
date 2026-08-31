const DAY_MS = 86_400_000

export function parseISODate(value) {
  if (!value) return null
  const [year, month, day] = value.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

export function toISODate(date) {
  return date.toISOString().slice(0, 10)
}

export function addDays(value, days) {
  const date = typeof value === 'string' ? parseISODate(value) : value
  return toISODate(new Date(date.getTime() + days * DAY_MS))
}

export function daysBetween(start, end) {
  return (parseISODate(end) - parseISODate(start)) / DAY_MS
}

export function formatHours(value, digits = 2) {
  return Number(value || 0).toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

export function projectVacationPlan(settings, vacations = []) {
  const {
    currentBalance,
    balanceDate,
    accrualAmount,
    accrualIntervalDays,
    nextAccrualDate,
    cap,
    hoursPerDay,
    reserveDays,
    goalDate,
  } = settings

  const safeCurrentBalance = Math.max(0, Number(currentBalance) || 0)
  const safeAccrualAmount = Math.max(0, Number(accrualAmount) || 0)
  const safeInterval = Math.max(1, Number(accrualIntervalDays) || 14)
  const safeCap = Math.max(0, Number(cap) || 0)
  const safeHoursPerDay = Math.max(0, Number(hoursPerDay) || 0)
  const safeReserveDays = Math.max(0, Number(reserveDays) || 0)
  const targetReserve = safeHoursPerDay * safeReserveDays

  const events = []
  let accrualDate = nextAccrualDate

  // Move a stale next-accrual date forward into the active planning window.
  while (accrualDate && accrualDate < balanceDate) {
    accrualDate = addDays(accrualDate, safeInterval)
  }

  let accrualCount = 0
  while (accrualDate && accrualDate <= goalDate) {
    events.push({
      id: `accrual-${accrualDate}`,
      date: accrualDate,
      type: 'accrual',
      amount: safeAccrualAmount,
    })
    accrualCount += 1
    accrualDate = addDays(accrualDate, safeInterval)
  }

  const activeVacations = vacations.filter(
    (vacation) => vacation.date >= balanceDate && vacation.date <= goalDate,
  )

  activeVacations.forEach((vacation) => {
    events.push({
      ...vacation,
      type: 'vacation',
      amount: Math.max(0, Number(vacation.hours) || 0),
    })
  })

  // Vacation is deducted before accrual on days where both happen. This is the
  // conservative choice for preserving hours that might otherwise hit the cap.
  events.sort((a, b) => {
    const dateOrder = a.date.localeCompare(b.date)
    if (dateOrder !== 0) return dateOrder
    if (a.type === b.type) return 0
    return a.type === 'vacation' ? -1 : 1
  })

  let balance = Math.min(safeCurrentBalance, safeCap)
  let lostHours = Math.max(0, safeCurrentBalance - safeCap)
  let vacationShortfall = 0
  let firstOverflowDate = lostHours > 0 ? balanceDate : null
  const timeline = [
    {
      id: 'starting-balance',
      date: balanceDate,
      type: 'start',
      balance,
      amount: balance,
    },
  ]

  events.forEach((event) => {
    let lost = 0
    let shortfall = 0

    if (event.type === 'accrual') {
      const uncappedBalance = balance + event.amount
      lost = Math.max(0, uncappedBalance - safeCap)
      balance = Math.min(safeCap, uncappedBalance)
      lostHours += lost
      if (lost > 0 && !firstOverflowDate) firstOverflowDate = event.date
    } else {
      shortfall = Math.max(0, event.amount - balance)
      balance = Math.max(0, balance - event.amount)
      vacationShortfall += shortfall
    }

    timeline.push({ ...event, balance, lost, shortfall })
  })

  if (timeline.at(-1)?.date !== goalDate) {
    timeline.push({
      id: 'goal-date',
      date: goalDate,
      type: 'goal',
      balance,
      amount: 0,
    })
  }

  const plannedHours = activeVacations.reduce(
    (total, vacation) => total + Math.max(0, Number(vacation.hours) || 0),
    0,
  )
  const totalAccrued = accrualCount * safeAccrualAmount
  const grossBalance = safeCurrentBalance + totalAccrued
  const remainingBudget = grossBalance - plannedHours - targetReserve
  const daysRemaining = safeHoursPerDay > 0 ? remainingBudget / safeHoursPerDay : 0
  const reserveGap = Math.max(0, targetReserve - balance)

  return {
    activeVacations,
    events,
    timeline,
    accrualCount,
    totalAccrued,
    targetReserve,
    plannedHours,
    grossBalance,
    remainingBudget,
    daysRemaining,
    endingBalance: balance,
    lostHours,
    firstOverflowDate,
    vacationShortfall,
    reserveGap,
    onTrack: balance + 0.0001 >= targetReserve,
  }
}

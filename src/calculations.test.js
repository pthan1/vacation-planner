import assert from 'node:assert/strict'
import test from 'node:test'
import { projectVacationPlan } from './calculations.js'

const settings = {
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

test('projects the default biweekly plan through early July', () => {
  const result = projectVacationPlan(settings)

  assert.equal(result.accrualCount, 22)
  assert.ok(Math.abs(result.totalAccrued - 101.5388) < 0.00001)
  assert.ok(Math.abs(result.remainingBudget - 39.3888) < 0.00001)
  assert.ok(Math.abs(result.endingBalance - 120) < 0.00001)
  assert.ok(Math.abs(result.lostHours - 39.3888) < 0.00001)
  assert.equal(result.firstOverflowDate, '2027-03-05')
  assert.equal(result.onTrack, true)
})

test('an early vacation protects hours that would hit the cap', () => {
  const result = projectVacationPlan(settings, [
    { id: 'trip', name: 'Winter break', date: '2026-12-01', hours: 32 },
  ])

  assert.ok(Math.abs(result.endingBalance - 120) < 0.00001)
  assert.ok(Math.abs(result.lostHours - 7.3888) < 0.00001)
  assert.ok(Math.abs(result.remainingBudget - 7.3888) < 0.00001)
  assert.equal(result.onTrack, true)
})

test('a vacation after hours have already been lost can miss the reserve goal', () => {
  const result = projectVacationPlan(settings, [
    { id: 'trip', name: 'Late June', date: '2027-06-30', hours: 32 },
  ])

  assert.ok(Math.abs(result.endingBalance - 88) < 0.00001)
  assert.ok(Math.abs(result.reserveGap - 32) < 0.00001)
  assert.equal(result.onTrack, false)
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { rankNextBestBlockOptions } from '../../lib/family-os/index.ts'

test('setup and transition cost count against available time', () => {
  const options = rankNextBestBlockOptions([
    {
      id: 'task-a', ownerId: 'person-a', title: 'Focused task', mode: 'together',
      estimatedMinutes: 35, setupMinutes: 10, transitionMinutes: 10,
      priority: 'high', evidenceRefs: ['e-task'],
    },
  ], {
    personId: 'person-a', availableMinutes: 50, energy: 'high', evidenceRefs: ['e-now'],
  })
  assert.equal(options.length, 0)
})

test('high-energy work is filtered when current energy is low', () => {
  const options = rankNextBestBlockOptions([
    {
      id: 'deep', ownerId: 'person-a', title: 'Deep work', mode: 'together',
      estimatedMinutes: 30, requiredEnergy: 'high', priority: 'high', evidenceRefs: ['e1'],
    },
    {
      id: 'rest', ownerId: 'person-a', title: 'Rest', mode: 'physical', kind: 'rest',
      estimatedMinutes: 20, requiredEnergy: 'low', evidenceRefs: ['e2'],
    },
  ], {
    personId: 'person-a', availableMinutes: 30, energy: 'low', evidenceRefs: ['e-now'],
  })
  assert.equal(options.some((option) => option.opportunityId === 'deep'), false)
  assert.equal(options[0]?.opportunityId, 'rest')
  assert.equal(options[0]?.label, 'rest')
})

test('observed fit stays visible as evidence-backed reasons', () => {
  const options = rankNextBestBlockOptions([
    {
      id: 'admin', ownerId: 'person-a', title: 'Admin block', mode: 'digital',
      estimatedMinutes: 20, tags: ['admin'], priority: 'medium', evidenceRefs: ['e-admin'],
    },
  ], {
    personId: 'person-a', availableMinutes: 30, energy: 'medium', evidenceRefs: ['e-now'],
    observations: [
      { id: 'obs-1', tags: ['admin'], effect: 'supports', evidenceRef: 'history-1' },
      { id: 'obs-2', tags: ['travel'], effect: 'cautions', evidenceRef: 'history-2' },
    ],
  })
  assert.equal(options[0]?.fitReason.includes('OBSERVED_SUPPORT:history-1'), true)
  assert.equal(options[0]?.frictionReason.includes('OBSERVED_CAUTION:history-2'), false)
})

test('unknown duration remains uncertain instead of becoming high confidence', () => {
  const options = rankNextBestBlockOptions([
    {
      id: 'unknown', ownerId: 'person-a', title: 'Unknown task', mode: 'digital',
      priority: 'high', evidenceRefs: ['e1'],
    },
  ], {
    personId: 'person-a', availableMinutes: 30, energy: 'medium', evidenceRefs: ['e-now'],
  })
  assert.equal(options[0]?.frictionReason.includes('DURATION_UNKNOWN'), true)
  assert.notEqual(options[0]?.confidence, 'high')
})

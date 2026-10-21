import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { legalActions } from '../../engine'
import { createLegacyGame, mergeChanges, recordAction, startSession, undoAction } from '../campaign'
import type { Campaign, Ctx } from '../records'
import { openIndexedDbStore } from '../store/indexeddb'
import { MemoryStore } from '../store/memory'
import type { LegacyStore } from '../store/store'

let dbCount = 0
const stores: [string, () => Promise<LegacyStore>][] = [
  ['MemoryStore', async () => new MemoryStore()],
  ['IndexedDbStore', () => openIndexedDbStore(`test-${++dbCount}`)],
]

function testCtx(): Ctx {
  let id = 0
  let tick = 0
  return {
    now: () => new Date(Date.UTC(2026, 9, 21, 12, 0, tick++)).toISOString(),
    newId: () => `id-${String(++id).padStart(3, '0')}`,
    newSeed: () => 7,
  }
}

describe.each(stores)('%s', (_, open) => {
  async function seeded() {
    const store = await open()
    const ctx = testCtx()
    const created = createLegacyGame({ name: 'Halcyon', difficulty: 'cadet', starting_threes: null }, ctx)
    const started = startSession(mergeChanges(null, created), ctx)
    await store.commit(created)
    await store.commit(started)
    const campaign: Campaign = mergeChanges(mergeChanges(null, created), started)
    return { store, ctx, campaign }
  }

  it('saves and loads a campaign with its chapters and sessions', async () => {
    const store = await open()
    const ctx = testCtx()
    const created = createLegacyGame({ name: 'Halcyon', difficulty: 'cadet', starting_threes: null }, ctx)
    let campaign = mergeChanges(null, created)
    const started = startSession(campaign, ctx)
    campaign = mergeChanges(campaign, started)
    await store.commit(created)
    await store.commit(started)
    expect(await store.loadCampaign(campaign.legacyGame.id)).toEqual(campaign)
    expect(await store.loadCampaign('missing')).toBeNull()
  })

  it('lists legacy games, most recently updated first', async () => {
    const store = await open()
    const ctx = testCtx()
    const first = createLegacyGame({ name: 'First', difficulty: 'cadet', starting_threes: null }, ctx)
    const second = createLegacyGame({ name: 'Second', difficulty: 'veteran', starting_threes: ['power', 'data'] }, ctx)
    await store.commit(first)
    await store.commit(second)
    expect((await store.listLegacyGames()).map((g) => g.name)).toEqual(['Second', 'First'])
  })

  it('keeps every action in order, replacing a record written again', async () => {
    const { store, ctx, campaign } = await seeded()
    let current = campaign
    const ids: string[] = []
    for (let i = 0; i < 3; i++) {
      const session = current.sessions[0]
      const changes = recordAction(current, session, legalActions(session.state).find((a) => a.type !== 'endTurn')!, ctx)
      await store.commit(changes)
      current = mergeChanges(current, changes)
      ids.push(changes.actions![0].id)
    }
    const undo = undoAction(current.sessions[0], (await store.getAction(ids[2]))!, ctx)
    await store.commit(undo)
    const log = await store.listActions(current.sessions[0].id)
    expect(log.map((a) => a.seq)).toEqual([1, 2, 3])
    expect(log.map((a) => a.undone_at !== null)).toEqual([false, false, true])
    expect(await store.getAction('missing')).toBeNull()
    expect((await store.loadCampaign(current.legacyGame.id))!.sessions[0]).toEqual(mergeChanges(current, undo).sessions[0])
  })
})


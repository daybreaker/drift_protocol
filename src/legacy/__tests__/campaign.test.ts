import { describe, it } from 'vitest'

// The first slice of the Legacy campaign (docs/legacy/legacy-spec.md). Each todo becomes a real test before its code.
describe('Campaign', () => {
  it.todo('newCampaign starts at the first Story with no Credits, stickers or unlocks')
  it.todo('startSession builds a game whose cards match the campaign deck')
  it.todo('endSession turns a won Session into Credits and unlocks the next Story')
  it.todo('endSession on a loss keeps the Story and Scars the cards left in Breach')
  it.todo('never mutates the campaign it is given')
})

describe('Stickers', () => {
  it.todo('Reinforced adds 1 yield on the resource side')
  it.todo('Scarred takes 1 yield off, never below 0')
  it.todo('a card with no stickers plays exactly like the base card')
})

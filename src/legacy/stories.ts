/** A chapter of the campaign. Stories are content in code; a chapter record exists once one is unlocked. */
export interface Story {
  key: string
  title: string
  briefing: string
}

export const STORIES: readonly Story[] = [
  {
    key: 'salvage-rights',
    title: 'Salvage Rights',
    briefing:
      'The Halcyon is adrift and nobody is coming. Make three Jumps on what the salvage field gives you, and the wreck is yours to rebuild.',
  },
]

export function storyAt(position: number): Story | undefined {
  return STORIES[position - 1]
}

export function storyByKey(key: string): Story | undefined {
  return STORIES.find((s) => s.key === key)
}

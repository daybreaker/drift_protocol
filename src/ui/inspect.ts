import { createContext } from 'react'
import type { Card } from '../engine'

/**
 * Clicking a card inspects it; clicking the inspected card again turns it.
 * Cards that are also choices (in decision panels) only inspect, so a second click can un-pick them.
 */
export const InspectContext = createContext<{
  inspectedId: string | null
  inspect: (card: Card) => void
  activate: (card: Card) => void
}>({
  inspectedId: null,
  inspect: () => {},
  activate: () => {},
})

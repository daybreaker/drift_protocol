import { createContext } from 'react'
import type { Card } from '../engine'

export interface Inspected {
  card: Card
  flipped: boolean
  /** Where the card sits, e.g. "in the Cargo Rail (Airlock)". */
  where?: string
}

/** Cards report hover and focus here so the inspector can show them full size, and mark the one it shows. */
export const InspectContext = createContext<{ inspectedId: string | null; inspect: (i: Inspected) => void }>({
  inspectedId: null,
  inspect: () => {},
})

/** The location phrase for cards rendered inside a zone. */
export const WhereContext = createContext<string | undefined>(undefined)

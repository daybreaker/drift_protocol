import { createContext } from 'react'
import type { Card } from '../engine'

export interface Inspected {
  card: Card
  flipped: boolean
}

/** Cards report hover and focus here so the inspector can show them full size. */
export const InspectContext = createContext<(i: Inspected) => void>(() => {})

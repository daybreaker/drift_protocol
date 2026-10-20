import { createContext } from 'react'
import type { Card } from '../engine'

/** Cards report hover and focus here so the inspector can show them full size, and mark the one it shows. */
export const InspectContext = createContext<{ inspectedId: string | null; inspect: (card: Card) => void }>({
  inspectedId: null,
  inspect: () => {},
})

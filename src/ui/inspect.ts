import { createContext } from 'react'
import type { FieldCard } from '../engine'

/** Clicking a card inspects it; clicking the inspected card again turns it. */
export const InspectContext = createContext<{ inspectedId: string | null; activate: (card: FieldCard) => void }>({
  inspectedId: null,
  activate: () => {},
})

import { useContext, type ReactNode } from 'react'
import type { Card, Suit } from '../engine'
import { InspectContext } from './inspect'
import { actionName, cardImage, cardName } from './text'

// Same glyphs as the printed cards (tools/make_cards.py).
const SUIT_PATH: Record<Suit, string> = {
  power: 'M13 2 4 14h7l-1 8 9-12h-7l1-8z',
  crew: 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z',
  data: 'M12 2l2.6 7.4L22 12l-7.4 2.6L12 22l-2.6-7.4L2 12l7.4-2.6z',
  shields: 'M12 2l8 3v6c0 5-3.4 9.4-8 11-4.6-1.6-8-6-8-11V5z',
}

export function SuitIcon({ suit, size = 16, outline = false }: { suit: Suit; size?: number; outline?: boolean }) {
  return (
    <svg className={`suit-icon suit-${suit}`} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d={SUIT_PATH[suit]}
        fill={outline ? 'none' : 'currentColor'}
        stroke={outline ? 'currentColor' : 'none'}
        strokeWidth={outline ? 1.6 : 0}
        strokeLinejoin="round"
      />
    </svg>
  )
}

interface CardViewProps {
  card: Card
  /** Turned 180°, action side up. */
  flipped?: boolean
  size?: 'xs' | 'sm' | 'md' | 'lg'
  /** Picked in a decision panel. */
  selected?: boolean
  ghost?: boolean
  dim?: boolean
  /** Show only the top band, as for a card tucked under a Module. */
  tucked?: boolean
  /** A choice in a decision panel: clicking picks it (and inspects it) instead of turning it. */
  onClick?: () => void
  disabled?: boolean
  children?: ReactNode
}

export function CardView({ card, flipped, size = 'md', selected, ghost, dim, tucked, onClick, disabled, children }: CardViewProps) {
  const { inspectedId, inspect, activate } = useContext(InspectContext)
  const className = [
    'card',
    `card-${size}`,
    flipped && 'is-flipped',
    selected && 'is-selected',
    ghost && 'is-ghost',
    dim && 'is-dim',
    tucked && 'is-tucked',
    inspectedId === card.id && 'is-inspected',
  ]
    .filter(Boolean)
    .join(' ')
  const label = `${cardName(card)}, ${actionName(card)}${flipped ? ', action side up' : ''}`
  const click = onClick
    ? () => {
        inspect(card)
        onClick()
      }
    : () => activate(card)

  return (
    <button
      type="button"
      className={className}
      data-suit={card.suit}
      onClick={click}
      disabled={disabled}
      aria-label={label}
      aria-pressed={onClick ? !!selected : undefined}
      aria-current={inspectedId === card.id ? 'true' : undefined}
    >
      <span className="card-face">
        <img src={cardImage(card)} alt="" draggable={false} />
      </span>
      {children}
    </button>
  )
}

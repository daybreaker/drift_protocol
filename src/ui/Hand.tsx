import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent, type RefObject } from 'react'
import type { Card } from '../engine'
import { CardView } from './Card'
import { dropTarget, moveId, reconcileSlots, type Slot } from './handLayout'

const HOLD_MS = 700
const CLOSE_MS = 320
const DRAG_THRESHOLD = 6

interface Props {
  /** The hand in display order. */
  cards: Card[]
  /** The card being tried out in the Circuit; its place in the hand is held open. */
  previewId: string | null
  flipped: (card: Card) => boolean
  onReorder: (ids: string[]) => void
  /** The Circuit, where a card can be dropped. */
  circuit: RefObject<HTMLElement | null>
  /** Whether a card can be added to the Circuit right now, the way it faces. */
  canAdd: (card: Card) => boolean
  /** Adds a card to the Circuit as the tentative play (by Enter, or by dropping it there). */
  onAdd: (card: Card) => void
  /** Called as a drag starts or ends ('ready' while the dragged card could be added) and as it moves over the Circuit. */
  onDropState: (state: 'ready' | 'over' | null) => void
  emptyNote: string
}

interface Drag {
  card: Card
  pointerId: number
  startX: number
  startY: number
  x: number
  y: number
  /** Pointer offset from the card's top-left corner when the drag began. */
  grabX: number
  grabY: number
  active: boolean
  overCircuit: boolean
}

/**
 * The hand row. A card that leaves keeps its place open for a moment, then the gap closes and the rest
 * slide over. Drag a card sideways to rearrange the hand, or up onto the Circuit to add it there;
 * a drag never counts as a click. Enter on a focused card adds it to the Circuit.
 */
export function Hand({ cards, previewId, flipped, onReorder, circuit, canAdd, onAdd, onDropState, emptyNote }: Props) {
  const key = cards.map((c) => c.id).join(',')
  const [slots, setSlots] = useState<Slot[]>(() => cards.map((card) => ({ card })))
  const [lastKey, setLastKey] = useState(key)
  if (key !== lastKey) {
    setLastKey(key)
    setSlots(reconcileSlots(slots, cards))
  }

  // Gaps hold, then close, then go.
  useEffect(() => {
    if (slots.some((s) => s.leaving === 'hold')) {
      const t = setTimeout(() => setSlots((ss) => ss.map((s) => (s.leaving === 'hold' ? { ...s, leaving: 'close' } : s))), HOLD_MS)
      return () => clearTimeout(t)
    }
    if (slots.some((s) => s.leaving === 'close')) {
      const t = setTimeout(() => setSlots((ss) => ss.filter((s) => s.leaving !== 'close')), CLOSE_MS)
      return () => clearTimeout(t)
    }
  }, [slots])

  const row = useRef<HTMLDivElement>(null)
  const els = useRef(new Map<string, HTMLDivElement>())
  /** The lifted part of each slot: the card itself, which follows the pointer while the slot holds its place. */
  const lifts = useRef(new Map<string, HTMLDivElement>())
  const drag = useRef<Drag | null>(null)
  const suppressClick = useRef(false)
  const flipFrom = useRef<Map<string, number> | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)

  const liveIds = () => slots.filter((s) => !s.leaving).map((s) => s.card.id)

  /** Keeps the dragged card under the pointer. */
  const follow = () => {
    const d = drag.current
    const lift = d?.active && lifts.current.get(d.card.id)
    if (!d || !lift) return
    lift.style.left = `${d.x - d.grabX}px`
    lift.style.top = `${d.y - d.grabY}px`
  }

  // After a reorder, slide the other cards from where they were (FLIP), and re-place the dragged one.
  useLayoutEffect(() => {
    const from = flipFrom.current
    if (from) {
      flipFrom.current = null
      for (const [id, left] of from) {
        const el = els.current.get(id)
        const dx = el ? left - el.getBoundingClientRect().left : 0
        if (el && Math.abs(dx) > 0.5) el.animate([{ transform: `translateX(${dx}px)` }, { transform: 'translateX(0)' }], { duration: 180, easing: 'ease-out' })
      }
    }
    follow()
  })

  const onPointerDown = (e: PointerEvent, card: Card) => {
    if (e.button !== 0 || card.id === previewId) return
    drag.current = { card, pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, x: e.clientX, y: e.clientY, grabX: 0, grabY: 0, active: false, overCircuit: false }
  }

  const onPointerMove = (e: PointerEvent) => {
    const d = drag.current
    if (!d || e.pointerId !== d.pointerId) return
    d.x = e.clientX
    d.y = e.clientY
    const el = els.current.get(d.card.id)
    if (!el) return
    if (!d.active) {
      if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < DRAG_THRESHOLD) return
      const box = el.getBoundingClientRect()
      d.active = true
      d.grabX = d.startX - box.left
      d.grabY = d.startY - box.top
      // The slot keeps its size while the card is lifted out of it.
      el.style.width = `${box.width}px`
      el.style.height = `${box.height}px`
      el.setPointerCapture(e.pointerId)
      setDraggingId(d.card.id)
      onDropState(canAdd(d.card) ? 'ready' : null)
    }
    follow()

    const rowEl = row.current!
    const target = dropTarget({ x: e.clientX, y: e.clientY }, rowEl.getBoundingClientRect(), circuit.current?.getBoundingClientRect() ?? null)
    const overCircuit = target === 'circuit' && canAdd(d.card)
    if (overCircuit !== d.overCircuit) {
      d.overCircuit = overCircuit
      onDropState(overCircuit ? 'over' : canAdd(d.card) ? 'ready' : null)
    }
    if (target !== 'hand') return

    const ids = liveIds()
    const others = ids.filter((id) => id !== d.card.id)
    const x = e.clientX - rowEl.getBoundingClientRect().left + rowEl.scrollLeft
    const centre = (id: string) => {
      const o = els.current.get(id)!
      return o.offsetLeft + o.offsetWidth / 2
    }
    const index = others.filter((id) => centre(id) < x).length
    if (ids.indexOf(d.card.id) !== index) {
      flipFrom.current = new Map(others.map((id) => [id, els.current.get(id)!.getBoundingClientRect().left]))
      onReorder(moveId(ids, d.card.id, index))
    }
  }

  const endDrag = (e: PointerEvent) => {
    const d = drag.current
    if (!d || e.pointerId !== d.pointerId) return
    drag.current = null
    if (!d.active) return
    suppressClick.current = true
    setDraggingId(null)
    onDropState(null)
    const el = els.current.get(d.card.id)
    const lift = lifts.current.get(d.card.id)
    const from = lift?.getBoundingClientRect()
    for (const node of [el, lift]) node?.removeAttribute('style')
    if (e.type === 'pointerup' && d.overCircuit) return onAdd(d.card)
    // Otherwise the card settles back into its place.
    const to = lift?.getBoundingClientRect()
    if (lift && from && to) {
      lift.animate([{ transform: `translate(${from.left - to.left}px, ${from.top - to.top}px)` }, { transform: 'translate(0, 0)' }], { duration: 180, easing: 'ease-out' })
    }
  }

  if (slots.length === 0) return <div className="hand"><p className="empty-note">{emptyNote}</p></div>

  return (
    <div
      className="hand"
      ref={row}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onClickCapture={(e) => {
        if (!suppressClick.current) return
        suppressClick.current = false
        e.stopPropagation()
        e.preventDefault()
      }}
    >
      {slots.map(({ card, leaving }) =>
        leaving ? (
          <div key={card.id} className="hand-gap" data-phase={leaving} aria-hidden="true" />
        ) : (
          <div
            key={card.id}
            ref={(el) => {
              if (el) els.current.set(card.id, el)
              else els.current.delete(card.id)
            }}
            className={`hand-slot ${draggingId === card.id ? 'is-dragging' : ''}`}
            onPointerDown={(e) => onPointerDown(e, card)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter' || card.id === previewId || !canAdd(card)) return
              e.preventDefault()
              onAdd(card)
            }}
          >
            {card.id === previewId ? (
              <div className="hand-gap is-held" aria-label="Held open while you try this card in the Circuit" />
            ) : (
              <div
                className="hand-lift"
                ref={(el) => {
                  if (el) lifts.current.set(card.id, el)
                  else lifts.current.delete(card.id)
                }}
              >
                <CardView card={card} size="md" flipped={flipped(card)} />
              </div>
            )}
          </div>
        ),
      )}
    </div>
  )
}

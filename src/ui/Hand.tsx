import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent } from 'react'
import type { Card } from '../engine'
import { CardView } from './Card'
import { moveId, reconcileSlots, type Slot } from './handLayout'

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
  emptyNote: string
}

interface Drag {
  id: string
  pointerId: number
  startX: number
  x: number
  /** Pointer offset from the card's left edge when the drag began. */
  grab: number
  active: boolean
}

/**
 * The hand row. A card that leaves keeps its place open for a moment, then the gap closes and the rest
 * slide over. Cards can be dragged sideways to rearrange them; a drag never counts as a click.
 */
export function Hand({ cards, previewId, flipped, onReorder, emptyNote }: Props) {
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
  const drag = useRef<Drag | null>(null)
  const suppressClick = useRef(false)
  const flipFrom = useRef<Map<string, number> | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)

  const liveIds = () => slots.filter((s) => !s.leaving).map((s) => s.card.id)

  /** Keeps the dragged card under the pointer wherever its slot is laid out. */
  const follow = () => {
    const d = drag.current
    const el = d && els.current.get(d.id)
    if (!d || !el) return
    el.style.transform = ''
    el.style.transform = `translateX(${d.x - d.grab - el.getBoundingClientRect().left}px)`
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

  const onPointerDown = (e: PointerEvent, id: string) => {
    if (e.button !== 0) return
    drag.current = { id, pointerId: e.pointerId, startX: e.clientX, x: e.clientX, grab: 0, active: false }
  }

  const onPointerMove = (e: PointerEvent) => {
    const d = drag.current
    if (!d || e.pointerId !== d.pointerId) return
    d.x = e.clientX
    const el = els.current.get(d.id)
    if (!el) return
    if (!d.active) {
      if (Math.abs(e.clientX - d.startX) < DRAG_THRESHOLD) return
      d.active = true
      d.grab = d.startX - el.getBoundingClientRect().left
      el.setPointerCapture(e.pointerId)
      setDraggingId(d.id)
    }
    follow()

    const ids = liveIds()
    const others = ids.filter((id) => id !== d.id)
    const rowEl = row.current!
    const x = e.clientX - rowEl.getBoundingClientRect().left + rowEl.scrollLeft
    const centre = (id: string) => {
      const o = els.current.get(id)!
      return o.offsetLeft + o.offsetWidth / 2
    }
    const target = others.filter((id) => centre(id) < x).length
    if (ids.indexOf(d.id) !== target) {
      flipFrom.current = new Map(others.map((id) => [id, els.current.get(id)!.getBoundingClientRect().left]))
      onReorder(moveId(ids, d.id, target))
    }
  }

  const endDrag = (e: PointerEvent) => {
    const d = drag.current
    if (!d || e.pointerId !== d.pointerId) return
    drag.current = null
    if (!d.active) return
    suppressClick.current = true
    setDraggingId(null)
    const el = els.current.get(d.id)
    if (el) {
      const from = el.style.transform
      el.style.transform = ''
      el.animate([{ transform: from }, { transform: 'translateX(0)' }], { duration: 150, easing: 'ease-out' })
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
            onPointerDown={(e) => onPointerDown(e, card.id)}
          >
            {card.id === previewId ? (
              <div className="hand-gap is-held" aria-label="Held open while you try this card in the Circuit" />
            ) : (
              <CardView card={card} size="md" flipped={flipped(card)} />
            )}
          </div>
        ),
      )}
    </div>
  )
}

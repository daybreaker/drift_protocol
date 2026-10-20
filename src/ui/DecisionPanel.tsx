import { useState, type ReactNode } from 'react'
import { isLegal, salvageCost, SUITS, type Action, type Card, type Decision, type DecisionChoice, type GameState, type Suit } from '../engine'
import { CardView, SuitIcon } from './Card'
import { WhereContext } from './inspect'
import { cardName, MODULE_NAME, SUIT_NAME } from './text'

interface Props {
  game: GameState
  act: (action: Action) => void
}

/** Answers the first pending decision. Each kind gets its own small form. */
export function DecisionPanel({ game, act }: Props) {
  const decision = game.pending[0]
  const resolve = (choice: DecisionChoice) => act({ type: 'resolve', choice })
  const valid = (choice: DecisionChoice) => isLegal(game, { type: 'resolve', choice })
  const props = { game, resolve, valid }
  // Keyed so a fresh decision of the same kind starts with a clean form.
  const key = `${game.turn}-${game.circuit.length}-${game.pending.length}-${decision.kind}`

  return (
    <WhereContext.Provider value={`shown in the ${decision.kind.startsWith('log') ? 'Log' : 'decision'} panel`}>
      <section className="decision" aria-live="polite">
        {decision.kind === 'chooseResource' && <ChooseResource key={key} decision={decision} {...props} />}
        {decision.kind === 'scan' && <Scan key={key} decision={decision} {...props} />}
        {decision.kind === 'chooseCards' && <ChooseCards key={key} decision={decision} {...props} />}
        {decision.kind === 'tractorBeam' && <TractorBeam key={key} decision={decision} {...props} />}
        {decision.kind === 'dock' && <Dock key={key} decision={decision} {...props} />}
        {decision.kind === 'engineer' && <Engineer key={key} decision={decision} {...props} />}
        {decision.kind === 'log1' && <Log1 key={key} {...props} />}
        {decision.kind === 'log2' && <Log2 key={key} {...props} />}
      </section>
    </WhereContext.Provider>
  )
}

interface FormProps<K extends Decision['kind']> {
  game: GameState
  decision: Extract<Decision, { kind: K }>
  resolve: (choice: DecisionChoice) => void
  valid: (choice: DecisionChoice) => boolean
}

function Prompt({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <header className="decision-prompt">
      <h2>{title}</h2>
      {children && <p>{children}</p>}
    </header>
  )
}

function ChooseResource({ decision, resolve }: FormProps<'chooseResource'>) {
  return (
    <>
      <Prompt title="Scrounge">Gain {decision.amount} of one resource.</Prompt>
      <div className="decision-row">
        {SUITS.map((suit) => (
          <button key={suit} type="button" className="btn suit-btn" data-suit={suit} onClick={() => resolve({ kind: 'chooseResource', suit })}>
            <SuitIcon suit={suit} size={18} /> {decision.amount} {SUIT_NAME[suit]}
          </button>
        ))}
      </div>
    </>
  )
}

function Scan({ decision, resolve }: FormProps<'scan'>) {
  const [order, setOrder] = useState<string[]>(decision.cards.map((c) => c.id))
  const discard = decision.cards.filter((c) => !order.includes(c.id)).map((c) => c.id)
  const byId = (id: string) => decision.cards.find((c) => c.id === id)!
  const move = (i: number, by: number) => {
    const next = [...order]
    ;[next[i], next[i + by]] = [next[i + by], next[i]]
    setOrder(next)
  }

  if (decision.cards.length === 0) {
    return (
      <>
        <Prompt title="Scan">Your deck is empty, so there is nothing to look at.</Prompt>
        <div className="decision-actions">
          <button type="button" className="btn btn-primary" onClick={() => resolve({ kind: 'scan', discard: [], order: [] })}>
            {decision.drawAfter ? 'Continue and draw 1' : 'Continue'}
          </button>
        </div>
      </>
    )
  }

  return (
    <>
      <Prompt title="Scan">
        These are the top {decision.cards.length} cards of your deck. Discard any, and put the rest back in the order you want; the leftmost goes on top.
        {decision.drawAfter && ' Then you draw 1.'}
      </Prompt>
      <div className="decision-row">
        {order.map((id, i) => (
          <div key={id} className="pick">
            <CardView card={byId(id)} size="sm" />
            <div className="pick-controls">
              <button type="button" className="btn btn-small" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move ${cardName(byId(id))} up the deck`}>
                ◀
              </button>
              <button type="button" className="btn btn-small" onClick={() => setOrder(order.filter((x) => x !== id))}>
                Discard
              </button>
              <button type="button" className="btn btn-small" disabled={i === order.length - 1} onClick={() => move(i, 1)} aria-label={`Move ${cardName(byId(id))} down the deck`}>
                ▶
              </button>
            </div>
          </div>
        ))}
        {discard.map((id) => (
          <div key={id} className="pick">
            <CardView card={byId(id)} size="sm" dim />
            <div className="pick-controls">
              <button type="button" className="btn btn-small" onClick={() => setOrder([...order, id])}>
                Keep
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="decision-actions">
        <button type="button" className="btn btn-primary" onClick={() => resolve({ kind: 'scan', discard, order })}>
          {discard.length ? `Discard ${discard.length}, return ${order.length}` : `Return ${order.length}`}
          {decision.drawAfter && ', draw 1'}
        </button>
      </div>
    </>
  )
}

function ChooseCards({ game, decision, resolve, valid }: FormProps<'chooseCards'>) {
  const [picked, setPicked] = useState<string[]>([])
  const toggle = (id: string) => setPicked(picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id])
  const choice: DecisionChoice = { kind: 'chooseCards', cardIds: picked }
  const jettison = decision.purpose === 'jettison'
  const groups: [string, Card[]][] = jettison
    ? [['Hand', game.hand], ['Discard pile', game.discard]]
    : [['Circuit', game.circuit.filter((e) => !e.plotted).map((e) => e.card)], ['Discard pile', game.discard]]
  const upTo = decision.max === 1 ? '1 card' : `up to ${decision.max} cards`

  return (
    <>
      {jettison ? (
        <Prompt title="Jettison">Archive {upTo} from your hand or discard pile. Each one gives 1 Power.</Prompt>
      ) : (
        <Prompt title="Navigator">Plot {upTo} from the Circuit or your discard pile into the Course, with no Data.</Prompt>
      )}
      <CardGroups groups={groups} picked={picked} onPick={toggle} full={picked.length >= decision.max} />
      <div className="decision-actions">
        <button type="button" className="btn btn-primary" disabled={!valid(choice)} onClick={() => resolve(choice)}>
          {picked.length === 0
            ? jettison ? 'Archive nothing' : 'Plot nothing'
            : jettison ? `Archive ${picked.length}, gain ${picked.length} Power` : `Plot ${picked.length}`}
        </button>
      </div>
    </>
  )
}

function CardGroups({ groups, picked, onPick, full }: { groups: [string, Card[]][]; picked: string[]; onPick: (id: string) => void; full: boolean }) {
  return (
    <div className="decision-groups">
      {groups.map(([label, cards]) => (
        <div key={label} className="decision-group">
          <h3>{label}</h3>
          {cards.length === 0 ? (
            <p className="muted">Empty</p>
          ) : (
            <div className="decision-row">
              {cards.map((card) => (
                <CardView
                  key={card.id}
                  card={card}
                  size="sm"
                  selected={picked.includes(card.id)}
                  disabled={full && !picked.includes(card.id)}
                  onClick={() => onPick(card.id)}
                />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function TractorBeam({ game, decision, resolve, valid }: FormProps<'tractorBeam'>) {
  return (
    <>
      <Prompt title="Tractor Beam">
        Salvage a Cargo Rail card for 2 less. It goes {decision.toHand ? 'into your hand' : 'on top of your deck'}.
      </Prompt>
      <div className="decision-row">
        {game.rail.map((card, railIndex) =>
          card ? (
            <div key={card.id} className="pick">
              <CardView
                card={card}
                size="sm"
                disabled={!valid({ kind: 'tractorBeam', railIndex })}
                onClick={() => resolve({ kind: 'tractorBeam', railIndex })}
              />
              <span className="pick-cost">
                {salvageCost(game, railIndex, 2)} <SuitIcon suit={card.suit} size={12} />
              </span>
            </div>
          ) : null,
        )}
      </div>
      <div className="decision-actions">
        <button type="button" className="btn" onClick={() => resolve({ kind: 'tractorBeam', railIndex: null })}>
          Salvage nothing
        </button>
      </div>
    </>
  )
}

function Dock({ game, decision, resolve, valid }: FormProps<'dock'>) {
  const [cardId, setCardId] = useState<string | null>(null)
  return (
    <>
      <Prompt title="Dock">
        Station a card from your hand at a Module for free.{decision.produceNow && ' That Module produces right away.'}
      </Prompt>
      <div className="decision-row">
        {game.hand.map((card) => (
          <CardView key={card.id} card={card} size="sm" selected={card.id === cardId} onClick={() => setCardId(card.id === cardId ? null : card.id)} />
        ))}
        {game.hand.length === 0 && <p className="muted">Your hand is empty.</p>}
      </div>
      <div className="decision-actions">
        {cardId &&
          SUITS.map((module) => (
            <button
              key={module}
              type="button"
              className="btn suit-btn"
              data-suit={module}
              disabled={!valid({ kind: 'dock', cardId, module })}
              onClick={() => resolve({ kind: 'dock', cardId, module })}
            >
              <SuitIcon suit={module} size={16} /> {MODULE_NAME[module]}
            </button>
          ))}
        <button type="button" className="btn" onClick={() => resolve({ kind: 'dock', cardId: null })}>
          Station nothing
        </button>
      </div>
    </>
  )
}

function Engineer({ game, decision, resolve, valid }: FormProps<'engineer'>) {
  return (
    <>
      <Prompt title="Engineer">Choose another Circuit card to copy its {decision.sync ? 'Sync effect' : 'base action'}.</Prompt>
      <div className="decision-row">
        {game.circuit.map((e, circuitIndex) =>
          circuitIndex === decision.engineerIndex ? null : (
            <CardView
              key={e.card.id}
              card={e.card}
              size="sm"
              flipped={e.side === 'action'}
              disabled={!valid({ kind: 'engineer', circuitIndex })}
              onClick={() => resolve({ kind: 'engineer', circuitIndex })}
            />
          ),
        )}
      </div>
    </>
  )
}

function Log1({ game, resolve }: { game: GameState; resolve: (c: DecisionChoice) => void }) {
  const [module, setModule] = useState<Suit | null>(null)
  return (
    <>
      <Prompt title="Log 1: Cold Sleepers">The cryo bay is intact: forty colonists, still breathing.</Prompt>
      <div className="log-options">
        <div className="log-option">
          <h3>Wake the chief engineer</h3>
          <p>One Module of your choice can hold two stationed cards for the rest of the game.</p>
          <div className="decision-row">
            {SUITS.map((m) => (
              <button key={m} type="button" className="btn suit-btn" data-suit={m} aria-pressed={module === m} onClick={() => setModule(m)}>
                <SuitIcon suit={m} size={16} /> {MODULE_NAME[m]}
              </button>
            ))}
          </div>
          <button type="button" className="btn btn-primary" disabled={!module} onClick={() => module && resolve({ kind: 'log1', option: 'A', module })}>
            {module ? `Expand the ${MODULE_NAME[module]}` : 'Choose a Module'}
          </button>
        </div>
        <div className="log-option">
          <h3>Let them sleep; take their power</h3>
          <p>
            Move every Breach card to the bottom of the Salvage Yard.{' '}
            {game.breach.length === 0 ? 'Your Breach pile is empty.' : `That clears ${game.breach.length} from your Breach pile.`}
          </p>
          <button type="button" className="btn btn-primary" onClick={() => resolve({ kind: 'log1', option: 'B' })}>
            Clear the Breach pile
          </button>
        </div>
      </div>
    </>
  )
}

function Log2({ game, resolve, valid }: { game: GameState; resolve: (c: DecisionChoice) => void; valid: (c: DecisionChoice) => boolean }) {
  const [rail, setRail] = useState<number[]>([])
  const [archive, setArchive] = useState<string[]>([])
  const toggleRail = (i: number) => setRail(rail.includes(i) ? rail.filter((x) => x !== i) : [...rail, i].slice(-2))
  const toggleArchive = (id: string) => setArchive(archive.includes(id) ? archive.filter((x) => x !== id) : [...archive, id])
  const boardChoice: DecisionChoice | null = rail.length === 2 ? { kind: 'log2', option: 'A', railIndices: [rail[0], rail[1]] } : null
  const silentChoice: DecisionChoice = { kind: 'log2', option: 'B', archive }

  return (
    <>
      <Prompt title="Log 2: The Echo">Something jumped in behind you. Its hull registry matches yours.</Prompt>
      <div className="log-options">
        <div className="log-option">
          <h3>Board it</h3>
          <p>Take any 2 Cargo Rail cards into your hand now. From now on, Drift vents both the Airlock and the Inner Lock each turn.</p>
          <div className="decision-row">
            {game.rail.map((card, i) =>
              card ? <CardView key={card.id} card={card} size="xs" selected={rail.includes(i)} onClick={() => toggleRail(i)} /> : null,
            )}
          </div>
          <button type="button" className="btn btn-primary" disabled={!boardChoice || !valid(boardChoice)} onClick={() => boardChoice && resolve(boardChoice)}>
            {rail.length === 2 ? 'Board it and take 2' : `Choose ${2 - rail.length} more`}
          </button>
        </div>
        <div className="log-option">
          <h3>Run silent</h3>
          <p>Archive up to 3 cards from your hand or discard pile. From now on, neutralizing costs 1 more.</p>
          <CardGroups groups={[['Hand', game.hand], ['Discard pile', game.discard]]} picked={archive} onPick={toggleArchive} full={archive.length >= 3} />
          <button type="button" className="btn btn-primary" disabled={!valid(silentChoice)} onClick={() => resolve(silentChoice)}>
            {archive.length ? `Run silent and archive ${archive.length}` : 'Run silent'}
          </button>
        </div>
      </div>
    </>
  )
}

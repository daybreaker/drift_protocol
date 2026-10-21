import { useState } from 'react'
import { activeSession, type LegacyStore, type SessionRecord } from '../../legacy'
import { Game } from '../Game'
import type { Session } from '../useGame'
import { CampaignScreen } from './CampaignScreen'
import { useCampaign } from './useLegacy'

const EXIT = { button: 'Campaign', outcome: 'Back to campaign' }

/** A legacy campaign: its campaign screen, or the Session being played. */
export function LegacyApp({ store, legacyGameId, leave }: { store: LegacyStore; legacyGameId: string; leave: () => void }) {
  const { campaign, error, start, act, undo, setHandOrder } = useCampaign(store, legacyGameId)
  const [playingId, setPlayingId] = useState<string | null>(null)

  if (!campaign) {
    return (
      <main className="start">
        <p className={error ? 'tray-problem' : 'muted'}>{error ?? 'Loading the campaign…'}</p>
        {error && <button type="button" className="btn" onClick={leave}>Main menu</button>}
      </main>
    )
  }

  const playing = playingId ? campaign.sessions.find((s) => s.id === playingId) : undefined
  if (playing) {
    return (
      <>
        {error && <p className="save-error" role="alert">{error}</p>}
        <Game
          session={asSession(playing)}
          act={(a) => act(playing.id, a)}
          undo={() => undo(playing.id)}
          quit={() => setPlayingId(null)}
          setHandOrder={(ids) => setHandOrder(playing.id, ids)}
          exit={EXIT}
        />
      </>
    )
  }

  const play = async () => {
    const id = activeSession(campaign)?.id ?? (await start())
    if (id) setPlayingId(id)
  }
  return <CampaignScreen campaign={campaign} error={error} play={play} leave={leave} />
}

function asSession(record: SessionRecord): Session {
  return { game: record.state, undo: record.undo_states, summary: record.summary, handOrder: record.hand_order }
}

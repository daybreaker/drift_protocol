import { activeSession, currentChapter, storyByKey, type Campaign, type SessionRecord } from '../../legacy'

const DIFFICULTY_NAME = { cadet: 'Cadet', standard: 'Standard', veteran: 'Veteran' } as const

export function CampaignScreen({ campaign, error, play, leave }: { campaign: Campaign; error: string | null; play: () => void; leave: () => void }) {
  const { legacyGame, sessions } = campaign
  const chapter = currentChapter(campaign)
  const story = storyByKey(chapter.story_key)
  const active = activeSession(campaign)
  const attempts = sessions.filter((s) => s.chapter_id === chapter.id).length
  const finished = chapter.status === 'completed'

  return (
    <main className="start campaign">
      <header className="campaign-head">
        <h1>{legacyGame.name}</h1>
        <dl className="campaign-stats">
          <div><dt>Credits</dt><dd>{legacyGame.credits}</dd></div>
          <div><dt>Difficulty</dt><dd>{DIFFICULTY_NAME[legacyGame.difficulty]}</dd></div>
          <div><dt>Sessions</dt><dd>{sessions.length}</dd></div>
        </dl>
      </header>

      <section className="story">
        <h2>Story {chapter.position}: {story?.title ?? chapter.story_key}</h2>
        <p className="start-premise">{story?.briefing}</p>
        {finished ? (
          <p className="muted">You have finished every Story written so far. New Stories will appear here as they are added.</p>
        ) : active ? (
          <p className="muted">Session {active.attempt} is in progress, on turn {active.state.turn} with {active.state.jumps} of 3 Jumps made.</p>
        ) : attempts > 0 ? (
          <p className="muted">The last Session was lost. Start another to try this Story again.</p>
        ) : null}
        {error && <p className="tray-problem">{error}</p>}
      </section>

      <div className="campaign-actions">
        {!finished && (
          <button type="button" className="btn btn-primary btn-launch" onClick={play}>
            {active ? 'Continue Session' : `Start Session ${attempts + 1}`}
          </button>
        )}
        <button type="button" className="btn" onClick={leave}>Main menu</button>
      </div>

      {sessions.length > 0 && (
        <section>
          <h2>Ship's log</h2>
          <table className="log-table">
            <thead>
              <tr><th>Story</th><th>Session</th><th>Result</th><th>Credits</th></tr>
            </thead>
            <tbody>
              {[...sessions].reverse().map((s) => <LogRow key={s.id} campaign={campaign} session={s} />)}
            </tbody>
          </table>
        </section>
      )}
    </main>
  )
}

function LogRow({ campaign, session }: { campaign: Campaign; session: SessionRecord }) {
  const chapter = campaign.chapters.find((c) => c.id === session.chapter_id)
  const result =
    session.status === 'won' ? `Won, ${session.score} points`
    : session.status === 'lost' ? `Lost on turn ${session.state.turn}`
    : `In progress, turn ${session.state.turn}`
  return (
    <tr>
      <td>{chapter ? storyByKey(chapter.story_key)?.title : ''}</td>
      <td>{session.attempt}</td>
      <td>{result}</td>
      <td>{session.credits_earned > 0 ? `+${session.credits_earned}` : '0'}</td>
    </tr>
  )
}

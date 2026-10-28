// The game on the screen, over the map: one start card, then time runs by itself. On top, the year and one line
// of what Weimar has become; a surprise is announced when something unexpected strikes; at the bottom, how the
// people of Weimar live, which the player can change at any time. The people the town's mind looks at stand on
// the streets of the map itself (Future.jsx). At 2077 the ending, and the whole chronicle in a drawer.

import { useState } from 'react'
import { CHOICES, INDICATORS, YEARS } from './future.js'
import { BeforeAfter, RealData } from './FuturePanel.jsx'

const pct = (v) => Math.round(v * 100)
const EARLY_AFTER = 3 // answers after which the town starts its first thought
const fmtDate = (iso) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
const barColor = (v) => (v > 0.6 ? '#3fbf6a' : v > 0.35 ? '#e0b400' : '#e0402e')
const iconOf = (c, level) => (level === 0 ? c.b.icon : level === 2 ? c.a.icon : '⚖️')
const modelName = (id = '') => (id.includes('haiku') ? 'Claude Haiku 4.5' : id.includes('opus') ? 'Claude Opus 5.5' : 'Claude')

export default function Game({ future, ready }) {
  const [chronicle, setChronicle] = useState(false)
  if (!ready) return null
  return (
    <>
      {future.phase === 'setup' ? <Start future={future} /> : <Play future={future} onChronicle={() => setChronicle(true)} />}
      {chronicle && future.run && <Chronicle future={future} onClose={() => setChronicle(false)} />}
    </>
  )
}

function Start({ future }) {
  const { live, recorded, real, play, pick, warmUp } = future
  const [step, setStep] = useState(-1) // -1 the intro, then one card per habit; after the last answer the future starts
  if (step >= 0) {
    const c = CHOICES[step]
    const answer = (level) => {
      pick(c.id, level)
      if (step === CHOICES.length - 1) play()
      else {
        // a few questions before the end the town already starts thinking, so nothing has to wait once time runs
        if (step + 1 === EARLY_AFTER) setTimeout(() => warmUp(EARLY_AFTER), 0)
        setStep(step + 1)
      }
    }
    return (
      <div className="stage">
        <div className="card">
          <div className="card-tag">Weimar · 2026</div>
          <h2>{c.question}</h2>
          <div className="answers">
            {[0, 1, 2].map((l) => (
              <button key={l} onClick={() => answer(l)}>
                <span className="answer-icon">{iconOf(c, l)}</span>
                {c.answers[l]}
              </button>
            ))}
          </div>
          <div className="dots">
            {CHOICES.map((q, i) => (
              <span key={q.id} className={i < step ? 'done' : i === step ? 'now' : ''} />
            ))}
          </div>
          <button className="back" onClick={() => setStep(step - 1)}>
            ← Back
          </button>
        </div>
      </div>
    )
  }
  return (
    <div className="stage">
      <div className="card intro">
        <div className="card-tag">Weimar · 2026</div>
        <h1>What will Weimar become?</h1>
        <p>
          First, tell how the people of Weimar live. Then time runs on its own until 2077, and the town decides what
          follows. Anything can happen.
        </p>
        <button className="go" onClick={() => setStep(0)} disabled={live === null}>
          {live === null ? 'Waking the town…' : 'Start'}
        </button>
        {live === false && !recorded.length && <p className="note warn">No future has been lived yet: play the game on the laptop first.</p>}
        {live === false && recorded.length > 0 && <p className="note">On this website you'll watch a future already lived, in the same fifty seconds.</p>}
        {real?.air && (
          <p className="note">
            Weimar right now, from Open-Meteo: air quality index {real.air.european_aqi}
            {real.weather && `, ${real.weather.temperature_c} °C`}
            {real.river && `, the Ilm flowing at ${real.river.today_m3s} m³/s`}. The town starts from these.
          </p>
        )}
      </div>
    </div>
  )
}

function Play({ future, onChronicle }) {
  const { run, phase, error, thinking, spot, ending, latest, compare, setCompare, pause, resume, toSetup } = future
  const [closed, setClosed] = useState(false) // the ending card, put away to explore the city
  if (!run) return <div className="stage">{error && <div className="card">{error}</div>}</div>
  const done = phase === 'done'
  const year = compare ? YEARS[0] : Math.floor(run.year)
  const progress = (run.year - YEARS[0]) / (YEARS[YEARS.length - 1] - YEARS[0])
  const recorded = Boolean(run.replay)
  return (
    <>
      <div className={`years${compare ? ' compare' : ''}`}>
        <div className="years-number">
          {year}
          {thinking && <span className="stirring" title="the town is thinking" />}
        </div>
      </div>

      {spot && !compare && !done && !ending && <Moment moment={spot} kind={spot.strange ? 'strange' : spot.mood} />}
      {ending?.stage === 'event' && !compare && <Moment moment={ending.event} kind={`last ${ending.event.mood}`} tag="The last event" />}

      {!(done && !closed) && (
        <div className="habits">
          <div className="habits-progress">
            <span style={{ width: `${progress * 100}%` }} />
          </div>
          <div className="habits-line">
            {compare
              ? 'Weimar before it all began'
              : spot || ending
                ? ' '
                : phase === 'ending'
                  ? 'The last years settle…'
                  : latest?.headline || 'Weimar, as it is today'}
          </div>
          <div className="habits-buttons">
            {phase === 'running' && <button onClick={pause}>⏸ Pause</button>}
            {phase === 'paused' && <button onClick={resume}>▶ Continue</button>}
            {(done || phase === 'paused') && run.memory.length > 0 && <button onClick={onChronicle}>Chronicle</button>}
            {(done || phase === 'paused') && (
              <button className={compare ? 'on' : ''} onClick={() => setCompare(!compare)}>
                {compare ? 'Back to now' : 'Compare with 2026'}
              </button>
            )}
            <button onClick={toSetup}>{done ? '▶ Play again' : '✕ New game'}</button>
          </div>
          {error && <div className="note warn">{error}</div>}
        </div>
      )}
      {done && !closed && <Ending run={run} onExplore={() => setClosed(true)} onChronicle={onChronicle} onAgain={toSetup} />}
    </>
  )
}

// One thing happening, on the whole screen: a glow at the edges, a flash when it strikes, the emoji, title and one sentence
function Moment({ moment, kind, tag }) {
  return (
    <div className={`moment ${kind}`} key={moment.key}>
      <div className="bars" />
      <div className="flash" />
      <div className="spot">
        {tag && <div className="spot-place">{tag}</div>}
        {moment.icon && <div className="spot-icon">{moment.icon}</div>}
        <div className="spot-title">{moment.title}</div>
        {moment.story && <div className="spot-story">{moment.story}</div>}
        {moment.place && <div className="spot-place">{moment.place}</div>}
      </div>
    </div>
  )
}

function Ending({ run, onExplore, onChronicle, onAgain }) {
  const last = run.memory[run.memory.length - 1]
  // the town's own verdict; without one, the scores decide
  const avg = INDICATORS.reduce((t, s) => t + (run.state[s.id] ?? 0.5), 0) / INDICATORS.length
  const verdict = last?.verdict ?? (avg > 0.6 ? { word: 'In good shape', icon: '🌿', mood: 'good' } : avg > 0.35 ? { word: 'Getting by', icon: '⚖️', mood: 'mixed' } : { word: 'In bad shape', icon: '🥀', mood: 'bad' })
  return (
    <div className="verdict">
      <div className="card-tag">Weimar · 2077</div>
      <div className="verdict-icon">{verdict.icon}</div>
      <div className={`verdict-word ${verdict.mood}`}>{verdict.word}</div>
      {last?.outlook && <div className="verdict-line">{last.outlook}</div>}
      <div className="ending-buttons">
        <button className="go" onClick={onAgain}>
          ▶ Play again
        </button>
        <button onClick={onExplore}>Look around</button>
        <button onClick={onChronicle}>What happened</button>
      </div>
    </div>
  )
}

function Chronicle({ future, onClose }) {
  const { run, zones } = future
  const name = (id) => zones.find((z) => z.id === id)?.name ?? id
  return (
    <aside className="story">
      <button className="close" onClick={onClose} aria-label="Close">
        ✕
      </button>
      <h2>Chronicle of Weimar, 2026–{Math.floor(run.year)}</h2>
      <p className="small">
        The town watched how people lived, judged each habit by its consequences, and decided on its own what followed. The
        people seen on the streets are simulated; the air, weather and river data are real. Nobody knows the future; this is one possibility.
      </p>
      {[...run.memory].reverse().map((m, i) => (
        <div key={i} className={`future-step${m.surprise ? ' struck' : ''}`}>
          <div className="fst-year">{m.year}</div>
          {m.headline && <div className="fst-headline">{m.headline}</div>}
          <div className="small">Woke because {m.why}.</div>
          {m.thought && <div className="fst-thought mixed">{m.thought}</div>}
          {m.guessed && Object.keys(m.guessed).length > 0 && (
            <div className="small">
              Guessed: {Object.entries(m.guessed).map(([k, v]) => `${k.replace(/_/g, ' ')} ${v}`).join(' · ')}
            </div>
          )}
          {m.judged?.length > 0 && (
            <div className="small">
              {m.judged.map((j) => `${j.value > 0 ? '+' : j.value < 0 ? '−' : '±'}${Math.abs(j.value).toFixed(1)} ${j.behaviour}`).join(' · ')}
            </div>
          )}
          {m.surprise && (
            <div className="fst-event">
              ⚡ {m.surprise.title}: {m.surprise.story}
            </div>
          )}
          {m.changes.map((c, k) => (
            <div key={k} className={`fst-decision ${c.mood}`}>
              <BeforeAfter change={c} />
              <div>
                <b>{c.title}</b> · {name(c.place)}
                <div>{c.story}</div>
              </div>
            </div>
          ))}
          {m.outlook && <div className="small fst-outlook">{m.outlook}</div>}
        </div>
      ))}
      <RealData real={run.real} recorded={Boolean(run.replay)} />
      <p className="small">Decided by {modelName(run.memory[run.memory.length - 1]?.model)} (Anthropic).</p>
    </aside>
  )
}

// Runs the game: time flows by itself from 2026 to 2077, about a year a second, and never waits. The mind of
// Weimar (Claude, on the laptop) wakes on its own, every few years or when something happens (the player
// changes how people live, or a surprise it started is still unfolding), looks at the town and decides what,
// if anything, changes. Its answer lands in whatever year it has become by then.
// Every game that reaches 2077 on the laptop is saved to public/data/futures/ as a timeline; the published
// site has no live mind and replays those timelines, year by year.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  CHOICES,
  DEFAULT_CHOICES,
  YEARS,
  applyChanges,
  cityFacts,
  cleanStep,
  closestRun,
  fetchRealData,
  initialState,
  makeZones,
  nextState,
  nextWorld,
  observe,
  sharesOf,
  happened,
  isRepeat,
  everyday,
  startWorld,
  wakeContext,
} from './future.js'

export const YEAR_MS = 1100 // one year of Weimar passes in this many milliseconds
// A thought takes about 3 s, but Replicate lets accounts with a small balance start only one every ~10 s. The game
// measures how long thoughts take; when there is no time left for two more before 2077, the next one is the last.
// the last waking: the town chooses the event Weimar's story ends with
const FINAL = 'It is now 2077: time has run out. Choose the last event, then give your final picture of Weimar, with indicators, outlook and verdict'
const finalWhy = () => FINAL
const LAST_EVENT_MS = 8000 // the least time the last event is shown before the verdict
const START = YEARS[0]
const END = YEARS[YEARS.length - 1]
const THINK_EVERY = 5 // years between wakings when nothing else happens
const FIRST_EVENT = 2027 // nothing is shown before this year: the first thought waits for it
const FINAL_AT = 2069 // the last thought is asked for in this year, so the last event plays while time runs out to 2077
const PEOPLE_MS = 3000 // how long the people the mind looks at stand on the streets
const SURPRISE_MS = 5000 // how long a surprise is announced
const SPOT_MS = 6000 // how long the camera stays on each thing that happened
const STRANGE_MS = 7000 // and on the strange event
const FUTURES = 'data/futures'
// A replayed future saved before the last event existed has none: one of these comes instead, picked at random,
// with no link to people's habits. A live game never uses them, the mind chooses its own.
const LAST_EVENTS = [
  { title: 'A new pandemic', story: 'A fever no one knows spreads in one week. The streets of Weimar are empty.', icon: '🦠', place: null, mood: 'bad' },
  { title: 'War reaches Weimar', story: 'Soldiers march into town. Tanks stand on Theaterplatz.', icon: '🪖', place: null, mood: 'bad' },
  { title: 'Ships from another planet', story: 'Huge ships land on the town. Their visitors want to see Goethe.', icon: '🛸', place: 'goethe_s_house', mood: 'mixed' },
  { title: 'Ice age in one night', story: 'The temperature falls to minus forty overnight. Weimar is frozen solid.', icon: '🧊', place: null, mood: 'bad' },
  { title: 'Meteor shower', story: 'Burning rocks fall from the sky all night. Craters open across the town.', icon: '☄️', place: null, mood: 'bad' },
  { title: 'Weimar rises into the sky', story: 'The ground lifts the whole town into the clouds. It floats there now.', icon: '☁️', place: null, mood: 'mixed' },
  { title: 'Every tree turns blue', story: 'One morning every leaf in Weimar is bright blue. Nobody knows why.', icon: '🌳', place: null, mood: 'mixed' },
  { title: 'The Ilm turns to gold', story: 'The river shines like liquid gold. People come from everywhere to see it.', icon: '✨', place: 'ilm_river', mood: 'good' },
  { title: 'A giant forest overnight', story: 'A forest grows through every street in one night. Houses sit inside old trees.', icon: '🌲', place: null, mood: 'good' },
  { title: 'The sun goes dark', story: 'The sun stops shining for a whole month. Weimar lives by lamplight.', icon: '🌑', place: null, mood: 'bad' },
]
const randomLastEvent = () => LAST_EVENTS[Math.floor(Math.random() * LAST_EVENTS.length)]

// Older saved futures were written in ten periods: they replay as wakings in the middle of each period
function toTimeline(saved) {
  if (saved.timeline) return saved.timeline
  return (saved.steps ?? []).map((s) => ({ year: s.year - 2, kind: 'think', entry: { ...s, why: 'a few years have passed', people: (s.observations ?? []).slice(0, 4) } }))
}

// A saved future as the replay plays it: repeats dropped (nothing is shown twice, even in other words), nothing
// bizarre before the last event, and the events spread evenly from the first year on, so there are no long waits
const IDLE_SPEED = 6 // in a replay, years run this many times faster while nothing is on screen
function forReplay(timeline) {
  const before = []
  const events = []
  const rest = []
  for (const e of timeline) {
    if (e.kind !== 'think' || e.entry.finalEvent || e.entry.verdict) {
      rest.push(e)
      continue
    }
    const changes = (e.entry.changes ?? []).filter((c, i, all) => !isRepeat(c, [...before, ...all.slice(0, i)]))
    before.push(...changes.map((c) => ({ title: c.title, place: c.place })))
    if (changes.length) events.push({ ...e, entry: { ...e.entry, changes, surprise: null } })
  }
  const every = events.length > 1 ? (FINAL_AT - 1 - FIRST_EVENT) / (events.length - 1) : 0
  events.forEach((e, i) => (e.year = FIRST_EVENT + i * every))
  return [...events, ...rest].sort((a, b) => a.year - b.year)
}

export function useFuture({ city, scenery, landmarks, active }) {
  const zones = useMemo(() => (city && scenery ? makeZones(city, scenery, landmarks) : []), [city, scenery, landmarks])
  const facts = useMemo(() => (city && scenery ? cityFacts(city, scenery) : null), [city, scenery])

  const [live, setLive] = useState(null) // true when the mind can think live (laptop), false on the published site
  const [recorded, setRecorded] = useState([]) // the futures already lived
  const [real, setReal] = useState(null)
  const [choices, setChoicesState] = useState(DEFAULT_CHOICES)
  const [run, setRun] = useState(null)
  const [phase, setPhase] = useState('setup') // setup, running, paused, ending, done, error
  const [error, setError] = useState(null)
  const [thinking, setThinking] = useState(false)
  const [people, setPeople] = useState(null) // the people the mind is looking at, shown on the streets
  const [surprise, setSurprise] = useState(null) // a surprise being announced
  const [spot, setSpot] = useState(null) // the one thing that just happened, shown up close
  const [ending, setEnding] = useState(null) // 2077: first the last event ('event'), then the verdict ('verdict')
  const [compare, setCompare] = useState(false)

  const runRef = useRef(null)
  const heldRef = useRef(null) // the first thought, waiting for its year
  const spotQueue = useRef([]) // what happened and has not been shown yet
  const spotBusy = useRef(false)
  const zonesRef = useRef(zones)
  zonesRef.current = zones
  const choicesRef = useRef(choices)
  const gameRef = useRef(0)
  const busyRef = useRef(false) // a waking is under way
  const thoughtMs = useRef(10000) // how long a thought takes, measured as the game goes
  const pendingRef = useRef(null) // why to wake next, if something happened during a waking
  const timers = useRef([])
  choicesRef.current = choices

  const later = (fn, ms) => timers.current.push(setTimeout(fn, ms))
  const lastShown = useRef(0) // when the last event came on screen

  const loadIndex = useCallback(async () => {
    try {
      const r = await fetch(`${import.meta.env.BASE_URL}${FUTURES}/index.json`, { cache: 'no-store' })
      setRecorded(r.ok ? await r.json() : [])
    } catch {
      setRecorded([])
    }
  }, [])

  // once the city is there: can the mind think live, which futures exist, what does the real data say?
  useEffect(() => {
    if (!active || live !== null) return
    ;(async () => {
      let ok = false
      if (import.meta.env.DEV) {
        try {
          const r = await fetch('/api/future/status')
          ok = r.ok && (await r.json()).key
        } catch {
          ok = false
        }
      }
      setLive(ok)
      loadIndex()
      setReal(await fetchRealData())
    })()
  }, [active, live, loadIndex])

  const update = (patch) => {
    runRef.current = { ...runRef.current, ...patch }
    setRun(runRef.current)
  }

  // What the mind decided lands in the town now
  const apply = useCallback((entry) => {
    const r = runRef.current
    const year = Math.floor(r.year)
    const fresh = entry.changes ?? [] // repeats were already dropped when the answer came
    update({
      changes: applyChanges(r.changes, { ...entry, year }),
      world: nextWorld(r.world, entry.world ?? {}),
      state: nextState(r.state, entry.state ?? {}),
      memory: [...r.memory, { ...entry, year }],
    })
    if (entry.people?.length) {
      setPeople(entry.people)
      later(() => setPeople(null), PEOPLE_MS)
    }
    if (entry.surprise) {
      setSurprise({ ...entry.surprise, year })
      later(() => setSurprise(null), SURPRISE_MS)
    }
    // everything new is shown up close, one thing after the other: the surprise first, then the changes
    if (entry.verdict) return
    const shown = [...(entry.surprise ? [{ ...entry.surprise, strange: true }] : []), ...fresh].slice(0, 1).map((s) => {
      const z = zonesRef.current.find((o) => o.id === s.place)
      return { key: `${year}-${s.title}`, title: s.title, story: s.story, icon: s.icon, strange: Boolean(s.strange), mood: s.mood, place: z?.name ?? null, x: z?.x, y: z?.y, radius: s.radius ?? 200 }
    })
    spotQueue.current.push(...shown)
    if (!spotBusy.current) nextSpot()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // the next thing to show, or none
  const nextSpot = () => {
    const s = spotQueue.current.shift() ?? null
    spotBusy.current = Boolean(s)
    setSpot(s)
    if (s) later(nextSpot, s.strange ? STRANGE_MS : SPOT_MS)
  }

  // a thought lands in the town and in the game's timeline
  const land = useCallback(
    (entry) => {
      apply(entry)
      update({ timeline: [...runRef.current.timeline, { year: Math.floor(runRef.current.year), kind: 'think', entry }] })
    },
    [apply],
  )

  // The last event the town chose: it lands in the town and fills the screen at once, while the last years run
  // out; nothing else is shown after it
  const showLast = useCallback(
    (entry) => {
      apply(entry)
      spotQueue.current = []
      spotBusy.current = false
      setSpot(null)
      const e = entry.finalEvent
      if (!e) return
      const z = zonesRef.current.find((o) => o.id === e.place)
      lastShown.current = Date.now()
      setEnding({ stage: 'event', event: { ...e, key: 'last-event', place: z?.name ?? null, x: z?.x, y: z?.y, radius: 220 } })
    },
    [apply],
  )
  // 2077 has come and the last event has had its time on screen
  const lastDone = () => runRef.current.finalEntry !== undefined && Date.now() - lastShown.current >= LAST_EVENT_MS

  // 2077: the game is over, the verdict comes; a live game joins the futures of the published site
  const finish = useCallback(async () => {
    if (!runRef.current || runRef.current.finished) return
    update({ finished: true })
    setEnding({ stage: 'verdict' })
    setPhase('done')
    setPeople(null)
    setSpot(null)
    spotQueue.current = []
    spotBusy.current = false
    const r = runRef.current
    if (r.replay) return
    const last = r.memory[r.memory.length - 1]
    await fetch('/api/future/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recordedAt: new Date().toISOString(), model: last?.model, choices: r.startChoices, headline: last?.headline ?? '', real: r.real, facts, seed: r.seed, startState: r.startState, startWorld: r.startWorld, timeline: r.timeline }),
    }).catch(() => {})
    loadIndex()
  }, [facts, loadIndex, apply])

  const ask = async (context) => {
    const res = await fetch('/api/future/think', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ context }) })
    return { ok: res.ok, status: res.status, body: await res.json() }
  }

  // A head start: the first thought is asked for while the player is still answering, from the answers given
  // so far, so that something already happens the moment time starts to run
  const earlyRef = useRef(null)
  const warmUp = useCallback((answered) => {
    if (!live || earlyRef.current) return
    const seed = Math.floor(Math.random() * 1e6)
    const seen = observe(seed, 1, sharesOf(choicesRef.current), zones).slice(0, 6)
    const why = 'time starts to run in Weimar'
    const context = wakeContext({ year: FIRST_EVENT, why, choices: choicesRef.current, people: seen, memory: [], world: startWorld(real), changes: [], zones, real, facts, first: true })
    context.how_people_live_now = Object.fromEntries(Object.entries(context.how_people_live_now).slice(0, answered))
    earlyRef.current = { seed, seen, why, answer: ask(context).catch((e) => ({ ok: false, body: { error: e.message } })) }
  }, [live, zones, real, facts]) // eslint-disable-line react-hooks/exhaustive-deps

  // Wake the mind: it looks at the town and decides on its own. One waking at a time; if something happens
  // meanwhile, it wakes again right after.
  const wake = useCallback(
    async (why, final = false, early = null) => {
      const game = gameRef.current
      if (busyRef.current) {
        pendingRef.current = final ? { why, final } : { why: pendingRef.current ? `${pendingRef.current.why}; ${why}` : why, final: pendingRef.current?.final ?? false }
        return
      }
      busyRef.current = true
      setThinking(true)
      const began = Date.now()
      const r = runRef.current
      const year = Math.floor(r.year)
      const wakes = r.wakes + 1
      const seen = early?.seen ?? observe(r.seed, wakes, sharesOf(choicesRef.current), zones).slice(0, 6)
      update({ wakes, lastWake: r.year })
      setPeople(seen.slice(0, 4))
      try {
        const context = wakeContext({ year: final ? END : year, why, choices: choicesRef.current, people: seen, memory: r.memory, world: r.world, changes: r.changes, zones, real: r.real, facts, first: wakes === 1 })
        const res = await (early?.answer ?? ask(context))
        const body = res.body
        if (gameRef.current !== game) return
        thoughtMs.current = (thoughtMs.current + (Date.now() - began)) / 2
        if (!res.ok) throw new Error(body.error ?? `the town didn't answer (${res.status})`)
        const entry = { why, people: seen.slice(0, 4), model: body.model, ...cleanStep(everyday(body.decision), zones) }
        // nothing ever happens twice in a game: whatever repeats an earlier event, even in other words, is dropped
        const before = happened(runRef.current.memory)
        entry.surprise = null // the only bizarre event is the last one, in 2077
        entry.changes = entry.changes.filter((c, i) => !isRepeat(c, [...before, ...entry.changes.slice(0, i)]))
        if (final) {
          update({ finalEntry: entry, timeline: [...runRef.current.timeline, { year: Math.floor(runRef.current.year), kind: 'think', entry }] })
          showLast(entry)
        } else if (runRef.current.year < FIRST_EVENT) heldRef.current = entry // shown when time reaches it
        else land(entry)
      } catch (e) {
        if (gameRef.current !== game) return
        // a failed waking is not the end of the world: time goes on, and the mind wakes again later
        console.warn('[weimar]', e.message)
        if (final) update({ finalEntry: null })
      } finally {
        if (gameRef.current === game) {
          busyRef.current = false
          setThinking(false)
          const next = pendingRef.current
          pendingRef.current = null
          if (final) {
            if (runRef.current.year >= END && lastDone()) finish()
          } else if (next && !runRef.current.ended && runRef.current.year >= FINAL_AT) {
            // too late for another ordinary waking: this one becomes the last
            update({ ended: true })
            wake(`${next.why}. ${finalWhy()}`, true)
          } else if (next && !runRef.current.ended) wake(next.why, next.final)
        }
      }
    },
    [zones, facts, apply, land, showLast, finish], // eslint-disable-line react-hooks/exhaustive-deps
  )

  // The clock: a year about every second. Live, the mind wakes every few years by itself; in a replay, what
  // it decided back then lands in the same year again.
  useEffect(() => {
    if (phase !== 'running' && phase !== 'ending') return
    const t = setInterval(() => {
      const r = runRef.current
      if (!r) return
      // a replay never waits: while nothing is on screen, the years run fast to the next event
      const idle = r.replay && !spotBusy.current && !r.ended
      const year = Math.min(END, r.year + (idle ? IDLE_SPEED : 1) * (100 / YEAR_MS))
      update({ year })
      if (r.replay) {
        const due = r.replay.timeline.slice(r.played).filter((e) => e.year <= year || year >= END)
        if (due.length) {
          update({ played: r.played + due.length })
          for (const e of due) {
            if (e.kind === 'habits') setChoicesState(e.choices)
            else if (e.entry.finalEvent || e.entry.verdict) {
              // the last event already on screen stays: only the verdict is taken from this entry
              const entry = { ...e.entry, surprise: null, finalEvent: r.ended ? null : e.entry.finalEvent }
              update({ finalEntry: entry })
              showLast(entry)
            } else apply(e.entry)
          }
        }
        // an old saved future without a last event gets a random one, while the last years run out
        if (year >= FINAL_AT && !r.ended && !r.replay.timeline.some((e) => e.entry?.finalEvent)) {
          update({ ended: true })
          showLast({ finalEvent: randomLastEvent(), changes: [], removed: [] })
        }
        if (year >= END) {
          if (r.finalEntry === undefined) update({ finalEntry: null })
          if (lastDone()) finish()
          else setPhase('ending')
        }
        return
      }
      if (heldRef.current && year >= FIRST_EVENT) {
        land(heldRef.current)
        heldRef.current = null
      }
      if (!r.ended && !busyRef.current) {
        if (year >= FINAL_AT) {
          // the last waking: its event plays while time runs out to 2077
          update({ ended: true })
          wake(finalWhy(), true)
        } else if (year - r.lastWake >= THINK_EVERY) wake('a few years have passed')
      }
      if (year >= END) {
        // time holds at 2077 until the last event has come and been seen
        if (lastDone()) finish()
        else setPhase('ending')
      }
    }, 100)
    return () => clearInterval(t)
  }, [phase, wake, apply, land, showLast, finish])

  const clear = useCallback(() => {
    gameRef.current++
    busyRef.current = false
    pendingRef.current = null
    timers.current.forEach(clearTimeout)
    timers.current = []
    setThinking(false)
    setPeople(null)
    setSurprise(null)
    setSpot(null)
    setEnding(null)
    heldRef.current = null
    spotQueue.current = []
    spotBusy.current = false
    setError(null)
    setCompare(false)
  }, [])

  const begin = useCallback(
    (r) => {
      clear()
      runRef.current = { ...r, year: START, world: r.startWorld, state: r.startState, changes: [], memory: [], timeline: [], wakes: 0, lastWake: START, played: 0 }
      setRun(runRef.current)
      setChoicesState(r.startChoices)
      choicesRef.current = r.startChoices
      setPhase('running')
      if (!r.replay) wake(r.early?.why ?? 'time starts to run in Weimar', false, r.early)
    },
    [clear, wake],
  )

  // replay a future lived before
  const playRecorded = useCallback(
    async (entry) => {
      const r = await fetch(`${import.meta.env.BASE_URL}${FUTURES}/${entry.file}`)
      if (!r.ok) {
        setError(`the saved future ${entry.file} didn't load`)
        setPhase('error')
        return
      }
      const saved = await r.json()
      begin({ replay: { ...saved, timeline: forReplay(everyday(toTimeline(saved))) }, entry, startChoices: saved.choices ?? DEFAULT_CHOICES, real: saved.real, seed: saved.seed, startState: saved.startState, startWorld: saved.startWorld })
    },
    [begin],
  )

  // start: live, the mind watches from now on; on the website, a future lived before plays again
  const play = useCallback(() => {
    if (live) {
      const early = earlyRef.current
      earlyRef.current = null
      begin({ early, startChoices: choicesRef.current, real, seed: early?.seed ?? Math.floor(Math.random() * 1e6), startState: initialState(real, facts), startWorld: startWorld(real) })
      return
    }
    const entry = closestRun(recorded, choicesRef.current)
    if (entry) playRecorded(entry)
    else {
      setError('No future has been lived yet. Play the game on the laptop first.')
      setPhase('error')
    }
  }, [live, real, facts, begin, recorded, playRecorded])

  // the player changes how people live, at any time: the mind notices and wakes
  const changeTimer = useRef(null)
  const setChoices = useCallback(
    (next) => {
      const before = choicesRef.current
      setChoicesState(next)
      choicesRef.current = next
      const r = runRef.current
      if (!r || r.replay || r.ended || phase !== 'running') return
      const changed = CHOICES.filter((c) => before[c.id] !== next[c.id]).map((c) => `${c.question} now: ${c.answers[next[c.id]]}`)
      if (!changed.length) return
      update({ timeline: [...r.timeline, { year: Math.floor(r.year), kind: 'habits', choices: next }] })
      clearTimeout(changeTimer.current)
      changeTimer.current = setTimeout(() => wake(`people changed how they live (${changed.join('; ')})`), 700)
    },
    [phase, wake],
  )

  // one habit moves on to its next answer, counted from the latest state, however fast the clicks come
  const cycle = useCallback((id) => setChoices({ ...choicesRef.current, [id]: (choicesRef.current[id] + 1) % 3 }), [setChoices])
  // or jumps straight to one answer
  const pick = useCallback((id, level) => setChoices({ ...choicesRef.current, [id]: level }), [setChoices])

  const pause = useCallback(() => setPhase('paused'), [])
  const resume = useCallback(() => setPhase('running'), [])
  const toSetup = useCallback(() => {
    clear()
    earlyRef.current = null
    runRef.current = null
    setRun(null)
    setPhase('setup')
  }, [clear])

  // the river's health: the scores come at the end, so in between it follows the river changes still standing
  const riverOf = (r) => {
    if (phase === 'done' && r.state.river !== r.startState.river) return r.state.river
    const sum = r.changes.reduce((t, c) => t + (c.visual.clean_water ?? 0) - (c.visual.dirty_water ?? 0), 0)
    return Math.min(1, Math.max(0, r.startState.river + 0.35 * sum))
  }
  const latest = run?.memory[run.memory.length - 1] ?? null
  const view = run
    ? compare
      ? { changes: [], state: run.startState, world: run.startWorld, latest: null, watching: null }
      : { changes: run.changes, state: { ...run.state, river: riverOf(run) }, world: run.world, latest, watching: null, explore: phase === 'done' || phase === 'paused' }
    : null

  // where the camera looks: at what just happened, or over the whole town at the end
  const closeUp = (s) => (s.x !== undefined ? { key: s.key, x: s.x, y: s.y, d: Math.min(650, Math.max(260, s.radius * 2.4)) } : { key: 'whole' })
  const lastEvent = ending?.stage === 'event' ? ending.event : null
  const focus = compare ? null : lastEvent ? closeUp(lastEvent) : phase === 'done' ? { key: 'whole' } : spot ? closeUp(spot) : null
  // what is shown as a beacon in the town: the thing happening now, or the last event
  const beacon = compare ? null : lastEvent ?? (phase !== 'done' ? spot : null)

  return { warmUp, spot, focus, beacon, ending, zones, live, recorded, real, choices, setChoices, cycle, pick, run, phase, error, thinking, surprise, latest, compare, setCompare, play, playRecorded, pause, resume, toSetup, view }
}

// Weimar 2077, a game where the AI decides. The player picks how the people of Weimar live; then an AI (Claude)
// watches them, period after period from 2026 to 2077, makes its own assumptions about where their habits lead
// and imagines how the city changes, down to the sky, the ground and the river. Nobody knows the future, so
// there are no rules here about what is good or bad: the AI decides. This file sets up what the AI can observe
// and what it can draw with; the thinking is in scripts/future-ai.mjs, the drawing in WorldScene.jsx and Future.jsx.
//
// Real: air quality, weather and the Ilm's discharge today (Open-Meteo), the buildings, green areas, water
// and density of the city kit, the landmark places. Simulated, and labelled so in the page: the people the AI
// sees, and the events.

import { makeRandom } from './scenery.js'

export const YEARS = [2026, 2031, 2036, 2041, 2046, 2051, 2056, 2061, 2066, 2071, 2077]
export const OBSERVATIONS_PER_PERIOD = 12

// The player's questions: how do the people of Weimar live? Each answer sets how many of the people the AI
// sees choose the first way (a) or the second (b). The AI is never told the answers, only what people do.
export const LEVELS = [0.1, 0.5, 0.9] // share of people choosing a, for the answers b-mostly, half, a-mostly
export const CHOICES = [
  {
    id: 'move',
    short: 'Travel',
    question: 'How do people get around?',
    answers: ['Everyone drives', 'Half and half', 'Bikes, buses, walking'],
    a: { icon: '🚲', seen: ['cycles to work instead of taking the car', 'takes the bus to the Hauptbahnhof', 'walks the children to school', 'rides an e-bike with a trailer of shopping'] },
    b: { icon: '🚗', seen: ['drives 400 m to buy bread', 'circles the block looking for parking', 'leaves the engine running while waiting', 'drives alone to work in a big car'] },
  },
  {
    id: 'litter',
    short: 'Litter',
    question: 'What happens to their trash on the street?',
    answers: ['Thrown on the street', 'Sometimes', 'Always in the bin'],
    a: { icon: '🧹', seen: ['picks up a bottle someone dropped', 'carries an empty can home', 'sweeps the pavement in front of the shop'] },
    b: { icon: '🗑', seen: ['throws a coffee cup on the pavement', 'leaves a pizza box on a bench', 'drops cigarette butts into the gutter', 'leaves bags of rubbish next to a full bin'] },
  },
  {
    id: 'recycle',
    short: 'Recycling',
    question: 'Do they recycle?',
    answers: ['Never', 'Some do', 'Everyone sorts and repairs'],
    a: { icon: '♻', seen: ['sorts glass, paper and plastic', 'takes old electronics to the recycling yard', 'repairs a chair instead of throwing it away'] },
    b: { icon: '🚮', seen: ['throws everything into one bin', 'puts old batteries in the household rubbish', 'buys a new phone every year and bins the old one'] },
  },
  {
    id: 'river',
    short: 'River',
    question: 'How do they treat the Ilm?',
    answers: ['Dump into it', 'Ignore it', 'Protect it'],
    a: { icon: '🌊', seen: ['joins a clean-up on the Ilm banks', 'pulls plastic out of the water', 'teaches a school class about the river'] },
    b: { icon: '🛢', seen: ['pours paint thinner down a drain', 'washes the car next to the river', 'throws a bag of rubbish into the Ilm'] },
  },
  {
    id: 'green',
    short: 'Trees',
    question: 'Gardens and trees?',
    answers: ['Pave and cut', 'Leave them be', 'Plant everywhere'],
    a: { icon: '🌱', seen: ['plants flowers on a balcony', 'waters the street tree in front of the house', 'turns a parking space into a small garden'] },
    b: { icon: '🧱', seen: ['paves the front garden for a parking space', 'cuts down a tree in the backyard', 'covers a lawn with gravel'] },
  },
  {
    id: 'energy',
    short: 'Energy',
    question: 'Energy at home?',
    answers: ['Waste it', 'As usual', 'Save it, go solar'],
    a: { icon: '☀', seen: ['puts solar panels on the roof', 'switches off the lights in empty rooms', 'insulates the attic of an old house'] },
    b: { icon: '🔥', seen: ['runs the air conditioner with the window open', 'heats with an old oil boiler', 'leaves every screen in the flat on all night'] },
  },
  {
    id: 'water',
    short: 'Water',
    question: 'Water use?',
    answers: ['Use as much as they like', 'As usual', 'Save every drop'],
    a: { icon: '💧', seen: ['collects rainwater for the garden', 'fixes a dripping tap', 'takes short showers'] },
    b: { icon: '🚿', seen: ['waters the lawn at noon in a drought', 'fills a private pool every week', 'washes the pavement with a hose'] },
  },
]
export const DEFAULT_CHOICES = Object.fromEntries(CHOICES.map((c) => [c.id, 1]))
export const sharesOf = (choices) => Object.fromEntries(CHOICES.map((c) => [c.id, LEVELS[choices[c.id]]]))

// The building blocks the AI draws its imagined city with at places, each 0 to 1
export const VISUALS = {
  trees: 'new healthy trees',
  dead_trees: 'sick, dying and fallen trees',
  cars: 'car traffic, jams',
  bikes: 'cyclists, buses and trams moving',
  people: 'people walking, sitting, gathering',
  smog: 'smog and exhaust in the air',
  waste: 'litter and piles of rubbish',
  recycling: 'recycling stations and sorted bins',
  green_roofs: 'roofs covered with plants',
  solar: 'solar panels on the roofs',
  dark_buildings: 'abandoned, dark, run-down buildings',
  flood: 'water spreading over the ground',
  sand: 'sand and dust drifting over the ground',
  clean_water: 'clear water and green riverbanks (near the river)',
  dirty_water: 'murky, polluted water and dead banks (near the river)',
}

// The whole world of the map, which the AI sets each period
export const LIGHTS = ['day', 'dusk', 'night']
export function startWorld(real) {
  const aqi = real?.air?.european_aqi ?? 25
  return { sky: '#9cc7ea', ground: '#d6d0c2', buildings: '#f2ead8', vegetation: 0.85, water: 0.8, haze: +Math.min(1, aqi / 150).toFixed(2), light: 'day', traffic: 0.6, crowds: 0.6 }
}

// The AI's own estimate of the city, 0 to 1, higher is better
export const INDICATORS = [
  { id: 'air', label: 'Clean air' },
  { id: 'green', label: 'Green space' },
  { id: 'mobility', label: 'Clean mobility' },
  { id: 'river', label: 'River health' },
  { id: 'trees', label: 'Tree health' },
  { id: 'clean', label: 'Clean streets' },
]

// Things that may happen to the town in a period (simulated)
const EVENTS = [
  'a summer heatwave of several weeks',
  'a flood of the Ilm after heavy rain',
  'a dry year, the Ilm runs low',
  'fuel prices rise sharply',
  'a big festival brings many visitors',
  'a new regional train line opens at the Hauptbahnhof',
  'a storm breaks old trees in the parks',
  'a new generation of students arrives at the Bauhaus-Universität',
]

export const clamp01 = (v) => Math.min(1, Math.max(0, v))

// The places the AI can imagine changes at: the landmarks, the four largest green areas and the river,
// each with what the kit says about its surroundings
export function makeZones(city, scenery, landmarks) {
  const around = (x, y) => {
    let density = 0
    let green = 0
    let n = 0
    for (const c of scenery.cells) {
      if (Math.hypot(c.x - x, c.y - y) > 170) continue
      density += c.density
      green += c.green
      n++
    }
    return { density: n ? +(density / n).toFixed(2) : 0, green: n ? +(green / n).toFixed(2) : 0 }
  }
  const zones = landmarks.map((l) => ({ id: slug(l.name), name: l.name, kind: 'place', x: l.x, y: l.y }))
  scenery.forests.forEach((f, i) => zones.push({ id: `park_${i + 1}`, name: `Green area ${i + 1} (${(f.area / 10000).toFixed(1)} ha)`, kind: 'park', x: f.x, y: f.y }))
  // the river: the middle of the largest water plot
  const river = [...scenery.water].sort((a, b) => b.area - a.area)[0]
  if (river) zones.push({ id: 'ilm_river', name: 'River Ilm', kind: 'river', x: (river.bbox.x0 + river.bbox.x1) / 2, y: (river.bbox.y0 + river.bbox.y1) / 2 })
  return zones.map((z) => ({ ...z, ...around(z.x, z.y) }))
}

function slug(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
}

// What the city kit itself says, for the AI's first look
export function cityFacts(city, scenery) {
  const { x0, y0, x1, y1 } = city.extent
  const area = (x1 - x0) * (y1 - y0)
  const greenArea = scenery.green.reduce((s, p) => s + p.area, 0)
  const waterArea = scenery.water.reduce((s, p) => s + p.area, 0)
  return {
    map_area_km2: +(area / 1e6).toFixed(2),
    buildings: city.buildings.length,
    green_share: +(greenArea / area).toFixed(3),
    water_share: +(waterArea / area).toFixed(3),
    bus_lines: 9,
    source: 'real: city kit (LoD2 buildings, land use plots) and OpenStreetMap bus lines',
  }
}

// Real data about Weimar now, from Open-Meteo (no key needed, works on the published site too)
const LAT = 50.98
const LON = 11.325
export async function fetchRealData() {
  const get = async (url) => {
    const r = await fetch(url)
    if (!r.ok) throw new Error(`${r.status}`)
    return r.json()
  }
  const [air, weather, flood] = await Promise.allSettled([
    get(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${LAT}&longitude=${LON}&current=pm10,pm2_5,nitrogen_dioxide,european_aqi&timezone=Europe%2FBerlin`),
    get(`https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=temperature_2m&daily=precipitation_sum&past_days=30&forecast_days=1&timezone=Europe%2FBerlin`),
    get(`https://flood-api.open-meteo.com/v1/flood?latitude=50.976&longitude=11.333&daily=river_discharge&past_days=30&forecast_days=1`),
  ])
  const data = { fetchedAt: new Date().toISOString() }
  if (air.status === 'fulfilled') {
    const c = air.value.current
    data.air = { time: c.time, european_aqi: c.european_aqi, pm2_5: c.pm2_5, pm10: c.pm10, no2: c.nitrogen_dioxide, source: 'real: Open-Meteo air quality (CAMS Europe model) for Weimar' }
  }
  if (weather.status === 'fulfilled') {
    const w = weather.value
    const rain = w.daily.precipitation_sum.filter((v) => v !== null)
    data.weather = { time: w.current.time, temperature_c: w.current.temperature_2m, rain_last_30_days_mm: Math.round(rain.reduce((s, v) => s + v, 0)), source: 'real: Open-Meteo weather for Weimar' }
  }
  if (flood.status === 'fulfilled') {
    const q = flood.value.daily.river_discharge.filter((v) => v !== null)
    data.river = { today_m3s: q[q.length - 1], mean_last_30_days_m3s: +(q.reduce((s, v) => s + v, 0) / q.length).toFixed(2), source: 'real: Open-Meteo flood API (GloFAS model), river Ilm at Weimar' }
  }
  return data
}

// The city on the first day: clean air and green space from real data, the rest a simulated start
export function initialState(real, facts) {
  const aqi = real?.air?.european_aqi
  return {
    air: aqi !== undefined ? +clamp01(1 - aqi / 100).toFixed(2) : 0.6,
    green: +clamp01(facts.green_share / 0.25).toFixed(2),
    mobility: 0.45,
    river: 0.55,
    trees: 0.6,
    clean: 0.6,
  }
}

// What the AI sees people do in one period: each observation is one person, at one place, choosing one
// way or the other, as often as the player's answers say. Every run has its own seed, so no two are the same.
export function observe(seed, index, shares, zones) {
  const r = makeRandom(seed * 131 + index * 977)
  const places = zones.filter((z) => z.kind !== 'river')
  const river = zones.find((z) => z.kind === 'river')
  return Array.from({ length: OBSERVATIONS_PER_PERIOD }, () => {
    const choice = CHOICES[Math.floor(r() * CHOICES.length)]
    const first = r() < shares[choice.id]
    const side = first ? choice.a : choice.b
    const place = choice.id === 'river' && river ? river : places[Math.floor(r() * places.length)]
    const act = side.seen[Math.floor(r() * side.seen.length)]
    return { choice: choice.id, first, icon: side.icon, place: place.id, act: `Someone ${act}`, text: `Someone near ${place.name} ${act}.` }
  })
}

export function eventFor(seed, index) {
  const r = makeRandom(seed * 7 + index * 4242)
  return index > 0 && r() < 0.35 ? EVENTS[Math.floor(r() * EVENTS.length)] : null
}

const COLOR = /^#[0-9a-f]{6}$/i

// One idea per sentence: whatever is joined on with "as", "while", "but", a semicolon or a colon goes, and a
// sentence always ends with a full stop
export function plain(text) {
  let t = String(text ?? '').trim()
  t = t.split(/\s*[;:—–]\s*|,?\s+(?:as|while|whereas|but|yet)\s+/i)[0].trim()
  if (t && !/[.!?]$/.test(t)) t += '.'
  return t.charAt(0).toUpperCase() + t.slice(1)
}

// Keeps what the city can draw: known places and building blocks, sizes the map can hold
export function cleanStep(raw, zones) {
  const ids = new Set(zones.map((z) => z.id))
  const changes = (Array.isArray(raw.changes) ? raw.changes : [])
    .filter((c) => ids.has(c.place))
    .slice(0, 6)
    .map((c, i) => {
      const visual = {}
      for (const k of Object.keys(VISUALS)) {
        const v = Number(c.visual?.[k])
        if (Number.isFinite(v) && v > 0) visual[k] = clamp01(v)
      }
      return {
        id: String(c.id ?? `change_${i}`).slice(0, 60),
        title: String(c.title ?? '').slice(0, 80),
        icon: String(c.icon ?? '').slice(0, 8),
        place: c.place,
        radius: Math.min(450, Math.max(40, Number(c.radius_m) || 170)),
        story: plain(c.story).slice(0, 300),
        mood: c.good === true ? 'good' : c.good === false ? 'bad' : 'mixed',
        visual,
        streetColor: COLOR.test(c.street_color ?? '') ? c.street_color : null,
        groundColor: COLOR.test(c.ground_color ?? '') ? c.ground_color : null,
      }
    })
  const state = {}
  for (const { id } of INDICATORS) {
    const v = Number(raw.indicators?.[id])
    state[id] = Number.isFinite(v) ? +clamp01(v).toFixed(2) : null
  }
  const w = raw.world ?? {}
  const world = {}
  for (const k of ['sky', 'ground', 'buildings']) if (COLOR.test(w[k] ?? '')) world[k] = w[k]
  for (const k of ['vegetation', 'water', 'haze', 'traffic', 'crowds']) if (w[k] !== undefined && w[k] !== null && Number.isFinite(Number(w[k]))) world[k] = +clamp01(Number(w[k])).toFixed(2)
  if (LIGHTS.includes(w.light)) world.light = w.light
  const observed = (Array.isArray(raw.observed) ? raw.observed : []).slice(0, 10).map((o) => ({
    pattern: String(o.pattern ?? '').slice(0, 140),
    assumption: String(o.assumption ?? '').slice(0, 220),
    mood: o.mood === 'good' || o.mood === 'bad' ? o.mood : 'mixed',
  }))
  const s = raw.surprise
  return {
    thought: String(raw.thought ?? raw.observed?.[0]?.pattern ?? '').replace(/^(Weimar\s*)?(in\s*)?(19|20)\d\d\s*[:,–-]?\s*/i, (m, w) => (w ? 'Weimar: ' : '')).trim().slice(0, 160),
    surprise: s && s.title ? { title: String(s.title).slice(0, 60), story: String(s.story ?? '').slice(0, 160), icon: String(s.icon ?? '').slice(0, 8), place: ids.has(s.place) ? s.place : null } : null,
    finalEvent: raw.final_event?.title ? { title: String(raw.final_event.title).slice(0, 60), story: plain(raw.final_event.story).slice(0, 200), icon: String(raw.final_event.icon ?? '').slice(0, 8), place: ids.has(raw.final_event.place) ? raw.final_event.place : null, mood: raw.final_event.good === true ? 'good' : raw.final_event.good === false ? 'bad' : 'mixed' } : null,
    verdict: raw.verdict?.word ? { word: String(raw.verdict.word).slice(0, 30), icon: String(raw.verdict.icon ?? '').slice(0, 8), mood: raw.verdict.good === true ? 'good' : raw.verdict.good === false ? 'bad' : 'mixed' } : null,
    // the year is shown on its own, so a year at the start of the headline ("Weimar 2035: …") goes
    headline: plain(raw.headline).replace(/^(Weimar\s*)?(in\s*)?(19|20)\d\d\s*[:,–-]?\s*/i, (m, w) => (w ? 'Weimar: ' : '')).trim().slice(0, 120),
    outlook: String(raw.outlook ?? '').slice(0, 280),
    observed,
    guessed: Object.fromEntries(Object.entries(raw.guessed_data && typeof raw.guessed_data === 'object' ? raw.guessed_data : {}).slice(0, 10).map(([k, v]) => [String(k).slice(0, 60), String(v).slice(0, 60)])),
    judged: (Array.isArray(raw.judged) ? raw.judged : []).slice(0, 8).map((j) => ({ behaviour: String(j.behaviour ?? '').slice(0, 80), value: Math.max(-1, Math.min(1, Number(j.value) || 0)) })).filter((j) => j.behaviour),
    changes,
    removed: (Array.isArray(raw.removed) ? raw.removed : []).map(String),
    state,
    world,
  }
}

// The city so far: the AI's changes stay until it removes them; a change with the same id is replaced
export function applyChanges(changes, step) {
  const gone = new Set([...step.removed, ...step.changes.map((c) => c.id)])
  return [...changes.filter((c) => !gone.has(c.id)), ...step.changes.map((c) => ({ ...c, year: step.year, key: `${step.year}-${c.id}` }))]
}

// Values the AI left out keep their last value
export function nextState(before, state) {
  const out = {}
  for (const { id } of INDICATORS) out[id] = state[id] ?? before[id]
  return out
}
export const nextWorld = (before, world) => ({ ...before, ...world })

// How people live right now, in words, from the answers in the bar
export function habitsNow(choices) {
  return Object.fromEntries(CHOICES.map((c) => [c.question, c.answers[choices[c.id]]]))
}



// Everything that already happened in this game, so nothing happens twice
export const happened = (memory) => memory.flatMap((m) => [...(m.surprise ? [{ year: m.year, title: m.surprise.title, story: m.surprise.story, place: m.surprise.place }] : []), ...(m.changes ?? []).map((c) => ({ year: m.year, title: c.title, story: c.story, place: c.place }))])

// The words that carry the meaning of an event, to tell when one is the same as an earlier one in other words
// (place names and everyday verbs say nothing about which event it is, so they don't count)
const FILLER = new Set(
  'a an the of on in at to and or is are has have now its it from with by for into over under up down out all every more less new again weimar town city people ilm river markt park square street centre run turn grow become take get make flow fill come go hit strike start keep'.split(' '),
)
const keywords = (t) => new Set(String(t).toLowerCase().replace(/[^a-zäöüß\s]/g, ' ').split(/\s+/).map((w) => w.replace(/(ing|ed|es|s)$/, '')).filter((w) => w.length > 2 && !FILLER.has(w)))
const overlap = (a, b) => {
  const x = keywords(a)
  const y = keywords(b)
  if (!x.size || !y.size) return 0
  let n = 0
  for (const w of x) if (y.has(w)) n++
  return n / Math.min(x.size, y.size)
}
// the same event again: the same title, or mostly the same words (at the same place, for a change)
export const isRepeat = (item, before) =>
  before.some((b) => b.title.toLowerCase() === item.title.toLowerCase() || ((!item.place || !b.place || item.place === b.place) && overlap(item.title, b.title) >= 0.5))

// What the mind of Weimar sees when it wakes
export function wakeContext({ year, why, choices, people, memory, world, changes, zones, real, facts, first }) {
  return {
    year,
    why_you_woke: why,
    how_people_live_now: habitsNow(choices),
    seen_on_the_streets: people.map((o) => o.text),
    note: 'the people seen are simulated, not measured data',
    everything_that_already_happened_never_repeat_any: happened(memory).map((h) => `${h.year}: ${h.title}`),
    what_you_thought_before: memory.slice(-5).map((m) => ({ year: m.year, thought: m.thought, headline: m.headline, surprise: m.surprise?.title })),
    surprises_you_made_so_far: memory.filter((m) => m.surprise).map((m) => `${m.year}: ${m.surprise.title}`),
    town_now: { world, your_changes_still_standing: changes.map((c) => ({ id: c.id, since: c.year, title: c.title, place: c.place })) },
    places: first ? zones.map((z) => ({ id: z.id, name: z.name, kind: z.kind, building_density: z.density, green_share: z.green })) : zones.map((z) => z.id),
    building_blocks: first ? VISUALS : Object.keys(VISUALS),
    real_data_measured_in_weimar: real,
    your_guessed_data_so_far: [...memory].reverse().find((m) => m.guessed && Object.keys(m.guessed).length)?.guessed ?? 'nothing guessed yet',
    city_facts: first ? facts : undefined,
  }
}

// The recorded run closest to the player's answers, for the published site, which has no live AI
export function closestRun(index, choices) {
  let best = null
  let bestD = Infinity
  for (const run of index) {
    const d = CHOICES.reduce((s, c) => s + Math.abs((run.choices?.[c.id] ?? 1) - choices[c.id]), 0) + Math.random() * 0.5
    if (d < bestD) {
      best = run
      bestD = d
    }
  }
  return best
}

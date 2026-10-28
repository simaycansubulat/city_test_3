import { useEffect, useMemo, useState } from 'react'
import WorldScene from './WorldScene.jsx'
import Game from './Game.jsx'
import { prepareCity } from './reach.js'
import { prepareScenery } from './scenery.js'
import { prepareLandmarks } from './landmarks.js'
import { useFuture } from './useFuture.js'

const ATTRIBUTION =
  'Buildings: 3D building models LoD2 © GDI-Th (dl-de/by-2-0). Land use and pedestrian network: Egor Gaydukov, InfAU, Bauhaus-Universität Weimar. Census grid: Zensus 2022, © Statistische Ämter des Bundes und der Länder (dl-de/by-2-0). Landmark locations: © OpenStreetMap contributors (ODbL). Air quality, weather and river data: Open-Meteo (CC BY 4.0). Cars, people and street trees: imagined. Futures written by Claude (Anthropic).'

// Every data file goes through BASE_URL, so the app works on localhost and on GitHub Pages
async function loadJSON(name) {
  const r = await fetch(`${import.meta.env.BASE_URL}data/${name}`)
  if (!r.ok) throw new Error(`data/${name}: ${r.status}`)
  return r.json()
}

export default function App() {
  const [city, setCity] = useState(null)
  const [scenery, setScenery] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    Promise.all(['kit.json', 'buildings.geojson', 'streets.graph.json', 'zensus.geojson', 'plots.geojson'].map(loadJSON))
      .then(([kit, buildings, graph, zensus, plots]) => {
        const c = prepareCity({ kit, buildings, graph, zensus })
        setScenery(prepareScenery(c, { plots, zensus }))
        setCity(c)
      })
      .catch((e) => setError(e.message))
  }, [])
  const landmarks = useMemo(() => (city ? prepareLandmarks(city) : []), [city])
  const future = useFuture({ city, scenery, landmarks, active: Boolean(city && scenery) })

  return (
    <div className="app game">
      {city && scenery && <WorldScene city={city} scenery={scenery} zones={future.zones} view={future.view} real={future.real} spin={future.phase === 'setup' || Boolean(future.beacon) || future.phase === 'done'} focus={future.focus} beacon={future.beacon} />}
      {city && scenery && <div className="vignette" />}
      {!city && <div className="loading">{error ? `The city didn't load (${error}).` : 'Loading Weimar…'}</div>}
      <Game future={future} ready={Boolean(city && scenery)} />
      <footer className="attribution">{ATTRIBUTION}</footer>
    </div>
  )
}

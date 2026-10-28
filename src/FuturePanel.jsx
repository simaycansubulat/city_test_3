// Pieces of the chronicle: the real data, and before/after illustrations of a change.

const fmtDate = (iso) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

export function RealData({ real, recorded }) {
  if (!real) return null
  return (
    <>
      <h2>Real data about Weimar</h2>
      <ul className="future-real">
        {real.air && (
          <li>
            Air quality index <b>{real.air.european_aqi}</b> (EAQI; PM2.5 {real.air.pm2_5}, NO₂ {real.air.no2} µg/m³)
          </li>
        )}
        {real.weather && (
          <li>
            <b>{real.weather.temperature_c} °C</b>, {real.weather.rain_last_30_days_mm} mm rain in the last 30 days
          </li>
        )}
        {real.river && (
          <li>
            River Ilm: <b>{real.river.today_m3s} m³/s</b> today, {real.river.mean_last_30_days_m3s} m³/s over 30 days
          </li>
        )}
        {!real.air && !real.weather && !real.river && <li>The live data could not be reached.</li>}
      </ul>
      <p className="small">
        Open-Meteo (CAMS air quality, weather, GloFAS river discharge), {recorded ? 'measured when this future was written' : 'fetched now'}: {fmtDate(real.fetchedAt)}.
        Model estimates for Weimar, not a street sensor. The town starts from these numbers.
      </p>
    </>
  )
}

// ---- before / after: the same street, then with what the AI imagined there ----

export function BeforeAfter({ change }) {
  return (
    <div className="before-after">
      <figure>
        <Scene />
        <figcaption>before</figcaption>
      </figure>
      <span className="ba-arrow">→</span>
      <figure>
        <Scene v={change.visual} streetColor={change.streetColor} groundColor={change.groundColor} />
        <figcaption>after</figcaption>
      </figure>
    </div>
  )
}

const Tree = ({ x, y = 44, s = 1, c = '#3fae55', bare = false, fallen = false }) => (
  <g transform={fallen ? `rotate(80 ${x} ${y})` : undefined}>
    <rect x={x - 0.8} y={y - 8 * s} width={1.6} height={8 * s} fill="#6b4a2b" />
    {bare ? (
      <path d={`M${x} ${y - 8 * s} l-4 -5 M${x} ${y - 9 * s} l4 -6 M${x} ${y - 6 * s} l3 -3`} stroke="#6d6258" strokeWidth="1" />
    ) : (
      <circle cx={x} cy={y - 11 * s} r={5 * s} fill={c} />
    )}
  </g>
)
const HOUSES = [
  [4, 14, 18, '#ece0c6'],
  [26, 20, 16, '#f1ebdd'],
  [46, 16, 20, '#e6d3a8'],
  [70, 10, 20, '#f3e7d3'],
  [93, 18, 14, '#d9d4cc'],
]
const pick = (n, max) => Math.max(0, Math.min(max, Math.round(n)))

// One small street of Weimar today, then with the AI's building blocks
function Scene({ v = {}, streetColor, groundColor }) {
  const k = (id) => v[id] ?? 0
  const nCars = pick(1 + 8 * k('cars'), 9)
  const jam = k('cars') > 0.5
  return (
    <svg viewBox="0 0 110 64" width="110" height="64" role="img" aria-label="illustration">
      <rect width="110" height="64" fill="#9cc7ea" />
      <circle cx="98" cy="8" r="4" fill="#fff4c4" />
      {/* houses, with their roofs */}
      {HOUSES.map(([x, w, h, wall], i) => {
        const dark = i / HOUSES.length < k('dark_buildings')
        const green = !dark && i / HOUSES.length < k('green_roofs')
        const solar = !dark && (i + 2) / (HOUSES.length + 2) < k('solar')
        return (
          <g key={x}>
            <rect x={x} y={h} width={w} height={40 - h} fill={dark ? '#4a4a50' : wall} />
            <path d={`M${x - 1} ${h} L${x + w / 2} ${h - 6} L${x + w + 1} ${h} Z`} fill={dark ? '#2a2a30' : green ? '#56c25e' : '#a4553a'} />
            {!dark && [0, 1].map((r) => <rect key={r} x={x + 3} y={h + 5 + r * 8} width={3} height={4} fill="#5d7088" />)}
            {dark && <path d={`M${x + 3} ${h + 6} l4 4 M${x + 7} ${h + 6} l-4 4`} stroke="#222" />}
            {solar && <rect x={x + 2} y={h - 4} width={w / 2} height={2} fill="#2c4dbf" />}
          </g>
        )
      })}
      {/* the pavement and the street */}
      <rect x="0" y="40" width="110" height="6" fill={groundColor ?? '#c9c3b6'} />
      <rect x="0" y="46" width="110" height="10" fill="#6d6a66" />
      {streetColor && <rect x="0" y="46" width="110" height="10" fill={streetColor} opacity="0.5" />}
      <rect x="0" y="56" width="110" height="8" fill={groundColor ?? '#c9c3b6'} />
      {k('sand') > 0 && (
        <path d="M0 64 Q 20 50 40 58 T 80 54 T 110 58 V 64 Z" fill="#d8bd85" opacity={0.5 + 0.5 * k('sand')} />
      )}
      {/* water in front, when the change is about the river */}
      {(k('clean_water') > 0 || k('dirty_water') > 0 || k('flood') > 0) && (
        <path d="M0 57 Q 27 54 55 57 T 110 57 V 64 H 0 Z" fill={k('dirty_water') > k('clean_water') ? '#5d5222' : '#2f8fc8'} />
      )}
      {k('flood') > 0 && <rect x="0" y={56 - 14 * k('flood')} width="110" height={14 * k('flood')} fill="#2f6fb0" opacity="0.55" />}
      {/* trees */}
      {Array.from({ length: pick(1 + 5 * k('trees'), 6) }, (_, i) => (
        <Tree key={`t${i}`} x={8 + i * 19} s={0.8 + (i % 2) * 0.2} c={i % 2 ? '#4f8c41' : '#3f7a3a'} />
      ))}
      {Array.from({ length: pick(4 * k('dead_trees'), 4) }, (_, i) => (
        <Tree key={`d${i}`} x={17 + i * 24} s={0.9} c="#8a4a22" bare={i % 2 === 1} fallen={i === 2} />
      ))}
      {/* traffic: cars, bikes and trams, people */}
      {Array.from({ length: nCars }, (_, i) => (
        <rect key={`c${i}`} x={jam ? 2 + i * 12 : 6 + i * 30} y={i % 2 ? 51 : 47} width={9} height={4} rx={1.5} fill={i % 3 ? '#c8372c' : '#3d4a5c'} />
      ))}
      {k('bikes') > 0.6 && <rect x="58" y="47" width="40" height="8" rx="3" fill="#e8c02c" />}
      {Array.from({ length: pick(4 * k('bikes'), 4) }, (_, i) => (
        <g key={`b${i}`} stroke="#1d2a3a" fill="none">
          <circle cx={12 + i * 14} cy={60} r="1.8" />
          <circle cx={17 + i * 14} cy={60} r="1.8" />
        </g>
      ))}
      {Array.from({ length: pick(8 * k('people'), 8) }, (_, i) => (
        <circle key={`p${i}`} cx={6 + i * 13} cy={i % 2 ? 43 : 60} r="1.6" fill="#3a2f45" />
      ))}
      {/* rubbish and recycling */}
      {Array.from({ length: pick(8 * k('waste'), 8) }, (_, i) => (
        <rect key={`w${i}`} x={4 + i * 13} y={i % 2 ? 41 : 57} width="5" height="3" fill={['#8a6a3a', '#c27c2c', '#6d6a5f', '#a33b2a'][i % 4]} transform={`rotate(${i * 23} ${4 + i * 13} 42)`} />
      ))}
      {k('recycling') > 0 &&
        ['#2fbf5b', '#2c7dff', '#ffd23a'].map((c, i) => <rect key={c} x={84 + i * 4} y={36} width="3.4" height="5" fill={c} />)}
      {/* smog over everything */}
      {k('smog') > 0 && <rect x="0" y="0" width="110" height="64" fill="#8d7a52" opacity={0.15 + 0.45 * k('smog')} />}
    </svg>
  )
}

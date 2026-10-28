// Close-ups of the people of Weimar: one small animated scene for each habit, on a street of plastered houses
// with tiled roofs. Shown while a period plays, next to the sentence about that person.

const W = 240
const H = 140

// A row of Weimar houses with gables, windows and a tiled roof
function Street({ ground = '#c9c3b6', road = true, sky = '#a9d0ee' }) {
  const houses = [
    [0, 44, 46, '#ece0c6'],
    [44, 40, 38, '#f3e7d3'],
    [84, 52, 50, '#e6d3a8'],
    [136, 44, 40, '#f1ebdd'],
    [180, 60, 46, '#efd9b5'],
  ]
  return (
    <g>
      <rect width={W} height={H} fill={sky} />
      {houses.map(([x, w, h, wall]) => (
        <g key={x}>
          <rect x={x} y={92 - h} width={w} height={h} fill={wall} />
          <path d={`M${x - 2} ${92 - h} L${x + w / 2} ${92 - h - 16} L${x + w + 2} ${92 - h} Z`} fill="#a4553a" />
          {[0, 1].map((row) =>
            [0, 1, 2].map((col) =>
              x + 6 + col * (w / 3) < x + w - 6 ? <rect key={`${row}${col}`} x={x + 6 + col * (w / 3)} y={92 - h + 8 + row * 18} width={7} height={10} fill="#5d7088" /> : null,
            ),
          )}
        </g>
      ))}
      <rect x="0" y="92" width={W} height="14" fill={ground} />
      {road && <rect x="0" y="106" width={W} height="34" fill="#6d6a66" />}
      {road && <path d="M0 123 H240" stroke="#e8e2d0" strokeWidth="2" strokeDasharray="12 10" />}
    </g>
  )
}

// A person: head, body, legs; arms set by the scene
function Person({ x, y, shirt = '#2d5d8c', skin = '#e8b894', children }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x="-4" y="-2" width="3" height="14" fill="#2a2a33" />
      <rect x="1" y="-2" width="3" height="14" fill="#2a2a33" />
      <rect x="-6" y="-20" width="12" height="19" rx="3" fill={shirt} />
      <circle cx="0" cy="-26" r="6" fill={skin} />
      <path d="M-6 -30 Q0 -36 6 -30" fill="#3a2a20" />
      {children}
    </g>
  )
}

const Sun = ({ x = 210, y = 22, r = 11, color = '#ffe08a' }) => <circle cx={x} cy={y} r={r} fill={color} />

function Tree({ x, y, s = 1, color = '#3f7a3a' }) {
  return (
    <g>
      <rect x={x - 2} y={y - 22 * s} width="4" height={22 * s} fill="#6b4a2b" />
      <circle cx={x} cy={y - 28 * s} r={12 * s} fill={color} />
    </g>
  )
}

const SCENES = {
  // 🚲 cycles, takes the bus, walks
  'move-a': () => (
    <>
      <Street />
      <g>
        <animateTransform attributeName="transform" type="translate" from="-60 0" to="300 0" dur="2.6s" repeatCount="indefinite" />
        {[0, 26].map((dx) => (
          <g key={dx} transform={`translate(${30 + dx} 120)`}>
            <circle r="9" fill="none" stroke="#1d2a3a" strokeWidth="2" />
            <path d="M-9 0 H9 M0 -9 V9" stroke="#1d2a3a">
              <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="0.5s" repeatCount="indefinite" />
            </path>
          </g>
        ))}
        <path d="M30 120 L43 104 L56 120 M43 104 L52 104 M40 98 L46 98" stroke="#c8372c" strokeWidth="3" fill="none" />
        <Person x={45} y={98} shirt="#2f8f5a">
          <path d="M-2 -16 L8 -6" stroke="#2f8f5a" strokeWidth="3" />
        </Person>
      </g>
    </>
  ),
  // 🚗 drives
  'move-b': () => (
    <>
      <Street />
      {[0, 1].map((k) => (
        <g key={k}>
          <animateTransform attributeName="transform" type="translate" from={`${-90 - k * 120} 0`} to={`${300 - k * 120} 0`} dur="3.2s" repeatCount="indefinite" />
          <rect x="20" y="104" width="56" height="18" rx="6" fill={k ? '#3d4a5c' : '#c8372c'} />
          <rect x="32" y="96" width="30" height="12" rx="4" fill={k ? '#3d4a5c' : '#c8372c'} />
          <rect x="36" y="98" width="10" height="8" fill="#9cc7ea" />
          <circle cx="32" cy="123" r="6" fill="#1f2329" />
          <circle cx="64" cy="123" r="6" fill="#1f2329" />
          <circle cx="12" cy="118" r="5" fill="#8d8470" opacity="0.7">
            <animate attributeName="r" values="3;9;3" dur="0.8s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.8;0;0.8" dur="0.8s" repeatCount="indefinite" />
          </circle>
        </g>
      ))}
    </>
  ),
  // 🧹 keeps the street clean
  'litter-a': () => (
    <>
      <Street road={false} ground="#d4cebf" />
      <rect x="0" y="106" width={W} height="34" fill="#d4cebf" />
      <Person x={110} y={118} shirt="#7a2d3a">
        <g>
          <animateTransform attributeName="transform" type="rotate" values="-20 0 -14;20 0 -14;-20 0 -14" dur="1s" repeatCount="indefinite" />
          <path d="M0 -14 L-4 22" stroke="#8a6a3a" strokeWidth="3" />
          <path d="M-12 22 H4" stroke="#5a4330" strokeWidth="5" />
        </g>
      </Person>
      <circle cx="80" cy="130" r="2" fill="#a89a78">
        <animate attributeName="cx" values="80;60;80" dur="1s" repeatCount="indefinite" />
      </circle>
      <rect x="160" y="104" width="16" height="24" rx="2" fill="#3a5a3a" />
    </>
  ),
  // 🗑 throws trash on the street
  'litter-b': () => (
    <>
      <Street road={false} ground="#cdc6b4" />
      <rect x="0" y="106" width={W} height="34" fill="#cdc6b4" />
      <Person x={90} y={118} shirt="#5a3d2b">
        <path d="M5 -16 L14 -24" stroke="#5a3d2b" strokeWidth="3" />
      </Person>
      <g>
        <rect x="-3" y="-5" width="6" height="9" fill="#f6f1e6" stroke="#8a6a3a" />
        <animateMotion path="M104 92 Q140 60 170 128" dur="1.3s" repeatCount="indefinite" />
        <animateTransform attributeName="transform" type="rotate" from="0" to="540" dur="1.3s" repeatCount="indefinite" additive="sum" />
      </g>
      {[[150, 132], [176, 130], [196, 134], [60, 133]].map(([x, y], i) => (
        <rect key={i} x={x} y={y} width="8" height="4" fill={['#c27c2c', '#8a6a3a', '#a33b2a', '#6d6a5f'][i]} transform={`rotate(${i * 30} ${x} ${y})`} />
      ))}
      <rect x="20" y="114" width="40" height="5" fill="#8a6a3a" />
      <rect x="28" y="108" width="16" height="6" fill="#e0b070" />
    </>
  ),
  // ♻ sorts and repairs
  'recycle-a': () => (
    <>
      <Street road={false} ground="#d4cebf" />
      <rect x="0" y="106" width={W} height="34" fill="#d4cebf" />
      {['#2fbf5b', '#2c7dff', '#ffd23a'].map((c, i) => (
        <g key={c}>
          <rect x={120 + i * 30} y="100" width="24" height="32" rx="2" fill={c} />
          <rect x={118 + i * 30} y="96" width="28" height="5" fill={c} />
        </g>
      ))}
      <Person x={90} y={118} shirt="#26415e">
        <path d="M5 -16 L20 -22" stroke="#26415e" strokeWidth="3" />
      </Person>
      <rect x="128" y="80" width="6" height="12" rx="2" fill="#4fa36a">
        <animate attributeName="y" values="70;96;96" keyTimes="0;0.6;1" dur="1.3s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="1;1;0" keyTimes="0;0.6;1" dur="1.3s" repeatCount="indefinite" />
      </rect>
    </>
  ),
  // 🚮 throws everything away
  'recycle-b': () => (
    <>
      <Street road={false} ground="#cdc6b4" />
      <rect x="0" y="106" width={W} height="34" fill="#cdc6b4" />
      <rect x="130" y="98" width="34" height="34" rx="3" fill="#5f6368" />
      {[[128, 90, '#c27c2c'], [146, 86, '#2c7dff'], [160, 92, '#a33b2a'], [138, 82, '#d8cfa6']].map(([x, y, c], i) => (
        <rect key={i} x={x} y={y} width="12" height="9" fill={c} transform={`rotate(${i * 25} ${x} ${y})`} />
      ))}
      <g>
        <ellipse cx="0" cy="0" rx="8" ry="10" fill="#2a2a33" />
        <animateMotion path="M100 96 Q120 70 146 84" dur="1.3s" repeatCount="indefinite" />
      </g>
      {[[172, 130], [180, 134], [120, 133]].map(([x, y], i) => (
        <rect key={i} x={x} y={y} width="7" height="4" fill={['#c27c2c', '#d8cfa6', '#6d6a5f'][i]} />
      ))}
      <Person x={88} y={118} shirt="#6d6a5f">
        <path d="M5 -16 L12 -24" stroke="#6d6a5f" strokeWidth="3" />
      </Person>
    </>
  ),
  // 🌊 cares for the Ilm
  'river-a': () => (
    <>
      <rect width={W} height={H} fill="#a9d0ee" />
      <rect x="0" y="60" width={W} height="34" fill="#5f8f45" />
      <Tree x={30} y={84} />
      <Tree x={200} y={84} s={1.2} />
      <path d="M0 98 Q60 92 120 98 T240 98 V140 H0 Z" fill="#2f86bd" />
      <Person x={96} y={96} shirt="#e0b400">
        <path d="M5 -16 L30 6" stroke="#8a6a3a" strokeWidth="2" />
      </Person>
      <g>
        <rect x="124" y="100" width="6" height="12" rx="2" fill="#d8e6ef" />
        <animateTransform attributeName="transform" type="translate" values="0 18;0 0;0 18" dur="1.6s" repeatCount="indefinite" />
      </g>
      <path d="M150 118 l8 -3 l0 6 z" fill="#ffe08a">
        <animateTransform attributeName="transform" type="translate" values="0 0;30 2;0 0" dur="2s" repeatCount="indefinite" />
      </path>
    </>
  ),
  // 🛢 harms the Ilm
  'river-b': () => (
    <>
      <rect width={W} height={H} fill="#b8c2c8" />
      <rect x="0" y="60" width={W} height="34" fill="#8a7a50" />
      <path d="M0 98 Q60 92 120 98 T240 98 V140 H0 Z" fill="#5d5222" />
      <Person x={96} y={96} shirt="#3d4a5c">
        <rect x="6" y="-20" width="10" height="12" fill="#c8372c" transform="rotate(50 6 -20)" />
      </Person>
      <ellipse cx="118" cy="112" rx="8" ry="3" fill="#2a2414">
        <animate attributeName="rx" values="4;40;4" dur="1.8s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.9;0.3;0.9" dur="1.8s" repeatCount="indefinite" />
      </ellipse>
      <path d="M114 80 Q118 92 118 104" stroke="#3a2f15" strokeWidth="3" fill="none">
        <animate attributeName="stroke-dasharray" values="0 40;40 0" dur="0.6s" repeatCount="indefinite" />
      </path>
      <rect x="170" y="110" width="10" height="6" fill="#d8e6ef" transform="rotate(20 170 110)" />
    </>
  ),
  // 🌱 plants and greens
  'green-a': () => (
    <>
      <Street road={false} ground="#d4cebf" />
      <rect x="0" y="106" width={W} height="34" fill="#d4cebf" />
      <rect x="140" y="118" width="30" height="8" fill="#6b4a2b" />
      <g transform="translate(155 120)">
        <g>
          <animateTransform attributeName="transform" type="scale" values="0.6;1;1" keyTimes="0;0.7;1" dur="2.6s" repeatCount="indefinite" />
          <rect x="-2" y="-30" width="4" height="30" fill="#6b4a2b" />
          <circle cx="0" cy="-38" r="14" fill="#4f8c41" />
        </g>
      </g>
      <Person x={110} y={118} shirt="#2f8f5a">
        <path d="M5 -16 L20 -20" stroke="#2f8f5a" strokeWidth="3" />
        <rect x="18" y="-24" width="12" height="8" fill="#2c7dff" />
      </Person>
      {[0, 1, 2].map((k) => (
        <circle key={k} cx={142 + k * 4} cy="98" r="1.6" fill="#2c7dff">
          <animate attributeName="cy" values="96;118" dur="0.7s" begin={`${k * 0.2}s`} repeatCount="indefinite" />
        </circle>
      ))}
    </>
  ),
  // 🧱 paves and cuts
  'green-b': () => (
    <>
      <Street road={false} ground="#bdb6a8" />
      <rect x="0" y="106" width={W} height="34" fill="#9c968c" />
      {Array.from({ length: 12 }, (_, i) => (
        <rect key={i} x={i * 20} y="106" width="19" height="16" fill="#aaa49a" stroke="#8a857c" />
      ))}
      <g transform="translate(160 122)">
        <g>
          <animateTransform attributeName="transform" type="rotate" values="0;0;75" keyTimes="0;0.4;1" dur="2.6s" repeatCount="indefinite" />
          <rect x="-3" y="-40" width="6" height="40" fill="#6b4a2b" />
          <circle cx="0" cy="-50" r="16" fill="#4f8c41" />
        </g>
      </g>
      <Person x={130} y={118} shirt="#e07a2c">
        <rect x="6" y="-16" width="14" height="6" fill="#e0b400" />
      </Person>
    </>
  ),
  // ☀ saves energy, goes solar
  'energy-a': () => (
    <>
      <rect width={W} height={H} fill="#a9d0ee" />
      <g>
        <Sun x={200} y={26} r={14} />
        {Array.from({ length: 8 }, (_, i) => (
          <path key={i} d="M200 6 V0" stroke="#ffe08a" strokeWidth="3" transform={`rotate(${i * 45} 200 26)`} />
        ))}
        <animateTransform attributeName="transform" type="rotate" from="0 200 26" to="360 200 26" dur="8s" repeatCount="indefinite" />
      </g>
      <rect x="40" y="62" width="110" height="60" fill="#f1ebdd" />
      <path d="M32 62 L95 24 L158 62 Z" fill="#a4553a" />
      {[0, 1, 2].map((i) => (
        <rect key={i} x={58 + i * 24} y={40 - i * 0} width="20" height="12" fill="#2c4dbf" transform="skewX(-20)">
          <animate attributeName="fill" values="#2c4dbf;#5b7cff;#2c4dbf" dur="1.5s" begin={`${i * 0.3}s`} repeatCount="indefinite" />
        </rect>
      ))}
      <rect x="60" y="80" width="14" height="18" fill="#5d7088" />
      <rect x="116" y="80" width="14" height="18" fill="#5d7088" />
      <rect x="0" y="122" width={W} height="18" fill="#c9c3b6" />
      <Person x={180} y={130} shirt="#26415e" />
    </>
  ),
  // 🔥 wastes energy
  'energy-b': () => (
    <>
      <rect width={W} height={H} fill="#1b2240" />
      <rect x="40" y="40" width="160" height="82" fill="#d9c9a8" />
      <path d="M32 40 L120 6 L208 40 Z" fill="#7a3a2a" />
      {[[56, 54], [96, 54], [136, 54], [176, 54], [56, 86], [136, 86], [176, 86]].map(([x, y], i) => (
        <rect key={i} x={x} y={y} width="16" height="20" fill="#ffd27a">
          <animate attributeName="opacity" values="1;0.7;1" dur={`${0.8 + i * 0.15}s`} repeatCount="indefinite" />
        </rect>
      ))}
      <rect x="94" y="84" width="22" height="24" fill="#ffd27a" />
      <rect x="92" y="84" width="10" height="24" fill="#c9b48a" transform="skewY(10)" />
      <rect x="150" y="100" width="34" height="18" fill="#c0c4c8" />
      <g transform="translate(167 109)">
        <path d="M-7 0 H7 M0 -7 V7" stroke="#5f6368" strokeWidth="2">
          <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="0.3s" repeatCount="indefinite" />
        </path>
      </g>
      {[0, 1, 2].map((k) => (
        <path key={k} d={`M${196 + k * 8} 110 q4 -6 0 -12 q-4 -6 0 -12`} stroke="#ff8a5a" fill="none" strokeWidth="2">
          <animate attributeName="opacity" values="0;1;0" dur="1s" begin={`${k * 0.3}s`} repeatCount="indefinite" />
        </path>
      ))}
      <rect x="0" y="122" width={W} height="18" fill="#4a4a50" />
    </>
  ),
  // 💧 saves water
  'water-a': () => (
    <>
      <rect width={W} height={H} fill="#9db0c0" />
      <rect x="30" y="40" width="110" height="82" fill="#f1ebdd" />
      <path d="M22 40 L85 10 L148 40 Z" fill="#a4553a" />
      <rect x="146" y="40" width="5" height="64" fill="#7d8596" />
      <rect x="138" y="96" width="34" height="28" rx="3" fill="#3a5a3a" />
      <rect x="140" y="110" width="30" height="12" fill="#2f86bd">
        <animate attributeName="y" values="122;104;122" dur="2.6s" repeatCount="indefinite" />
        <animate attributeName="height" values="0;18;0" dur="2.6s" repeatCount="indefinite" />
      </rect>
      {Array.from({ length: 14 }, (_, i) => (
        <path key={i} d={`M${10 + i * 17} 0 l-3 9`} stroke="#e6f2fb" strokeWidth="1.5">
          <animateTransform attributeName="transform" type="translate" values="0 -10;0 140" dur="0.9s" begin={`${(i % 5) * 0.18}s`} repeatCount="indefinite" />
        </path>
      ))}
      <rect x="0" y="122" width={W} height="18" fill="#c9c3b6" />
      <Person x={200} y={130} shirt="#2f8f5a" />
    </>
  ),
  // 🚿 uses as much water as they like
  'water-b': () => (
    <>
      <rect width={W} height={H} fill="#f2c27a" />
      <Sun x={200} y={28} r={20} color="#ff9a3a" />
      <rect x="20" y="40" width="100" height="70" fill="#efd9b5" />
      <path d="M12 40 L70 12 L128 40 Z" fill="#a4553a" />
      <rect x="0" y="110" width={W} height="30" fill="#c9b456" />
      <rect x="148" y="112" width="6" height="8" fill="#5f6368" />
      {[-50, -25, 0, 25, 50].map((a) => (
        <path key={a} d="M151 112 q0 -30 30 -10" stroke="#5fb0e8" strokeWidth="2" fill="none" transform={`rotate(${a} 151 112)`}>
          <animate attributeName="opacity" values="1;0.3;1" dur="0.6s" repeatCount="indefinite" />
        </path>
      ))}
      <Person x={60} y={130} shirt="#e07a2c">
        <path d="M5 -16 L16 -10" stroke="#e07a2c" strokeWidth="3" />
      </Person>
    </>
  ),
}

export default function Vignette({ observation }) {
  const key = `${observation.choice}-${observation.first ? 'a' : 'b'}`
  const Scene = SCENES[key]
  if (!Scene) return null
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="vignette" role="img" aria-label={observation.act}>
      <Scene />
    </svg>
  )
}

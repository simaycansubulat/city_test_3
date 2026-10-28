// The AI's changes at places: every change is drawn from building blocks (trees, cars, smog, rubbish,
// water, sand…) and stays until the AI removes it. While the AI is watching, the people it sees appear on
// the map. The world around them (sky, ground, river) is in WorldScene.jsx.
// Decoration only: no clicks, no effect on any calculation.

import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { makeRandom, pointInRing } from './scenery.js'
import Vignette from './Vignettes.jsx'

const v3 = (x, y, h) => [x, h, -y]
const CAR_COLORS = ['#ff3b2f', '#ff8a3d', '#fff1c9'] // brake lights, indicators, headlights
const BIKE_COLORS = ['#3fd8ff', '#bff6ff', '#4fe08a']
const PEOPLE_COLORS = ['#ffe2b0', '#ffc98a', '#ffd6f0', '#e0f0ff']
const MOOD_COLOR = { good: '#4fe08a', bad: '#ff4a3a', mixed: '#fcee0a' }

function useDispose(...objects) {
  useEffect(() => () => objects.forEach((o) => o?.dispose()), objects) // eslint-disable-line react-hooks/exhaustive-deps
}

// What lies around a place: its street segments, buildings, trees and points along the streets
function areaGeometry(city, scenery, zone, radius) {
  const near = (x, y) => Math.hypot(x - zone.x, y - zone.y) <= radius
  const segments = []
  for (const e of city.edges) {
    for (let i = 1; i < e.pts.length; i++) {
      const [a, b] = [e.pts[i - 1], e.pts[i]]
      if (near((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)) segments.push([a, b])
    }
  }
  const buildings = []
  city.buildings.forEach((b, i) => {
    const [x, y] = b.rings[0][0]
    if (near(x, y)) buildings.push(i)
  })
  const inBuilding = (x, y) => buildings.some((i) => pointInRing([x, y], city.buildings[i].rings[0]))
  // points beside the streets, every 12 m, alternating sides, kept out of the buildings
  const kerb = []
  for (const [a, b] of segments) {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1])
    if (len < 1) continue
    const ux = (b[0] - a[0]) / len
    const uy = (b[1] - a[1]) / len
    for (let s = 6, side = 1; s < len; s += 12, side = -side) {
      const x = a[0] + ux * s - uy * 5 * side
      const y = a[1] + uy * s + ux * 5 * side
      if (!inBuilding(x, y)) kerb.push({ x, y })
    }
  }
  const trees = scenery.trees.filter((t) => near(t.x, t.y))
  return { segments, buildings, kerb, trees, inBuilding }
}

export default function FutureCity({ city, scenery, zones, view }) {
  const zoneById = useMemo(() => new Map(zones.map((z) => [z.id, z])), [zones])
  // the surroundings of each place and size, worked out once
  const cache = useRef(new Map())
  const areaOf = (zone, radius) => {
    const key = `${zone.id}:${radius}`
    if (!cache.current.has(key)) cache.current.set(key, areaGeometry(city, scenery, zone, radius))
    return cache.current.get(key)
  }
  // the middles of all street segments, where the people of each period stand
  const kerbs = useMemo(() => city.edges.flatMap((e) => e.pts.slice(1).map((p, i) => [(p[0] + e.pts[i][0]) / 2, (p[1] + e.pts[i][1]) / 2])), [city])
  if (!view) return null
  // labels over the places only once the years stop, so the run itself stays calm
  const latest = view.explore ? view.latest?.changes ?? [] : []
  return (
    <group>
      {view.changes.map((c) => {
        const z = zoneById.get(c.place)
        return z ? <Change key={c.key} change={c} zone={z} area={areaOf(z, c.radius)} city={city} scenery={scenery} /> : null
      })}
      {latest.map((c, i) => {
        const z = zoneById.get(c.place)
        return z ? <ChangeMark key={`${view.latest.year}-${c.id}`} change={c} zone={z} stack={latest.slice(0, i).filter((o) => o.place === c.place).length} /> : null
      })}
      {view.watching && <People people={view.watching} zones={zoneById} kerbs={kerbs} />}
    </group>
  )
}

// One imagined change: each building block the AI asked for, as strong as it asked
function Change({ change, zone, area, city, scenery }) {
  const v = change.visual
  const r = change.radius
  const seed = Math.round(zone.x * 7 + zone.y * 13 + r)
  return (
    <group>
      {change.groundColor && <Patch zone={zone} radius={r} color={change.groundColor} />}
      {v.flood > 0 && <Flood zone={zone} radius={r} strength={v.flood} />}
      {v.sand > 0 && <Sand zone={zone} radius={r} strength={v.sand} />}
      {v.smog > 0 && <Smog zone={zone} radius={r} strength={v.smog} />}
      <Grow>
        {change.streetColor && <StreetLines segments={area.segments} color={change.streetColor} />}
        {v.cars > 0.5 && !change.streetColor && <StreetLines segments={area.segments} color="#ff4a3a" opacity={0.4 + 0.5 * v.cars} />}
        {v.cars > 0 && <Movers segments={area.segments} count={Math.round(30 + 220 * v.cars)} colors={CAR_COLORS} speed={8 - 6.5 * v.cars} size={[2, 1.4, 4]} seed={seed} />}
        {v.bikes > 0 && <Movers segments={area.segments} count={Math.round(10 + 60 * v.bikes)} colors={BIKE_COLORS} speed={7} size={[0.8, 1.6, 2]} seed={seed + 1} />}
        {v.bikes > 0.6 && <Movers segments={area.segments} count={Math.round(2 + 6 * v.bikes)} colors={BIKE_COLORS} speed={10} size={[2.6, 3, 16]} seed={seed + 2} />}
        {v.people > 0 && <Movers segments={area.segments} count={Math.round(20 + 140 * v.people)} colors={PEOPLE_COLORS} speed={1.2} size={[0.7, 1.8, 0.7]} seed={seed + 3} offset={4} />}
        {v.trees > 0 && <NewTrees zone={zone} radius={r} area={area} count={Math.round(30 + 220 * v.trees)} />}
        {v.dead_trees > 0 && <DyingTrees trees={area.trees.length ? area.trees : area.kerb.map((p) => ({ x: p.x, y: p.y, r: 3.5, h: 10 }))} share={0.25 + 0.75 * v.dead_trees} />}
        {v.waste > 0 && <Waste zone={zone} radius={r} points={area.kerb} share={0.2 + 0.8 * v.waste} />}
        {v.recycling > 0 && <Recycling points={area.kerb} share={0.08 + 0.3 * v.recycling} />}
        {(v.green_roofs > 0 || v.solar > 0 || v.dark_buildings > 0) && (
          <Roofs city={city} buildings={area.buildings} green={v.green_roofs ?? 0} solar={v.solar ?? 0} dark={v.dark_buildings ?? 0} />
        )}
      </Grow>
      {v.clean_water > 0 && <Banks scenery={scenery} color="#4fe08a" trees />}
      {v.dirty_water > 0 && <Banks scenery={scenery} color="#6b5a2a" />}
    </group>
  )
}

// A change rises out of the ground when it appears
function Grow({ children }) {
  const ref = useRef()
  const t = useRef(0)
  useFrame((_, delta) => {
    if (t.current >= 1) return
    t.current = Math.min(1, t.current + delta / 1.6)
    ref.current.scale.y = Math.max(0.01, 1 - (1 - t.current) ** 3)
  })
  return (
    <group ref={ref} scale={[1, 0.01, 1]}>
      {children}
    </group>
  )
}

function StreetLines({ segments, color, opacity = 0.95 }) {
  const geometry = useMemo(() => {
    const pos = []
    for (const [a, b] of segments) {
      // three lines side by side read as one wide glowing street
      for (const off of [-1.5, 0, 1.5]) pos.push(...v3(a[0] + off, a[1] + off, 3), ...v3(b[0] + off, b[1] + off, 3))
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    return g
  }, [segments])
  useDispose(geometry)
  return (
    <lineSegments geometry={geometry} renderOrder={6}>
      <lineBasicMaterial color={color} transparent opacity={opacity} blending={THREE.AdditiveBlending} depthWrite={false} />
    </lineSegments>
  )
}

// Things moving along the streets: cars (many and slow in a jam), bikes, trams, people
export function Movers({ segments, count, colors, speed, size, seed, offset = 0 }) {
  const ref = useRef()
  const movers = useMemo(() => {
    if (!segments.length) return []
    const r = makeRandom(seed + count)
    return Array.from({ length: count }, () => ({ seg: segments[Math.floor(r() * segments.length)], t: r(), dir: r() < 0.5 ? 1 : -1, jitter: r(), side: (r() - 0.5) * 2 * offset }))
  }, [segments, count, seed, offset])
  const colorArray = useMemo(() => {
    const c = new THREE.Color()
    const arr = new Float32Array(movers.length * 3)
    movers.forEach((m, i) => c.set(colors[Math.floor(m.jitter * colors.length)]).toArray(arr, i * 3))
    return arr
  }, [movers, colors])
  const dummy = useMemo(() => new THREE.Object3D(), [])
  useFrame((_, delta) => {
    const mesh = ref.current
    if (!mesh) return
    movers.forEach((m, i) => {
      const [a, b] = m.seg
      const len = Math.max(1, Math.hypot(b[0] - a[0], b[1] - a[1]))
      m.t += (m.dir * speed * (0.6 + m.jitter * 0.8) * delta) / len
      if (m.t > 1 || m.t < 0) m.t = m.dir > 0 ? 0 : 1
      const nx = -(b[1] - a[1]) / len
      const ny = (b[0] - a[0]) / len
      dummy.position.set(...v3(a[0] + (b[0] - a[0]) * m.t + nx * m.side, a[1] + (b[1] - a[1]) * m.t + ny * m.side, size[1] / 2 + 0.6))
      dummy.rotation.set(0, Math.atan2(b[0] - a[0], b[1] - a[1]), 0)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
  })
  if (!movers.length) return null
  return (
    <instancedMesh ref={ref} args={[null, null, movers.length]} frustumCulled={false}>
      <boxGeometry args={size}>
        <instancedBufferAttribute attach="attributes-color" args={[colorArray, 3]} />
      </boxGeometry>
      <meshBasicMaterial vertexColors toneMapped={false} />
    </instancedMesh>
  )
}

// Round crowns on trunks, as instanced meshes
function TreeInstances({ trees, crown = '#3fae55', trunk = '#5b3b22' }) {
  const crowns = useRef()
  const trunks = useRef()
  useEffect(() => {
    if (!trees.length) return
    const d = new THREE.Object3D()
    trees.forEach((t, i) => {
      d.position.set(...v3(t.x, t.y, t.h * 0.62))
      d.scale.set(t.r, t.r * 1.15, t.r)
      d.rotation.set(0, 0, t.fallen ? 1.3 : 0)
      d.updateMatrix()
      crowns.current.setMatrixAt(i, d.matrix)
      d.position.set(...v3(t.x, t.y, t.h * 0.25))
      d.scale.set(0.5, t.h * 0.5, 0.5)
      d.rotation.set(0, 0, 0)
      d.updateMatrix()
      trunks.current.setMatrixAt(i, d.matrix)
    })
    crowns.current.instanceMatrix.needsUpdate = true
    trunks.current.instanceMatrix.needsUpdate = true
  }, [trees])
  if (!trees.length) return null
  return (
    <group>
      <instancedMesh ref={crowns} args={[null, null, trees.length]} frustumCulled={false}>
        <icosahedronGeometry args={[1, 1]} />
        <meshLambertMaterial color={crown} emissive={crown} emissiveIntensity={0.35} flatShading />
      </instancedMesh>
      <instancedMesh ref={trunks} args={[null, null, trees.length]} frustumCulled={false}>
        <cylinderGeometry args={[1, 1, 1, 5]} />
        <meshLambertMaterial color={trunk} />
      </instancedMesh>
    </group>
  )
}

// New trees in the open ground around the place, out of the buildings
function NewTrees({ zone, radius, area, count }) {
  const trees = useMemo(() => {
    const r = makeRandom(Math.round(zone.x * 13 + zone.y + radius))
    const out = []
    for (let tries = 0; out.length < count && tries < count * 8; tries++) {
      const a = r() * Math.PI * 2
      const d = Math.sqrt(r()) * radius
      const x = zone.x + Math.cos(a) * d
      const y = zone.y + Math.sin(a) * d
      if (!area.inBuilding(x, y)) out.push({ x, y, r: 2.4 + r() * 2.2, h: 7 + r() * 8 })
    }
    return out
  }, [zone, radius, area, count])
  return <TreeInstances trees={trees} crown="#5fd36b" />
}

function DyingTrees({ trees, share }) {
  const dead = useMemo(() => {
    const r = makeRandom(trees.length * 7 + 3)
    return trees.filter(() => r() < share).map((t) => ({ ...t, r: t.r * 1.12, fallen: r() < 0.25 }))
  }, [trees, share])
  const brown = useMemo(() => dead.filter((_, i) => i % 3 !== 0), [dead])
  const bare = useMemo(() => dead.filter((_, i) => i % 3 === 0).map((t) => ({ ...t, r: t.r * 0.55 })), [dead])
  return (
    <group>
      <TreeInstances trees={brown} crown="#8a4a22" trunk="#3d2b1f" />
      <TreeInstances trees={bare} crown="#4d4640" trunk="#3d2b1f" />
    </group>
  )
}

// Caps on the roofs around the place: plants, solar panels, or dark for abandoned buildings
function Roofs({ city, buildings, green, solar, dark }) {
  const { greenGeo, solarGeo, darkGeo } = useMemo(() => {
    const r = makeRandom(buildings.length * 17 + 5)
    const greens = []
    const panels = []
    const darks = []
    for (const i of buildings) {
      const b = city.buildings[i]
      const ring = b.rings[0]
      if (ring.length < 3) continue
      const roll = r()
      const cap = (list, lift) => {
        const g = new THREE.ShapeGeometry(new THREE.Shape(ring.map(([x, y]) => new THREE.Vector2(x, y))))
        g.rotateX(-Math.PI / 2)
        g.translate(0, b.height + lift, 0)
        list.push(g)
      }
      if (roll < dark) {
        cap(darks, 0.7)
        continue
      }
      if (roll < dark + green * (1 - dark)) cap(greens, 0.6)
      if (r() < solar) {
        let cx = 0
        let cy = 0
        for (const [x, y] of ring) {
          cx += x
          cy += y
        }
        const p = new THREE.BoxGeometry(5, 0.4, 3)
        p.translate(cx / ring.length, b.height + 1.4, -cy / ring.length)
        panels.push(p)
      }
    }
    const merge = (list) => {
      const m = list.length ? mergeGeometries(list) : null
      list.forEach((g) => g.dispose())
      return m
    }
    return { greenGeo: merge(greens), solarGeo: merge(panels), darkGeo: merge(darks) }
  }, [city, buildings, green, solar, dark])
  useDispose(greenGeo, solarGeo, darkGeo)
  const cap = { side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }
  return (
    <group>
      {greenGeo && (
        <mesh geometry={greenGeo}>
          <meshBasicMaterial color="#56c25e" {...cap} />
        </mesh>
      )}
      {darkGeo && (
        <mesh geometry={darkGeo}>
          <meshBasicMaterial color="#121318" {...cap} />
        </mesh>
      )}
      {solarGeo && (
        <mesh geometry={solarGeo}>
          <meshBasicMaterial color="#2c7dff" toneMapped={false} />
        </mesh>
      )}
    </group>
  )
}

// A soft round puff for the smog, drawn once
let puffTexture
function getPuff() {
  if (puffTexture) return puffTexture
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.5, 'rgba(255,255,255,0.45)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 64, 64)
  puffTexture = new THREE.CanvasTexture(c)
  return puffTexture
}

function Smog({ zone, radius, strength }) {
  const group = useRef()
  const fade = useRef(0)
  const puffs = useMemo(() => {
    const r = makeRandom(Math.round(zone.x + zone.y * 3 + radius))
    return Array.from({ length: Math.round((6 + 16 * strength) * Math.max(0.5, radius / 170)) }, () => {
      const a = r() * Math.PI * 2
      const d = Math.sqrt(r()) * radius
      return { x: zone.x + Math.cos(a) * d, y: zone.y + Math.sin(a) * d, h: 14 + r() * 50, s: 90 + r() * 120, phase: r() * 6 }
    })
  }, [zone, radius, strength])
  useFrame((state, delta) => {
    fade.current = Math.min(1, fade.current + delta / 2)
    group.current?.children.forEach((sp, i) => {
      const p = puffs[i]
      sp.position.y = p.h + Math.sin(state.clock.elapsedTime * 0.3 + p.phase) * 4
      sp.material.opacity = (0.25 + 0.3 * strength) * fade.current
    })
  })
  return (
    <group ref={group}>
      {puffs.map((p, i) => (
        <sprite key={i} position={v3(p.x, p.y, p.h)} scale={[p.s, p.s * 0.6, 1]} renderOrder={12}>
          <spriteMaterial map={getPuff()} color="#9c8a5e" transparent opacity={0} depthWrite={false} />
        </sprite>
      ))}
    </group>
  )
}

function Waste({ zone, radius, points, share }) {
  const ref = useRef()
  const piles = useMemo(() => {
    const r = makeRandom(points.length * 5 + 11)
    return points.filter(() => r() < share).flatMap((p) => Array.from({ length: 2 + Math.floor(r() * 3) }, () => ({ x: p.x + (r() - 0.5) * 4, y: p.y + (r() - 0.5) * 4, s: 0.8 + r() * 1.6, rot: r() * 3, c: r() })))
  }, [points, share])
  const colorArray = useMemo(() => {
    const cols = ['#8a6a3a', '#c27c2c', '#6d6a5f', '#a33b2a', '#d8cfa6'].map((c) => new THREE.Color(c))
    const arr = new Float32Array(piles.length * 3)
    piles.forEach((p, i) => cols[Math.floor(p.c * cols.length)].toArray(arr, i * 3))
    return arr
  }, [piles])
  useEffect(() => {
    if (!piles.length) return
    const d = new THREE.Object3D()
    piles.forEach((p, i) => {
      d.position.set(...v3(p.x, p.y, p.s / 2))
      d.rotation.set(p.rot, p.rot * 2, 0)
      d.scale.setScalar(p.s)
      d.updateMatrix()
      ref.current.setMatrixAt(i, d.matrix)
    })
    ref.current.instanceMatrix.needsUpdate = true
  }, [piles])
  return (
    <group>
      <Patch zone={zone} radius={radius * 0.85} color="#4a3a22" opacity={0.35} />
      {piles.length > 0 && (
        <instancedMesh ref={ref} args={[null, null, piles.length]} frustumCulled={false}>
          <boxGeometry args={[1, 1, 1]}>
            <instancedBufferAttribute attach="attributes-color" args={[colorArray, 3]} />
          </boxGeometry>
          <meshLambertMaterial vertexColors />
        </instancedMesh>
      )}
    </group>
  )
}

// Recycling stations: rows of green, blue and yellow bins beside the streets
function Recycling({ points, share }) {
  const ref = useRef()
  const bins = useMemo(() => {
    const r = makeRandom(points.length * 3 + 29)
    return points.filter(() => r() < share).flatMap((p) => [0, 1, 2].map((k) => ({ x: p.x + k * 1.6, y: p.y, k })))
  }, [points, share])
  const colorArray = useMemo(() => {
    const cols = ['#2fbf5b', '#2c7dff', '#ffd23a'].map((c) => new THREE.Color(c))
    const arr = new Float32Array(bins.length * 3)
    bins.forEach((b, i) => cols[b.k].toArray(arr, i * 3))
    return arr
  }, [bins])
  useEffect(() => {
    if (!bins.length) return
    const d = new THREE.Object3D()
    bins.forEach((b, i) => {
      d.position.set(...v3(b.x, b.y, 1))
      d.updateMatrix()
      ref.current.setMatrixAt(i, d.matrix)
    })
    ref.current.instanceMatrix.needsUpdate = true
  }, [bins])
  if (!bins.length) return null
  return (
    <instancedMesh ref={ref} args={[null, null, bins.length]} frustumCulled={false}>
      <boxGeometry args={[1.3, 2, 1.3]}>
        <instancedBufferAttribute attach="attributes-color" args={[colorArray, 3]} />
      </boxGeometry>
      <meshBasicMaterial vertexColors toneMapped={false} />
    </instancedMesh>
  )
}

// A tint on the ground around the place, with soft edges
// a soft round stain, fading out towards its edge, drawn once
let stainTexture
function getStain() {
  if (stainTexture) return stainTexture
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.55, 'rgba(255,255,255,0.75)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 128, 128)
  stainTexture = new THREE.CanvasTexture(c)
  return stainTexture
}

function Patch({ zone, radius, color, opacity = 0.45 }) {
  return (
    <mesh position={v3(zone.x, zone.y, 0.45)} rotation={[-Math.PI / 2, 0, 0]} renderOrder={3}>
      <planeGeometry args={[radius * 2, radius * 2]} />
      <meshBasicMaterial color={color} map={getStain()} transparent opacity={opacity} depthWrite={false} />
    </mesh>
  )
}

// Sand blown over the ground: a pale patch and low dunes, more of them the stronger it is
function Sand({ zone, radius, strength }) {
  const ref = useRef()
  const dunes = useMemo(() => {
    const r = makeRandom(Math.round(zone.x * 3 + zone.y * 5 + radius))
    return Array.from({ length: Math.round(10 + 60 * strength) }, () => {
      const a = r() * Math.PI * 2
      const d = Math.sqrt(r()) * radius
      return { x: zone.x + Math.cos(a) * d, y: zone.y + Math.sin(a) * d, s: 8 + r() * 22, h: 1 + r() * 4 * strength, rot: r() * 3 }
    })
  }, [zone, radius, strength])
  useEffect(() => {
    const d = new THREE.Object3D()
    dunes.forEach((p, i) => {
      d.position.set(...v3(p.x, p.y, 0))
      d.rotation.set(0, p.rot, 0)
      d.scale.set(p.s, p.h, p.s * 0.6)
      d.updateMatrix()
      ref.current.setMatrixAt(i, d.matrix)
    })
    ref.current.instanceMatrix.needsUpdate = true
  }, [dunes])
  return (
    <group>
      <Patch zone={zone} radius={radius} color="#d9c08a" opacity={0.35 + 0.5 * strength} />
      <instancedMesh ref={ref} args={[null, null, dunes.length]} frustumCulled={false}>
        <sphereGeometry args={[1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshLambertMaterial color="#d8bd85" />
      </instancedMesh>
    </group>
  )
}

// Water spreading over the ground, gently rippling
function Flood({ zone, radius, strength }) {
  const ref = useRef()
  useFrame((state) => {
    ref.current.material.opacity = (0.3 + 0.35 * strength) * (0.85 + 0.15 * Math.sin(state.clock.elapsedTime * 1.3))
  })
  return (
    <mesh ref={ref} position={v3(zone.x, zone.y, 1 + 3 * strength)} rotation={[-Math.PI / 2, 0, 0]} renderOrder={7}>
      <circleGeometry args={[radius * (0.5 + 0.5 * strength), 64]} />
      <meshBasicMaterial color="#1f7fd0" transparent opacity={0.5} depthWrite={false} />
    </mesh>
  )
}

// The riverbanks: green with trees when restored, brown and dead when polluted
function Banks({ scenery, color, trees = false }) {
  const { geometry, bankTrees } = useMemo(() => {
    const pos = []
    const pts = []
    const r = makeRandom(77)
    for (const { rings } of scenery.water) {
      const ring = rings[0]
      for (let i = 1; i < ring.length; i++) {
        const [a, b] = [ring[i - 1], ring[i]]
        pos.push(...v3(a[0], a[1], 1.2), ...v3(b[0], b[1], 1.2))
        const len = Math.hypot(b[0] - a[0], b[1] - a[1])
        for (let s = 0; s < len; s += 16) if (r() < 0.7) pts.push({ x: a[0] + ((b[0] - a[0]) * s) / len, y: a[1] + ((b[1] - a[1]) * s) / len, r: 2.4 + r() * 2, h: 7 + r() * 7 })
      }
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    return { geometry: g, bankTrees: pts }
  }, [scenery])
  useDispose(geometry)
  return (
    <group>
      <lineSegments geometry={geometry} renderOrder={6}>
        <lineBasicMaterial color={color} transparent opacity={0.95} blending={THREE.AdditiveBlending} depthWrite={false} />
      </lineSegments>
      {trees && (
        <Grow>
          <TreeInstances trees={bankTrees} crown="#4fbf63" />
        </Grow>
      )}
    </group>
  )
}

// The newest changes: a pulsing ring on the ground and the AI's story above the place
function ChangeMark({ change, zone, stack }) {
  const ring = useRef()
  const color = MOOD_COLOR[change.mood]
  useFrame((state) => {
    const t = (state.clock.elapsedTime % 2) / 2
    ring.current.scale.setScalar(20 + t * change.radius)
    ring.current.material.opacity = 0.9 * (1 - t)
  })
  return (
    <group>
      <mesh ref={ring} position={v3(zone.x, zone.y, 5)} rotation={[-Math.PI / 2, 0, 0]} renderOrder={11}>
        <ringGeometry args={[0.95, 1, 72]} />
        <meshBasicMaterial color={color} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  )
}

// The people of this period, standing on real streets: a few of them, each doing something different, as
// small illustrations pinned to the street nearest to where they were seen
function People({ people, zones, kerbs }) {
  const shown = useMemo(() => {
    const seen = new Set()
    const out = []
    people.forEach((o, i) => {
      const k = `${o.choice}${o.first}`
      const z = zones.get(o.place)
      if (!z || seen.has(k) || out.length >= 5) return
      seen.add(k)
      // a street near the place, a little off its centre so people at one place stand apart
      const a = i * 2.4
      const tx = z.x + Math.cos(a) * 70
      const ty = z.y + Math.sin(a) * 70
      let best = kerbs[0]
      let bestD = Infinity
      for (const p of kerbs) {
        const d = (p[0] - tx) ** 2 + (p[1] - ty) ** 2
        if (d < bestD) {
          best = p
          bestD = d
        }
      }
      out.push({ o, x: best[0], y: best[1] })
    })
    return out
  }, [people, zones, kerbs])
  return shown.map(({ o, x, y }, i) => (
    <Html key={`${o.text}-${i}`} position={v3(x, y, 2)} zIndexRange={[12, 0]} style={{ pointerEvents: 'none' }}>
      <div className="street-person" style={{ animationDelay: `${i * 0.12}s` }}>
        <Vignette observation={o} />
      </div>
    </Html>
  ))
}

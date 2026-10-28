// Weimar as a world the AI can reshape. It starts as the town today, in 2026: daylight and sun shadows,
// plastered houses with windows, their real footprints and heights and tiled roofs, asphalt streets with
// trees, cars and people, green parks, the Ilm. Each period the AI sets the world (sky, ground, walls,
// vegetation, water, haze, light) and the scene fades towards it; its changes at places are drawn on top by
// Future.jsx.

import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Html, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { buildBuildingGeometry } from './buildingGeometry.js'
import FutureCity, { Movers } from './Future.jsx'
import { startWorld } from './future.js'
import { makeRandom, pointInRing } from './scenery.js'

const v3 = (x, y, h) => [x, h, -y]
const FADE = 0.025 // how much of the way to the new world the scene goes each frame
const ROAD_W = 7 // metres of asphalt along each street of the network

// The light of each time of day: sky dome, ground bounce, sun
const LIGHT = {
  day: { hemi: 0.95, sun: 1.5, sunColor: '#fff1dc' },
  dusk: { hemi: 0.75, sun: 1.1, sunColor: '#ffc89a' },
  night: { hemi: 0.2, sun: 0.1, sunColor: '#8fa6ff' },
}

// Weimar's plaster: off-whites, creams, ochres and soft greys, one per building
const PLASTER = ['#f1ebdd', '#ece0c6', '#e6d3a8', '#f3e7d3', '#d9d4cc', '#efd9b5', '#e2cfb4', '#f6f1e6'].map((c) => new THREE.Color(c))
const CAR_COLORS = ['#c8372c', '#3d4a5c', '#e8e6e1', '#1f2329', '#7d8a96', '#2d5d8c']
const PEOPLE_COLORS = ['#3a2f45', '#5a3d2b', '#26415e', '#7a2d3a', '#2f4f3a']

const mix = (a, b, t) => new THREE.Color(a).lerp(new THREE.Color(b), t)

// Moves a material's colour (or a light's) a little towards its target every frame
function useFadeColor(ref, target, key = 'color') {
  useFrame(() => ref.current?.[key]?.lerp(target, FADE))
}

export default function WorldScene({ city, scenery, zones, view, real, spin, focus, beacon }) {
  const world = { ...startWorld(real), ...(view?.world ?? {}) }
  const { x0, y0, x1, y1 } = city.extent
  const size = Math.max(x1 - x0, y1 - y0)
  const target = useMemo(() => [(x0 + x1) / 2, 0, -(y0 + y1) / 2], [x0, x1, y0, y1])
  // a low view across the roofs, from inside the town: never the whole map from above like a model on a table
  const home = useMemo(() => [target[0] + size * 0.12, size * 0.09, target[2] + size * 0.22], [target, size])
  const segments = useMemo(() => {
    const s = []
    for (const e of city.edges) for (let i = 1; i < e.pts.length; i++) s.push([e.pts[i - 1], e.pts[i]])
    return s
  }, [city])
  const night = world.light === 'night'
  return (
    <Canvas shadows="percentage" camera={{ position: home, fov: 38, near: 5, far: size * 20 }} dpr={[1, 2]}>
      <Atmosphere world={world} size={size} />
      <Ground city={city} color={world.ground} vegetation={world.vegetation} />
      <Land scenery={scenery} world={world} />
      <River scenery={scenery} health={view?.state?.river ?? 0.6} water={world.water} />
      <Roads segments={segments} ground={world.ground} />
      <Trees city={city} scenery={scenery} segments={segments} vegetation={world.vegetation} />
      <Buildings city={city} tint={world.buildings} night={night} />
      {/* everyday life: cars on the streets, people on the pavements, as many as the world's traffic and crowds */}
      <Movers segments={segments} count={Math.round(430 * (world.traffic ?? 0.6))} colors={CAR_COLORS} speed={9} size={[1.9, 1.5, 4.3]} seed={2026} />
      <Movers segments={segments} count={Math.round(700 * (world.crowds ?? 0.6))} colors={PEOPLE_COLORS} speed={1.3} size={[0.6, 1.75, 0.6]} seed={1919} offset={5} />
      <FutureCity city={city} scenery={scenery} zones={zones} view={view} />
      {beacon && beacon.x !== undefined && <Beacon key={beacon.key} beacon={beacon} />}
      <CameraDirector focus={focus} whole={{ x: (x0 + x1) / 2, y: (y0 + y1) / 2, d: size * 0.55 }} />
      <OrbitControls makeDefault enableDamping target={target} autoRotate={spin} autoRotateSpeed={0.5} maxPolarAngle={Math.PI / 2 - 0.12} minDistance={40} maxDistance={size * 0.7} />
    </Canvas>
  )
}

// Flies the camera to what just happened, or high over the whole town, and back to where it was when the
// focus goes away. You can still orbit and zoom in between.
function CameraDirector({ focus, whole }) {
  const controls = useThree((s) => s.controls)
  const camera = useThree((s) => s.camera)
  const flight = useRef(null)
  const back = useRef(null) // the view before the first flight
  const key = focus?.key ?? null
  useEffect(() => {
    if (!controls) return
    let to
    if (focus) {
      if (!back.current) back.current = { position: camera.position.clone(), target: controls.target.clone() }
      const f = focus.key === 'whole' ? whole : focus
      const t = new THREE.Vector3(f.x, 0, -f.y)
      // every flight comes from another side and height, sometimes very close, sometimes low along the street
      const turn = Math.random() * Math.PI * 2
      const rise = 0.18 + Math.random() * 0.45
      const d = f.d * (focus.key === 'whole' ? 1 : 0.55 + Math.random() * 0.6)
      to = { target: t, position: t.clone().add(new THREE.Vector3(Math.cos(turn) * d, d * rise + 25, Math.sin(turn) * d)) }
    } else if (back.current) {
      to = back.current
      back.current = null
    } else return
    flight.current = { from: { position: camera.position.clone(), target: controls.target.clone() }, to, t: 0 }
  }, [key, controls]) // eslint-disable-line react-hooks/exhaustive-deps
  useFrame((_, delta) => {
    const f = flight.current
    if (!f || !controls) return
    f.t = Math.min(1, f.t + delta / 2.2)
    const e = f.t < 0.5 ? 4 * f.t ** 3 : 1 - (-2 * f.t + 2) ** 3 / 2 // gentle start and landing
    camera.position.lerpVectors(f.from.position, f.to.position, e)
    controls.target.lerpVectors(f.from.target, f.to.target, e)
    controls.update()
    if (f.t >= 1) flight.current = null
  })
  return null
}

// Where something is happening: a pillar of light in the event's colour, shock rings running out over the
// roofs and its emoji floating above, so the eye goes straight to it
const GLOW = { good: '#4fe08a', bad: '#ff4a3a', mixed: '#fcee0a', strange: '#ff9f1c' }
function Beacon({ beacon }) {
  const color = useMemo(() => new THREE.Color(GLOW[beacon.strange ? 'strange' : beacon.mood] ?? GLOW.mixed).multiplyScalar(2.2), [beacon])
  const pillar = useRef()
  const rings = useRef([])
  const born = useRef(null)
  const big = beacon.strange || beacon.key === 'last-event'
  const reach = Math.max(120, beacon.radius ?? 200) * (big ? 2.2 : 1.2)
  useFrame(({ clock }) => {
    if (born.current === null) born.current = clock.elapsedTime
    const age = clock.elapsedTime - born.current
    pillar.current.scale.set(1, Math.max(0.01, Math.min(1, age / 0.8)), 1)
    pillar.current.material.opacity = (0.35 + 0.15 * Math.sin(age * 6)) * Math.min(1, age * 3)
    rings.current.forEach((r, i) => {
      if (!r) return
      const t = ((age + i * 0.6) % 1.8) / 1.8
      r.scale.setScalar(10 + t * reach)
      r.material.opacity = 0.9 * (1 - t)
    })
  })
  const h = big ? 900 : 520
  return (
    <group position={v3(beacon.x, beacon.y, 0)}>
      <mesh ref={pillar} position={[0, h / 2, 0]}>
        <cylinderGeometry args={[big ? 14 : 8, big ? 30 : 18, h, 24, 1, true]} />
        <meshBasicMaterial color={color} transparent depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} toneMapped={false} fog={false} />
      </mesh>
      {[0, 1, 2].map((i) => (
        <mesh key={i} ref={(m) => (rings.current[i] = m)} position={[0, 3 + i, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.9, 1, 96]} />
          <meshBasicMaterial color={color} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} fog={false} />
        </mesh>
      ))}
      {beacon.icon && (
        <Html position={[0, big ? 170 : 110, 0]} center zIndexRange={[14, 0]} style={{ pointerEvents: 'none' }}>
          <div className="beacon-icon">{beacon.icon}</div>
        </Html>
      )}
    </group>
  )
}

// Sky, haze and light, with the sun casting shadows over the whole town
function Atmosphere({ world, size }) {
  const light = LIGHT[world.light] ?? LIGHT.day
  const night = world.light === 'night'
  // the sky colour, browned by haze, darkened at dusk and night
  const sky = useMemo(() => {
    // by day the sky is never darker than a real daytime sky; only night is truly dark
    const c = new THREE.Color(world.sky)
    if (!night) {
      const hsl = {}
      c.getHSL(hsl)
      c.setHSL(hsl.h, hsl.s, Math.max(hsl.l, world.light === 'dusk' ? 0.55 : 0.68))
    }
    c.lerp(new THREE.Color('#a8946a'), world.haze * 0.6)
    return night ? c.lerp(new THREE.Color('#05070f'), 0.75) : world.light === 'dusk' ? c.lerp(new THREE.Color('#e8a878'), 0.2) : c
  }, [world.sky, world.haze, world.light, night])
  // the town is lit by a brightened sky, so the light stays clear whatever colour the sky is
  const skyLight = useMemo(() => (night ? sky.clone() : sky.clone().lerp(new THREE.Color('#ffffff'), 0.55)), [sky, night])
  const groundBounce = useMemo(() => new THREE.Color(world.ground), [world.ground])
  const sunColor = useMemo(() => new THREE.Color(light.sunColor), [light.sunColor])
  const fog = useRef()
  const hemi = useRef()
  const sun = useRef()
  useFrame(({ scene, camera, controls }) => {
    if (!scene.background) scene.background = sky.clone()
    scene.background.lerp(sky, FADE)
    fog.current.color.copy(scene.background)
    // the fog follows the camera, so wherever it looks the town fades into the sky before its edge is seen
    const away = controls ? camera.position.distanceTo(controls.target) : size * 0.3
    fog.current.near += (away * (0.9 - 0.5 * world.haze) - fog.current.near) * 0.08
    fog.current.far += (away + size * (0.5 - 0.25 * world.haze) - fog.current.far) * 0.08
    hemi.current.intensity += (light.hemi - hemi.current.intensity) * FADE
    sun.current.intensity += (light.sun - sun.current.intensity) * FADE
  })
  useFadeColor(hemi, skyLight)
  useFadeColor(hemi, groundBounce, 'groundColor')
  useFadeColor(sun, sunColor)
  const half = size * 0.75
  return (
    <>
      <fog ref={fog} attach="fog" args={[world.sky, size * 0.3, size * 0.8]} />
      <hemisphereLight ref={hemi} args={[world.sky, world.ground, light.hemi]} />
      <directionalLight
        ref={sun}
        position={[-700, 1100, 500]}
        intensity={light.sun}
        color={light.sunColor}
        castShadow
        shadow-mapSize={[4096, 4096]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.6}
        shadow-camera-left={-half}
        shadow-camera-right={half}
        shadow-camera-top={half}
        shadow-camera-bottom={-half}
        shadow-camera-near={100}
        shadow-camera-far={4000}
      />
    </>
  )
}

// The town's open ground (pavements, yards) in the world's ground colour, and around it the countryside:
// fields that are green while the vegetation lives and turn to bare ground as it goes
function Ground({ city, color, vegetation }) {
  const { x0, y0, x1, y1 } = city.extent
  const town = useRef()
  const land = useRef()
  const townTarget = useMemo(() => new THREE.Color(color), [color])
  const landTarget = useMemo(() => mix('#7f9a58', color, 1 - vegetation), [color, vegetation])
  useFadeColor(town, townTarget)
  useFadeColor(land, landTarget)
  const cx = (x0 + x1) / 2
  const cz = -(y0 + y1) / 2
  // the town's ground fades into the land at its edge instead of ending in a straight line
  const edgeFade = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = c.height = 256
    const g = c.getContext('2d')
    const r = g.createRadialGradient(128, 128, 70, 128, 128, 128)
    r.addColorStop(0, '#fff')
    r.addColorStop(1, '#000')
    g.fillStyle = r
    g.fillRect(0, 0, 256, 256)
    return new THREE.CanvasTexture(c)
  }, [])
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, 0, cz]} receiveShadow>
        <planeGeometry args={[x1 - x0 + 160, y1 - y0 + 160]} />
        <meshLambertMaterial ref={town} color={color} transparent alphaMap={edgeFade} depthWrite={false} />
      </mesh>
      {/* far wider than the town, so the haze swallows its edge */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, -0.3, cz]} receiveShadow>
        <planeGeometry args={[(x1 - x0) * 14, (y1 - y0) * 14]} />
        <meshLambertMaterial ref={land} color="#7f9a58" />
      </mesh>
    </group>
  )
}

function flat(polys, h) {
  const shapes = polys.map(({ rings }) => {
    const s = new THREE.Shape(rings[0].map(([x, y]) => new THREE.Vector2(x, y)))
    s.holes = rings.slice(1).map((r) => new THREE.Path(r.map(([x, y]) => new THREE.Vector2(x, y))))
    return s
  })
  const g = new THREE.ShapeGeometry(shapes)
  g.rotateX(-Math.PI / 2)
  g.translate(0, h, 0)
  return g
}

// Parks and squares: green fades into the ground as the vegetation goes
function Land({ scenery, world }) {
  const green = useMemo(() => flat(scenery.green, 0.15), [scenery])
  const squares = useMemo(() => flat(scenery.squares, 0.12), [scenery])
  const greenMat = useRef()
  const squareMat = useRef()
  const greenTarget = useMemo(() => mix('#6a9a4c', world.ground, 1 - world.vegetation), [world.ground, world.vegetation])
  const squareTarget = useMemo(() => mix('#c8bca2', world.ground, 0.4), [world.ground])
  useFadeColor(greenMat, greenTarget)
  useFadeColor(squareMat, squareTarget)
  return (
    <group>
      <mesh geometry={green} receiveShadow>
        <meshLambertMaterial ref={greenMat} color="#6a9a4c" polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-2} />
      </mesh>
      <mesh geometry={squares} receiveShadow>
        <meshLambertMaterial ref={squareMat} color="#c8bca2" polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-2} />
      </mesh>
    </group>
  )
}

// Asphalt along every street, with a round patch at each corner so the strips join
function Roads({ segments, ground }) {
  const geometry = useMemo(() => {
    const pos = []
    const w = ROAD_W / 2
    for (const [a, b] of segments) {
      const len = Math.hypot(b[0] - a[0], b[1] - a[1])
      if (len < 0.5) continue
      const nx = (-(b[1] - a[1]) / len) * w
      const ny = ((b[0] - a[0]) / len) * w
      const p = [
        [a[0] + nx, a[1] + ny],
        [a[0] - nx, a[1] - ny],
        [b[0] - nx, b[1] - ny],
        [b[0] + nx, b[1] + ny],
      ]
      for (const k of [0, 1, 2, 0, 2, 3]) pos.push(...v3(p[k][0], p[k][1], 0.25))
      // a disc at the end, so corners have no gaps
      for (let i = 0; i < 8; i++) {
        const t0 = (i / 8) * Math.PI * 2
        const t1 = ((i + 1) / 8) * Math.PI * 2
        pos.push(...v3(b[0], b[1], 0.25), ...v3(b[0] + Math.cos(t1) * w, b[1] + Math.sin(t1) * w, 0.25), ...v3(b[0] + Math.cos(t0) * w, b[1] + Math.sin(t0) * w, 0.25))
      }
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.computeVertexNormals()
    return g
  }, [segments])
  const mat = useRef()
  const target = useMemo(() => mix('#605d58', ground, 0.2), [ground])
  useFadeColor(mat, target)
  return (
    <mesh geometry={geometry} receiveShadow renderOrder={2}>
      <meshLambertMaterial ref={mat} color="#605d58" side={THREE.DoubleSide} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-4} />
    </mesh>
  )
}

// The Ilm: clear blue when healthy, murky when polluted, and a cracked sandy bed when it runs dry
function River({ scenery, health, water }) {
  const geometry = useMemo(() => flat(scenery.water, 0.4), [scenery])
  const mat = useRef()
  const target = useMemo(() => {
    const wet = mix('#5d5222', '#2f86bd', health)
    return wet.lerp(new THREE.Color('#b59f78'), water < 0.3 ? 1 - water / 0.3 : 0)
  }, [health, water])
  useFadeColor(mat, target)
  return (
    <mesh geometry={geometry} renderOrder={4} receiveShadow>
      <meshLambertMaterial ref={mat} color="#2f86bd" polygonOffset polygonOffsetFactor={-3} polygonOffsetUnits={-6} />
    </mesh>
  )
}

// Street trees along the pavements, every 16 m on both sides, out of the buildings and the water
function streetTrees(city, scenery, segments) {
  const G = 40
  const grid = new Map()
  city.buildings.forEach((b) => {
    const r = b.rings[0]
    let bx0 = Infinity
    let by0 = Infinity
    let bx1 = -Infinity
    let by1 = -Infinity
    for (const [x, y] of r) {
      bx0 = Math.min(bx0, x)
      by0 = Math.min(by0, y)
      bx1 = Math.max(bx1, x)
      by1 = Math.max(by1, y)
    }
    for (let i = Math.floor(bx0 / G); i <= Math.floor(bx1 / G); i++)
      for (let j = Math.floor(by0 / G); j <= Math.floor(by1 / G); j++) {
        const k = `${i},${j}`
        if (!grid.has(k)) grid.set(k, [])
        grid.get(k).push(r)
      }
  })
  const blocked = (x, y) =>
    (grid.get(`${Math.floor(x / G)},${Math.floor(y / G)}`) || []).some((r) => pointInRing([x, y], r)) ||
    scenery.water.some((w) => x >= w.bbox.x0 && x <= w.bbox.x1 && y >= w.bbox.y0 && y <= w.bbox.y1 && pointInRing([x, y], w.rings[0]))
  const r = makeRandom(1990)
  const out = []
  for (const [a, b] of segments) {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1])
    if (len < 10) continue
    const ux = (b[0] - a[0]) / len
    const uy = (b[1] - a[1]) / len
    for (let s = 8; s < len - 4; s += 16) {
      for (const side of [-1, 1]) {
        if (r() < 0.35) continue
        const x = a[0] + ux * s - uy * (ROAD_W / 2 + 2.5) * side
        const y = a[1] + uy * s + ux * (ROAD_W / 2 + 2.5) * side
        if (!blocked(x, y)) out.push({ x, y, r: 2.2 + r() * 1.4, h: 8 + r() * 5, tone: r(), lean: r() })
      }
    }
  }
  return out
}

// All trees, in the parks and along the streets. As the vegetation goes, more of them turn brown and bare,
// and then disappear.
function Trees({ city, scenery, segments, vegetation }) {
  const trees = useMemo(() => [...scenery.trees, ...streetTrees(city, scenery, segments)], [city, scenery, segments])
  const v = Math.round(vegetation * 20) / 20 // redraw in steps of 5 %
  const crowns = useRef()
  const trunks = useRef()
  useEffect(() => {
    const d = new THREE.Object3D()
    const greens = ['#3f7a3a', '#4f8c41', '#356b33', '#5c9a4a'].map((c) => new THREE.Color(c))
    const sick = ['#a0522d', '#8b6b3d', '#6d5a48'].map((c) => new THREE.Color(c))
    trees.forEach((t, i) => {
      const alive = t.tone < v
      const dying = !alive && t.tone < v + 0.25
      const s = alive ? 1 : dying ? 0.55 : 0.001
      d.position.set(...v3(t.x, t.y, t.h - t.r * 0.9))
      d.scale.set(t.r * s, t.r * 1.15 * s, t.r * s)
      d.updateMatrix()
      crowns.current.setMatrixAt(i, d.matrix)
      crowns.current.setColorAt(i, alive ? greens[Math.floor(t.lean * 4) % 4] : sick[Math.floor(t.lean * 3) % 3])
      const trunkH = alive || dying ? t.h - t.r : 0.001
      d.position.set(...v3(t.x, t.y, trunkH / 2))
      d.scale.set(1, trunkH, 1)
      d.updateMatrix()
      trunks.current.setMatrixAt(i, d.matrix)
    })
    crowns.current.instanceMatrix.needsUpdate = true
    crowns.current.instanceColor.needsUpdate = true
    trunks.current.instanceMatrix.needsUpdate = true
  }, [trees, v])
  return (
    <group>
      <instancedMesh ref={crowns} args={[null, null, trees.length]} frustumCulled={false} castShadow>
        <icosahedronGeometry args={[1, 1]} />
        <meshLambertMaterial flatShading />
      </instancedMesh>
      <instancedMesh ref={trunks} args={[null, null, trees.length]} frustumCulled={false} castShadow>
        <cylinderGeometry args={[0.25, 0.35, 1, 5]} />
        <meshLambertMaterial color="#5a4330" />
      </instancedMesh>
    </group>
  )
}

// The facades get rows of windows, one row per floor, from the wall data of buildingGeometry.js;
// by day they are dark glass, at night they glow warm
function addWindows(material, uniforms) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uGlow = uniforms.uGlow
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 facade;\nvarying vec4 vFacade;\nvarying float vH;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFacade = facade;\nvH = position.y;')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uGlow;\nvarying vec4 vFacade;\nvarying float vH;\nfloat win = 0.0;')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        if (vFacade.w < 0.5 && vFacade.y > 3.0) {
          float fh = max(vFacade.z, 2.8);
          float u = mod(vFacade.x, 3.4);
          float v = mod(vH, fh);
          win = step(0.9, u) * step(u, 2.3) * step(0.95, v) * step(v, fh - 0.75) * step(1.5, vH);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.30, 0.36, 0.42), win * 0.85);
        }`,
      )
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += win * uGlow * vec3(1.0, 0.78, 0.45);')
  }
}

// All buildings, with their real footprints and heights and approximate pitched roofs, in plaster colours
// with tiled roofs. The AI's wall colour tints them all.
function Buildings({ city, tint, night }) {
  const built = useMemo(() => {
    let k = 0
    const b = buildBuildingGeometry(city.buildings, { pitched: true, colorOf: () => '#' + PLASTER[(k++ * 7) % PLASTER.length].getHexString() })
    // roof slopes in red-brown tiles, flat roofs in grey; the walls keep their plaster
    const part = b.geometry.getAttribute('facade')
    const color = b.geometry.getAttribute('color')
    const tile = [new THREE.Color('#a4553a'), new THREE.Color('#8e4a35'), new THREE.Color('#7a5a4a')]
    const flatRoof = new THREE.Color('#8f8a84')
    for (let i = 0; i < part.count; i++) {
      const p = part.getW(i)
      if (p === 2) tile[Math.floor(color.getX(i) * 37) % 3].toArray(color.array, i * 3)
      else if (p === 1) flatRoof.toArray(color.array, i * 3)
    }
    color.needsUpdate = true
    return b
  }, [city])
  const uniforms = useMemo(() => ({ uGlow: { value: 0 } }), [])
  const material = useMemo(() => {
    const m = new THREE.MeshLambertMaterial({ vertexColors: true })
    addWindows(m, uniforms)
    return m
  }, [uniforms])
  const mat = useRef(material)
  const target = useMemo(() => new THREE.Color(tint).lerp(new THREE.Color('#ffffff'), 0.25), [tint])
  useFadeColor(mat, target)
  useFrame(() => {
    uniforms.uGlow.value += ((night ? 1.4 : 0) - uniforms.uGlow.value) * FADE
  })
  return <mesh geometry={built.geometry} material={material} castShadow receiveShadow />
}

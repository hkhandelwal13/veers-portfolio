'use client'

import { useEffect, useRef, useSyncExternalStore } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import {
  canRenderFluidDistortion,
  getCapabilities,
  getServerCapabilities,
  subscribeToCapabilities,
} from '@/lib/capabilities'
import { fluidPointer } from '@/lib/pointer-bus'
import { getTargetRect, type TargetRect } from '@/lib/rect-sampler'
import { ALL_LAYERS_MASK } from './layers'

const VERT = [
  'varying vec2 vUv;',
  'void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}',
].join('\\n')

const ADVECT = [
  'precision highp float;',
  'uniform sampler2D uVelocity; uniform sampler2D uSource;',
  'uniform float uDt; uniform float uDissipation; varying vec2 vUv;',
  'void main(){vec2 v=texture2D(uVelocity,vUv).xy; vec2 p=clamp(vUv-v*uDt,0.001,0.999);',
  'float d=pow(clamp(uDissipation,0.0,1.0),uDt*60.0); gl_FragColor=texture2D(uSource,p)*d;}',
].join('\\n')

const SPLAT = [
  'precision highp float;',
  'uniform sampler2D uTarget; uniform vec2 uPoint; uniform vec4 uValue;',
  'uniform float uRadius; uniform float uAspect; varying vec2 vUv;',
  'void main(){vec2 d=vUv-uPoint; d.x*=uAspect; float w=exp(-dot(d,d)/max(uRadius,0.000001));',
  'gl_FragColor=texture2D(uTarget,vUv)+uValue*w;}',
].join('\\n')

const CURL = [
  'precision highp float; uniform sampler2D uVelocity; uniform vec2 uTexel; varying vec2 vUv;',
  'void main(){float l=texture2D(uVelocity,vUv-vec2(uTexel.x,0.0)).y;',
  'float r=texture2D(uVelocity,vUv+vec2(uTexel.x,0.0)).y;',
  'float b=texture2D(uVelocity,vUv-vec2(0.0,uTexel.y)).x;',
  'float t=texture2D(uVelocity,vUv+vec2(0.0,uTexel.y)).x;',
  'gl_FragColor=vec4(0.5*(r-l-t+b),0.0,0.0,1.0);}',
].join('\\n')

const VORTICITY = [
  'precision highp float; uniform sampler2D uVelocity; uniform sampler2D uCurl;',
  'uniform vec2 uTexel; uniform float uDt; uniform float uStrength; varying vec2 vUv;',
  'void main(){float l=abs(texture2D(uCurl,vUv-vec2(uTexel.x,0.0)).x);',
  'float r=abs(texture2D(uCurl,vUv+vec2(uTexel.x,0.0)).x);',
  'float b=abs(texture2D(uCurl,vUv-vec2(0.0,uTexel.y)).x);',
  'float t=abs(texture2D(uCurl,vUv+vec2(0.0,uTexel.y)).x);',
  'float c=texture2D(uCurl,vUv).x; vec2 f=0.5*vec2(t-b,r-l);',
  'f/=max(length(f),0.0001); f*=uStrength*c; f.y*=-1.0;',
  'gl_FragColor=vec4(texture2D(uVelocity,vUv).xy+f*uDt,0.0,1.0);}',
].join('\\n')

const DIVERGENCE = [
  'precision highp float; uniform sampler2D uVelocity; uniform vec2 uTexel; varying vec2 vUv;',
  'void main(){float l=texture2D(uVelocity,vUv-vec2(uTexel.x,0.0)).x;',
  'float r=texture2D(uVelocity,vUv+vec2(uTexel.x,0.0)).x;',
  'float b=texture2D(uVelocity,vUv-vec2(0.0,uTexel.y)).y;',
  'float t=texture2D(uVelocity,vUv+vec2(0.0,uTexel.y)).y;',
  'gl_FragColor=vec4(0.5*(r-l+t-b),0.0,0.0,1.0);}',
].join('\\n')

const CLEAR = [
  'precision highp float; uniform sampler2D uTexture; uniform float uValue; varying vec2 vUv;',
  'void main(){gl_FragColor=texture2D(uTexture,vUv)*uValue;}',
].join('\\n')

const PRESSURE = [
  'precision highp float; uniform sampler2D uPressure; uniform sampler2D uDivergence;',
  'uniform vec2 uTexel; varying vec2 vUv;',
  'void main(){float l=texture2D(uPressure,vUv-vec2(uTexel.x,0.0)).x;',
  'float r=texture2D(uPressure,vUv+vec2(uTexel.x,0.0)).x;',
  'float b=texture2D(uPressure,vUv-vec2(0.0,uTexel.y)).x;',
  'float t=texture2D(uPressure,vUv+vec2(0.0,uTexel.y)).x;',
  'float d=texture2D(uDivergence,vUv).x; gl_FragColor=vec4((l+r+b+t-d)*0.25,0.0,0.0,1.0);}',
].join('\\n')

const GRADIENT = [
  'precision highp float; uniform sampler2D uVelocity; uniform sampler2D uPressure;',
  'uniform vec2 uTexel; varying vec2 vUv;',
  'void main(){float l=texture2D(uPressure,vUv-vec2(uTexel.x,0.0)).x;',
  'float r=texture2D(uPressure,vUv+vec2(uTexel.x,0.0)).x;',
  'float b=texture2D(uPressure,vUv-vec2(0.0,uTexel.y)).x;',
  'float t=texture2D(uPressure,vUv+vec2(0.0,uTexel.y)).x;',
  'vec2 v=texture2D(uVelocity,vUv).xy-0.5*vec2(r-l,t-b); gl_FragColor=vec4(v,0.0,1.0);}',
].join('\\n')

const COMPOSITE = [
  'precision highp float;',
  'uniform sampler2D uScene; uniform sampler2D uVelocity; uniform sampler2D uDensity;',
  'uniform vec2 uSimTexel; uniform vec4 uHeroRect; uniform vec4 uContactRect;',
  'uniform float uStrength; uniform float uChroma; varying vec2 vUv;',
  'float rectMask(vec2 uv,vec4 r){if(r.z<=0.0||r.w<=0.0)return 0.0;',
  'vec2 p=(uv-r.xy)/r.zw; float e=min(min(p.x,1.0-p.x),min(p.y,1.0-p.y)); return smoothstep(0.0,0.025,e);}',
  'vec4 sceneAt(vec2 uv){return texture2D(uScene,clamp(uv,0.001,0.999));}',
  'void main(){float m=max(rectMask(vUv,uHeroRect),rectMask(vUv,uContactRect)); vec4 base=sceneAt(vUv);',
  'vec2 flow=texture2D(uVelocity,vUv).xy; float fl=length(flow); if(fl>1.0)flow/=fl;',
  'float l=texture2D(uDensity,vUv-vec2(uSimTexel.x,0.0)).r;',
  'float r=texture2D(uDensity,vUv+vec2(uSimTexel.x,0.0)).r;',
  'float b=texture2D(uDensity,vUv-vec2(0.0,uSimTexel.y)).r;',
  'float t=texture2D(uDensity,vUv+vec2(0.0,uSimTexel.y)).r;',
  'vec2 dg=0.5*vec2(r-l,t-b); float den=texture2D(uDensity,vUv).r;',
  'float trail=max(smoothstep(0.008,0.22,den),smoothstep(0.008,0.18,fl));',
  'vec2 o=(flow+dg*0.7)*uStrength*trail*m;',
  'vec3 c; c.r=sceneAt(vUv+o*(1.0+uChroma)).r; c.g=sceneAt(vUv+o).g; c.b=sceneAt(vUv+o*(1.0-uChroma)).b;',
  'gl_FragColor=vec4(c,base.a);',
  '#include <tonemapping_fragment>',
  '#include <colorspace_fragment>',
  '}',
].join('\\n')

const TUNING = {
  velocityDissipation: 0.985,
  densityDissipation: 0.974,
  vorticity: 16,
  pointerForce: 0.62,
  maxPointerForce: 1.35,
  desktopRadius: 0.0024,
  mobileRadius: 0.0038,
  desktopStrength: 0.018,
  mobileStrength: 0.013,
  desktopChroma: 0.14,
  mobileChroma: 0.08,
} as const

const HERO_TARGET = 'hero-field'
const CONTACT_TARGET = 'contact-distortion'

type Pair = { read: THREE.WebGLRenderTarget; write: THREE.WebGLRenderTarget; swap(): void; dispose(): void }
type Resources = {
  simScene: THREE.Scene
  simCamera: THREE.OrthographicCamera
  quad: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>
  compositeScene: THREE.Scene
  compositeCamera: THREE.OrthographicCamera
  velocity: Pair
  density: Pair
  pressure: Pair
  curl: THREE.WebGLRenderTarget
  divergence: THREE.WebGLRenderTarget
  sceneTarget: THREE.WebGLRenderTarget
  advect: THREE.ShaderMaterial
  splat: THREE.ShaderMaterial
  curlMat: THREE.ShaderMaterial
  vorticity: THREE.ShaderMaterial
  divergenceMat: THREE.ShaderMaterial
  pressureClear: THREE.ShaderMaterial
  pressureMat: THREE.ShaderMaterial
  gradient: THREE.ShaderMaterial
  composite: THREE.ShaderMaterial
  pressureIterations: number
  dispose(): void
}

function target(width: number, height: number, depthBuffer = false) {
  const value = new THREE.WebGLRenderTarget(width, height, {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer,
    stencilBuffer: false,
  })
  value.texture.generateMipmaps = false
  return value
}

function pair(width: number, height: number): Pair {
  const value: Pair = {
    read: target(width, height),
    write: target(width, height),
    swap() { const next = value.read; value.read = value.write; value.write = next },
    dispose() { value.read.dispose(); value.write.dispose() },
  }
  return value
}

function material(fragmentShader: string, uniforms: Record<string, THREE.IUniform>) {
  return new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader, uniforms, depthTest: false, depthWrite: false, toneMapped: false })
}

function createResources(simWidth: number, simHeight: number, sceneWidth: number, sceneHeight: number, pressureIterations: number): Resources {
  const velocity = pair(simWidth, simHeight)
  const density = pair(simWidth, simHeight)
  const pressure = pair(simWidth, simHeight)
  const curl = target(simWidth, simHeight)
  const divergence = target(simWidth, simHeight)
  const sceneTarget = target(sceneWidth, sceneHeight, true)
  const texel = new THREE.Vector2(1 / simWidth, 1 / simHeight)
  const advect = material(ADVECT, { uVelocity: { value: null }, uSource: { value: null }, uDt: { value: 1 / 60 }, uDissipation: { value: 0.98 } })
  const splat = material(SPLAT, { uTarget: { value: null }, uPoint: { value: new THREE.Vector2() }, uValue: { value: new THREE.Vector4() }, uRadius: { value: TUNING.desktopRadius }, uAspect: { value: 1 } })
  const curlMat = material(CURL, { uVelocity: { value: null }, uTexel: { value: texel.clone() } })
  const vorticity = material(VORTICITY, { uVelocity: { value: null }, uCurl: { value: curl.texture }, uTexel: { value: texel.clone() }, uDt: { value: 1 / 60 }, uStrength: { value: TUNING.vorticity } })
  const divergenceMat = material(DIVERGENCE, { uVelocity: { value: null }, uTexel: { value: texel.clone() } })
  const pressureClear = material(CLEAR, { uTexture: { value: null }, uValue: { value: 0.8 } })
  const pressureMat = material(PRESSURE, { uPressure: { value: null }, uDivergence: { value: divergence.texture }, uTexel: { value: texel.clone() } })
  const gradient = material(GRADIENT, { uVelocity: { value: null }, uPressure: { value: null }, uTexel: { value: texel.clone() } })
  const composite = material(COMPOSITE, {
    uScene: { value: sceneTarget.texture }, uVelocity: { value: velocity.read.texture }, uDensity: { value: density.read.texture },
    uSimTexel: { value: texel.clone() }, uHeroRect: { value: new THREE.Vector4() }, uContactRect: { value: new THREE.Vector4() },
    uStrength: { value: TUNING.desktopStrength }, uChroma: { value: TUNING.desktopChroma },
  })
  composite.transparent = true
  composite.toneMapped = true

  const geometry = new THREE.PlaneGeometry(2, 2)
  const quad = new THREE.Mesh(geometry, advect)
  quad.frustumCulled = false
  const simScene = new THREE.Scene()
  simScene.add(quad)
  const compositeQuad = new THREE.Mesh(geometry, composite)
  compositeQuad.frustumCulled = false
  const compositeScene = new THREE.Scene()
  compositeScene.add(compositeQuad)
  const simCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  const compositeCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  const materials = [advect, splat, curlMat, vorticity, divergenceMat, pressureClear, pressureMat, gradient, composite]

  return {
    simScene, simCamera, quad, compositeScene, compositeCamera, velocity, density, pressure, curl, divergence, sceneTarget,
    advect, splat, curlMat, vorticity, divergenceMat, pressureClear, pressureMat, gradient, composite, pressureIterations,
    dispose() { velocity.dispose(); density.dispose(); pressure.dispose(); curl.dispose(); divergence.dispose(); sceneTarget.dispose(); materials.forEach((m) => m.dispose()); geometry.dispose() },
  }
}

function renderPass(gl: THREE.WebGLRenderer, r: Resources, mat: THREE.ShaderMaterial, output: THREE.WebGLRenderTarget) {
  r.quad.material = mat
  gl.setRenderTarget(output)
  gl.render(r.simScene, r.simCamera)
}

function clearFluid(gl: THREE.WebGLRenderer, r: Resources) {
  const oldTarget = gl.getRenderTarget()
  const oldAlpha = gl.getClearAlpha()
  const oldColor = new THREE.Color()
  gl.getClearColor(oldColor)
  gl.setClearColor(0x000000, 0)
  const targets = [r.velocity.read, r.velocity.write, r.density.read, r.density.write, r.pressure.read, r.pressure.write, r.curl, r.divergence]
  targets.forEach((item) => { gl.setRenderTarget(item); gl.clear(true, false, false) })
  gl.setClearColor(oldColor, oldAlpha)
  gl.setRenderTarget(oldTarget)
}

function stepFluid(gl: THREE.WebGLRenderer, r: Resources, dt: number, compact: boolean, aspect: number, point: THREE.Vector2 | null, force: THREE.Vector2 | null) {
  const oldTarget = gl.getRenderTarget()
  const oldAlpha = gl.getClearAlpha()
  const oldColor = new THREE.Color()
  gl.getClearColor(oldColor)
  gl.setClearColor(0x000000, 0)

  r.advect.uniforms.uVelocity.value = r.velocity.read.texture
  r.advect.uniforms.uSource.value = r.velocity.read.texture
  r.advect.uniforms.uDt.value = dt
  r.advect.uniforms.uDissipation.value = TUNING.velocityDissipation
  renderPass(gl, r, r.advect, r.velocity.write); r.velocity.swap()

  if (point && force) {
    r.splat.uniforms.uTarget.value = r.velocity.read.texture
    r.splat.uniforms.uPoint.value.copy(point)
    r.splat.uniforms.uValue.value.set(force.x, force.y, 0, 0)
    r.splat.uniforms.uRadius.value = compact ? TUNING.mobileRadius : TUNING.desktopRadius
    r.splat.uniforms.uAspect.value = aspect
    renderPass(gl, r, r.splat, r.velocity.write); r.velocity.swap()
  }

  r.curlMat.uniforms.uVelocity.value = r.velocity.read.texture
  renderPass(gl, r, r.curlMat, r.curl)
  r.vorticity.uniforms.uVelocity.value = r.velocity.read.texture
  r.vorticity.uniforms.uCurl.value = r.curl.texture
  r.vorticity.uniforms.uDt.value = dt
  renderPass(gl, r, r.vorticity, r.velocity.write); r.velocity.swap()

  r.divergenceMat.uniforms.uVelocity.value = r.velocity.read.texture
  renderPass(gl, r, r.divergenceMat, r.divergence)
  r.pressureClear.uniforms.uTexture.value = r.pressure.read.texture
  renderPass(gl, r, r.pressureClear, r.pressure.write); r.pressure.swap()
  r.pressureMat.uniforms.uDivergence.value = r.divergence.texture
  for (let i = 0; i < r.pressureIterations; i += 1) {
    r.pressureMat.uniforms.uPressure.value = r.pressure.read.texture
    renderPass(gl, r, r.pressureMat, r.pressure.write); r.pressure.swap()
  }

  r.gradient.uniforms.uVelocity.value = r.velocity.read.texture
  r.gradient.uniforms.uPressure.value = r.pressure.read.texture
  renderPass(gl, r, r.gradient, r.velocity.write); r.velocity.swap()

  r.advect.uniforms.uVelocity.value = r.velocity.read.texture
  r.advect.uniforms.uSource.value = r.density.read.texture
  r.advect.uniforms.uDt.value = dt
  r.advect.uniforms.uDissipation.value = TUNING.densityDissipation
  renderPass(gl, r, r.advect, r.density.write); r.density.swap()
  if (point) {
    r.splat.uniforms.uTarget.value = r.density.read.texture
    r.splat.uniforms.uPoint.value.copy(point)
    r.splat.uniforms.uValue.value.set(0.9, 0, 0, 0)
    renderPass(gl, r, r.splat, r.density.write); r.density.swap()
  }

  gl.setClearColor(oldColor, oldAlpha)
  gl.setRenderTarget(oldTarget)
}

function visible(rect: TargetRect | null, height: number) {
  return Boolean(rect?.valid && rect.y < height + 80 && rect.y + rect.height > -80)
}

function contains(rect: TargetRect | null, x: number, y: number) {
  return Boolean(rect?.valid && x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height)
}

function writeRect(out: THREE.Vector4, rect: TargetRect | null, width: number, height: number) {
  if (!rect?.valid || width <= 0 || height <= 0) { out.set(0, 0, 0, 0); return }
  out.set(rect.x / width, 1 - (rect.y + rect.height) / height, rect.width / width, rect.height / height)
}

export function FluidDistortion() {
  const size = useThree((state) => state.size)
  const dpr = useThree((state) => state.viewport.dpr)
  const compact = useSyncExternalStore(
    subscribeToCapabilities,
    () => getCapabilities().compact,
    () => getServerCapabilities().compact,
  )
  const resources = useRef<Resources | null>(null)
  const previous = useRef({ x: 0.5, y: 0.5, active: false })
  const dtTotal = useRef(0)
  const mobileFrame = useRef(0)
  const wasActive = useRef(false)
  const point = useRef(new THREE.Vector2())
  const force = useRef(new THREE.Vector2())

  useEffect(() => {
    const aspect = size.height > 0 ? size.width / size.height : 1
    const shortSide = compact ? 112 : 192
    const simWidth = Math.max(2, Math.round(aspect >= 1 ? shortSide * aspect : shortSide))
    const simHeight = Math.max(2, Math.round(aspect >= 1 ? shortSide : shortSide / aspect))
    const next = createResources(
      simWidth, simHeight,
      Math.max(1, Math.round(size.width * dpr)),
      Math.max(1, Math.round(size.height * dpr)),
      compact ? 10 : 18,
    )
    resources.current = next
    return () => { next.dispose(); if (resources.current === next) resources.current = null }
  }, [size.width, size.height, dpr, compact])

  useFrame((state, delta) => {
    const r = resources.current
    if (!r) return
    const hero = getTargetRect(HERO_TARGET)
    const contact = getTargetRect(CONTACT_TARGET)
    const active = canRenderFluidDistortion(getCapabilities()) && (visible(hero, state.size.height) || visible(contact, state.size.height))
    const input = fluidPointer
    const prev = previous.current

    if (!active) {
      if (wasActive.current) clearFluid(state.gl, r)
      wasActive.current = false
      dtTotal.current = 0
      previous.current = { x: input.x, y: input.y, active: input.active }
      return
    }

    wasActive.current = true
    dtTotal.current += Math.min(delta, 1 / 30)
    mobileFrame.current += 1
    if (compact && mobileFrame.current % 2 !== 0) return

    const dt = Math.min(dtTotal.current, 1 / 20)
    dtTotal.current = 0
    const px = input.x * state.size.width
    const py = input.y * state.size.height
    const moved = Math.hypot(input.x - prev.x, input.y - prev.y) > 0.00005
    const shouldSplat = input.active && prev.active && moved && (contains(hero, px, py) || contains(contact, px, py))
    let splatPoint: THREE.Vector2 | null = null
    let splatForce: THREE.Vector2 | null = null

    if (shouldSplat && dt > 0) {
      point.current.set(input.x, 1 - input.y)
      force.current.set(
        ((input.x - prev.x) / dt) * TUNING.pointerForce,
        (-(input.y - prev.y) / dt) * TUNING.pointerForce,
      )
      const length = force.current.length()
      if (length > TUNING.maxPointerForce) force.current.multiplyScalar(TUNING.maxPointerForce / length)
      splatPoint = point.current
      splatForce = force.current
    }

    if (dt > 0) stepFluid(state.gl, r, dt, compact, state.size.width / Math.max(1, state.size.height), splatPoint, splatForce)
    previous.current = { x: input.x, y: input.y, active: input.active }
  }, -1.5)

  useFrame((state) => {
    const { gl, scene, camera } = state
    const r = resources.current
    const oldTarget = gl.getRenderTarget()
    const oldMask = camera.layers.mask
    camera.layers.mask = ALL_LAYERS_MASK
    const hero = getTargetRect(HERO_TARGET)
    const contact = getTargetRect(CONTACT_TARGET)
    const active = Boolean(r && canRenderFluidDistortion(getCapabilities()) && (visible(hero, state.size.height) || visible(contact, state.size.height)))

    if (!active || !r) {
      gl.setRenderTarget(oldTarget)
      gl.render(scene, camera)
      camera.layers.mask = oldMask
      return
    }

    gl.setRenderTarget(r.sceneTarget)
    gl.render(scene, camera)
    const u = r.composite.uniforms
    u.uScene.value = r.sceneTarget.texture
    u.uVelocity.value = r.velocity.read.texture
    u.uDensity.value = r.density.read.texture
    u.uStrength.value = compact ? TUNING.mobileStrength : TUNING.desktopStrength
    u.uChroma.value = compact ? TUNING.mobileChroma : TUNING.desktopChroma
    writeRect(u.uHeroRect.value as THREE.Vector4, hero, state.size.width, state.size.height)
    writeRect(u.uContactRect.value as THREE.Vector4, contact, state.size.width, state.size.height)
    gl.setRenderTarget(oldTarget)
    gl.render(r.compositeScene, r.compositeCamera)
    camera.layers.mask = oldMask
  }, 1)

  return null
}

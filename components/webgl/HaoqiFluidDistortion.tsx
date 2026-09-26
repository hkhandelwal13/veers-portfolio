'use client'

import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { fluidPointer } from '@/lib/pointer-bus'
import { getCapabilities } from '@/lib/capabilities'
import { getTargetRect, type TargetRect } from '@/lib/rect-sampler'
import { ALL_LAYERS_MASK } from './layers'

const HERO_TARGET = 'hero-field'
const CONTACT_TARGET = 'contact-distortion'
const SIM_SHORT_SIDE = 160
const SPLAT_RADIUS = 0.003
const SPLAT_FORCE = 3000
const CURL_STRENGTH = 16
const DISSIPATION = 3
const PRESSURE_ITERATIONS = 4
const DISPLACEMENT_STRENGTH = 1
const CHROMATIC_BOOST = 0.5
const ACTIVE_WINDOW_MS = 600

const fullscreenVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = position.xy * 0.5 + 0.5;
    gl_Position = vec4(position.xy, 1.0, 1.0);
  }
`

const curlFragment = /* glsl */ `
  uniform sampler2D uVelocity;
  uniform vec2 uTexelSize;
  varying vec2 vUv;
  void main() {
    float left = texture2D(uVelocity, vUv - vec2(uTexelSize.x, 0.0)).y;
    float right = texture2D(uVelocity, vUv + vec2(uTexelSize.x, 0.0)).y;
    float top = texture2D(uVelocity, vUv + vec2(0.0, uTexelSize.y)).x;
    float bottom = texture2D(uVelocity, vUv - vec2(0.0, uTexelSize.y)).x;
    gl_FragColor = vec4(0.5 * (right - left - top + bottom), 0.0, 0.0, 1.0);
  }
`

const vorticityFragment = /* glsl */ `
  uniform sampler2D uVelocity;
  uniform sampler2D uCurl;
  uniform vec2 uTexelSize;
  uniform vec2 uResolution;
  uniform vec2 uPointer;
  uniform vec2 uPointerDelta;
  uniform float uCurlStrength;
  uniform float uSplatRadius;
  uniform float uSplatForce;
  varying vec2 vUv;
  void main() {
    float left = abs(texture2D(uCurl, vUv - vec2(uTexelSize.x, 0.0)).x);
    float right = abs(texture2D(uCurl, vUv + vec2(uTexelSize.x, 0.0)).x);
    float top = abs(texture2D(uCurl, vUv + vec2(0.0, uTexelSize.y)).x);
    float bottom = abs(texture2D(uCurl, vUv - vec2(0.0, uTexelSize.y)).x);
    float center = texture2D(uCurl, vUv).x;

    vec2 force = vec2(top - bottom, right - left);
    float forceLength = length(force);
    force = forceLength > 0.0001 ? force / forceLength : vec2(0.0);
    force *= uCurlStrength * center;
    force.y *= -1.0;

    vec2 velocity = texture2D(uVelocity, vUv).xy + force * 0.016;
    velocity = clamp(velocity, vec2(-1000.0), vec2(1000.0));

    vec2 mouseUv = uPointer / max(uResolution, vec2(0.0001));
    vec2 diff = vUv - mouseUv;
    diff.x *= uResolution.x / max(uResolution.y, 0.0001);
    float pointerMask = exp(-dot(diff, diff) / max(uSplatRadius, 0.0001));
    velocity += (uPointerDelta / max(uResolution, vec2(0.0001))) * pointerMask * uSplatForce;

    gl_FragColor = vec4(velocity, 0.0, 1.0);
  }
`

const divergenceFragment = /* glsl */ `
  uniform sampler2D uVelocity;
  uniform vec2 uTexelSize;
  varying vec2 vUv;
  void main() {
    float left = texture2D(uVelocity, vUv - vec2(uTexelSize.x, 0.0)).x;
    float right = texture2D(uVelocity, vUv + vec2(uTexelSize.x, 0.0)).x;
    float top = texture2D(uVelocity, vUv + vec2(0.0, uTexelSize.y)).y;
    float bottom = texture2D(uVelocity, vUv - vec2(0.0, uTexelSize.y)).y;
    gl_FragColor = vec4(0.5 * (right - left + top - bottom), 0.0, 0.0, 1.0);
  }
`

const clearFragment = /* glsl */ `
  void main() { gl_FragColor = vec4(0.0); }
`

const pressureFragment = /* glsl */ `
  uniform sampler2D uPressure;
  uniform sampler2D uDivergence;
  uniform vec2 uTexelSize;
  varying vec2 vUv;
  void main() {
    float left = texture2D(uPressure, vUv - vec2(uTexelSize.x, 0.0)).x;
    float right = texture2D(uPressure, vUv + vec2(uTexelSize.x, 0.0)).x;
    float top = texture2D(uPressure, vUv + vec2(0.0, uTexelSize.y)).x;
    float bottom = texture2D(uPressure, vUv - vec2(0.0, uTexelSize.y)).x;
    float divergence = texture2D(uDivergence, vUv).x;
    gl_FragColor = vec4((left + right + top + bottom - divergence) * 0.25, 0.0, 0.0, 1.0);
  }
`

const gradientFragment = /* glsl */ `
  uniform sampler2D uVelocity;
  uniform sampler2D uPressure;
  uniform vec2 uTexelSize;
  varying vec2 vUv;
  void main() {
    float left = texture2D(uPressure, vUv - vec2(uTexelSize.x, 0.0)).x;
    float right = texture2D(uPressure, vUv + vec2(uTexelSize.x, 0.0)).x;
    float top = texture2D(uPressure, vUv + vec2(0.0, uTexelSize.y)).x;
    float bottom = texture2D(uPressure, vUv - vec2(0.0, uTexelSize.y)).x;
    vec2 velocity = texture2D(uVelocity, vUv).xy - vec2(right - left, top - bottom);
    gl_FragColor = vec4(velocity, 0.0, 1.0);
  }
`

const advectFragment = /* glsl */ `
  uniform sampler2D uProjectedVelocity;
  uniform vec2 uTexelSize;
  uniform float uDissipation;
  varying vec2 vUv;
  void main() {
    vec2 velocity = texture2D(uProjectedVelocity, vUv).xy;
    vec2 coord = clamp(vUv - velocity * uTexelSize * 0.016, 0.0, 1.0);
    vec2 advected = texture2D(uProjectedVelocity, coord).xy;
    advected /= 1.0 + uDissipation * 0.016;
    gl_FragColor = vec4(advected, 0.0, 1.0);
  }
`

const displayFragment = /* glsl */ `
  uniform sampler2D tDiffuse;
  uniform sampler2D uVelocity;
  uniform vec2 uSimSize;
  uniform float uDisplacementStrength;
  uniform float uChromaticBoost;
  uniform float uEffectEnabled;
  uniform vec4 uHeroRect;
  uniform vec4 uContactRect;
  varying vec2 vUv;

  float rectMask(vec2 uv, vec4 r) {
    if (r.z <= 0.0 || r.w <= 0.0) return 0.0;
    vec2 p = (uv - r.xy) / r.zw;
    float e = min(min(p.x, 1.0 - p.x), min(p.y, 1.0 - p.y));
    return smoothstep(0.0, 0.025, e);
  }

  vec3 spectrum(float x) {
    return cos((x - vec3(0.0, 0.5, 1.0)) * vec3(0.6, 1.0, 0.5) * 3.14);
  }

  vec4 fluidColor(vec2 uv) {
    vec2 velocity = texture2D(uVelocity, uv).xy;
    float enabled = step(0.5, uEffectEnabled);
    float sectionMask = max(rectMask(uv, uHeroRect), rectMask(uv, uContactRect));
    vec2 displacement = velocity / max(uSimSize, vec2(1.0)) * uDisplacementStrength * enabled * sectionMask;
    float velocityMagnitude = length(displacement);

    vec4 color = vec4(0.0);
    vec3 weightSum = vec3(0.0);
    for (int index = 0; index < 4; index++) {
      float t = float(index) / 3.0;
      vec3 weight = max(vec3(0.0), cos((t - vec3(0.0, 0.5, 1.0)) * 3.14159 * 0.5));
      vec2 sampleUv = clamp(uv - displacement * 0.3 * (t + 0.3) * velocityMagnitude, 0.0, 1.0);
      vec4 sampleColor = texture2D(tDiffuse, sampleUv);
      color.rgb += sampleColor.rgb * weight;
      color.a += sampleColor.a * (weight.r + weight.g + weight.b) / 3.0;
      weightSum += weight;
    }

    color.rgb /= max(weightSum, vec3(0.0001));
    color.a /= max((weightSum.r + weightSum.g + weightSum.b) / 3.0, 0.0001);
    vec3 spectralHighlight = spectrum(sin(velocityMagnitude * 2.0) * 0.4 + 0.6);
    color.rgb += spectralHighlight * smoothstep(0.2, 0.8, velocityMagnitude) * 0.5 * uChromaticBoost * enabled * sectionMask;
    return color;
  }

  void main() {
    gl_FragColor = fluidColor(vUv);
    #include <colorspace_fragment>
  }
`

const copyFragment = /* glsl */ `
  uniform sampler2D tDiffuse;
  varying vec2 vUv;
  void main() {
    gl_FragColor = texture2D(tDiffuse, vUv);
    #include <colorspace_fragment>
  }
`

function material(fragmentShader: string, uniforms: Record<string, THREE.IUniform>) {
  return new THREE.ShaderMaterial({
    vertexShader: fullscreenVertex,
    fragmentShader,
    uniforms,
    depthTest: false,
    depthWrite: false,
    transparent: false,
    toneMapped: false,
  })
}

function target(width = 1, height = 1, halfFloat = false, depthBuffer = false) {
  return new THREE.WebGLRenderTarget(width, height, {
    depthBuffer,
    stencilBuffer: false,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    format: THREE.RGBAFormat,
    type: halfFloat ? THREE.HalfFloatType : THREE.UnsignedByteType,
  })
}

function visible(rect: TargetRect | null, height: number) {
  return Boolean(rect?.valid && rect.y < height + 80 && rect.y + rect.height > -80)
}

function writeRect(out: THREE.Vector4, rect: TargetRect | null, width: number, height: number) {
  if (!rect?.valid || width <= 0 || height <= 0) {
    out.set(0, 0, 0, 0)
    return
  }
  out.set(rect.x / width, 1 - (rect.y + rect.height) / height, rect.width / width, rect.height / height)
}

export function HaoqiFluidDistortion() {
  const { camera, gl, scene, size } = useThree()
  const previousPointerPx = useRef(new THREE.Vector2(-1, -1))
  const pointerPx = useRef(new THREE.Vector2(-1, -1))
  const pointerDelta = useRef(new THREE.Vector2())
  const lastMovedAt = useRef(0)

  const targets = useMemo(() => ({
    base: target(1, 1, false, true),
    velocityRead: target(1, 1, true),
    velocityWrite: target(1, 1, true),
    curl: target(1, 1, true),
    vort: target(1, 1, true),
    divergence: target(1, 1, true),
    pressureA: target(1, 1, true),
    pressureB: target(1, 1, true),
    projected: target(1, 1, true),
  }), [])

  const materials = useMemo(() => {
    const texel = new THREE.Vector2(1, 1)
    const resolution = new THREE.Vector2(1, 1)
    return {
      copy: material(copyFragment, { tDiffuse: { value: null } }),
      curl: material(curlFragment, { uVelocity: { value: null }, uTexelSize: { value: texel.clone() } }),
      vorticity: material(vorticityFragment, {
        uVelocity: { value: null },
        uCurl: { value: null },
        uTexelSize: { value: texel.clone() },
        uResolution: { value: resolution.clone() },
        uPointer: { value: pointerPx.current },
        uPointerDelta: { value: pointerDelta.current },
        uCurlStrength: { value: CURL_STRENGTH },
        uSplatRadius: { value: SPLAT_RADIUS },
        uSplatForce: { value: SPLAT_FORCE },
      }),
      divergence: material(divergenceFragment, { uVelocity: { value: null }, uTexelSize: { value: texel.clone() } }),
      clear: material(clearFragment, {}),
      pressure: material(pressureFragment, {
        uPressure: { value: null },
        uDivergence: { value: null },
        uTexelSize: { value: texel.clone() },
      }),
      gradient: material(gradientFragment, {
        uVelocity: { value: null },
        uPressure: { value: null },
        uTexelSize: { value: texel.clone() },
      }),
      advect: material(advectFragment, {
        uProjectedVelocity: { value: null },
        uTexelSize: { value: texel.clone() },
        uDissipation: { value: DISSIPATION },
      }),
      display: material(displayFragment, {
        tDiffuse: { value: null },
        uVelocity: { value: null },
        uSimSize: { value: new THREE.Vector2(1, 1) },
        uDisplacementStrength: { value: DISPLACEMENT_STRENGTH },
        uChromaticBoost: { value: CHROMATIC_BOOST },
        uEffectEnabled: { value: 1 },
        uHeroRect: { value: new THREE.Vector4() },
        uContactRect: { value: new THREE.Vector4() },
      }),
    }
  }, [])

  const passScene = useMemo(() => new THREE.Scene(), [])
  const passCamera = useMemo(() => new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), [])
  const passMesh = useMemo(() => new THREE.Mesh(new THREE.PlaneGeometry(2, 2), materials.copy), [materials.copy])

  useEffect(() => {
    passScene.add(passMesh)
    return () => { passScene.remove(passMesh) }
  }, [passMesh, passScene])

  useEffect(() => {
    const drawing = gl.getDrawingBufferSize(new THREE.Vector2())
    const width = Math.max(1, Math.floor(drawing.x))
    const height = Math.max(1, Math.floor(drawing.y))
    targets.base.setSize(width, height)

    const aspect = width / height
    const simWidth = aspect > 1 ? Math.round(SIM_SHORT_SIDE * aspect) : SIM_SHORT_SIDE
    const simHeight = aspect > 1 ? SIM_SHORT_SIDE : Math.round(SIM_SHORT_SIDE / Math.max(aspect, 0.0001))
    for (const current of [
      targets.velocityRead,
      targets.velocityWrite,
      targets.curl,
      targets.vort,
      targets.divergence,
      targets.pressureA,
      targets.pressureB,
      targets.projected,
    ]) current.setSize(simWidth, simHeight)

    const simulationMaterials = [
      materials.curl,
      materials.vorticity,
      materials.divergence,
      materials.pressure,
      materials.gradient,
      materials.advect,
    ]
    for (const current of simulationMaterials) current.uniforms.uTexelSize?.value.set(1 / simWidth, 1 / simHeight)
    materials.vorticity.uniforms.uResolution.value.set(width, height)
    materials.display.uniforms.uSimSize.value.set(simWidth, simHeight)
  }, [gl, materials, size.height, size.width, targets])

  useEffect(() => () => {
    Object.values(targets).forEach((current) => current.dispose())
    Object.values(materials).forEach((current) => current.dispose())
    passMesh.geometry.dispose()
  }, [materials, passMesh, targets])

  useFrame((state) => {
    const oldTarget = gl.getRenderTarget()
    const oldMask = camera.layers.mask
    const drawing = gl.getDrawingBufferSize(new THREE.Vector2())
    const hero = getTargetRect(HERO_TARGET)
    const contact = getTargetRect(CONTACT_TARGET)
    const sectionVisible = visible(hero, size.height) || visible(contact, size.height)
    const desktop = size.width >= 1024
    const reducedMotion = getCapabilities().reducedMotion
    const canUsePointer = fluidPointer.active && desktop && !reducedMotion && sectionVisible

    pointerPx.current.set(fluidPointer.x * drawing.x, (1 - fluidPointer.y) * drawing.y)
    if (canUsePointer && previousPointerPx.current.x >= 0) {
      pointerDelta.current.copy(pointerPx.current).sub(previousPointerPx.current)
      if (pointerDelta.current.lengthSq() > 0.01) lastMovedAt.current = performance.now()
    } else {
      pointerDelta.current.set(0, 0)
    }
    previousPointerPx.current.copy(pointerPx.current)

    const fluidActive = canUsePointer && performance.now() - lastMovedAt.current <= ACTIVE_WINDOW_MS

    camera.layers.mask = ALL_LAYERS_MASK
    gl.setRenderTarget(targets.base)
    gl.clear()
    gl.render(scene, camera)

    let velocityRead = targets.velocityRead
    let velocityWrite = targets.velocityWrite

    if (fluidActive) {
      const renderSimulation = (currentMaterial: THREE.ShaderMaterial, currentTarget: THREE.WebGLRenderTarget) => {
        passMesh.material = currentMaterial
        gl.setRenderTarget(currentTarget)
        gl.clear()
        gl.render(passScene, passCamera)
      }

      materials.curl.uniforms.uVelocity.value = velocityRead.texture
      renderSimulation(materials.curl, targets.curl)

      materials.vorticity.uniforms.uVelocity.value = velocityRead.texture
      materials.vorticity.uniforms.uCurl.value = targets.curl.texture
      renderSimulation(materials.vorticity, targets.vort)

      materials.divergence.uniforms.uVelocity.value = targets.vort.texture
      renderSimulation(materials.divergence, targets.divergence)

      renderSimulation(materials.clear, targets.pressureA)
      let pressureRead = targets.pressureA
      let pressureWrite = targets.pressureB
      for (let iteration = 0; iteration < PRESSURE_ITERATIONS; iteration += 1) {
        materials.pressure.uniforms.uPressure.value = pressureRead.texture
        materials.pressure.uniforms.uDivergence.value = targets.divergence.texture
        renderSimulation(materials.pressure, pressureWrite)
        ;[pressureRead, pressureWrite] = [pressureWrite, pressureRead]
      }

      materials.gradient.uniforms.uVelocity.value = targets.vort.texture
      materials.gradient.uniforms.uPressure.value = pressureRead.texture
      renderSimulation(materials.gradient, targets.projected)

      materials.advect.uniforms.uProjectedVelocity.value = targets.projected.texture
      renderSimulation(materials.advect, velocityWrite)
      ;[velocityRead, velocityWrite] = [velocityWrite, velocityRead]
      targets.velocityRead = velocityRead
      targets.velocityWrite = velocityWrite
    }

    writeRect(materials.display.uniforms.uHeroRect.value as THREE.Vector4, hero, size.width, size.height)
    writeRect(materials.display.uniforms.uContactRect.value as THREE.Vector4, contact, size.width, size.height)
    materials.display.uniforms.tDiffuse.value = targets.base.texture
    materials.display.uniforms.uVelocity.value = targets.velocityRead.texture
    materials.display.uniforms.uEffectEnabled.value = fluidActive ? 1 : 0
    passMesh.material = materials.display

    gl.setRenderTarget(oldTarget)
    gl.clear()
    gl.render(passScene, passCamera)
    camera.layers.mask = oldMask
  }, 1)

  return null
}

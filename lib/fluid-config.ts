/**
 * The fluid distortion's knobs, in one typed object.
 *
 * Every number here is a starting point that was then tuned against the real
 * scene — the ones that moved furthest from their first values have a note
 * saying why.
 */

export type FluidConfig = {
  /** Side of the square simulation target. Never the viewport's resolution. */
  simulationSize: number
  /** Gaussian falloff of the pointer splat, in squared UV. */
  radius: number
  /**
   * How hard a splat writes into the flow.
   *
   * Scaled by the frame's own duration inside the shader, so the field reaches
   * the same strength on a 144Hz screen as on a 60Hz one. The reference
   * formula adds the splat undivided, which makes the whole effect twice as
   * strong on a fast display.
   */
  splatStrength: number
  /** Per-frame velocity retention while the pointer is present. */
  dissipation: number
  /** Per-frame retention once it has gone. Lower, so the frame comes back. */
  releaseDissipation: number
  /** How far the field drags itself along its own velocity each frame. */
  advectionStrength: number
  /**
   * Drag injected under the pointer for as long as it is present.
   *
   * This is what makes the effect answer to hover rather than only to
   * movement: velocity alone leaves the field blank the instant the hand
   * stops, and holding the cursor over the word then does nothing.
   */
  swirlStrength: number
  /** Speed, in UV per second, above which the drag re-aims itself. */
  aimThreshold: number
  /** Damping rate, per second, on hovering in and out of a fluid section. */
  presenceSmoothing: number
  /**
   * Flow → UV offset on the captured scene.
   *
   * The splat is tuned so a brisk swipe settles the field near 1, which makes
   * this readable directly: it is roughly the largest offset, as a share of the
   * frame, that a fast movement produces.
   */
  distortionStrength: number
  /** RGB separation along the flow direction. Subtle by contract. */
  chromaticAberration: number
  /** Exponential damping rate on the pointer's velocity, per second. */
  velocitySmoothing: number
  /** Extra decay applied while the pointer is outside the window. */
  idleDecay: number
}

export const FLUID_DEFAULTS: FluidConfig = {
  simulationSize: 256,
  // Wider than the suggested 0.006, which puts the whole influence inside
  // about 150px and is too small to read — but not so wide that the pointer
  // drags half the viewport around with it. Roughly 300px across.
  radius: 0.028,
  // Well below the suggested 2.5, because the splat is integrated over the
  // frame rather than added whole: 2.5 undivided is about 150x this at 60Hz.
  // Set so an ordinary hand — not a synthetic one, which moves several times
  // faster than a person does — builds a field worth looking at.
  splatStrength: 1.0,
  // Half-life around three quarters of a second. At 0.975 the trail was gone
  // in under half of one, which reads as a flicker rather than as fluid.
  dissipation: 0.985,
  // About a sixth of a second, so the picture is clean within one of leaving.
  releaseDissipation: 0.93,
  advectionStrength: 1.0,
  // Balances against dissipation into a standing drag of roughly 3 flow units,
  // which at the distortion below is about a sixth of the frame.
  swirlStrength: 3.0,
  // Low enough that an ordinary drift re-aims it, high enough that the jitter
  // of a hand holding still does not spin the direction around.
  aimThreshold: 0.25,
  // A little under half a second in, the same out.
  presenceSmoothing: 5,
  // Deep enough that the letterforms genuinely come apart in the core rather
  // than leaning: at a standing swirl of ~3 this is roughly a sixth of the
  // frame, which is what the reference does under the cursor.
  distortionStrength: 0.055,
  // Present but not the subject. Larger than this and the rainbow banding
  // becomes the effect, which reads as ripples rather than as a stretch. It is
  // multiplied by the flow, so it is exactly zero everywhere at rest.
  chromaticAberration: 0.005,
  velocitySmoothing: 14,
  idleDecay: 0.9,
}

/** Small screens: a quarter of the simulation, and a gentler result. */
export const FLUID_COMPACT: Partial<FluidConfig> = {
  simulationSize: 128,
  distortionStrength: 0.04,
  chromaticAberration: 0.003,
}

/** The ceiling, for reference — going above this buys nothing visible. */
export const FLUID_MAX_SIMULATION_SIZE = 384

export function resolveFluidConfig(
  overrides: Partial<FluidConfig>,
  compact: boolean,
): FluidConfig {
  const base = compact ? { ...FLUID_DEFAULTS, ...FLUID_COMPACT } : FLUID_DEFAULTS
  const merged = { ...base, ...overrides }
  return {
    ...merged,
    simulationSize: Math.min(merged.simulationSize, FLUID_MAX_SIMULATION_SIZE),
  }
}

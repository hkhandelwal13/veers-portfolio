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
  /**
   * Radius of the stamp, in UV.
   *
   * A real radius now rather than a Gaussian denominator — inside it the field
   * is the stamp, outside it is the advected history, and the smoothstep
   * between the two is the only place anything bends.
   */
  radius: number
  /**
   * The stamp's length while the pointer merely rests on the section.
   *
   * The stamp replaces the field rather than adding to it, so this is not a
   * rate — it is the displacement itself, in flow units, and it is what makes
   * hovering keep distorting when the hand has stopped.
   */
  holdStrength: number
  /** How much the pointer's own speed adds to that, and the cap on it. */
  speedGain: number
  speedCap: number
  /** Velocity retention per 1/60s while the pointer is present. */
  dissipation: number
  /** Retention once it has gone. Lower, so the frame comes back. */
  releaseDissipation: number
  /** How far the field drags itself along its own velocity each frame. */
  advectionStrength: number

  /** Speed, in UV per second, above which the stamp re-aims itself. */
  aimThreshold: number
  /** Damping rate, per second, on hovering in and out of a fluid section. */
  presenceSmoothing: number
  /**
   * Flow → UV offset on the captured scene.
   *
   * Multiplied by the stamp, which is a displacement rather than a rate, so
   * holdStrength * this is directly the share of the frame that the picture
   * under the cursor is moved by.
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
  // Roughly 300px across on a 900-tall viewport: big enough to take several
  // letters at once, not so big that the pointer drags half the frame.
  radius: 0.17,
  // Around a sixth of the frame of displacement at the distortion below,
  // which is what "the letters come apart" costs.
  holdStrength: 2.6,
  speedGain: 0.55,
  speedCap: 2.2,
  // Half-life around three quarters of a second. At 0.975 the trail was gone
  // in under half of one, which reads as a flicker rather than as fluid.
  dissipation: 0.985,
  // About a sixth of a second, so the picture is clean within one of leaving.
  releaseDissipation: 0.93,
  advectionStrength: 1.0,
  // Low enough that an ordinary drift re-aims it, high enough that the jitter
  // of a hand holding still does not spin the direction around.
  aimThreshold: 0.25,
  // A little under half a second in, the same out.
  presenceSmoothing: 5,
  // With holdStrength above, about a seventh of the frame at rest and a fifth
  // under a fast hand — deep enough that the letterforms come apart rather
  // than lean.
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

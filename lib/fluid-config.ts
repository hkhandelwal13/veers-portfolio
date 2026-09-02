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
  /** Per-frame velocity retention. Below 1 or the field never settles. */
  dissipation: number
  /** How far the field drags itself along its own velocity each frame. */
  advectionStrength: number
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
  radius: 0.006,
  // Well below the suggested 2.5, because the splat is integrated over the
  // frame rather than added whole: 2.5 undivided is about 150x this at 60Hz.
  // Chosen so a brisk swipe settles the field near 1.
  splatStrength: 0.5,
  dissipation: 0.975,
  advectionStrength: 0.8,
  // Tuned down from 0.12. What is being distorted is mostly type and a glass
  // word with hard specular edges; past about a tenth of the frame a fast
  // swipe tears the letterforms rather than pushing them.
  distortionStrength: 0.09,
  chromaticAberration: 0.002,
  velocitySmoothing: 14,
  idleDecay: 0.9,
}

/** Small screens: a quarter of the simulation, and a gentler result. */
export const FLUID_COMPACT: Partial<FluidConfig> = {
  simulationSize: 128,
  distortionStrength: 0.055,
  chromaticAberration: 0.001,
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

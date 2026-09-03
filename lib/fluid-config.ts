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
  // Far wider than the suggested 0.006, which puts the whole influence inside
  // about 150px — a smear that small under a cursor that is already moving is
  // genuinely hard to notice. This reaches roughly 350px across.
  radius: 0.03,
  // Well below the suggested 2.5, because the splat is integrated over the
  // frame rather than added whole: 2.5 undivided is about 150x this at 60Hz.
  // Set so an ordinary hand — not a synthetic one, which moves several times
  // faster than a person does — builds a field worth looking at.
  splatStrength: 1.0,
  // Half-life around three quarters of a second. At 0.975 the trail was gone
  // in under half of one, which reads as a flicker rather than as fluid.
  dissipation: 0.985,
  advectionStrength: 1.0,
  // Reads as roughly the offset a normal sweep produces: the splat above is
  // tuned so an ordinary movement settles the field near 2, so this is about
  // a tenth of the frame. Past that a fast swipe tears the letterforms rather
  // than pushing them.
  distortionStrength: 0.055,
  chromaticAberration: 0.0035,
  velocitySmoothing: 14,
  idleDecay: 0.9,
}

/** Small screens: a quarter of the simulation, and a gentler result. */
export const FLUID_COMPACT: Partial<FluidConfig> = {
  simulationSize: 128,
  distortionStrength: 0.038,
  chromaticAberration: 0.002,
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

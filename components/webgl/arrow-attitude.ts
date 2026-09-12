import * as THREE from 'three'

/**
 * The arrow model's resting orientation, shared by the hero and the finale.
 *
 * arrow.glb is an extruded plate authored on a diagonal, so its identity
 * orientation shows a three-quarter view rather than its face. This is the
 * shortest rotation that squares that face up to a camera looking down -Z,
 * plus a roll that points it up and to the left.
 *
 * Shared because both places need the arrow to START flat — the hero's spins
 * up from it, the finale's returns to it — and two copies of a hand-measured
 * normal is two things to get wrong the next time the model is re-exported.
 */

/**
 * The normal of the arrow's broad face, in the model's own space.
 *
 * Area-averaged from the GLB's normals: the two largest faces by a wide margin
 * are the front and back of the plate, and they share this axis.
 */
export const ARROW_FLAT_FACE_NORMAL = new THREE.Vector3(0.66321, -0.54478, 0.51319).normalize()

/** Which way it points when flat: up, and to the left. */
export const ARROW_REST_ROLL = 1.28

export const ARROW_REST_ATTITUDE = new THREE.Quaternion()
  .setFromUnitVectors(ARROW_FLAT_FACE_NORMAL, new THREE.Vector3(0, 0, 1))
  .premultiply(
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), ARROW_REST_ROLL),
  )

/**
 * Glass settings that give the plate form while it is face-on.
 *
 * Square to the camera the surface normal barely varies, so Fresnel is near
 * zero across the whole face and a tight specular finds nothing to catch: the
 * arrow reads as a flat blue silhouette exactly when it is most visible. A
 * broader Fresnel picks up the bevel around the rim, a wider and stronger
 * highlight gives the face a gradient instead of one value, and more thickness
 * and refraction put some of the scene's own structure through it.
 */
export function applyFlatArrowDefinition(uniforms: Record<string, { value: unknown }>) {
  uniforms.uThickness.value = 1.7
  uniforms.uRefractStrength.value = 0.24
  uniforms.uRimPower.value = 1.7
  uniforms.uRimStrength.value = 1.15
  uniforms.uSpecPower.value = 22
  uniforms.uSpecStrength.value = 1.5
}

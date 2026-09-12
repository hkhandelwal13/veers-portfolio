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

/**
 * The axis that cuts the arrow into two halves, once it is facing the camera.
 *
 * Derived from the mesh rather than typed in: it is the principal axis of the
 * geometry — the direction the vertices spread furthest along, which for a
 * shape with one axis of symmetry is that axis — rotated into the resting
 * attitude and flattened into the screen plane.
 *
 * Spinning about this rather than about world Y is the difference between the
 * arrow turning like a page and turning like a propeller: world Y cuts it
 * across the middle regardless of which way it happens to be pointing, so the
 * two halves swap sides. About its own axis the silhouette stays put and the
 * faces roll over.
 *
 * Power iteration on the covariance is enough here — one dominant axis, and a
 * mesh of a few tens of thousands of vertices converges in a handful of steps.
 */
export function computeArrowSpinAxis(geometry: THREE.BufferGeometry): THREE.Vector3 {
  const position = geometry.attributes.position
  const count = position.count

  const mean = new THREE.Vector3()
  const point = new THREE.Vector3()
  for (let i = 0; i < count; i++) mean.add(point.fromBufferAttribute(position, i))
  mean.divideScalar(Math.max(count, 1))

  // Covariance, accumulated as its six unique terms.
  let xx = 0, xy = 0, xz = 0, yy = 0, yz = 0, zz = 0
  for (let i = 0; i < count; i++) {
    point.fromBufferAttribute(position, i).sub(mean)
    xx += point.x * point.x
    xy += point.x * point.y
    xz += point.x * point.z
    yy += point.y * point.y
    yz += point.y * point.z
    zz += point.z * point.z
  }

  const axis = new THREE.Vector3(1, 1, 1).normalize()
  const next = new THREE.Vector3()
  for (let step = 0; step < 32; step++) {
    next.set(
      xx * axis.x + xy * axis.y + xz * axis.z,
      xy * axis.x + yy * axis.y + yz * axis.z,
      xz * axis.x + yz * axis.y + zz * axis.z,
    )
    if (next.lengthSq() < 1e-12) break
    axis.copy(next.normalize())
  }

  // Into the resting attitude, then flattened: the arrow is face-on there, so
  // its axis of symmetry lies in the screen plane and the small Z component
  // left over is the plate's own thickness.
  axis.applyQuaternion(ARROW_REST_ATTITUDE)
  axis.z = 0
  return axis.lengthSq() < 1e-8 ? new THREE.Vector3(1, 0, 0) : axis.normalize()
}

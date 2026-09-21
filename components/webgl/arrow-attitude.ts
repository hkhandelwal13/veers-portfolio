import * as THREE from 'three'

/**
 * The arrow model's resting orientation, shared by the hero and the finale.
 *
 * Every number here is measured off the geometry rather than typed in. An
 * earlier version carried a hand-measured face normal and a hand-picked roll,
 * with a comment warning that two copies of them were two things to get wrong
 * the next time the model was re-exported — and that is exactly what happened:
 * the plate that used to be authored on a diagonal was replaced by one already
 * square to the camera and already pointing where it should, and both constants
 * became wrong in the same commit.
 *
 * So the file derives what it used to declare. Given any extruded plate it
 * finds the face, squares it to a camera looking down -Z, and rolls it until it
 * points up and to the left. Shared because both places need the arrow to START
 * flat — the hero's spins up from it, the finale's returns to it.
 */

/** Which way it points when flat: up, and to the left. */
const REST_DIRECTION = new THREE.Vector2(-1, 1).normalize()

export type ArrowAttitude = {
  /** Squares the plate to the camera and aims it. Fixed; not per frame. */
  rest: THREE.Quaternion
  /** The axis it turns about, in the screen plane once `rest` is applied. */
  spinAxis: THREE.Vector3
  /** The point that axis runs through, in the geometry's own space. */
  pivot: THREE.Vector3
}

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
 * The point the arrow's axis of symmetry passes through, in model space.
 *
 * The mean of the vertices, not the centre of the bounding box. For a shape
 * like this one — a broad head and a long tail — those are different points,
 * and the box centre sits off the axis. Spinning about an axis that misses the
 * shape is what makes a turn read as orbiting a corner rather than rolling in
 * place, however right the axis direction is. So the same point that the axis
 * is derived through is the point it has to be applied through.
 */
export function computeArrowCentroid(geometry: THREE.BufferGeometry): THREE.Vector3 {
  const position = geometry.attributes.position
  const mean = new THREE.Vector3()
  const point = new THREE.Vector3()
  for (let i = 0; i < position.count; i++) mean.add(point.fromBufferAttribute(position, i))
  return mean.divideScalar(Math.max(position.count, 1))
}

/** Dominant eigenvector of a symmetric 3x3, by power iteration. */
function dominantAxis(m: number[][]): THREE.Vector3 {
  const axis = new THREE.Vector3(1, 1, 1).normalize()
  const next = new THREE.Vector3()
  for (let step = 0; step < 48; step++) {
    next.set(
      m[0][0] * axis.x + m[0][1] * axis.y + m[0][2] * axis.z,
      m[1][0] * axis.x + m[1][1] * axis.y + m[1][2] * axis.z,
      m[2][0] * axis.x + m[2][1] * axis.y + m[2][2] * axis.z,
    )
    if (next.lengthSq() < 1e-12) break
    axis.copy(next.normalize())
  }
  return axis
}

/**
 * The plate's face normal, its long axis, its tip, and its centre.
 *
 * All four come out of one pass over the vertices.
 *
 * The face normal is the direction the vertices spread *least* along — for an
 * extruded plate that is its thickness, and the two broad faces share it.
 * Averaging the mesh's own normals would not do: the front and back of a plate
 * point opposite ways in equal measure and cancel to nothing. Power iteration
 * finds the largest eigenvector, so the smallest is found by running the same
 * iteration on trace*I - C, which reverses the order of the spectrum.
 *
 * The long axis is the largest eigenvector of the same matrix, which for a
 * shape with one axis of symmetry is that axis. The tip is simply the vertex
 * furthest from the centre; on an arrow that is the point, which is what says
 * which end of the long axis is the front.
 */
function measurePlate(geometry: THREE.BufferGeometry) {
  const position = geometry.attributes.position
  const count = position.count
  const mean = computeArrowCentroid(geometry)
  const point = new THREE.Vector3()

  // Covariance, accumulated as its six unique terms.
  let xx = 0, xy = 0, xz = 0, yy = 0, yz = 0, zz = 0
  let tip = new THREE.Vector3()
  let furthest = -1

  for (let i = 0; i < count; i++) {
    point.fromBufferAttribute(position, i).sub(mean)
    xx += point.x * point.x
    xy += point.x * point.y
    xz += point.x * point.z
    yy += point.y * point.y
    yz += point.y * point.z
    zz += point.z * point.z

    const distance = point.lengthSq()
    if (distance > furthest) {
      furthest = distance
      tip = point.clone()
    }
  }

  const covariance = [
    [xx, xy, xz],
    [xy, yy, yz],
    [xz, yz, zz],
  ]
  const trace = xx + yy + zz
  const inverted = [
    [trace - xx, -xy, -xz],
    [-xy, trace - yy, -yz],
    [-xz, -yz, trace - zz],
  ]

  const normal = dominantAxis(inverted)
  const long = dominantAxis(covariance)

  // Power iteration's sign is arbitrary. Pin both, so the same model always
  // lands the same way up rather than flipping between reloads: the face
  // toward the viewer, and the long axis running from tail to tip.
  if (normal.z < 0) normal.negate()
  if (long.dot(tip) < 0) long.negate()

  return { centre: mean, normal, long, tip }
}

/**
 * How the arrow rests, what it turns about, and where it turns.
 *
 * `rest` is the shortest rotation that squares the plate's face to a camera
 * looking down -Z, followed by whatever roll leaves the tip pointing up and to
 * the left. On a model already authored that way — the current one — both parts
 * come out near identity, which is the point: the constant is in the geometry.
 *
 * `spinAxis` is the long axis carried into that attitude and flattened into the
 * screen plane, where the leftover Z is just the plate's thickness. Spinning
 * about this rather than about world Y is the difference between the arrow
 * turning like a page and turning like a propeller: world Y cuts it across the
 * middle regardless of which way it happens to be pointing, so the two halves
 * swap sides. About its own axis the silhouette stays put and the faces roll.
 */
export function computeArrowAttitude(geometry: THREE.BufferGeometry): ArrowAttitude {
  const { centre, normal, long, tip } = measurePlate(geometry)

  const faceOn = new THREE.Quaternion().setFromUnitVectors(normal, new THREE.Vector3(0, 0, 1))

  // Where the tip lands once the face is square, and how far that is from
  // where it should be. Measured in the screen plane, which is where "up and
  // to the left" means anything.
  const aimed = tip.clone().applyQuaternion(faceOn)
  const roll =
    Math.atan2(REST_DIRECTION.y, REST_DIRECTION.x) - Math.atan2(aimed.y, aimed.x)

  const rest = new THREE.Quaternion()
    .setFromAxisAngle(new THREE.Vector3(0, 0, 1), roll)
    .multiply(faceOn)

  const spinAxis = long.clone().applyQuaternion(rest)
  spinAxis.z = 0

  return {
    rest,
    spinAxis: spinAxis.lengthSq() < 1e-8 ? new THREE.Vector3(1, 0, 0) : spinAxis.normalize(),
    pivot: centre,
  }
}

import * as THREE from 'three'
import { mergeBufferGeometries } from 'three-stdlib'

/**
 * One geometry for a whole GLB, with every node's transform already in it.
 *
 * Read off the loaded scene rather than from a hard-coded node name and a pair
 * of transcribed constants. Every model here has been re-exported more than
 * once, and each export changed both: `hello` arrived first as a single node
 * called `g_groupNumber_0_n3d` carrying a position and a uniform scale, then as
 * a `Path_3` five levels down a chain of matrices; `contact` arrived as one
 * node, then as nine, and now as twenty-five under a `Scene_1`. Naming any of
 * that in a component means the next export renders a fraction of the word, or
 * throws on a node that no longer exists.
 *
 * Merged rather than rendered as a mesh per node because everything downstream
 * assumes one: the layer assignment, the refraction pass's view of it, the
 * pointer-driven spin axis, and the tint gradient, which normalises against a
 * single local Y range.
 *
 * Still not Box3.setFromObject on a mounted object — that measures in world
 * space and folds in whatever scale the component has already applied, so it
 * shrinks the model a little more on every remount. Measured here, off the
 * geometry, the answer is the same whenever it is asked.
 */

export type ModelGeometry = {
  /** Position + normal, in the model's own space, transforms baked in. */
  geometry: THREE.BufferGeometry
  size: THREE.Vector3
  center: THREE.Vector3
  /**
   * Geometry-space Y range. The vertex shader sees `position` before any mesh
   * transform, so the tint gradient has to be normalised against these bounds
   * rather than against transformed ones.
   */
  localY: THREE.Vector2
}

/**
 * A plain float copy of an attribute.
 *
 * A packed model (KHR_mesh_quantization) carries its positions and normals as
 * normalized integers with the real scale on the node. Transforming one of
 * those in place truncates every coordinate to a whole number — the word
 * collapses into a row of flat slabs, which is a convincing enough shape to
 * look like a loading bug rather than a rounding one. getX/getY/getZ
 * denormalize, so this reads the values the file actually means and writes
 * them somewhere that can hold them.
 */
function toFloatAttribute(
  attribute: THREE.BufferAttribute | THREE.InterleavedBufferAttribute,
): THREE.BufferAttribute {
  const { count, itemSize } = attribute
  const values = new Float32Array(count * itemSize)
  for (let i = 0; i < count; i++) {
    const at = i * itemSize
    values[at] = attribute.getX(i)
    if (itemSize > 1) values[at + 1] = attribute.getY(i)
    if (itemSize > 2) values[at + 2] = attribute.getZ(i)
  }
  return new THREE.BufferAttribute(values, itemSize)
}

export function flattenModel(scene: THREE.Object3D, label: string): ModelGeometry {
  const parts: THREE.BufferGeometry[] = []

  scene.traverse((object) => {
    const mesh = object as THREE.Mesh
    if (!mesh.isMesh) return

    // Only position and normal: that is all the glass shader reads, and merging
    // requires every part to carry the same attributes — an export with UVs on
    // some meshes and not others fails outright.
    const part = new THREE.BufferGeometry()
    part.setAttribute('position', toFloatAttribute(mesh.geometry.attributes.position))
    if (mesh.geometry.attributes.normal) {
      part.setAttribute('normal', toFloatAttribute(mesh.geometry.attributes.normal))
    }
    if (mesh.geometry.index) part.setIndex(mesh.geometry.index.clone())

    // Recomputed from the ancestors at this moment, so it is the transform
    // inside the GLB and not whatever the cached scene was last mounted under.
    mesh.updateWorldMatrix(true, false)
    part.applyMatrix4(mesh.matrixWorld)
    parts.push(part)
  })

  const geometry = parts.length === 1 ? parts[0] : mergeBufferGeometries(parts, false)
  if (parts.length > 1) for (const part of parts) part.dispose()
  if (!geometry) throw new Error(`${label}: no mesh to render`)

  geometry.computeBoundingBox()
  const box = geometry.boundingBox!
  return {
    geometry,
    size: box.getSize(new THREE.Vector3()),
    center: box.getCenter(new THREE.Vector3()),
    localY: new THREE.Vector2(box.min.y, box.max.y),
  }
}

import { Matrix4, Ray, Raycaster, Vector2, Vector3, type Camera, type Intersection, type Object3D, type Points } from "three";

/**
 * Raycasting for point clouds whose points are drawn a few pixels wide.
 *
 * three.js tests points against a threshold in world units, which is wrong
 * for sprites whose on-screen size doesn't depend on distance. Here the test
 * is angular: a point is hit when the angle between the ray and the direction
 * to the point is within that point's own pick radius (in pixels, converted
 * with the camera's pixels-per-radian). One pass, no allocation except for
 * hits, and every hit carries `index` — the point's position in the buffer —
 * so callers map it straight to their metadata.
 */

export interface AngularHit extends Intersection {
  index: number;
  /** Angular distance from the ray, in screen pixels. */
  pixels: number;
}

export interface AngularRaycastOptions {
  /** Flat xyz array in the object's local space. */
  positions: () => Float32Array | null;
  /** Largest pick radius any point can have (px); a cheap first cut. */
  maxRadiusPx: number;
  /** Per-point pick radius in px, or ≤ 0 to skip the point (e.g. too faint to see). `distance` is from the ray origin, in local units. */
  radiusPx?: (index: number, distance: number) => number;
}

/** Screen pixels per radian at the centre of the view, stashed on the raycaster by `rayFromScreen`. */
const PX_PER_RAD = "pxPerRad";

const local = new Ray();
const inverse = new Matrix4();

export function angularRaycast(opts: AngularRaycastOptions): Object3D["raycast"] {
  return function (this: Points, raycaster: Raycaster, intersects: Intersection[]) {
    const positions = opts.positions();
    if (!positions) return;
    const pxPerRad = (raycaster.params as unknown as Record<string, number>)[PX_PER_RAD] ?? 1000;
    inverse.copy(this.matrixWorld).invert();
    local.copy(raycaster.ray).applyMatrix4(inverse);
    const { origin: o, direction: d } = local;
    d.normalize();
    // Compare squared tangents so the loop needs no trig or square roots.
    const maxTan = Math.tan(opts.maxRadiusPx / pxPerRad);
    const maxTan2 = maxTan * maxTan;
    const n = positions.length / 3;
    for (let i = 0; i < n; i++) {
      const vx = positions[i * 3] - o.x;
      const vy = positions[i * 3 + 1] - o.y;
      const vz = positions[i * 3 + 2] - o.z;
      const t = vx * d.x + vy * d.y + vz * d.z;
      if (t <= 0) continue;
      const len2 = vx * vx + vy * vy + vz * vz;
      const perp2 = Math.max(len2 - t * t, 0);
      if (perp2 > maxTan2 * t * t) continue;
      const pixels = Math.atan(Math.sqrt(perp2) / t) * pxPerRad;
      const dist = Math.sqrt(len2);
      if (opts.radiusPx) {
        const r = opts.radiusPx(i, dist);
        if (r <= 0 || pixels > r) continue;
      }
      const point = new Vector3(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]).applyMatrix4(this.matrixWorld);
      intersects.push({ distance: dist, distanceToRay: Math.sqrt(perp2), point, index: i, object: this, pixels } as AngularHit);
    }
  };
}

const ndc = new Vector2();

/** Aim a raycaster through a canvas pixel and record the pixels-per-radian the angular test needs. */
export function rayFromScreen(raycaster: Raycaster, camera: Camera & { fov?: number }, x: number, y: number, width: number, height: number) {
  ndc.set((x / width) * 2 - 1, -(y / height) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const fov = ((camera.fov ?? 50) * Math.PI) / 180;
  (raycaster.params as unknown as Record<string, number>)[PX_PER_RAD] = height / 2 / Math.tan(fov / 2);
}

import { Vector3, type Camera } from "three";

const v = new Vector3();

/** World point → CSS pixel position. Returns false when behind the camera or far off-screen. */
export function projectToScreen(
  p: Vector3,
  camera: Camera,
  width: number,
  height: number,
  out: { x: number; y: number },
  margin = 60,
): boolean {
  v.copy(p).project(camera);
  if (v.z > 1 || v.z < -1) return false;
  out.x = (v.x * 0.5 + 0.5) * width;
  out.y = (-v.y * 0.5 + 0.5) * height;
  return out.x > -margin && out.x < width + margin && out.y > -margin && out.y < height + margin;
}

/**
 * Shared per-point shimmer for star and galaxy point clouds, entirely in the
 * vertex shader (no per-star CPU work). Each point hashes its index into its
 * own seeds, so nothing pulses in step:
 *
 * - ~15% are perfectly steady,
 * - ~73% vary subtly (a few percent, slowly),
 * - ~12% vary more strongly, with an occasional slow swell.
 *
 * It is a visual effect only: catalogue brightness and colour are unchanged
 * on average (the modulation is centred on 1).
 *
 * `shimmer(id, time, strength)` returns a brightness factor; use its square
 * root for a matching size factor.
 */
export const shimmerChunk = /* glsl */ `
float shimmerHash(uint n) {
  n = (n << 13u) ^ n;
  n = n * (n * n * 15731u + 789221u) + 1376312589u;
  return float(n & 0x7fffffffu) / 2147483647.0;
}
float shimmer(uint id, float t, float strength) {
  float a = shimmerHash(id * 3u + 101u);
  if (a < 0.15 || strength <= 0.0) return 1.0;
  float b = shimmerHash(id * 3u + 211u);
  float c = shimmerHash(id * 3u + 307u);
  bool strong = a > 0.88;
  float amp = strong ? 0.32 : 0.06;
  float w = sin(t * (0.35 + 1.4 * b) + c * 6.2832) * 0.65 + sin(t * (1.7 + 2.3 * c) + b * 6.2832) * 0.35;
  float swell = strong ? pow(0.5 + 0.5 * sin(t * (0.12 + 0.2 * b) + a * 40.0), 6.0) * 0.4 : 0.0;
  return max(1.0 + strength * (amp * w + swell - swell * 0.3), 0.2);
}
`;

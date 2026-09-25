import { buildModelledUniverse } from "./modelledUniverse";

/** Builds the modelled universe off the main thread; buffers are transferred, not copied. */
self.onmessage = (e: MessageEvent<{ count: number }>) => {
  const u = buildModelledUniverse(e.data.count);
  (self as unknown as Worker).postMessage(u, [u.positions.buffer, u.luminosity.buffer, u.diameter.buffer, u.props.buffer]);
};

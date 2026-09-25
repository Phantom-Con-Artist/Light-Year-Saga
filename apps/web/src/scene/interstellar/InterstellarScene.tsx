import { useCallback, useMemo } from "react";
import { OrbitControls } from "@react-three/drei";
import { Vector3 } from "three";
import { useStarStore, type StarCatalog } from "../../data/stars";
import { CATALOG, getCatalogObject, type CatalogObject } from "../../data/catalog";
import { selectObject } from "../../state/selectionStore";
import { useViewStore } from "../../state/viewStore";
import { DIFFUSE_SOURCES, SkyDome } from "../Backdrop";
import { StarField } from "./StarField";
import { StarOverlay } from "./StarOverlay";
import { Galaxy } from "./Galaxy";
import { diffuseSkyOpacity, smoothstep } from "./visibility";
import { FlightRig, type RigTarget } from "../common/FlightRig";
import { CatalogLayer } from "../common/CatalogLayer";
import { GalaxyDisks } from "../common/GalaxyDisks";
import { GalaxyClouds } from "../common/GalaxyClouds";
import { useGraphicsStore } from "../../state/graphicsStore";
import { SkyPhotos } from "../common/SkyPhotos";
import { useScreenPicking } from "../common/picking";

const ORIGIN = new Vector3();
const HOME_LY = 60;
const MIN_LY = 0.015;
const MAX_LY = 400_000;
const STAR_FRAMING_LY = 3;

const OBJECTS = CATALOG.filter((o) => o.level === "interstellar" && o.id !== "milky-way");
const NEBULAE = OBJECTS.filter((o) => o.kind === "nebula");
/** Satellite galaxies close enough to appear in light-year space. */
const SATELLITES = CATALOG.filter((o) => o.id === "lmc" || o.id === "smc");
const MARKER_KINDS: CatalogObject["kind"][] = ["black-hole", "star", "stellar-remnant", "exo-system"];

const labelRange = (o: CatalogObject) => (o.kind === "nebula" ? Math.max(o.extent * 70, 2_500) : Math.max(o.framing * 300, 1_200));
/** Curated markers belong to the neighbourhood view; fade them at galactic scale. */
const layerOpacity = (p: Vector3) => 1 - smoothstep(40_000, 90_000, p.length());
const satelliteGain = (p: Vector3) => smoothstep(8_000, 40_000, p.length());

function Picking() {
  useScreenPicking(selectObject);
  return null;
}

function Rig({ catalog }: { catalog: StarCatalog | null }) {
  const fromCosmic = useViewStore.getState().fromLevel === "cosmic";
  const milkyWay = getCatalogObject("milky-way")!;

  const home = useMemo<RigTarget>(() => ({ position: () => ORIGIN, distance: HOME_LY, minDistance: MIN_LY }), []);
  const resolve = useCallback(
    (id: string): RigTarget | null => {
      if (id === "sun") return { position: () => ORIGIN, distance: 1.5, minDistance: MIN_LY };
      const c = getCatalogObject(id);
      if (c && c.level === "interstellar") return { position: () => c.position, distance: c.framing, direction: c.viewDirection };
      const i = catalog?.indexById.get(id);
      if (i === undefined || !catalog) return null;
      const p = new Vector3(catalog.positions[i * 3], catalog.positions[i * 3 + 1], catalog.positions[i * 3 + 2]);
      return { position: () => p, distance: STAR_FRAMING_LY };
    },
    [catalog],
  );

  return (
    <FlightRig
      resolve={resolve}
      home={home}
      entry={
        fromCosmic
          ? { fromDistance: MAX_LY, target: { position: () => milkyWay.position, distance: milkyWay.framing, direction: milkyWay.viewDirection } }
          : { fromDistance: 0.02, target: { position: () => ORIGIN, distance: 32, minDistance: MIN_LY } }
      }
      clip={() => [1e-4, 3e6]}
      edgeIn={{
        atEdge: (d, target) => target.lengthSq() < 1e-6 && d <= MIN_LY * 1.1,
        onTrigger: (dir) => {
          selectObject(null);
          useViewStore.getState().goTo("system", { direction: dir });
        },
      }}
      edgeOut={{
        atEdge: (d) => d >= MAX_LY * 0.97,
        onTrigger: (dir) => {
          selectObject(null);
          useViewStore.getState().goTo("cosmic", { direction: dir });
        },
      }}
      onDistance={(camera) => useViewStore.getState().setCameraDistance(camera.position.length())}
    />
  );
}

/**
 * Light-year scale, Sun at the origin: 42k real stars (HYG), curated nebulae,
 * black holes, extreme stars and exoplanet systems, inside a Milky Way model.
 */
export function InterstellarScene() {
  const catalog = useStarStore((s) => s.catalog);
  const pointClouds = useGraphicsStore((g) => g.pointClouds);

  return (
    <>
      <SkyDome
        sources={DIFFUSE_SOURCES}
        gain={0.5}
        blackLevel={0.05}
        blur={6}
        opacity={(camera) => diffuseSkyOpacity(camera.position.length())}
      />
      <Galaxy />
      {pointClouds ? (
        <GalaxyClouds objects={SATELLITES} unitScale={1e6} gain={satelliteGain} />
      ) : (
        <GalaxyDisks objects={SATELLITES} unitScale={1e6} gain={satelliteGain} />
      )}
      <SkyPhotos objects={SATELLITES} unitScale={1e6} mode="sky" gain={satelliteGain} />
      <SkyPhotos objects={NEBULAE} mode="billboard" />
      {catalog && (
        <>
          <StarField catalog={catalog} />
          <StarOverlay catalog={catalog} />
        </>
      )}
      <CatalogLayer objects={OBJECTS} labelRange={labelRange} markerKinds={MARKER_KINDS} opacity={layerOpacity} />
      <Picking />
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.07}
        rotateSpeed={0.5}
        zoomSpeed={5}
        panSpeed={0.6}
        minDistance={MIN_LY}
        maxDistance={MAX_LY}
      />
      <Rig catalog={catalog} />
    </>
  );
}

import type { ExternalSource } from "../../domain/types";

/**
 * Real telescope photographs, placed in 3D from each image's own astrometry
 * (Astronomy Visualization Metadata published with the release): the image
 * centre, its field of view and which way north points. At the object's
 * distance that gives the photo's true physical size and orientation as seen
 * from Earth.
 */
export interface SkyPhoto {
  /** Public path of the (downsized) image. */
  file: string;
  /** Image centre, J2000. */
  ra: string;
  dec: string;
  /** Field of view, width × height in arcminutes. */
  fovArcmin: [number, number];
  /** Where north points: degrees counter-clockwise from image-up ("left of vertical"). */
  northDeg: number;
  telescope: string;
  credit: string;
  release: ExternalSource;
  /**
   * Pixel (u, v from top) that sits on the object’s catalogue position — for
   * releases whose listed coordinates are a reference pixel, not the centre.
   */
  anchor?: [u: number, v: number];
  /** Frame-filling images need a wider soft edge so the rectangle never shows. */
  edge?: "tight" | "soft";
  /** Linear-light level treated as black (hides sky background / noise). */
  black?: number;
  gain?: number;
}

const hubble = (id: string) => `https://esahubble.org/images/${id}/`;
const webb = (id: string) => `https://esawebb.org/images/${id}/`;
const eso = (id: string) => `https://www.eso.org/public/images/${id}/`;
const noirlab = (id: string) => `https://noirlab.edu/public/images/${id}/`;

function photo(
  objectId: string,
  release: string,
  url: string,
  o: Omit<SkyPhoto, "file" | "release">,
): [string, SkyPhoto] {
  return [
    objectId,
    {
      ...o,
      file: `/textures/deep/${objectId}.jpg`,
      release: { provider: o.telescope, name: `Photo ${release}`, url, freshness: "STATIC" },
    },
  ];
}

// "Right of vertical" in the release metadata is a negative angle here.
export const PHOTOS: Record<string, SkyPhoto> = Object.fromEntries([
  /* ------------------------------------------------------------ nebulae */
  photo("orion-nebula", "eso1723a", eso("eso1723a"), {
    ra: "05h35m08.26s", dec: "-05°28′43.3″", fovArcmin: [59.95, 46.56], northDeg: 0.2,
    telescope: "ESO VLT Survey Telescope", credit: "ESO/G. Beccari", edge: "soft",
  }),
  photo("horsehead-nebula", "eso0202a", eso("eso0202a"), {
    ra: "05h40m58.99s", dec: "-02°27′29.6″", fovArcmin: [6.53, 6.72], northDeg: 89.9,
    telescope: "ESO Very Large Telescope", credit: "ESO", edge: "soft", gain: 0.85,
  }),
  photo("eagle-nebula", "eso0926a", eso("eso0926a"), {
    ra: "18h18m48.01s", dec: "-13°49′11.8″", fovArcmin: [32.08, 32.08], northDeg: 0,
    telescope: "ESO MPG/ESO 2.2 m telescope", credit: "ESO", edge: "soft",
  }),
  photo("pillars-of-creation", "heic1501a", hubble("heic1501a"), {
    ra: "18h18m52.72s", dec: "-13°50′22.0″", fovArcmin: [4.53, 4.72], northDeg: 35,
    telescope: "Hubble Space Telescope", credit: "NASA, ESA/Hubble and the Hubble Heritage Team", edge: "soft",
  }),
  photo("lagoon-nebula", "eso0936a", eso("eso0936a"), {
    ra: "18h03m36.99s", dec: "-24°23′13.0″", fovArcmin: [93.49, 62.61], northDeg: 0,
    telescope: "ESO MPG/ESO 2.2 m telescope", credit: "ESO", edge: "soft", black: 0.012,
  }),
  photo("carina-nebula", "eso1250a", eso("eso1250a"), {
    ra: "10h45m05.70s", dec: "-59°51′47.7″", fovArcmin: [61.82, 66.34], northDeg: 0,
    telescope: "ESO VLT Survey Telescope", credit: "ESO. Acknowledgement: VPHAS+ Consortium/Cambridge Astronomical Survey Unit", edge: "soft",
  }),
  photo("crab-nebula", "heic0515a", hubble("heic0515a"), {
    ra: "05h34m32.53s", dec: "+22°00′54.9″", fovArcmin: [6.41, 6.41], northDeg: 0,
    telescope: "Hubble Space Telescope", credit: "NASA, ESA and Allison Loll/Jeff Hester (Arizona State University). Acknowledgement: Davide De Martin (ESA/Hubble)",
  }),
  photo("ring-nebula", "heic1310a", hubble("heic1310a"), {
    ra: "18h53m35.21s", dec: "+33°01′44.1″", fovArcmin: [2.1, 2.1], northDeg: 11.7,
    telescope: "Hubble Space Telescope", credit: "NASA, ESA, and C. Robert O'Dell (Vanderbilt University)",
  }),
  photo("helix-nebula", "eso0907a", eso("eso0907a"), {
    ra: "22h29m38.57s", dec: "-20°50′13.8″", fovArcmin: [28.02, 25.94], northDeg: 0.1,
    telescope: "ESO MPG/ESO 2.2 m telescope", credit: "ESO",
  }),
  // The release gives no astrometry; the frame spans ~340 ly at the LMC's distance.
  photo("tarantula-nebula", "weic2212a", webb("weic2212a"), {
    ra: "05h38m47.61s", dec: "-69°06′03″", fovArcmin: [7.26, 4.19], northDeg: 0,
    telescope: "James Webb Space Telescope", credit: "NASA, ESA, CSA, and STScI", edge: "soft",
  }),

  /* ----------------------------------------------------------- galaxies */
  photo("andromeda", "noao-m31fsqblock", noirlab("noao-m31fsqblock"), {
    ra: "00h39m43.83s", dec: "+40°24′44.0″", fovArcmin: [162.24, 58.9], northDeg: -120.3,
    telescope: "Kitt Peak National Observatory", credit: "KPNO/NOIRLab/NSF/AURA/Adam Block", black: 0.01, anchor: [0.504, 0.444],
  }),
  photo("triangulum", "noao-m33_opt", noirlab("noao-m33_opt"), {
    ra: "01h32m14.15s", dec: "+30°48′01.7″", fovArcmin: [57.4, 58.55], northDeg: -0.2,
    telescope: "Kitt Peak National Observatory", credit: "T.A. Rector (NRAO/AUI/NSF and NOIRLab/NSF/AURA) and M. Hanna (NOIRLab/NSF/AURA)", black: 0.01, anchor: [0.506, 0.514],
  }),
  photo("smc", "iotw2615a", noirlab("iotw2615a"), {
    ra: "00h53m10.91s", dec: "-72°47′46.4″", fovArcmin: [556.75, 371.11], northDeg: 133.5,
    telescope: "Wide-field camera, Cerro Pachón", credit: "NOIRLab/NSF/AURA/P. Horálek (Institute of Physics in Opava)", black: 0.015,
  }),
  photo("m81", "heic0710a", hubble("heic0710a"), {
    ra: "09h55m33.86s", dec: "+69°04′20.1″", fovArcmin: [18.85, 12.67], northDeg: 114,
    telescope: "Hubble Space Telescope", credit: "NASA, ESA and the Hubble Heritage Team (STScI/AURA). Acknowledgment: A. Zezas and J. Huchra (Harvard-Smithsonian Center for Astrophysics)",
  }),
  photo("m82", "heic0604a", hubble("heic0604a"), {
    ra: "09h55m55.00s", dec: "+69°40′54.2″", fovArcmin: [7.91, 6.17], northDeg: 50.1,
    telescope: "Hubble Space Telescope", credit: "NASA, ESA and the Hubble Heritage Team (STScI/AURA)",
  }),
  photo("centaurus-a", "eso0903a", eso("eso0903a"), {
    ra: "13h25m27.70s", dec: "-43°01′09.6″", fovArcmin: [22.71, 23.92], northDeg: 0,
    telescope: "ESO, APEX and Chandra (composite)", credit: "ESO/WFI (optical); MPIfR/ESO/APEX/A. Weiss et al. (submillimetre); NASA/CXC/CfA/R. Kraft et al. (X-ray)",
  }),
  photo("pinwheel", "heic0602a", hubble("heic0602a"), {
    ra: "14h03m34.71s", dec: "+54°18′03.7″", fovArcmin: [13.2, 10.32], northDeg: -3.5,
    telescope: "Hubble Space Telescope", credit: "European Space Agency & NASA", edge: "soft",
  }),
  photo("whirlpool", "heic0506a", hubble("heic0506a"), {
    ra: "13h29m52.34s", dec: "+47°12′47.4″", fovArcmin: [9.56, 6.64], northDeg: -91.9,
    telescope: "Hubble Space Telescope", credit: "NASA, ESA, S. Beckwith (STScI), and the Hubble Heritage Team (STScI/AURA)", edge: "soft",
  }),
  photo("sombrero", "opo0328a", hubble("opo0328a"), {
    ra: "12h39m59.29s", dec: "-11°37′21.9″", fovArcmin: [9.57, 5.36], northDeg: -5,
    telescope: "Hubble Space Telescope", credit: "NASA/ESA and the Hubble Heritage Team (STScI/AURA)",
  }),
  photo("m87", "eso1907b", eso("eso1907b"), {
    ra: "12h30m49.29s", dec: "+12°23′29.4″", fovArcmin: [6.92, 7.0], northDeg: 0,
    telescope: "ESO Very Large Telescope", credit: "ESO", black: 0.008,
  }),
  photo("ngc-1300", "opo0501a", hubble("opo0501a"), {
    ra: "03h19m40.62s", dec: "-19°24′43.4″", fovArcmin: [5.54, 3.16], northDeg: -29.9,
    telescope: "Hubble Space Telescope", credit: "NASA, ESA, and the Hubble Heritage Team (STScI/AURA)",
  }),
  photo("antennae", "heic0615a", hubble("heic0615a"), {
    ra: "12h01m52.88s", dec: "-18°52′49.8″", fovArcmin: [3.27, 3.25], northDeg: -30.6,
    telescope: "Hubble Space Telescope", credit: "NASA, ESA, and the Hubble Heritage Team (STScI/AURA)-ESA/Hubble Collaboration",
  }),
  photo("cartwheel", "weic2211a", webb("weic2211a"), {
    ra: "00h37m41.57s", dec: "-33°42′47.0″", fovArcmin: [2.34, 2.16], northDeg: 28,
    telescope: "James Webb Space Telescope", credit: "NASA, ESA, CSA, STScI",
  }),
  photo("hoags-object", "opo0221a", hubble("opo0221a"), {
    ra: "15h17m14.54s", dec: "+21°35′08.2″", fovArcmin: [1.26, 1.23], northDeg: 19.3,
    telescope: "Hubble Space Telescope", credit: "NASA/ESA and the Hubble Heritage Team (STScI/AURA)",
  }),
]);

/** Physical size of a photo's frame (width, height) at a distance, in the same units. */
export function photoSize(p: SkyPhoto, distance: number): [number, number] {
  const k = (Math.PI / 180 / 60) * distance;
  return [p.fovArcmin[0] * k, p.fovArcmin[1] * k];
}

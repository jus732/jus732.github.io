/**
 * Ship/weapon definitions: base fire pattern and stats per selectable
 * ship. The engine turns these into pooled bullets; in-run upgrades and
 * meta upgrades multiply on top. Unlocks are bought with cores (meta.ts).
 */

export type ShipId = "vanguard" | "spread" | "lance" | "orbit";

export type ShipDef = {
  id: ShipId;
  name: string;
  tagline: string;
  color: string;
  /** Cores to unlock; 0 = starter ship. */
  cost: number;
  /** Seconds between volleys. */
  cooldown: number;
  damage: number;
  bulletSpeed: number;
  bulletRadius: number;
  /** Enemies a bullet passes through before expiring. */
  pierce: number;
  /** Angle offsets (radians) of each bullet in a volley. */
  spreadAngles: number[];
  /** Random aim wobble in radians. */
  jitter: number;
  /** Orbiting auto-fire drones the ship starts with. */
  drones: number;
};

export const SHIPS: Record<ShipId, ShipDef> = {
  vanguard: {
    id: "vanguard",
    name: "Vanguard",
    tagline: "Rapid single stream. Reliable.",
    color: "#7df9ff",
    cost: 0,
    cooldown: 0.11,
    damage: 1,
    bulletSpeed: 620,
    bulletRadius: 2.5,
    pierce: 0,
    spreadAngles: [0],
    jitter: 0.02,
    drones: 0,
  },
  spread: {
    id: "spread",
    name: "Spread",
    tagline: "Five-bolt shotgun fan. Crowd control.",
    color: "#ffd166",
    cost: 300,
    cooldown: 0.34,
    damage: 0.8,
    bulletSpeed: 540,
    bulletRadius: 2.5,
    pierce: 0,
    spreadAngles: [-0.22, -0.11, 0, 0.11, 0.22],
    jitter: 0.03,
    drones: 0,
  },
  lance: {
    id: "lance",
    name: "Lance",
    tagline: "Slow, piercing rail bolts. Line them up.",
    color: "#c39bff",
    cost: 800,
    cooldown: 0.5,
    damage: 3.2,
    bulletSpeed: 780,
    bulletRadius: 3.5,
    pierce: 3,
    spreadAngles: [0],
    jitter: 0,
    drones: 0,
  },
  orbit: {
    id: "orbit",
    name: "Orbit",
    tagline: "Weak main gun, two hunting drones.",
    color: "#7dffb5",
    cost: 1500,
    cooldown: 0.16,
    damage: 0.7,
    bulletSpeed: 600,
    bulletRadius: 2,
    pierce: 0,
    spreadAngles: [0],
    jitter: 0.04,
    drones: 2,
  },
};

export const SHIP_ORDER: ShipId[] = ["vanguard", "spread", "lance", "orbit"];

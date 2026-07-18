export const CONFIG = Object.freeze({
  WORLD: {
    HALF_SIZE: 51.25,
    STREAM_BLOCK_HALF_WIDTH: 3.1,
    BRIDGE_Z: 7,
    FOG_NEAR: 40,
    FOG_FAR: 112,
  },
  PLAYER: {
    EYE_HEIGHT: 1.72,
    RADIUS: .38,
    WALK_SPEED: 4.7,
    RUN_SPEED: 7.2,
    CARRY_SPEED: 2.8,
    DODGE_SPEED: 13.5,
    DODGE_TIME: .34,
    MAX_HEALTH: 3,
    INVULNERABILITY: 1.55,
    INTERACTION_DISTANCE: 3.1,
  },
  CHOP: {
    TREE_COUNT: 12,
    HITS: 4,
    FIRST_ANSWER_HITS: 2,
    SWING_DURATION: .72,
    IMPACT_TIME: .39,
    FALL_DURATION: 1.45,
    TRUNK_LINGER_SECONDS: 3,
    LOG_DISTANCE: 2.1,
    LOG_LENGTH: 4.2,
    LOG_THICKNESS: 1.45,
  },
  BUILD: {
    TOTAL_LOGS: 3,
    RADIUS: 5.5,
    FORT_RADIUS: 10.2,
    WALL_INNER_RADIUS: 9.35,
    WALL_OUTER_RADIUS: 10.95,
    MAX_HEALTH: 1000,
    REPAIR_PER_LOG: 1000,
  },
  TOWER: {
    PLATFORM_TOP: 6.21,
    RAIL_HEIGHT: .58,
    ROOF_SCALE_XZ: .68,
    ROOF_SCALE_Y: .58,
    ROOF_RAISE: .38,
  },
  FORT_BUILDINGS: {
    ROOF_SCALE_X: .76,
    ROOF_SCALE_Y: .72,
    ROOF_SCALE_Z: .95,
    ROOF_COLOR: 0x4f321f,
  },
  ATTACK: {
    START_SECONDS: 180,
    WARNING_SECONDS: 30,
    FINAL_WARNING_SECONDS: 10,
    DEV_TIME_SCALE: 15,
  },
  GOBLINS: {
    COUNT: 6,
    SPEED: 2.15,
    RADIUS: .48,
    REPATH_INTERVAL: 1.25,
    STUCK_TIME: 2.2,
    SEPARATION_RADIUS: 1.25,
    SEPARATION_FORCE: 1.4,
    ATTACK_DAMAGE: 7.2,
    ATTACK_INTERVAL: 1.4,
  },
  CATAPULTS: {
    COUNT: 3,
    HITS_TO_DESTROY: 1,
    NOTES_PER_DESTRUCTION: 1,
    MIN_FIRE_INTERVAL: 8,
    MAX_FIRE_INTERVAL: 14,
    BASE_DAMAGE: 28,
    GRAVITY: 9.81,
    PROJECTILE_RADIUS: .28,
    INWARD_OFFSET: 4.25,
    PLAYER_THROW_SPEED: 24.5,
    CLEAR_RADIUS: 4.2,
    HIT_RADIUS: 2.1,
    COLLISION_RADIUS: 2.05,
    NOTE_DROP_CLEARANCE: .45,
    PATROL_DISTANCE: 2.2,
    PATROL_ANGULAR_SPEED: .36,
    REINFORCEMENT_ARRIVAL_DISTANCE: 6.5,
    REINFORCEMENT_ANGLE_OFFSET: .16,
    REINFORCEMENT_RADIAL_OFFSET: 5.5,
    CORRIDOR_HALF_WIDTH: 3.6,
    CORRIDOR_TREE_OFFSET: 7,
  },
  NOTES: {
    TOTAL: 6,
    PER_MATCH: 3,
    MATCHES: 2,
    PICKUP_RADIUS: 1.45,
  },
  NAVMESH: {
    ZONE: "waldwacht",
    ATTACK_POINTS: 10,
  },
});

export function runtimeConfig() {
  const params = new URLSearchParams(location.search);
  const demo = params.get("demo") === "1";
  return {
    dev: params.get("dev") === "1" || demo,
    demo,
    preset: params.get("preset") || "",
    navDebug: params.get("navdebug") === "1",
    timeScale: 1,
  };
}

const OPTIMIZED_WORLD_URL = "/assets/forest_defense/first_person/first_person_world_1k_meshopt.glb";
export const LOW_END_WORLD_URL = "/assets/forest_defense/first_person/first_person_world_512_meshopt.glb";

export const ASSET_URLS = Object.freeze({
  // The repository ships only runtime-ready Meshopt worlds. Normal computers
  // use 1K textures; weak hardware receives the separate 512px variant.
  world: OPTIMIZED_WORLD_URL,
  fort1: "/assets/forest_defense/first_person/fort_stage_1.glb",
  fort2: "/assets/forest_defense/first_person/fort_stage_2.glb",
  fort3: "/assets/forest_defense/first_person/fort_stage_3.glb",
  nav0: "/assets/forest_defense/first_person/navmesh_stage_0.glb",
  nav1: "/assets/forest_defense/first_person/navmesh_stage_1.glb",
  nav2: "/assets/forest_defense/first_person/navmesh_stage_2.glb",
  nav3Open: "/assets/forest_defense/first_person/navmesh_stage_3_open.glb",
  nav3Closed: "/assets/forest_defense/first_person/navmesh_stage_3_closed.glb",
  goblin: "/assets/forest_defense/first_person/goblin.glb",
  catapult: "/assets/forest_defense/first_person/catapult_intact.glb",
  catapultDestroyed: "/assets/forest_defense/first_person/catapult_destroyed.glb",
  viewAxe: "/assets/forest_defense/first_person/first_person_axe_pose.glb",
  viewLog: "/assets/forest_defense/first_person/first_person_log_pose.glb",
  viewStone: "/assets/forest_defense/first_person/first_person_stone_pose.glb",
  axe: "/assets/forest_defense/chop/first_person_axe.glb",
  note: "/assets/forest_defense/first_person/note.glb",
  stone: "/assets/forest_defense/first_person/throwable_stone.glb",
  log: "/assets/forest_defense/first_person/log_large.glb",
  tree0: "/assets/forest_defense/chop/tree_stage_0.glb",
  tree25: "/assets/forest_defense/chop/tree_stage_25.glb",
  tree50: "/assets/forest_defense/chop/tree_stage_50.glb",
  tree75: "/assets/forest_defense/chop/tree_stage_75.glb",
  tree90: "/assets/forest_defense/chop/tree_stage_90.glb",
  treeFallen: "/assets/forest_defense/chop/tree_stage_fallen.glb",
});

export const ASSET_FALLBACK_URLS = Object.freeze({
  world: OPTIMIZED_WORLD_URL,
});

export function assetUrlsForProfile(profileId = "normal") {
  return Object.freeze({
    ...ASSET_URLS,
    world: profileId === "low" ? LOW_END_WORLD_URL : ASSET_URLS.world,
  });
}

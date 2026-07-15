import * as THREE from "three";
import { CONFIG } from "./config.js";


export function adjustedCatapultPosition(position, target=new THREE.Vector3()) {
  target.copy(position);
  const inward = position.clone().setY(0);
  if (inward.lengthSq() > 0) inward.normalize().multiplyScalar(-CONFIG.CATAPULTS.INWARD_OFFSET);
  return target.add(inward);
}

export function catapultPatrolEndpoints(position) {
  const inward = position.clone().setY(0);
  if (inward.lengthSq() > 0) inward.normalize().multiplyScalar(-1);
  return {
    back: position.clone().addScaledVector(inward, -CONFIG.CATAPULTS.PATROL_DISTANCE),
    front: position.clone().addScaledVector(inward, CONFIG.CATAPULTS.PATROL_DISTANCE),
  };
}

export function catapultPositionPool(initialPositions) {
  const seeds = initialPositions.map((position) => position.clone());
  const pool = seeds.map((position) => position.clone());
  for (let wave = 0; wave < 2; wave += 1) {
    for (let index = 0; index < seeds.length; index += 1) {
      const seed = seeds[index];
      const radius = Math.hypot(seed.x, seed.z)
        + (wave === 0 ? CONFIG.CATAPULTS.REINFORCEMENT_RADIAL_OFFSET : -CONFIG.CATAPULTS.REINFORCEMENT_RADIAL_OFFSET);
      const baseAngle = Math.atan2(seed.z, seed.x);
      const side = index % 2 === 0 ? 1 : -1;
      const angle = baseAngle + side * (wave === 0 ? 1 : -1) * CONFIG.CATAPULTS.REINFORCEMENT_ANGLE_OFFSET;
      pool.push(new THREE.Vector3(Math.cos(angle) * radius, seed.y, Math.sin(angle) * radius));
    }
  }
  return pool;
}

export function catapultArrivalEndpoints(position) {
  const inward = position.clone().setY(0);
  if (inward.lengthSq() > 0) inward.normalize().multiplyScalar(-1);
  return {
    start: position.clone().addScaledVector(inward, -CONFIG.CATAPULTS.REINFORCEMENT_ARRIVAL_DISTANCE),
    end: position.clone().addScaledVector(inward, CONFIG.CATAPULTS.PATROL_DISTANCE),
  };
}

export function distanceToSegment2D(point, start, end) {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const lengthSq = dx * dx + dz * dz;
  if (lengthSq <= 1e-9) return Math.hypot(point.x - start.x, point.z - start.z);
  const t = THREE.MathUtils.clamp(((point.x - start.x) * dx + (point.z - start.z) * dz) / lengthSq, 0, 1);
  return Math.hypot(point.x - (start.x + dx * t), point.z - (start.z + dz * t));
}

export function blocksTowerShot(position, towerPosition, catapultPositions) {
  return catapultPositions.some((catapult) => (
    distanceToSegment2D(position, towerPosition, catapult) < CONFIG.CATAPULTS.CORRIDOR_HALF_WIDTH
  ));
}

export function relocateOffTowerShots(position, towerPosition, catapultPositions, target=new THREE.Vector3()) {
  target.copy(position);
  // Neighbouring reinforcement corridors overlap. A shift out of one line can
  // place a tree inside the next, so re-check the whole set a few times.
  for (let pass = 0; pass < 3; pass += 1) {
    let shifted = false;
    for (const catapult of catapultPositions) {
      const dx = catapult.x - towerPosition.x;
      const dz = catapult.z - towerPosition.z;
      const lengthSq = dx * dx + dz * dz;
      if (lengthSq <= 1e-9) continue;
      const length = Math.sqrt(lengthSq);
      const t = THREE.MathUtils.clamp(((target.x - towerPosition.x) * dx + (target.z - towerPosition.z) * dz) / lengthSq, 0, 1);
      const projectionX = towerPosition.x + dx * t;
      const projectionZ = towerPosition.z + dz * t;
      const perpendicularX = -dz / length;
      const perpendicularZ = dx / length;
      const signedDistance = (target.x - projectionX) * perpendicularX + (target.z - projectionZ) * perpendicularZ;
      if (Math.abs(signedDistance) >= CONFIG.CATAPULTS.CORRIDOR_HALF_WIDTH) continue;
      const side = Math.abs(signedDistance) > .05 ? Math.sign(signedDistance) : ((target.x + target.z) >= 0 ? 1 : -1);
      const shift = CONFIG.CATAPULTS.CORRIDOR_TREE_OFFSET - Math.abs(signedDistance);
      target.x += perpendicularX * side * shift;
      target.z += perpendicularZ * side * shift;
      shifted = true;
    }
    if (!shifted) break;
  }
  return target;
}

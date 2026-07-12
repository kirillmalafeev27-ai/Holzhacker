import * as THREE from "three";
import { Pathfinding } from "three-pathfinding";
import { CONFIG } from "./config.js";


export class NavigationSystem {
  constructor(scene, assets) {
    this.scene = scene;
    this.assets = assets;
    this.pathfinding = new Pathfinding();
    this.zone = CONFIG.NAVMESH.ZONE;
    this.geometries = new Map();
    this.currentKey = null;
    this.currentGroup = null;
    this.debugVisible = false;
    this.debugRoot = new THREE.Group();
    this.debugRoot.name = "NavmeshDebugRoot";
    this.debugRoot.visible = false;
    scene.add(this.debugRoot);
    this.navMeshView = null;
    this.pathLine = null;
    this.attackPointViews = [];
    this.obstacleViews = [];
    for (const key of ["nav0", "nav1", "nav2", "nav3Open", "nav3Closed"]) {
      this.geometries.set(key, assets.navGeometry(key));
    }
    this.attackPoints = Array.from({ length: CONFIG.NAVMESH.ATTACK_POINTS }, (_, index) => {
      const angle = index / CONFIG.NAVMESH.ATTACK_POINTS * Math.PI * 2 + .18;
      return {
        id: index,
        position: new THREE.Vector3(Math.cos(angle) * 11.25, .15, Math.sin(angle) * 11.25),
        occupancy: 0,
        healthBias: 0,
      };
    });
    this.createAttackPointDebug();
    this.switchState(0, true);
  }

  keyForState(stage, gateOpen) {
    if (stage <= 0) return "nav0";
    if (stage === 1) return "nav1";
    if (stage === 2) return "nav2";
    return gateOpen ? "nav3Open" : "nav3Closed";
  }

  switchState(stage, gateOpen) {
    const key = this.keyForState(stage, gateOpen);
    if (key === this.currentKey) return;
    this.currentKey = key;
    const geometry = this.geometries.get(key);
    const zoneData = Pathfinding.createZone(geometry);
    this.pathfinding.setZoneData(this.zone, zoneData);
    this.currentGroup = null;
    this.refreshNavDebug(geometry);
  }

  groupFor(position) {
    const group = this.pathfinding.getGroup(this.zone, position, true);
    return group ?? this.pathfinding.getGroup(this.zone, position, false);
  }

  findPath(start, target) {
    const group = this.groupFor(start);
    if (group === null || group === undefined) return [];
    const path = this.pathfinding.findPath(start, target, this.zone, group);
    return path || [];
  }

  nearestPoint(position) {
    const group = this.groupFor(position);
    if (group === null || group === undefined) return position.clone();
    const node = this.pathfinding.getClosestNode(position, this.zone, group, true);
    return node?.centroid?.clone?.() || position.clone();
  }

  closestNode(position) {
    const group = this.groupFor(position);
    if (group === null || group === undefined) return null;
    return this.pathfinding.getClosestNode(position, this.zone, group, true);
  }

  clampStep(start, end, node) {
    const group = this.groupFor(start);
    if (group === null || group === undefined || !node) return { position: end.clone(), node };
    const clamped = new THREE.Vector3();
    const nextNode = this.pathfinding.clampStep(start, end, node, this.zone, group, clamped);
    return { position: clamped, node: nextNode || node };
  }

  chooseAttackPoint(origin, agents) {
    let best = null;
    let bestScore = Infinity;
    for (const point of this.attackPoints) {
      point.occupancy = agents.filter((agent) => agent.targetPoint?.id === point.id && agent.state !== "defeated").length;
      const distance = origin.distanceToSquared(point.position);
      const score = distance + point.occupancy * 58 - point.healthBias * 24;
      if (score < bestScore) {
        bestScore = score;
        best = point;
      }
    }
    return best;
  }

  setWallDamageRatio(ratio) {
    for (let index = 0; index < this.attackPoints.length; index += 1) {
      this.attackPoints[index].healthBias = ratio * (1 + (index % 3) * .18);
    }
  }

  toggleDebug(force) {
    this.debugVisible = force ?? !this.debugVisible;
    this.debugRoot.visible = this.debugVisible;
    return this.debugVisible;
  }

  refreshNavDebug(geometry) {
    if (this.navMeshView) {
      this.debugRoot.remove(this.navMeshView);
      this.navMeshView.geometry.dispose();
      this.navMeshView.material.dispose();
    }
    const material = new THREE.MeshBasicMaterial({
      color: 0x2cff88, transparent: true, opacity: .34,
      wireframe: false, depthTest: false, depthWrite: false, side: THREE.DoubleSide,
    });
    this.navMeshView = new THREE.Mesh(geometry.clone(), material);
    this.navMeshView.position.y += .14;
    this.navMeshView.renderOrder = 70;
    this.debugRoot.add(this.navMeshView);
  }

  createAttackPointDebug() {
    const geometry = new THREE.ConeGeometry(.18, .55, 7);
    const material = new THREE.MeshBasicMaterial({ color: 0xffd458, depthTest: false });
    for (const point of this.attackPoints) {
      const marker = new THREE.Mesh(geometry, material);
      marker.position.copy(point.position).setY(.55);
      marker.renderOrder = 72;
      this.attackPointViews.push(marker);
      this.debugRoot.add(marker);
    }
  }

  setObstacleDebug(colliders) {
    for (const view of this.obstacleViews) this.debugRoot.remove(view);
    this.obstacleViews.length = 0;
    const material = new THREE.MeshBasicMaterial({ color: 0xff4f3f, side: THREE.DoubleSide, depthTest: false });
    for (const collider of colliders) {
      const view = new THREE.Mesh(new THREE.RingGeometry(collider.radius, collider.radius + .045, 18), material);
      view.rotation.x = -Math.PI / 2;
      view.position.copy(collider.position).setY(collider.position.y + .08);
      view.renderOrder = 73;
      this.debugRoot.add(view);
      this.obstacleViews.push(view);
    }
  }

  showPath(points) {
    if (this.pathLine) {
      this.debugRoot.remove(this.pathLine);
      this.pathLine.geometry.dispose();
      this.pathLine.material.dispose();
      this.pathLine = null;
    }
    if (!points?.length) return;
    const geometry = new THREE.BufferGeometry().setFromPoints(points.map((point) => point.clone().add(new THREE.Vector3(0, .25, 0))));
    const material = new THREE.LineBasicMaterial({ color: 0x3fdcff, depthTest: false });
    this.pathLine = new THREE.Line(geometry, material);
    this.pathLine.renderOrder = 74;
    this.debugRoot.add(this.pathLine);
  }
}

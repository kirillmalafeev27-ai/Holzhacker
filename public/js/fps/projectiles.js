import * as THREE from "three";
import { CONFIG } from "./config.js";


export class ProjectileSystem {
  constructor(scene, assets, effects, audio) {
    this.scene = scene;
    this.assets = assets;
    this.effects = effects;
    this.audio = audio;
    this.pool = [];
    this.active = [];
    for (let index = 0; index < 28; index += 1) {
      const object = assets.clone("stone");
      object.visible = false;
      scene.add(object);
      const marker = new THREE.Mesh(
        new THREE.RingGeometry(.45, .58, 24),
        new THREE.MeshBasicMaterial({ color: 0xe44b35, transparent: true, opacity: .82, side: THREE.DoubleSide, depthWrite: false }),
      );
      marker.rotation.x = -Math.PI / 2;
      marker.visible = false;
      scene.add(marker);
      this.pool.push({ object, marker, velocity: new THREE.Vector3(), target: new THREE.Vector3(), age: 0, duration: 0, kind: "", mode: "target", onMove: null, onImpact: null });
    }
  }

  launch({ kind, start, target, flightTime, scale=1, warning=true, onImpact }) {
    const projectile = this.pool.find((item) => !item.object.visible);
    if (!projectile) return null;
    const duration = flightTime || THREE.MathUtils.clamp(start.distanceTo(target) / 11.5, 1.35, 3.35);
    projectile.kind = kind;
    projectile.mode = "target";
    projectile.onMove = null;
    projectile.object.visible = true;
    projectile.object.position.copy(start);
    projectile.object.scale.setScalar(scale);
    projectile.target.copy(target);
    projectile.age = 0;
    projectile.duration = duration;
    projectile.onImpact = onImpact;
    projectile.velocity.copy(target).sub(start).divideScalar(duration);
    projectile.velocity.y = (target.y - start.y + .5 * CONFIG.CATAPULTS.GRAVITY * duration * duration) / duration;
    projectile.marker.visible = warning;
    projectile.marker.position.copy(target).add(new THREE.Vector3(0, .055, 0));
    this.active.push(projectile);
    return projectile;
  }

  // Free-flight stone: follows the launch velocity under gravity until onMove
  // reports a hit (or maxAge runs out). Used for the crosshair-aimed throws.
  launchBallistic({ kind, start, velocity, scale=1, maxAge=10, onMove, onImpact }) {
    const projectile = this.pool.find((item) => !item.object.visible);
    if (!projectile) return null;
    projectile.kind = kind;
    projectile.mode = "ballistic";
    projectile.object.visible = true;
    projectile.object.position.copy(start);
    projectile.object.scale.setScalar(scale);
    projectile.age = 0;
    projectile.duration = maxAge;
    projectile.onMove = onMove || null;
    projectile.onImpact = onImpact;
    projectile.velocity.copy(velocity);
    projectile.marker.visible = false;
    this.active.push(projectile);
    return projectile;
  }

  update(dt) {
    for (let index = this.active.length - 1; index >= 0; index -= 1) {
      const projectile = this.active[index];
      projectile.age += dt;
      projectile.velocity.y -= CONFIG.CATAPULTS.GRAVITY * dt;
      projectile.object.position.addScaledVector(projectile.velocity, dt);
      projectile.object.rotation.x += dt * 5.7;
      projectile.object.rotation.z += dt * 4.2;
      const pulse = .92 + Math.sin(projectile.age * 10) * .12;
      projectile.marker.scale.setScalar(pulse);
      const landed = projectile.mode === "ballistic"
        ? Boolean(projectile.onMove?.(projectile.object.position)) || projectile.age >= projectile.duration
        : projectile.age >= projectile.duration;
      if (!landed) continue;
      const impact = projectile.mode === "ballistic" ? projectile.object.position.clone() : projectile.target.clone();
      projectile.object.position.copy(impact);
      projectile.onImpact?.(impact, projectile.kind);
      projectile.object.visible = false;
      projectile.marker.visible = false;
      this.active.splice(index, 1);
    }
  }

  clear() {
    for (const projectile of this.active) {
      projectile.object.visible = false;
      projectile.marker.visible = false;
    }
    this.active.length = 0;
  }
}

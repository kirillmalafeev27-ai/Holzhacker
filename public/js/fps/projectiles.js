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
      this.pool.push({
        object, marker, velocity: new THREE.Vector3(), target: new THREE.Vector3(),
        age: 0, duration: 0, kind: "", onImpact: null, shouldImpact: null,
        ballistic: false, groundHeight: -Infinity,
      });
    }
  }

  launch({ kind, start, target, flightTime, scale=1, warning=true, onImpact }) {
    const projectile = this.pool.find((item) => !item.object.visible);
    if (!projectile) return null;
    const duration = flightTime || THREE.MathUtils.clamp(start.distanceTo(target) / 11.5, 1.35, 3.35);
    projectile.kind = kind;
    projectile.object.visible = true;
    projectile.object.position.copy(start);
    projectile.object.scale.setScalar(scale);
    projectile.target.copy(target);
    projectile.age = 0;
    projectile.duration = duration;
    projectile.onImpact = onImpact;
    projectile.shouldImpact = null;
    projectile.ballistic = false;
    projectile.groundHeight = -Infinity;
    projectile.velocity.copy(target).sub(start).divideScalar(duration);
    projectile.velocity.y = (target.y - start.y + .5 * CONFIG.CATAPULTS.GRAVITY * duration * duration) / duration;
    projectile.marker.visible = warning;
    projectile.marker.position.copy(target).add(new THREE.Vector3(0, .055, 0));
    this.active.push(projectile);
    return projectile;
  }

  launchVelocity({ kind, start, velocity, maxTime=5, scale=1, groundHeight=0, shouldImpact, onImpact }) {
    const projectile = this.pool.find((item) => !item.object.visible);
    if (!projectile) return null;
    projectile.kind = kind;
    projectile.object.visible = true;
    projectile.object.position.copy(start);
    projectile.object.scale.setScalar(scale);
    projectile.marker.visible = false;
    projectile.velocity.copy(velocity);
    projectile.age = 0;
    projectile.duration = maxTime;
    projectile.onImpact = onImpact;
    projectile.shouldImpact = shouldImpact || null;
    projectile.ballistic = true;
    projectile.groundHeight = groundHeight;
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
      const contact = projectile.ballistic ? projectile.shouldImpact?.(projectile.object.position, projectile) : null;
      const reachedTarget = !projectile.ballistic && projectile.age >= projectile.duration;
      const reachedGround = projectile.ballistic && projectile.age > .18 && projectile.object.position.y <= projectile.groundHeight;
      const timedOut = projectile.ballistic && projectile.age >= projectile.duration;
      if (!contact && !reachedTarget && !reachedGround && !timedOut) continue;
      const impact = projectile.ballistic ? projectile.object.position.clone() : projectile.target.clone();
      projectile.object.position.copy(impact);
      projectile.onImpact?.(impact, projectile.kind, contact || null);
      projectile.object.visible = false;
      projectile.marker.visible = false;
      projectile.shouldImpact = null;
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

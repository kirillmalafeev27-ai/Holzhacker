import * as THREE from "three";


export const GUIDANCE_FOCUS_SECONDS = 5;

export function lookAnglesToTarget(origin, target) {
  const dx = target.x - origin.x;
  const dy = target.y - origin.y;
  const dz = target.z - origin.z;
  return {
    yaw: Math.atan2(-dx, -dz),
    pitch: Math.atan2(dy, Math.max(1e-6, Math.hypot(dx, dz))),
  };
}

function createArrow() {
  const group = new THREE.Group();
  group.name = "DynamicObjectiveArrow";

  const material = new THREE.MeshStandardMaterial({
    color: 0xffd34f,
    emissive: 0x9b5700,
    emissiveIntensity: 1.15,
    roughness: .38,
    metalness: .08,
  });
  const glow = new THREE.MeshBasicMaterial({ color: 0xffef92, transparent: true, opacity: .72, depthWrite: false });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(.13, .13, 1.35, 12), material);
  shaft.position.y = .28;
  const head = new THREE.Mesh(new THREE.ConeGeometry(.43, .82, 16), material);
  head.position.y = -.72;
  head.rotation.z = Math.PI;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(.72, .055, 8, 28), glow);
  ring.position.y = -1.08;
  ring.rotation.x = Math.PI / 2;
  group.add(shaft, head, ring);
  group.traverse((object) => {
    if (!object.isMesh) return;
    object.castShadow = true;
    object.frustumCulled = false;
  });
  group.visible = false;
  return group;
}

export class GuidanceSystem {
  constructor(scene, player, ui) {
    this.player = player;
    this.ui = ui;
    this.arrow = createArrow();
    this.targetProvider = null;
    this.text = "";
    this.aimHeight = 1.15;
    this.focusRemaining = 0;
    this.time = 0;
    this.target = new THREE.Vector3();
    scene.add(this.arrow);
  }

  pointTo(targetProvider, text, { focus = false, aimHeight = 1.15 } = {}) {
    this.targetProvider = typeof targetProvider === "function" ? targetProvider : () => targetProvider;
    this.text = text;
    this.aimHeight = aimHeight;
    this.focusRemaining = focus ? GUIDANCE_FOCUS_SECONDS : 0;
    this.ui.setGuidance(text, this.focusRemaining);
  }

  clear() {
    this.targetProvider = null;
    this.focusRemaining = 0;
    this.arrow.visible = false;
    this.ui.setGuidance("");
  }

  update(dt) {
    if (!this.targetProvider) return;
    const value = this.targetProvider?.();
    if (!value) {
      this.clear();
      return;
    }
    this.target.copy(value);
    this.time += dt;
    this.arrow.visible = true;
    this.arrow.position.copy(this.target);
    this.arrow.position.y += 3.05 + Math.sin(this.time * 3.4) * .24;
    this.arrow.rotation.y = this.time * 1.45;
    const pulse = 1 + Math.sin(this.time * 5.2) * .06;
    this.arrow.scale.setScalar(pulse);

    if (this.focusRemaining > 0) {
      this.focusRemaining = Math.max(0, this.focusRemaining - dt);
      const aimTarget = this.target.clone().add(new THREE.Vector3(0, this.aimHeight, 0));
      this.player.forceLookAt(aimTarget, dt);
      this.ui.setGuidance(this.text, this.focusRemaining);
    }
  }
}

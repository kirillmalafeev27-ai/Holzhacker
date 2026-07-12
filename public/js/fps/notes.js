import * as THREE from "three";
import { CONFIG } from "./config.js";


export class NoteSystem {
  constructor(scene, assets, navigation, audio) {
    this.scene = scene;
    this.assets = assets;
    this.navigation = navigation;
    this.audio = audio;
    this.notes = [];
    this.collected = 0;
    this.onCollected = () => {};
  }

  drop(position, count=2) {
    for (let index = 0; index < count; index += 1) {
      const offset = new THREE.Vector3(index ? .65 : -.65, 0, index ? -.35 : .35);
      const safe = this.navigation.nearestPoint(position.clone().add(offset));
      const object = this.assets.clone("note");
      object.position.copy(safe).add(new THREE.Vector3(0, .24, 0));
      object.rotation.y = index * 1.4;
      object.scale.setScalar(1.1);
      object.traverse((mesh) => {
        if (mesh.isMesh) {
          mesh.material = mesh.material.clone();
          mesh.material.emissive?.setHex(0x5b3710);
          mesh.material.emissiveIntensity = .35;
        }
      });
      this.scene.add(object);
      this.notes.push({ object, collected: false, phase: Math.random() * Math.PI * 2, baseY: object.position.y });
    }
  }

  update(dt, playerPosition) {
    for (const note of this.notes) {
      if (note.collected) continue;
      note.phase += dt * 2.1;
      note.object.position.y = note.baseY + Math.sin(note.phase) * .08;
      note.object.rotation.y += dt * .45;
      const dx = note.object.position.x - playerPosition.x;
      const dz = note.object.position.z - playerPosition.z;
      if (Math.hypot(dx, dz) > CONFIG.NOTES.PICKUP_RADIUS) continue;
      note.collected = true;
      note.object.visible = false;
      this.collected += 1;
      this.audio.play("note");
      this.onCollected(this.collected);
    }
  }
}

import * as THREE from "three";


export class EffectsSystem {
  constructor(scene, { profileId = "normal" } = {}) {
    this.scene = scene;
    this.pool = [];
    this.active = [];
    this.profileId = profileId;
    this.particleScale = profileId === "low" ? .42 : 1;
    this.geometry = new THREE.TetrahedronGeometry(.08, 0);
    this.materials = {
      wood: new THREE.MeshStandardMaterial({ color: 0xb76528, roughness: .9 }),
      freshWood: new THREE.MeshStandardMaterial({ color: 0xe0a250, roughness: .82 }),
      dust: new THREE.MeshStandardMaterial({ color: 0x8f7448, roughness: 1, transparent: true }),
      spark: new THREE.MeshBasicMaterial({ color: 0xffc443 }),
      repair: new THREE.MeshBasicMaterial({ color: 0x79df78 }),
      smoke: new THREE.MeshStandardMaterial({ color: 0x282d29, roughness: 1, transparent: true }),
      impact: new THREE.MeshStandardMaterial({ color: 0x6d6b60, roughness: 1 }),
      mud: new THREE.MeshStandardMaterial({ color: 0x6b3f20, roughness: 1 }),
    };
    const poolSize = profileId === "low" ? 72 : 180;
    for (let index = 0; index < poolSize; index += 1) {
      const mesh = new THREE.Mesh(this.geometry, this.materials.dust);
      mesh.visible = false;
      mesh.castShadow = false;
      scene.add(mesh);
      this.pool.push({ mesh, velocity: new THREE.Vector3(), life: 0, maxLife: 1, gravity: 8, spin: new THREE.Vector3() });
    }
  }

  spawn(kind, position, velocity, life=1, scale=1, gravity=8) {
    const particle = this.pool.find((item) => !item.mesh.visible);
    if (!particle) return;
    particle.mesh.visible = true;
    particle.mesh.material = this.materials[kind] || this.materials.dust;
    particle.mesh.position.copy(position);
    particle.mesh.scale.setScalar(scale * this.particleScale);
    particle.velocity.copy(velocity);
    particle.life = life;
    particle.maxLife = life;
    particle.gravity = gravity;
    particle.spin.set(Math.random() * 8, Math.random() * 8, Math.random() * 8);
    this.active.push(particle);
  }

  burst(kind, position, count, speed=3, life=.8, scale=1) {
    const adjustedCount = Math.max(1, Math.round(count * this.particleScale));
    for (let index = 0; index < adjustedCount; index += 1) {
      const angle = Math.random() * Math.PI * 2;
      const velocity = new THREE.Vector3(Math.cos(angle), .5 + Math.random() * 1.3, Math.sin(angle)).multiplyScalar(speed * (.45 + Math.random() * .65));
      this.spawn(kind, position, velocity, life * (.7 + Math.random() * .6), scale * (.65 + Math.random() * .7));
    }
  }

  setPerformanceProfile(profileId) {
    this.profileId = profileId;
    this.particleScale = profileId === "low" ? .42 : 1;
    if (profileId !== "low") return;
    for (let index = this.active.length - 1; index >= 0 && this.active.length > 54; index -= 1) {
      this.active[index].mesh.visible = false;
      this.active.splice(index, 1);
    }
  }

  woodBurst(position) {
    this.burst("wood", position, 12, 3.6, .75, 1.0);
    this.burst("freshWood", position, 8, 2.6, .65, .8);
    for (let index = 0; index < 8; index += 1) {
      const velocity = new THREE.Vector3((Math.random() - .5) * 3, 1 + Math.random() * 3, (Math.random() - .5) * 3);
      this.spawn("spark", position, velocity, .42 + Math.random() * .25, .45, 4);
    }
  }

  constructionBurst(position, count=40) {
    this.burst("dust", position, count, 5.8, 1.6, 2.4);
    this.burst("wood", position.clone().add(new THREE.Vector3(0, .7, 0)), Math.floor(count * .35), 4.2, 1.1, 1.2);
  }

  repairBurst(position) {
    this.burst("repair", position, 28, 3.5, 1.1, .85);
  }

  groundImpact(position) {
    this.burst("impact", position, 16, 4.5, .9, 1.5);
    this.burst("dust", position, 24, 4.0, 1.25, 2.1);
  }

  dirtImpact(position) {
    this.burst("mud", position.clone().add(new THREE.Vector3(0, .08, 0)), 18, 3.1, 1.05, 2.1);
    this.burst("dust", position, 8, 2.2, .85, 1.35);
  }

  fortImpact(position) {
    this.burst("wood", position, 24, 5.3, 1.15, 1.6);
    this.burst("freshWood", position, 12, 4.2, .9, 1.15);
    this.burst("dust", position, 12, 3.2, 1.05, 1.7);
  }

  catapultImpact(position) {
    this.burst("wood", position, 26, 5.8, 1.2, 1.7);
    this.burst("freshWood", position, 10, 4.6, 1.0, 1.25);
    this.burst("impact", position, 8, 3.5, .8, 1.0);
  }

  smoke(position, count=4) {
    for (let index = 0; index < count; index += 1) {
      this.spawn("smoke", position, new THREE.Vector3((Math.random() - .5) * .34, .65 + Math.random() * .48, (Math.random() - .5) * .34), 2.65, 3.15, -.07);
    }
  }

  update(dt) {
    for (let index = this.active.length - 1; index >= 0; index -= 1) {
      const particle = this.active[index];
      particle.life -= dt;
      if (particle.life <= 0) {
        particle.mesh.visible = false;
        this.active.splice(index, 1);
        continue;
      }
      particle.velocity.y -= particle.gravity * dt;
      particle.mesh.position.addScaledVector(particle.velocity, dt);
      particle.mesh.rotation.x += particle.spin.x * dt;
      particle.mesh.rotation.y += particle.spin.y * dt;
      particle.mesh.rotation.z += particle.spin.z * dt;
      const fade = Math.min(1, particle.life / (particle.maxLife * .45));
      if (particle.mesh.material.transparent) particle.mesh.material.opacity = fade * .55;
    }
  }
}


export class AudioSystem {
  constructor() {
    this.context = null;
    this.master = null;
    this.noiseBuffer = null;
  }

  start() {
    if (this.context) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    this.context = new AudioContext();
    this.master = this.context.createGain();
    this.master.gain.value = .28;
    this.master.connect(this.context.destination);
    this.noiseBuffer = this.createNoiseBuffer();
    this.startAmbient();
  }

  createNoiseBuffer() {
    const length = this.context.sampleRate * 2;
    const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let index = 0; index < length; index += 1) {
      last = last * .985 + (Math.random() * 2 - 1) * .015;
      data[index] = last;
    }
    return buffer;
  }

  startAmbient() {
    const source = this.context.createBufferSource();
    source.buffer = this.noiseBuffer;
    source.loop = true;
    const filter = this.context.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 950;
    filter.Q.value = .4;
    const gain = this.context.createGain();
    gain.gain.value = .075;
    source.connect(filter).connect(gain).connect(this.master);
    source.start();
  }

  tone(frequency, duration=.12, type="triangle", volume=.13, detune=0) {
    if (!this.context) return;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    oscillator.detune.value = detune;
    gain.gain.setValueAtTime(volume, this.context.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, this.context.currentTime + duration);
    oscillator.connect(gain).connect(this.master);
    oscillator.start();
    oscillator.stop(this.context.currentTime + duration);
  }

  noise(duration=.16, volume=.16, highpass=180) {
    if (!this.context) return;
    const source = this.context.createBufferSource();
    source.buffer = this.noiseBuffer;
    const filter = this.context.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = highpass;
    const gain = this.context.createGain();
    gain.gain.setValueAtTime(volume, this.context.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, this.context.currentTime + duration);
    source.connect(filter).connect(gain).connect(this.master);
    source.start();
    source.stop(this.context.currentTime + duration);
  }

  play(name) {
    if (name === "axe") { this.noise(.1, .18, 1200); this.tone(92, .13, "square", .11); }
    else if (name === "build") { this.noise(.55, .2, 140); this.tone(74, .5, "sawtooth", .08); }
    else if (name === "pickup") { this.tone(420, .16, "triangle", .11); this.tone(620, .20, "triangle", .08, 8); }
    else if (name === "catapult") { this.noise(.25, .22, 80); this.tone(55, .45, "sawtooth", .15); }
    else if (name === "impact") { this.noise(.30, .26, 90); this.tone(46, .32, "square", .12); }
    else if (name === "gate") { this.noise(.7, .10, 90); this.tone(66, .65, "sawtooth", .06); }
    else if (name === "note") { this.tone(520, .18, "triangle", .10); this.tone(780, .28, "sine", .08); }
    else if (name === "damage") { this.noise(.2, .20, 300); this.tone(72, .25, "square", .13); }
    else if (name === "repair") { this.tone(330, .18, "triangle", .10); this.tone(495, .28, "triangle", .08); }
  }
}

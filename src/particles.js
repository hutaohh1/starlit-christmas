export function seededRandom(seed = 1225) {
  return () => { seed |= 0; seed = seed + 0x6d2b79f5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
export const TREE_BOTTOM = -2.65;
export const TREE_HEIGHT = 6.5;
export function treeRadius(height) {
  const t = Math.max(0, Math.min(1, height));
  return 2.33 * Math.pow(1 - t, .86) * (.87 + .13 * Math.sin(t * Math.PI * 16)) + .025;
}
export function createParticleData(count, seed = 1225, balanced = false) {
  const random = seededRandom(seed);
  const positions = new Float32Array(count * 3), scatter = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3), sizes = new Float32Array(count), phases = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const t = balanced ? 1 - Math.pow(1 - random(), .65) : Math.pow(random(), .82), angle = random() * Math.PI * 2;
    const surface = random() > .28;
    const radius = treeRadius(t) * (surface ? .82 + random() * .18 : Math.sqrt(random()) * .83);
    const j = i * 3;
    positions[j] = Math.cos(angle) * radius;
    positions[j + 1] = TREE_BOTTOM + t * TREE_HEIGHT;
    positions[j + 2] = Math.sin(angle) * radius;
    const azimuth = random() * Math.PI * 2, vertical = random() * 2 - 1;
    const r = 3 + random() * 4.2, horizontal = Math.sqrt(1 - vertical * vertical);
    scatter[j] = Math.cos(azimuth) * horizontal * r;
    scatter[j + 1] = vertical * r * .63 + .4;
    scatter[j + 2] = Math.sin(azimuth) * horizontal * r * .65;
    const choice = random(), light = .35 + random() * .8;
    const color = choice < .05 ? [.27,.44,.26] : choice < .075 ? [.7,.13,.1] : choice < .38 ? [1,.69,.3] : [1,.87,.58];
    colors.set(color.map(c => c * light), j);
    sizes[i] = .045 + Math.pow(random(), 3) * .19;
    phases[i] = random() * Math.PI * 2;
  }
  return { positions, scatter, colors, sizes, phases };
}
export function createRibbonData(count = 2600) {
  const random = seededRandom(42), positions = new Float32Array(count * 3), scatter = new Float32Array(count * 3), colors = new Float32Array(count * 3), sizes = new Float32Array(count), phases = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const t = i / count, angle = t * Math.PI * 2 * 5.6;
    const radius = 2.38 * Math.pow(1 - t, .86) + .06;
    positions.set([Math.cos(angle)*radius + (random()-.5)*.055, TREE_BOTTOM+t*TREE_HEIGHT, Math.sin(angle)*radius + (random()-.5)*.055], i*3);
    scatter.set([Math.cos(angle)*radius*2.3, TREE_BOTTOM+t*TREE_HEIGHT+(random()-.5)*2, Math.sin(angle)*radius*2.3], i*3);
    colors.set([1.35,1.03,.52],i*3); sizes[i] = .045 + random()*.065; phases[i] = t*20;
  }
  return { positions, scatter, colors, sizes, phases };
}



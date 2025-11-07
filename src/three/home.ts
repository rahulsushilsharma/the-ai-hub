import {
  AmbientLight,
  BoxGeometry,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  PointLight,
  Scene,
  WebGLRenderer,
} from "three";

// Scene setup
const scene = new Scene();
const camera = new PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);

const renderer = new WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Cube with a material that reacts to light
const geometry = new BoxGeometry();
const material = new MeshStandardMaterial({ color: 0x00ff00 });
const cube = new Mesh(geometry, material);
scene.add(cube);

// 💡 Point light
const pointLight = new PointLight(0xffffff); // (color, intensity)
pointLight.position.set(5, 5, 5);
scene.add(pointLight);

const ambientLight = new AmbientLight(0x404040, 0.5);
scene.add(ambientLight);

camera.position.z = 5;

// Animate
export function animate() {
  requestAnimationFrame(animate);
  cube.rotation.x += 0.01;
  cube.rotation.y += 0.01;
  renderer.render(scene, camera);
}

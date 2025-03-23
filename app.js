import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import * as tf from "@tensorflow/tfjs";
import * as handpose from "@tensorflow-models/handpose";

let model;
let videoWidth, videoHeight;
let renderer, scene, camera;
let loadedModel;
let controls;
const statusElement = document.getElementById("status");
let modelScale = 5;
let isPinching = false;
let lastPinchDistance = 0;

async function setupCamera() {
  const video = document.getElementById("video");
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      facingMode: "user",
      width: 640,
      height: 480,
    },
  });
  video.srcObject = stream;

  return new Promise((resolve) => {
    video.onloadedmetadata = () => {
      videoWidth = video.videoWidth;
      videoHeight = video.videoHeight;
      video.width = videoWidth;
      video.height = videoHeight;
      resolve(video);
    };
  });
}

async function setupHandTrackingModel() {
  statusElement.textContent = "Loading handpose model...";
  model = await handpose.load();
  statusElement.textContent = "Model loaded successfully";
}

function setupThreeJsScene() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x111111);

  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.z = 5;
  camera.position.y = 1;

  const modelContainer = document.getElementById("model-container");
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  modelContainer.appendChild(renderer.domElement);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(0, 10, 5);
  scene.add(directionalLight);

  const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
  scene.add(hemisphereLight);

  const spotLight = new THREE.SpotLight(0xffffff, 0.5);
  spotLight.position.set(0, 10, 10);
  spotLight.angle = Math.PI / 6;
  spotLight.penumbra = 0.1;
  scene.add(spotLight);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.25;
  controls.enableZoom = true;
  controls.update();

  const loader = new GLTFLoader();
  statusElement.textContent = "Loading 3D model...";
  loader.load(
    "sonic_hedge/scene.gltf",
    (gltf) => {
      loadedModel = gltf.scene;
      loadedModel.scale.set(modelScale, modelScale, modelScale);
      scene.add(loadedModel);
      statusElement.textContent = " ";

      setTimeout(() => {
        const initialAnimation = new THREE.AnimationMixer(loadedModel);
        const rotateAction = initialAnimation.clipAction(
          new THREE.AnimationClip("rotate", 3, [
            new THREE.KeyframeTrack(
              ".rotation[y]",
              [0, 1.5, 3],
              [0, Math.PI, Math.PI * 2]
            ),
          ])
        );
        rotateAction.setLoop(THREE.LoopOnce);
        rotateAction.play();
      }, 1000);
    },
    (xhr) => {
      statusElement.textContent = `Loading model: ${Math.floor(
        (xhr.loaded / xhr.total) * 100
      )}%`;
    },
    (error) => {
      statusElement.textContent = "Error loading model";
      console.error("An error occurred loading the model:", error);
    }
  );

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

function calculateDistance(point1, point2) {
  return Math.sqrt(
    Math.pow(point1[0] - point2[0], 2) +
      Math.pow(point1[1] - point2[1], 2) +
      Math.pow(point1[2] - point2[2], 2)
  );
}

function detectPinch(landmarks) {
  const thumbTip = landmarks[4];
  const indexTip = landmarks[8];

  const distance = calculateDistance(thumbTip, indexTip);

  const isPinching = distance < 40;

  return {
    isPinching,
    distance,
    thumbTip,
    indexTip,
  };
}

async function detectHand() {
  const video = document.getElementById("video");
  const predictions = await model.estimateHands(video);
  const canvas = document.getElementById("output");
  const ctx = canvas.getContext("2d");

  canvas.width = videoWidth;
  canvas.height = videoHeight;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.scale(-1, 1);
  ctx.translate(-canvas.width, 0);
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  ctx.restore();

  if (predictions.length > 0 && loadedModel) {
    const landmarks = predictions[0].landmarks;

    const pinch = detectPinch(landmarks);

    drawHand(ctx, landmarks, pinch);

    const palmPosition = landmarks[0];

    const normalizedX = ((videoWidth - palmPosition[0]) / videoWidth) * 2 - 1;
    const normalizedY = -((palmPosition[1] / videoHeight) * 2 - 1);
    const normalizedZ = palmPosition[2] / 100;

    loadedModel.position.x = THREE.MathUtils.lerp(
      loadedModel.position.x,
      normalizedX * 3,
      0.1
    );
    loadedModel.position.y = THREE.MathUtils.lerp(
      loadedModel.position.y,
      normalizedY * 2,
      0.1
    );

    if (pinch.isPinching) {
      if (!isPinching) {
        lastPinchDistance = pinch.distance;
        isPinching = true;
      } else {
        const pinchDelta = pinch.distance - lastPinchDistance;

        if (Math.abs(pinchDelta) > 1) {
          const scaleFactor = 1 + pinchDelta * 0.01;
          modelScale *= scaleFactor;
          modelScale = THREE.MathUtils.clamp(modelScale, 1, 20);
          loadedModel.scale.set(modelScale, modelScale, modelScale);

          const handRotation = Math.atan2(
            landmarks[5][0] - landmarks[17][0],
            landmarks[5][1] - landmarks[17][1]
          );

          loadedModel.rotation.y = THREE.MathUtils.lerp(
            loadedModel.rotation.y,
            handRotation,
            0.05
          );

          lastPinchDistance = pinch.distance;
        }
      }
    } else {
      isPinching = false;
    }
  }

  requestAnimationFrame(detectHand);
}

function drawHand(ctx, landmarks, pinch) {
  ctx.fillStyle = "red";
  landmarks.forEach((point) => {
    ctx.beginPath();
    ctx.arc(videoWidth - point[0], point[1], 5, 0, 2 * Math.PI);
    ctx.fill();
  });

  // Connect fingers
  const fingers = [
    [0, 1, 2, 3, 4], // thumb
    [0, 5, 6, 7, 8], // index
    [0, 9, 10, 11, 12], // middle
    [0, 13, 14, 15, 16], // ring
    [0, 17, 18, 19, 20], // pinky
  ];

  ctx.lineWidth = 2;

  fingers.forEach((finger) => {
    ctx.strokeStyle = "white";
    ctx.beginPath();
    for (let i = 0; i < finger.length; i++) {
      const point = landmarks[finger[i]];
      if (i === 0) {
        ctx.moveTo(videoWidth - point[0], point[1]);
      } else {
        ctx.lineTo(videoWidth - point[0], point[1]);
      }
    }
    ctx.stroke();
  });

  if (pinch.isPinching) {
    ctx.strokeStyle = "yellow";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(videoWidth - pinch.thumbTip[0], pinch.thumbTip[1]);
    ctx.lineTo(videoWidth - pinch.indexTip[0], pinch.indexTip[1]);
    ctx.stroke();

    ctx.fillStyle = "yellow";
    ctx.font = "12px Arial";
    ctx.fillText(`Pinch: ${pinch.distance.toFixed(1)}`, 10, 20);
  }
}

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

function setupUIControls() {
  const resizeVideoBtn = document.getElementById("resize-video");
  const videoContainer = document.getElementById("video-container");

  resizeVideoBtn.addEventListener("click", () => {
    videoContainer.classList.toggle("expanded");
  });

  const zoomInBtn = document.getElementById("zoom-in");
  const zoomOutBtn = document.getElementById("zoom-out");

  zoomInBtn.addEventListener("click", () => {
    if (loadedModel) {
      modelScale *= 1.2;
      modelScale = THREE.MathUtils.clamp(modelScale, 1, 20);
      loadedModel.scale.set(modelScale, modelScale, modelScale);
    }
  });

  zoomOutBtn.addEventListener("click", () => {
    if (loadedModel) {
      modelScale /= 1.2;
      modelScale = THREE.MathUtils.clamp(modelScale, 1, 20);
      loadedModel.scale.set(modelScale, modelScale, modelScale);
    }
  });
}

async function init() {
  try {
    const video = await setupCamera();
    video.play();
    await setupHandTrackingModel();
    setupThreeJsScene();
    setupUIControls();
    detectHand();
    animate();
  } catch (error) {
    statusElement.textContent = `Error initializing app: ${error.message}`;
    console.error(error);
  }
}

window.onload = init;

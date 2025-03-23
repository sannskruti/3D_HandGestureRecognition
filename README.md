# 3D_HandGestureRecognition

This project demonstrates how to use hand tracking for interactive manipulation of a 3D model in a web browser using TensorFlow.js, Three.js, and other supporting libraries. The 3D model can be scaled, rotated, and moved based on hand gestures captured by a webcam.

Technologies Used
Three.js: A 3D graphics library for rendering and animating 3D models in the browser.

TensorFlow.js: A JavaScript library for machine learning, used here for hand gesture detection.

HandPose: A model from TensorFlow.js that detects and tracks hand landmarks.

GLTFLoader: A Three.js loader for importing GLTF/GLB 3D models into the scene.

OrbitControls: A Three.js control that allows the user to orbit, zoom, and pan the scene with mouse movements.

Features
3D Model Interaction: Use hand gestures to move, scale, and rotate a 3D model (e.g., Sonic the Hedgehog) in real-time.

Hand Gesture Detection: Detect pinch gestures using the handpose model to manipulate the scale of the model.

Pinch-to-Scale: Zoom in and out by pinching the thumb and index fingers.

Real-Time Rendering: Render 3D models and video feed with real-time updates to position and scale.

Setup
To run this project locally, follow the instructions below:

Prerequisites
Node.js and npm installed.

You can download and install Node.js from https://nodejs.org/.

A webcam: The app uses the webcam to track hand movements.
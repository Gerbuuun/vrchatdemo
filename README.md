## Overview

This project demonstrates a basic multiplayer 3D environment where users can navigate a virtual world with their avatars. It serves as a proof of concept for creating interactive 3D spaces with real-time multiplayer capabilities.

## Stack

- **Frontend**: React, Vite, TanStack Router
- **Backend**: SpacetimeDB with Rust
- **3D Models**: glTF/GLB format

## Checklist

- ✅ Set up a new project with TanStack Router using Vite and React
- ✅ For the world / character models, we'll use the glTF/GLB file format
- ✅ Find a basic world model → You can find free world glTF/GLB file online, anything will do for now
- ✅ Find some basic character models → Similar to the above step, find a few free glTF/GLB character models online
- ☐ Setup the backend using SpacetimeDB with Rust
- ✅ The controls should be similar to minecraft (WASD to move, camera is controlled by mouse). No need to implement jump, sprint, or anything physics related for this demo
- ☐ Implement the basic state and reducers (character location, movement, etc.). Note: No need to handle more complex things like collision detection between the world and the characters for now, for example it's fine if the characters can "walk through trees" for the time being
- ☐ Create a basic demo of the characters walking around in the world using Three.js



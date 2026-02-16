# 🚗 Highway Havoc: Save the Town

A grid-based traffic management strategy game built with pure HTML, CSS, and Vanilla JavaScript.

## 🎯 Concept

A new super highway is stealing all traffic from a small desert town. As the player, you must redirect cars through the town by rotating road tiles and controlling highway gates to keep the local economy alive.

## 🎮 How to Play

1. **Open `index.html`** in a modern browser (Chrome recommended)
2. **Click road tiles** to rotate them and redirect traffic
3. **Click gates** to open/close highway barriers
4. **Redirect cars through the town** (center of the grid) to boost the economy
5. **Survive 3 minutes** or redirect **200 cars** to win!

## 🕹️ Controls

| Action | How |
|--------|-----|
| Rotate road tile | Click on it (tiles with ↻ icon) |
| Open/Close gate | Click the gate tile |
| Pause | Click ⏸ PAUSE button |
| Restart | Click 🔄 RESTART button |

## 📊 Stats

- **Town Economy (0–100)**: Drops when cars bypass town or crash. Game over at 0.
- **Redirect %**: Percentage of cars routed through town. Aim for 60%+.
- **Score**: Points earned from redirected cars.
- **Timer**: 3 minutes countdown.

## ✨ Features

- Smooth car movement animation with `requestAnimationFrame`
- Car spawn rate increases over time (difficulty scaling)
- Animated economy bar with color coding
- Crash particle effects
- Sound effects (Web Audio API) — crash, redirect, gate toggle, rotate
- Local storage high score persistence
- Tutorial overlay
- Responsive layout
- Desert sunset visual theme with glowing town center

## 🛠 Tech Stack

- HTML5
- CSS3 (Grid, Animations, Gradients)
- Vanilla JavaScript (Canvas API, Web Audio API)
- No frameworks, no backend, no dependencies

## 📁 Project Structure

```
highway-havoc/
├── index.html    # Game HTML structure
├── style.css     # All styling and animations
├── script.js     # Complete game engine
└── README.md     # This file
```

## 🎨 Visual Style

- Desert sunset background (purple-orange gradient)
- Neon blue highway tiles
- Warm orange glowing town center
- Colorful animated cars with headlights/taillights
- Particle explosion effects on crashes

## Credits

Built for CSI Code-for-Ralph 2026. All assets generated in-code, no external resources used.

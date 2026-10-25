# 🪂 Hang Glide Charger ⚡

A 3D mobile web game inspired by Roblox games like *Treadmill Tycoon*.

**▶ Play it: https://jdonald.github.io/hang-glide-charger**

## How to play

1. **Pick your glider** — Cat 🐱, Bunny 🐰, Dog 🐶 or Fox 🦊
2. **Charge up** — Stand on a treadmill and run to build ⚡ power. Better treadmills
   (Sprinter, Turbo) charge faster and unlock as you earn more total power.
   Treadmills keep charging while you stand on them — AFK friendly!
3. **Hang glide** — Walk to a launch gate at the cliff edge and tap **LAUNCH**.
   Steer to the island, fly through golden rings ⭐ for speed, and tap **BOOST**
   to spend 10⚡ on a burst of speed and lift. Longer levels need more charge —
   if you splash, go charge more!

### Controls

| | Move | Camera | Jump / Boost |
|---|---|---|---|
| 📱 Touch | Left virtual joystick | Drag right side of screen | On-screen buttons |
| 💻 Keyboard/mouse | WASD / arrow keys | Drag on the canvas | Space = jump, E = launch, B / Shift = boost |

Progress (power, character, levels beaten, stars) is saved in your browser.

## Install as an app (PWA)

- **iPhone/iPad (Safari):** Share → **Add to Home Screen**
- **Android (Chrome):** ⋮ menu → **Install app / Add to Home screen**

It plays fullscreen from the home screen and works offline after the first load.

## Tech

- [Three.js](https://threejs.org/) (CDN) — all 3D is procedural, no model/texture assets
- Vanilla JS + CSS, one service worker for offline caching
- Hosted on GitHub Pages from this repo — push to `main` to deploy

## Development

```bash
python3 -m http.server 8765
# open http://localhost:8765
```

Game code lives in `js/game.js` (levels and treadmills are data at the top of the
file — tweak `LEVELS` / `MILLS` to rebalance). A debug hook is exposed in the
browser console as `window.HGC` (`HGC.setPower(150)`, `HGC.startLevel(0)`, …).

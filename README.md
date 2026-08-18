# Aim Practice Arena

A pure Three.js FPS aim-practice arena. Move around a small 3D range, pick a
weapon, start a timed drill, and shoot moving targets with a center crosshair.

## Run

```bash
npm run dev
```

Then open `http://localhost:5173`.

## Controls

- `WASD`: move
- Mouse: look around after pointer lock
- Left click: shoot
- Left click range buttons: start, reset, or change target speed
- Left click the gun rack: pick up that weapon
- `E`: backup use action for nearby in-world controls
- `1`-`4`: quick switch weapons
- `Esc`: release pointer lock

## Notes

Weapons are slim stylized Three.js models made from geometry and materials.
The desert floor, plaster walls, and distant backdrop use procedural canvas
textures rather than downloaded assets, which keeps the project lightweight and
avoids relying on third-party asset licensing.

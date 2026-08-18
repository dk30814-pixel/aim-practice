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
- `1`-`3`: quick switch weapons
- `Esc`: release pointer lock

## Notes

Weapons are loaded from the OBJ assets in `textures/guns`. The desert floor,
plaster walls, and distant backdrop use procedural canvas textures so the arena
still stays lightweight around the imported gun models.

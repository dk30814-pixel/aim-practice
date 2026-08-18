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
- `E`: use the in-world gun rack or range buttons
- `1`-`4`: quick switch weapons
- `Esc`: release pointer lock

## Notes

Weapons are stylized Three.js models made from geometry and materials rather
than downloaded textures. That keeps the project lightweight and avoids relying
on third-party asset licensing.

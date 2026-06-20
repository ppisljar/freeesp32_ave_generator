# freeesp32_ave_generator

**Web-based session editor and `.led` timeline file generator** for the
[`freeesp32_ave`](https://github.com/ppisljar/freeesp32_ave) audio-visual
entrainment firmware.

Also fully usable on its own as an **in-browser binaural-beat / isochronic
tone generator with synchronized visual flicker** — no firmware or hardware
required.

> **Planned**: export sessions as `.wav` audio files in addition to `.led`
> timeline scripts, so they can be played back anywhere.

**[Live demo →](https://ppisljar.github.io/binaural-frequency-generator/)**
(repo was renamed; the old URL keeps working as a redirect)

## Features

### Audio generation
- **Multiple frequency panels** — build complex multi-frequency soundscapes
- **Wave types** — sine, square, triangle, sawtooth
- **Binaural beats** — lock panel pairs for precise L/R frequency offsets
- **Isochronic tones** — pulsed audio for brainwave entrainment
- **Delayed tones** — stereo delay (left direct, right delayed 1–5000 ms)
- **Volume & panning** — per panel
- **Noise panels** — pink / white / brown noise with modulation

### Visual synchronization
- **Screen flashing** — full-screen flicker at configurable rate and color
- **Flashlight mode** — phone camera flash control (Android Chrome/Edge)
- **Duty cycle control** — 1 – 99 % on/off ratio
- **Auto-detected** best visual mode per device

### Timeline system
- **Keyframe sequences** — choreograph complex audio/visual journeys
- **Keyframe inheritance** — child keyframes inherit parent values
- **Smooth animations** — interpolate frequencies, volumes, visual effects
- **Real-time playback** with visual progress

### Session management
- **Save / load** custom configurations
- **Prebuilt sessions** for meditation, focus, sleep
- **Favorites**, export / import for sharing
- **`.led` export** for playback on `freeesp32_ave` hardware

## Run locally

```bash
python3 serve.py            # starts a local dev server
# open http://localhost:8000
```

Vanilla JavaScript + Web Audio API — no build step.

## Browser compatibility

| Feature | Support |
|---|---|
| Audio | Any modern browser with Web Audio API |
| Screen flashing | Universal |
| Flashlight | Chrome/Edge on Android; limited on iOS |
| Camera permission | Required only for flashlight mode |

## Related projects

| Repo | Role |
|---|---|
| [`freeesp32_audioplayer`](https://github.com/ppisljar/freeesp32_audioplayer) | Open-hardware ESP32 board (KiCad) |
| [`freeesp32_ave`](https://github.com/ppisljar/freeesp32_ave) | Firmware that plays the `.led` files this tool generates |
| [`freeesp32_ave_generator`](https://github.com/ppisljar/freeesp32_ave_generator) | **This repo** — session editor / timeline generator |

## License

TBD.

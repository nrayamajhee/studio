# How the synth engine works

The Device doesn't play samples, and apart from one plain Oscillator source (§5.7) it doesn't use oscillators. Every other note is a small physics simulation. An **exciter** (hammer, pick, finger, breath, bow or drum stick) drives a **resonator** (a string, a tube, a reed or a drum head), and the resonator's own feedback loop creates the pitch and tone. A **body** (soundboard, guitar top, bell) then colors the result.

```text
  +-----------+  energy   +-------------+  vibration  +--------+       +--------+
  |  EXCITER  | --------> |  RESONATOR  | ----------> |  BODY  | ----> |  OUT   |
  | hammer    |           | string loop |             | wood,  |       |        |
  | pick      | <-------- | air column  |             | bell   |       |        |
  | breath    |  (some    | membrane    |             |        |       |        |
  | bow       |  push     |             |             |        |       |        |
  | stick     |  back)    |             |             |        |       |        |
  +-----------+           +-------------+             +--------+       +--------+
```

Struck and plucked sounds only excite the string once, at the start. For blown and bowed sounds the exciter stays coupled to the resonator: the air jet and the bow keep reacting to what comes back. That is why the flute, sax and violin can squeak, overblow and slide.

All code lives in `app/lib/physical/`. The design goals come from `docs/new-synth-plan.md`.

---

## 1. Where it runs

The audio is computed on the browser's audio thread, inside one `AudioWorkletProcessor`. The UI only sends small messages.

```text
   MAIN THREAD                                        AUDIO THREAD (AudioWorklet)
  +-------------------------------+                 +-----------------------------------+
  | SynthDevice (keys, pads,      |                 | PhysicalSynthProcessor            |
  |   knobs)                      |                 |   process() every 128 frames      |
  |        |                      |                 |     engine.frame = currentFrame   |
  |        v                      |   postMessage   |     engine.render(left, right)    |
  | deviceEngine                  |   [events...]   |                                   |
  |   octave offset, kit mapping, | --------------> |   Engine                          |
  |   param de-duplication        |                 |     EventQueue (sorted by frame)  |
  |        |                      |                 |     9 instruments (one bus each)  |
  |        v                      |                 |     FDN reverb, metronome         |
  | physicalSynth (PhysicalSynth) |  stats/warnings |     master volume + safety clip   |
  |   boots AudioContext lazily,  | <-------------- |                                   |
  |   queues events until ready   |   every 0.25 s  +-----------------+-----------------+
  +-------------------------------+                                   |
                                                                      v
                                        DynamicsCompressor (limiter: -3 dB, 20:1, 2 ms)
                                                                      |
                                                                      v
                                                AnalyserNode (feeds the oscilloscope)
                                                                      |
                                                                      v
                                                                  speakers
```

- **Lazy boot.** `physicalSynth.start()` runs on the first user gesture (browsers need that to allow audio). It creates the `AudioContext`, loads `processor.worklet.ts` and waits for a `ready` message. Nothing touches Web Audio at import time, so prerendering the page is safe.
- **Nothing is lost while booting.** Events sent before `ready` are queued and replayed immediately, so the very first key press still sounds, just late. For `param` events only the latest value per target/id is kept.
- **Timing.** Events carry an optional `time` in AudioContext seconds. With no time, they play at the start of the next block (at most ~2.7 ms at 48 kHz).

## 2. The render loop

`Engine.render()` never allocates memory: every buffer, voice and delay line is preallocated. Events are applied at their **exact sample**, because the block is cut into segments at each event:

```text
  one block (128 frames)
  |<----------------------------------------------------------------------->|
  [ voices render 0..37  ][ voices render 37..90         ][ voices 90..128  ]
                          ^                               ^
                          noteOn C4 @ frame 37            param cutoff @ frame 90

  then, once per block:
    each instrument.finish()   body -> drive -> gain  -> master L/R  (+ reverb send)
    reverb.process(send)       -> wet L/R
    lfo, fx                    on master L/R
    out = safetyClip( volume * (master + click + return * wet) )
```

`EventQueue` is a preallocated array kept sorted by frame. Events at the same frame keep their arrival order, so a chord's notes and a param change sent together land in order.

## 3. Signal flow

Each instrument owns one **bus**. Its voices add their panned output into the bus buffers, and the bus stage then finishes the sound:

```text
    voice    voice    voice        each voice pans itself (equal-power)
       \       |       /           piano pans by key, guitar/bass by string
        v      v      v
   +-------------------------+
   |  bus L/R  (per          |     piano, guitar, bass, upright bass, violin,
   |  instrument)            |     sax, flute, drums, 808
   +-------------------------+
                |                  (drum kits: optional lowpass filter here)
                v
   +-------------------------+
   |  BODY                   |     modal soundboard / radiation filter / none,
   |                         |     then a +/-6 dB tilt around 800 Hz
   +-------------------------+
                |
                v
   +-------------------------+
   |  DRIVE (if > 0)         |     softClip(x * (1 + 9d)) / (1 + 2d) -> DC blocker
   +-------------------------+
                |
                v
   +-------------------------+
   |  x outputGain x level   |---------------------------------+
   +-------------------------+                                 |  mono x send
                |                                              v
                v                                   +---------------------+
   master L/R                                       |  FDN REVERB         |
                |                                   |  (shared by all)    |
                v                                   +---------------------+
   +-------------------------+                                 |
   |  LFO (if depth > 0)     |     pitch / volume / filter / pan |
   +-------------------------+                                 |
                |                                              |
                v                                              |
   +-------------------------+                                 |
   |  FX: drive -> chorus    |     each stage skipped at zero  |
   |      -> ping-pong delay |                                 |
   +-------------------------+                                 |
                |                                              |
                v                                              |
          (+) <------------------------------ x return --------+
          (+) <----- metronome woodblock, dry
                |
                v
         x master level            (the Device's red Level knob)
                |
                v
         peak limiter      1.5 ms look-ahead, ceiling 0.7 (-3 dBFS), 100 ms release
                |
                v
         safety clipper    tanh knee above 0.7, never > 1.0 (a last resort)
                |
                v
         worklet output  -> browser limiter -> analyser -> system volume -> speakers
```

- **Idle buses cost nothing.** After its last voice ends, a bus keeps running for 0.5 s so the body can ring out, then it is skipped entirely.
- **Master ADSR.** Every voice is multiplied by one shared amplitude envelope (the `adsr.*` master params, set from the Device's ADSR mode) on top of its model's own envelopes. It triggers when a note or hit starts and releases when the key (or sustain pedal) lets go. The engine's defaults, instant attack, 100% sustain and a 4 s release, leave notes as modelled; the Device sends those when its ADSR is off, and its knob values (0, 200 ms, 50%, 200 ms to start) when it's on. Because it's a volume envelope, a short release can cut a tail, but a long one can't make a damped string ring longer.
- **LFO** (`engine/MasterLfo.ts`, the `lfo.*` master params). One modulator over the whole dry mix, so every model responds the same way. Shapes: sine, triangle, square, random (a new value each cycle); square and random edges are eased over 5 ms so they don't click. Targets:

  ```text
    pitch    delay line swept around its centre: up to +/-3% (about +/-50 cents)
             at full depth, crossfaded in over 20 ms when switched on
    volume   gain = 1 - depth x (1 - lfo) / 2     (full depth dips to silence)
    filter   lowpass swept 250 Hz .. 16 kHz, blended in by depth
    pan      equal-power, centred at rest, hard left/right at full depth
  ```

- **FX** (`engine/MasterFx.ts`, the `fx.*` master params), in series:

  ```text
    drive    the bus drive curve, softClip(x * (1 + 9d)) / (1 + 2d), then a DC blocker
    chorus   two taps swept in quadrature around 15 ms (+/-4 ms at 0.8 Hz):
             left and right drift apart, widening the image
    delay    ping-pong: the mono sum enters on the left, each repeat crosses
             sides every 250 ms (an eighth note at 120 BPM), 0.45 feedback,
             3.5 kHz damping so repeats darken
  ```

  A stage at zero is skipped, and the chorus and delay clear their lines when they switch off, so an old tail never replays. The Device's FX module also has a Reverb knob; it sets `reverb.return`, the level of the shared reverb above. The reverb is fed by the instruments' sends, not by the FX, so echoes don't pile into it.

- **The metronome stays dry.** Its woodblock is added after the LFO and FX, so tremolo or echoes never blur the click.
- **No zipper noise.** Gain, send, drive, volume, reverb return and the LFO and FX amounts glide through `Smoother`s (~10 ms one-pole).
- **Why two limiters?** A chord's hammers or plucks land on the same sample, so their transients stack almost fully: a piano triad at the default level peaks about 6 dB over −3 dBFS. Those sub-millisecond peaks are too fast for the browser's compressor. The engine's look-ahead limiter (`dsp/PeakLimiter.ts`) sees each peak 1.5 ms early and ramps the gain down to meet it, so the chord is turned down for a moment instead of squashed; below the ceiling it only delays. It delays everything by those 1.5 ms. The tanh clipper behind it only catches what rounding lets through, and the browser's compressor still guards the track mixer and scrubber, which sum rendered buffers outside the engine.
- **Level and volume.** The master level (`master.volume`) is applied before the limiter, so it sets how hard chords push into it. The Device's white knob is a system volume after the browser limiter and analyser, so turning it up never clips.

## 4. Voices and their lifecycle

A voice is one sounding note (or one string, or one drum piece). Every model shares the same state machine from `engine/Voice.ts`:

```text
                  noteOn
       +------+ ---------> +--------+   noteOff / breath or bow ends   +----------+
       | IDLE |            | ACTIVE | -------------------------------> | RELEASED |
       +------+            +--------+                                  +----------+
          ^                    |                                            |
          |                    | voice stolen for a new note                | quiet for 50 ms
          |                    v  (5 ms fade-out)                           | (< -90 dBFS)
          |               +--------+       quiet for 50 ms                  |
          |               | STOLEN | ------------------------------+        |
          |               +--------+                               |        |
          |                                                        v        v
          +-------------------------------- free() <------------------------+

   Also freed: any voice that stays silent for 1 s, even while ACTIVE.
   Drum hits go straight to RELEASED (they are one-shots).
```

When all voices are busy, `pickVictim` chooses which one to reuse: the **quietest released** voice first, otherwise the **oldest active** one. Voice pools hold a few spares above the polyphony so a stolen voice can fade out while its replacement starts.

## 5. The instruments

### 5.1 Strings: piano, guitars, ukulele, banjo, basses, harp and sitar

`models/StringLoop.ts` is an extended **Karplus-Strong** loop. A wave travels around a delay line, and each trip through the loop filters it a little:

```text
        +---------------+   +---------------+   +---------------+   +---------------+
  +---->| DELAY LINE    |-->| DISPERSION    |-->| LOSS          |-->| TUNING        |---+
  |     | N_int samples |   | M allpasses   |   | one-pole LP   |   | allpass for   |   |
  |     |               |   | (stiffness:   |   | (highs die    |   | the fraction  |   |
  |     |               |   |  highs travel |   |  faster) x g  |   | of a sample   |   |
  |     |               |   |  faster)      |   | (overall T60) |   | left over     |   |
  |     +---------------+   +---------------+   +---------------+   +---------------+   |
  |                                                                                      v
  +------------------------------------------------------------------------------------(+)<-- excitation
                                                                                         |
                                                                                         +--> string output
```

**Exact tuning.** The pitch is whatever frequency makes the loop exactly one period long. Every filter adds a little delay, so the loop subtracts that delay at the fundamental ω0:

```text
   fs / f0  =  N_int  +  d  +  tau_loss(w0)  +  M * tau_dispersion(w0)
               ^^^^^     ^
               integer   fraction in [0.5, 1.5), realised by an allpass solved
               delay     for exactly that delay at w0
```

**Exact decay.** The loop gain `g` is chosen so the note loses 60 dB after `f0 * T60` trips around the loop:

```text
   g = 10^(-3 / (f0 * T60)) / |H_loss(w0)|        (capped at 0.99999 so it can never grow)
```

For very high notes with long decays, the loss filter alone would already lose too much per trip. The loop then lightens the filter just enough to keep `g < 1` (`lightestLoss`).

Everything that varies across the keyboard is a **key table**: piecewise-linear values per MIDI note for T60, loss (brightness), dispersion stages and coefficient, damper T60, unison detune and hammer mass. For example, the piano rings 18 s at A0 and 0.5 s at C8, with 8 dispersion stages in the bass and none above C6.

#### Exciters (`models/exciters.ts`)

The exciter writes a short burst into a buffer, and the loop adds it in sample by sample.

```text
  HAMMER (piano)                          PICK (guitar)            FINGER (basses)
                                                /\
     hammer: mass m, speed v0                  /  \                    .--.
        |                                     /    \                  /    \
        v    felt squashes by c              /      \____            /      \______
   ====[felt]====   F = K * c^2.5          0  apex       period     0  width       period
   ------+-------   string = two             (pluck point)          raised cosine
                    half-strings (2Z)      + scrape noise,          + a little noise
                                             lowpassed by hardness
   simulated 4x oversampled until the
   felt leaves the string (~1 ms at C4)    + a sharp "click" edge
```

- **Hammer.** A small physics simulation: a felt hammer (stiffness exponent 2.5) hits a string. Faster hammers and harder felt give a shorter contact, and a shorter contact means a brighter tone. Hammer mass follows the key: heavy in the bass, light in the treble.
- **Pick or finger.** Each plucked string starts on its instrument's usual pluck, and its **Pluck** param switches it: a pick displaces the string into a triangle with the scrape of the pick as noise, a fingertip into a soft raised-cosine bump. A strum plays the same pluck on each string, so the Picked and Fingerstyle Guitar presets strum the same way they pick.
- **Pluck position.** Plucking or striking a string at 1/β of its length silences every β-th harmonic. A comb `e[n] - e[n - b]` removes those harmonics (the pick's triangle already has the notches built in).
- **Velocity** blends between "ignore velocity" and `velocity^curve` through the Strength parameter.

#### Voice chain and allocation

```text
  1-3 loops ---> sum ---> [pickup comb] ---> DC blocker ---> SVF lowpass ---> amp env ---> pan ---> bus
  (unison or              (electric bass:                    cutoff glides,
   2 polarizations)        e[n] - e[n-tap])                  filter env, keytrack
```

|                 | Piano                                                       | Guitar                             | Electric / upright bass                 |
| --------------- | ----------------------------------------------------------- | ---------------------------------- | --------------------------------------- |
| Allocation      | per **key**, 24 voices                                      | per **string**: 6 open strings     | per **string**: 4 open strings          |
| Loops per voice | 1–3 unison strings (detuned, each decaying at its own rate) | 2 polarizations (+0.3 ¢, 0.6× T60) | 1                                       |
| Exciter         | felt hammer                                                 | pick                               | finger                                  |
| Body            | 20-mode soundboard                                          | modal top plate                    | none (pickup comb + drive) / modal body |

- **Per-string allocation.** A note goes to the string that can play it at the lowest fret. If that string is already ringing, the voice damps it for 8 ms, retunes it and plucks it again (a **re-fret**).
- **Re-striking** a key that is still sounding re-excites the same loops, so the old vibration keeps going underneath the new one, as it would on a real string.
- **Dampers.** A note-off ramps the loop's T60 down to the damper T60 over 15 ms. With the sustain pedal down, the damping waits until the pedal lifts. Piano keys above F6 have no dampers, like a real piano.
- **Strum.** Chord-macro notes arrive as a burst within 15 ms. If the Strum param is set, each note in the burst is delayed a few more milliseconds than the last.
- **Electric guitar and bass** have no acoustic body. A pickup tap subtracts the loop read a few samples away (the comb filter of a magnetic pickup), and the bus drive stands in for the amp. The **nylon guitar** uses the finger exciter, darker loss and less stiffness than steel.
- **Harp.** A string per key, and no dampers anywhere in its range, so every note rings until it fades.
- **Ukulele and banjo.** Both use per-string allocation. The ukulele's four nylon strings are re-entrant (G4 C4 E4 A4, the G above the C), over a small body whose modes sit higher than a guitar's. The banjo's five steel strings are in open G with the short high g drone, picked near the bridge; its body is a tight drumhead, so the modal body holds membrane modes that ring bright and short, and the strings fade sooner than a guitar's.
- **Sitar.** A steel string plucked by a wire mizrab, over a body that holds both the gourd's modes and the **taraf**: eleven sympathetic strings tuned to C major (C4–G5), each a 3 s mode at its fundamental and a 2 s mode at its octave, so they ring along with matching notes and harmonics. The playing string buzzes on its **jawari**, a broad curved bridge, modelled after Pierce & Van Duyne's passive nonlinear filter: one more stage in the loop, a first-order allpass that is a plain one-sample delay at rest and switches to coefficient `contact` (0.6 × the Jawari param) while the string is past the bridge's gap.

  ```text
    ... tuning allpass ---> JAWARI ---> + excitation ---> delay line ...
                            |  s > gap ?  a = contact : a = 0
                            |  (y, s') = (a x + c s, c x - a s),  c = sqrt(1 - a^2)
  ```

  Shortening the loop for part of every swing throws energy into the upper partials, and the louder the string, the more of each swing it spends on the bridge, so the note blooms brighter after the pluck and the buzz fades with it. Written as a rotation of (input, state), the stage never adds energy however it switches, so the loop stays stable. Its rest delay of one sample is taken out of the loop length, so the sitar is in tune by construction like the other strings. The string's loss is kept light and its T60 long, because the buzz only lasts as long as the partials it feeds.

### 5.2 Blown: flute, alto sax, clarinet, trumpet, bass trumpet and trombone (ported from STK)

A wind instrument is a nonlinear "mouth" coupled to a tube. Pressure waves travel down the tube, reflect off the open end or bell, and come back to disturb the jet or reed. That disturbance is what keeps the note going.

```text
   breath pressure = maxPressure x ADSR x (1 + noise + vibrato)
         |
         v
  +--------------+  pressure wave  +------------------------------+  +---------------------+
  | MOUTH        | --------------> | TUBE                         |->| OPEN END / BELL     |
  | nonlinearity |                 | delay line(s), fractional    |  | lowpass, inverted   |
  |  flute: jet  | <-------------- | length (Lagrange-3 reads)    |<-| (reflects back in)  |
  |  sax:   reed |   reflection    +------------------------------+  +---------------------+
  +--------------+                                     |
                                                       v
                                                     output
```

|            | Flute (STK `Flute`)                                                       | Sax (STK `Saxofony`)                                             | Brass (STK `Brass`)                                                          |
| ---------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Mouth      | air jet: its own delay (Jet ratio × tube) then `x(x² − 1)`, clamped       | reed table `0.7 + slope·x`, slope = 0.1 + 0.4 × Reed stiffness   | lips: a resonance at the note; its output squared and clipped is the opening |
| Tube       | tuned to 2/3 of the note, so the jet overblows it into the right register | split into reed-side and bell-side sections at the Blow position | two periods long, so the lips lock onto its second mode                      |
| Reflection | one-pole lowpass, inverted, DC-blocked                                    | −0.95 × lowpass with cutoff **14 × f0** (min 500 Hz)             | 0.85 back at the lips, DC-blocked                                            |

STK fixes the sax's bell lowpass at about 740 Hz. That makes low notes overblow an octave up and high notes fail to speak. On a real sax the open tone holes move the reflection with the note, so here the cutoff tracks f0.

STK's lip resonance (radius 0.997, input gain 0.03) has a DC gain of about 0.03/ω², so low notes hold the lips wide open and never oscillate. Here its Q and gain are fixed relative to the note instead:

```text
   r = 1 - 0.026 w          gain = 2.26 w^2          (w = 2 pi f_lip / fs)
```

These match STK at 880 Hz, where it speaks well, and keep the lips behaving the same at every pitch, so both trumpets speak from E2 to C6. Lip tension moves the resonance ±0.05 octave, brightening and bending the note as tightening real lips does. The **trombone** is the same lip loop with a larger, darker bell (presence near 600 Hz) and a long portamento for the slide.

The **clarinet** (STK `Clarinet`) is a reed on a cylinder: one delay line, the reed table `0.7 − slope·x` on the difference between the reflected wave and the breath, and an end reflection of −0.95 through a two-point average. The inverting reflection makes the loop two passes of the bore, so its delay is half the period, less the average's half sample and the loop's sample; a tube closed at one end like this sounds mostly odd harmonics.

Shared behavior:

- **Monophonic, last-note priority.** Holding a note and pressing another retunes the tube without a new attack (**legato**), and the delay lengths glide (**portamento**). Releasing returns to the previous held note. In a chord burst, only the first note plays.
- **Velocity → breath.** Velocity sets the steady pressure between the patch's `pressure: [low, high]`, scaled by the Breath knob.
- **Watchdog.** If the loop ever blows up (|out| > 4, or NaN), it is cleared and a warning is posted once.
- **Measured tuning.** A nonlinear loop settles slightly off the pitch its delay implies. Each patch carries a `tuningCents` table measured at 44.1 and 48 kHz, and the engine picks the closest rate.

### 5.3 Bowed: violin and cello (STK `Bowed`)

The bow sits on the string, splitting it into a neck side and a bridge side. At every sample the bow compares its own velocity with the string's velocity under it. The friction curve decides whether the string **sticks** to the bow or **slips** free, and that stick-slip cycle is the sawtooth-like motion a bowed string makes.

```text
   nut                              bow                                bridge
    |<------- neck delay ----------->|<------ bridge delay ------------>|
    |       (1 - beta) x D           |          beta x D                |
    |                                |                                  |
   reflect x -1               dv = v_bow - v_string              reflect x -0.95 x lowpass
                              f  = dv x bowTable(dv)                    |
                              (injected both ways)                      v
                                                          6-biquad violin body (Maestre)
                                                                        |
                                                                        v
                                                                       out

   bowTable(x) = (|slope x (x + 0.001)| + 0.75)^-4, clamped to [0.01, 0.98]
   slope = 5 - 4 x Bow pressure            beta = Bow position
   v_bow = (0.03 + 0.2 x velocity) x Bow speed x ADSR
```

- Up to 4 voices (double stops and chords). Vibrato modulates the neck length and fades in after 0.3 s, the way a player adds it late.
- **Portamento**: a note played while another is still held starts at that note's loop length and glides to its own (80 ms on the violin, 100 ms on the cello), like a finger sliding along the string. Notes starting within 30 ms of each other are a chord and don't glide. The plucked and struck strings have no portamento: a fret or hammer jumps.
- The body filter was designed at 44.1 kHz. Its pole/zero pairs are rescaled to the actual sample rate so the resonances stay put.
- The **cello** runs the same loop an octave and a fifth lower. The violin's filter would put its resonances in the wrong place, so the cello uses the bus's modal body instead (air and wood modes near 100 and 200 Hz); its Body knob is that body's mix.

### 5.4 Drums: Drum Kit, Rock Kit, Jazz Kit, 808 Kit, 909 Kit, Madal and Tabla

Drums use **modal synthesis**: the resonator is a bank of decaying sine waves, one per vibration mode. Each mode is a two-pole resonator:

```text
   y[n] = g x[n] + 2r cos(theta) y[n-1] - r^2 y[n-2]

   theta = 2 pi f / fs              (mode frequency)
   r     = exp(-ln(1000) / (T60 fs)) (mode decay)
   g     = amp x sin(theta)          (impulse response peaks at ~amp)
```

```text
  stick pulse: half-sine, soft..hard ms   (harder hit = shorter pulse = brighter)
    or brush: a light push + a burst of bristle noise (unit energy, length ms)
        |
        v
  +---------------------------------------+
  | MODAL BANK  sum of decaying sines     |  membrane: pitch starts high and settles
  |   mode i: f_i, T60_i, weight_i        |  (tension modulation), updated every 32 samples
  +---------------------------------------+
        |   + click   : highpassed noise, a few ms  (beater)
        |   + wires   : highpassed noise x envelope of the drum itself (snare)
        |   + sizzle  : highpassed decaying noise (hats, cymbals)
        |   + hiss    : the brush's bristle burst, highpassed (brushed pieces)
        v
   x level x velocity  ->  pan  ->  kit bus
```

| Piece model                                                   | How it's built                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **membrane** (kick, snare, toms)                              | Ideal circular-membrane ratios 1, 1.593, 2.136, 2.295, 2.653, …. **Position** blends center hits (only the symmetric modes) toward edge hits (all modes). Optional shell mode.                                                                                                                          |
| **metal** (hats, cowbell, crash, ride, ride bell, side stick) | Either a table of modes or a seeded log-spread set: `T60_i = T60 (f_lo / f_i)^0.3`, amplitude `1/sqrt(i+1)` ± 30 %. A closed hat **chokes** the open hat (30 ms).                                                                                                                                       |
| **noise** (clap, tambourine, brush sweep)                     | Several short noise bursts a few ms apart (slightly jittered), then a decaying tail, all through a bandpass. The sweep has no bursts: its tail swells in from silence (a raised cosine) before it decays, as a brush stirred across the head does.                                                      |
| **loaded** (madal, tabla)                                     | A head loaded with paste (syahi, kharee) has near-harmonic modes, so each stroke lists its own partials (ratio, T60, amp). Open strokes ring (Tun, Ta), rim strokes damp the fundamental (Na, Tin), closed strokes are short slaps (Te, Ke, Ti, Ka), and Ge settles in pitch as the bayan head relaxes. |
| **combo** (Dha, Dhin)                                         | Strokes played together (Dha = Na + Ge), scaled to peak like a single stroke.                                                                                                                                                                                                                           |

**Brushes** (the Jazz Kit) replace the stick on the membranes and metals: the stick pulse lands at about a third of its weight, and the wires add a noise burst that rises in 1.5 ms and dies away over the piece's brush length (shorter on a harder stroke). The burst is scaled to unit energy, so it drives every mode about as hard as a stick's impulse whatever its length, and part of it, highpassed, is heard directly as the brush's hiss. On the snare the hiss and the head's own motion set the wires buzzing.

Each piece is one voice: hitting it again restarts it. The kits differ only in their constants (`patches/drums.ts`, `patches/handDrums.ts`), and each maps the 12 pitch classes to its own pieces (`keys`), which the Device plays from the keybed (the hats sit on the first black keys, F♯ closed and G♯ open, with the clap on A♯; on the Drum, Rock and Jazz kits every key has its own sound: F kick, G snare, A and B toms, C♯ side stick, D crash, D♯ ride or ride bell, C ride or tambourine, E cowbell or brush sweep; on the hand drums, keys show the stroke's syllable).

The **metronome** is a separate two-mode woodblock (1.9/2.9 kHz, higher when accented) that goes straight to the master, dry.

### 5.5 Free reeds: harmonium, harmonica and accordion (`models/ReedInstrument.ts`)

A free reed is a brass tongue that swings through a slot. Each swing it lets a pulse of air past, and that pulsing flow is the sound; unlike the sax's reed, no tube sets the pitch, so the tongue's own frequency does. A key can have several reeds: the harmonium's second sits a few cents sharp and beats against the first, and the accordion's musette has three, one in tune and one either side of it.

```text
   pressure = ADSR x drive x (1 + swell)          swell: bellows (harmonium), hand tremolo (harmonica)
        |
        v
   +--------------------------+     x      +---------------------------+   flow   +-----------+
   | REED  van der Pol        | ---------> | SLOT  opening(x - slot)   | -------> | d/dt      | --> DC block --> lowpass --> bus
   | x'' - (2/t)(D - 1 - 4Dx^2)x'          |   + (1 - asym) opening(-x - slot)    | (radiated |
   |     + w^2 x = 0          |            |   + clearance;  x sqrt(p) |          |  sound)   |
   +--------------------------+            +---------------------------+          +-----------+
                                                                   + air noise riding on the flow
```

- **The reed** is a two-pole resonator tuned to the note whose swing dies away over `settle` seconds, fed by its own velocity in proportion to the drive `D`. Below D = 1 it just rings down; above it the swing grows and settles at an amplitude of `√((D − 1)/D)`, so a harder push swings it wider. The pressure step bends the reed first (`push`), so it speaks in tens of milliseconds rather than growing from nothing.
- **The slot.** Air rushes past once the tongue is more than `slot` from rest (the Brightness param moves it); the opening's corners are rounded so high notes don't alias. `asymmetry` is how much less it opens on the way back: one-sided swings keep the fundamental, symmetric ones would sound the octave. The flow follows the opening and `√pressure` (Bernoulli).
- **The sound** is the flow's slope, as a small source radiates, so the pulses' edges make it bright, and a wider swing brightens it further. Its 6 dB-per-octave rise is mostly taken back so the range sits level.
- **Two reeds a key** (harmonium): the second is a few cents sharp, so the pair beats; the Celeste param scales how far.
- **Polyphonic.** Up to 12 voices (harmonium) or 6 (harmonica); a measured `tuningCents` table corrects the small detune of the discrete oscillator.

### 5.6 Tuned percussion: xylophone, steel pan and kalimba (`models/BarInstrument.ts`)

A struck bar, a hammered pan dome and a plucked tine all ring in a handful of modes whose frequencies are fixed multiples of the note, and mostly not whole ones. Each key is a small modal bank:

```text
  strike: half-sine pulse, length = contact(hardness) x (1 + 0.3 x (0.5 - velocity))
        |
        v
  +----------------------------------------------+
  | MODES   f0 x ratio, level x ratio^brightness, |  --> lowpass --> master ADSR --> pan (by key) --> bus
  |         T60 x decay(key) x Decay param        |
  +----------------------------------------------+
```

|               | Xylophone                                                                       | Steel pan                                                    | Kalimba                         |
| ------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------- |
| Modes (ratio) | 1, 3, 6.2, 9.9, 13.9 (bars undercut to the twelfth; tubes lift the fundamental) | 1, 2, 3, 4.02, 5.05, with twins at 1.004 and 2.006 that beat | 1, 6.27, 17.55 (a clamped tine) |
| Strike        | hard mallet, 1.2–0.25 ms                                                        | rubber-tipped stick, 3–0.8 ms                                | thumb, 4–1.5 ms                 |
| Body          | none                                                                            | none                                                         | a small box (modal)             |

- **The strike** is the drum kit's half-sine stick pulse, area-normalized, so the low modes keep their level and a shorter contact (a harder mallet, a harder hit) only adds the highs.
- **Exact tuning.** Every mode is a resonator at its own frequency, so nothing needs a tuning table. Modes above 0.45·fs are left silent.
- **No dampers.** A note rings until it fades; striking it again while it rings adds to what is sounding, as on the real thing.

### 5.7 Oscillator (not a physical model)

The one source with nothing to simulate: a sine, triangle, square or saw (the **Wave** param, in the LFO's shape order with a saw in place of random) through a lowpass, for the master ADSR, LFO and FX to shape. It runs on its own bus like any instrument, so it reaches them the same way.

```text
  oscillator (sine | triangle | square | saw)  x velocity
        |
        v
  SVF lowpass (Cutoff, Resonance)  ->  gate (Attack, Release)  ->  master ADSR  ->  bus
```

- Raw square and saw edges alias at high notes, so the square and saw steps are rounded off with **polyBLEP** and the triangle's corners with **polyBLAMP** (`dsp/generators.ts`), about 15 dB less aliasing at F7.
- Each wave is scaled to a sine's RMS, so switching waves keeps the level; one output gain puts a mezzo-forte C4 at −14 LUFS momentary for all four.
- The gate holds full level while the key is down; decay and sustain come from the master ADSR. Up to 8 voices.
- **Glide**: played legato, a new note's frequency slides from the held note's (50 ms by default), under the same chord rule as the bowed strings.

## 6. Bodies (`models/Body.ts`)

```text
  modal      bus --> mono --> [ modal bank: N modes ] --x mix--> added to L and R
             (piano soundboard: 20 modes, log-spaced 60 Hz - 3 kHz, T60 0.25 s -> 0.04 s)

  radiation  bus --> [ highpass (+ presence peak) ] --crossfade by mix--> L, R
             (flute, sax: the open end / bell radiates highs better than lows)

  none       bus passes through (electric bass, violin: its body lives in the voice)

  all        then an optional +/-6 dB tilt around 800 Hz (Tone)
```

A body is driven continuously, not by a single impulse, so each mode's resonant gain is normalized (`amp x 2(1 - r)`). Without that, long-ringing modes would boost the level by tens of dB. **Size** scales the mode frequencies (0.7–1.4×), and **Resonance** scales their decay (0.5–2×).

## 7. Reverb (`dsp/Fdn.ts`)

One shared 8-line **feedback delay network**. Each instrument feeds it through its own Reverb send.

```text
  send (mono) --> predelay 0-60 ms --> 4 Schroeder allpass diffusers (3.1, 5.3, 8.9, 12.7 ms)
                                                   |
                                    +/- 1/sqrt(8) into each line
                                                   v
   +--------------------------------------------------------------------------+
   |   line 0   line 1   line 2   ...   line 7     29 ms .. 71 ms, prime      |
   |     |        |        |               |       lengths, x Reverb size     |
   |   damping lowpass on each line (Reverb damping)                          |
   |     |        |        |               |                                  |
   |   x g_i     x g_i     x g_i          x g_i    g_i = 10^(-3 L_i / (T60 fs))|
   |     |        |        |               |                                  |
   |   +------------------------------------------------+                     |
   |   | Householder mix  I - (2/8) 1 1^T   (lossless)  | --> back into lines |
   |   +------------------------------------------------+                     |
   +--------------------------------------------------------------------------+
         taps 0, 2, 4, 6 (+ - + -) --> wet L        taps 1, 3, 5, 7 --> wet R
```

- Every line loses exactly 60 dB in the Reverb decay time, whatever its length.
- The Householder matrix mixes every line into every other one at O(N) cost, so echoes smear into a dense tail.
- **Sleep.** After 0.5 s below −100 dBFS the reverb clears itself and stops computing, and it wakes on the next input.

## 8. Parameters

Every instrument publishes a list of `ParamSpec`s (`patches/params.ts`). The Lab builds its panel from that list, the Device's Synth screen displays it, and saved presets store it.

```text
  ParamSpec {
    id:       "exciter.hardness"      section.name
    label:    "Hardness"
    section:  exciter | resonator | body | filter | envelope | space
    min, max, default
    unit:     Hz | s | % | cents | dB | st | x | ms       (display only)
    scale:    linear | log                                (knob mapping)
    primary:  shown without "Advanced"
  }
```

- **Knob mapping.** `fromUnit(spec, t)` maps 0–1 across the range, geometrically for log params. The Device's knobs have 11 steps: step `k` means `t = k / 10`.
- **When changes take effect.** On strings and winds, settings that shape the attack or tune the loop (hardness, position, decay, brightness, inharmonicity, breath) apply from the next note. Everything else changes notes that are already sounding: filter, body, drive, level, send, reverb, volume, vibrato, bow pressure and the drum controls. Values that would click if they jumped are smoothed.
- **Presets.** `deviceEngine.loadPreset` resets _every_ param of the instrument to its default or the preset's override, so settings never leak between presets. It only sends values that actually changed. Saved presets are a full snapshot of those values.

## 9. From key press to sound

```text
  press "Z"
    |
    v
  SynthDevice.pressKey(semitone)        chord macro on? expand into chord intervals
    |
    v
  deviceEngine.noteOn(midi)             + the preset's octave offset
    |                                   kit? pitch class -> drum piece -> physicalSynth.hit()
    v
  physicalSynth.noteOn(target, note)    postMessage([event])   (queued until booted)
    |
    v  ------------------------------------------------ audio thread -----------
  Engine.schedule(event)                no time -> start of the next block
    |
    v
  StringInstrument.noteOn               fold into range, pick a voice,
    |                                   tune the loops, write the excitation
    v
  voice renders into the bus -> body -> drive -> gain -> master -> clip -> speakers
```

## 10. Calibration and checks

- **Pitch.** Strings are in tune by construction, because the loop filters' delay is compensated at the fundamental. The winds, brass, free reeds and bowed strings use measured `tuningCents` tables per sample rate. Re-measure those after changing their loops.
- **Loudness.** Each patch's `outputGain` puts a mezzo-forte C4 at −14 LUFS momentary: the loudest 400 ms, K-weighted as ITU-R BS.1770 and EBU R128 meter it (`momentaryLoudness` in `offline/analysis.ts`). Matching that rather than an average over a second makes instruments sound equally loud: a pluck that strikes and fades against a bow that swells and holds. Drum pieces peak at −3 dBFS on a hard hit.
- **Offline rendering.** `offline/renderEngine.ts` runs the same `Engine` in plain TypeScript (Node or browser). `offline/renderOffline.ts` renders through the real worklet in an `OfflineAudioContext`.
- **Diagnostics** (`offline/diagnostics.ts`, runnable from Storybook > Lab / Instrument Lab > Diagnostics):

  | Sweep                 | Checks                                                                                               |
  | --------------------- | ---------------------------------------------------------------------------------------------------- |
  | tuning                | every note within tolerance of its target pitch                                                      |
  | decay                 | string T60 matches the patch's table                                                                 |
  | stability             | loops never blow up across velocities and params                                                     |
  | loudness, drum levels | the calibration targets above                                                                        |
  | stress                | how much faster than real time a dense passage renders (sustained piano cluster, fast guitar strums) |
  | onset, lifecycle      | notes start on time; voices free themselves                                                          |

- **Unit tests.** `npm run test:unit` runs the DSP building blocks (`dsp/dsp.test.ts`) and the engine (`physical.test.ts`) in Node.

## 11. File map

```text
  app/lib/physical/
  |-- index.ts               physicalSynth singleton (safe to import during prerender)
  |-- PhysicalSynth.ts       main-thread facade: boot, queue, limiter, analyser, offline render
  |-- Scrubber.ts            plays a rendered take at a drag's speed (tape / vinyl scrub)
  |-- processor.worklet.ts   the AudioWorkletProcessor (only file touching worklet globals)
  |-- messages.ts            event / stats / warning types shared by both threads
  |-- engine/
  |   |-- Engine.ts          render loop, segmenting, master stage, limiter, safety clip
  |   |-- MasterLfo.ts       the LFO over the mix: pitch, volume, filter, pan
  |   |-- MasterFx.ts        drive, chorus, ping-pong delay over the mix
  |   |-- EventQueue.ts      preallocated frame-sorted queue
  |   |-- Instrument.ts      bus: body, drive, gain, reverb send, idle tail
  |   |-- Voice.ts           voice state machine, pickVictim
  |   `-- ParamSet.ts        clamped param values by id
  |-- models/
  |   |-- StringLoop.ts      single-delay-loop string, jawari bridge
  |   |-- exciters.ts        hammer, pluck, stick
  |   |-- StringInstrument.ts piano, guitars, ukulele, banjo, basses, harp, sitar
  |   |-- BoreInstrument.ts  flute, sax, clarinet, brass
  |   |-- ReedInstrument.ts  harmonium, harmonica, accordion (free reeds)
  |   |-- BarInstrument.ts   xylophone, steel pan, kalimba (modal)
  |   |-- BowedInstrument.ts violin
  |   |-- DrumKit.ts         drum kits + metronome woodblock
  |   |-- OscillatorInstrument.ts  band-limited oscillator source
  |   |-- Body.ts            modal / radiation bodies, tilt
  |   `-- Waveguide.ts       fractional delay section (STK DelayL style)
  |-- dsp/                   DelayLine, filters, Svf, modal banks, Fdn, Adsr, noise/LFO,
  |                          jet/reed/bow tables, phase-delay math, peak limiter
  |-- patches/               per-instrument constants, key tables, ParamSpecs, tuning tables
  `-- offline/               renderers, analysis, diagnostics
```

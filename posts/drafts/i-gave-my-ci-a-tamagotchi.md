---
title: I Gave My CI a Tamagotchi
dek: Meta open-sourced the Muse gadget SDK, and my Arduino UNO Q had an 8x13 LED matrix doing nothing but blink boot codes. Now a pixel creature lives there: it hops when CI goes green, sulks when a deploy fails, dozes when the board runs hot.
tags: [AI, Arduino, IoT, Hardware, Open Source]
cover: posts/covers/i-gave-my-ci-a-tamagotchi.jpg
hero: posts/covers/i-gave-my-ci-a-tamagotchi-hero.png
hero_alt: The muse-familiar pixel creature on an LED matrix
hero_caption: Repo art for muse-familiar (owner board photo pending) — live demo with real frame data at nitishagar.github.io/muse-familiar
---

# I Gave My CI a Tamagotchi

*Meta open-sourced the Muse gadget SDK, and my Arduino UNO Q had an 8×13 LED matrix doing nothing but blink boot codes. Now a pixel creature lives there: it hops when CI goes green, sulks when a deploy fails, dozes when the board runs hot — and the AI assistant I talk to every day can ask how it's feeling. The interesting engineering isn't the creature. It's where the safety lives.*

---

> **[Hero image: the board mid-hop, or docs/og-image.png from the repo. Live demo with the real frame data: https://nitishagar.github.io/muse-familiar/ ]**

## The matrix was just sitting there

The Arduino UNO Q is two computers pretending to be one board: a Qualcomm quad-core running Debian, and an STM32 microcontroller running Zephyr sketches. Between them sits a small blue LED matrix — 104 pixels, eight brightness levels, and, until last week, no purpose in my life.

Then Meta open-sourced the [Muse gadget SDK](https://github.com/facebookincubator/muse-gadget-sdk). Muse is the assistant; a *gadget* is a machine Muse can reach — run a command, read a file, get a message into your chat. The Linux SDK turns any Debian box into one. The obvious demo is a dashboard. The correct demo is a pet.

So I built [muse-familiar](https://github.com/nitishagar/muse-familiar): a small creature on the matrix, fed by webhooks. It knows seven moods and eleven kinds of news:

| It hears | It feels |
|---|---|
| `ci_green`, `deploy_ok`, `merge` | happy |
| `ci_red`, `deploy_fail` | sad |
| `alert`, `incident` | wide-eyed |
| `mention`, `poke` | curious |
| board hits 78 °C | sleepy |

Pair it with Muse and the creature narrates: *"The Familiar is now sad (event: deploy_fail)."* And the direction that matters works too — *"make the Familiar happy"* is now a sentence my assistant understands and can act on. **An assistant with a body it can cheer up behaves differently than one with only a text box.** I can't prove that yet. I check on the creature more than I check the dashboard, though.

## The constraint that made it fun

The two brains talk over the board's message router, and the router caps messages around **256 bytes**. One animation frame is 104 characters. You can do that math: two frames per message, never three.

So the protocol chunks. `begin` (how many frames, how fast) → `chunk` (two frames, base-104 art) → `play`. Round trip measured at **19 milliseconds**. Constraints like this are a gift — the protocol wrote itself once the number was known, and "make it fit in 256 bytes" settled every design argument before it started.

## The safety lives in the part that can't crash

Here's the part I actually want to argue. A creature that flashes at 30 fps when your engine dies isn't a gadget, it's a photosensitivity hazard on a desk. So the question is: where does the cap live?

The tempting answer is the engine. The engine is Python, it's right there, add a rate limiter. But the engine is exactly the component that fails — that's the scenario we're designing for. Every layer above the hardware shares one property: **they can all die together.** The only clamp that survives a crash is the one below every layer that can fail.

So the clamps live in the Zephyr sketch, burned into the same firmware that draws the pixels: **minimum 250 ms per frame (≤4 fps), maximum 64 frames, 3-bit grayscale, and a 30-second idle timeout.** The engine sends a heartbeat with every animation. If the heartbeat stops — crash, kill -9, power brownout, whatever — the sketch doesn't strobe and doesn't guess. It draws a dim sleeping glyph and waits for a competent adult.

We test it the way it will actually fail: SIGKILL the engine mid-show, on the board. The systemd unit restarts it, and while it's down the matrix dims to the nap glyph. No strobe, no half-drawn face frozen mid-hop. **The engine has opinions. The sketch has laws.** A mood engine is allowed to be moody; the thing driving photons is not.

The webhook gets the same treatment — key'd, 2 KiB body cap, 12 requests a minute, bounded queue — but those are conventional. The MCU clamp is the one people skip, because the dumb component feels beneath architecture. It's the opposite: the dumb component is the last line that still works when everything smart is dead.

## Build your own in three commands

1. Clone and flash: `git clone https://github.com/nitishagar/muse-familiar ~/muse-familiar && cd ~/muse-familiar`, then `firmware/upload.sh` (needs the board's password, typed not stored).
2. `scripts/install.sh` — generates the webhook key, links the systemd unit, done. Dry-run first with `--check`.
3. Make it hop: `python3 -m familiar.cli feed ci_green` — or `curl -X POST localhost:8123/poke -H "X-Familiar-Key: $(cat ~/.config/familiar/key)" -d '{"kind":"ci_green"}'`.

The [landing page](https://nitishagar.github.io/muse-familiar/) plays the *actual* frame data in your browser, so you can meet the creature before owning a board. MIT, open source, and the repo ships a GitHub Action and a Home Assistant snippet for feeding it from things that aren't your terminal.

## Takeaway

Nobody needs a tamagotchi for their CI. That's the point. The fastest way I've found to actually learn a new SDK is to give it something with feelings to take care of — every design decision gets sharper when the thing on the other end has a face. Somewhere between the 256-byte cap and the kill test, the Muse SDK stopped being documentation and became a pet.

Assistants are getting bodies — speakers, wearables, robots, desk toys. Before you build the serious one, build the silly one. You'll discover where the safety has to live, and it's never where the smart code runs.

**Give your assistant something to take care of.**

---

## Sources

- [muse-familiar](https://github.com/nitishagar/muse-familiar) — source, architecture, and the full research/plan/validation trail in `thoughts/`
- [Live landing page](https://nitishagar.github.io/muse-familiar/) — the real frame data, playable in-browser
- [facebookincubator/muse-gadget-sdk](https://github.com/facebookincubator/muse-gadget-sdk) — Meta's open-source Muse gadget SDK (Apache-2.0)
- [gadgets.muse.ai](https://gadgets.muse.ai/) — the Muse gadget platform
- [Arduino UNO Q](https://docs.arduino.cc/hardware/uno-q/) — the dual-brain board

**Suggested Medium tags:** AI · Arduino · IoT · Hardware · Open Source

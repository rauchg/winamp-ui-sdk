import { bindDrag } from "@ui-sdk/core"
import type { PlaybackStatus, TrackInfo } from "./audio-engine"

export type AnalyzerMode = "spectrum" | "oscilloscope" | "off"

// Exact Winamp 5 Modern variable-width 5-row (+1 descender row) dot-matrix font
// extracted directly from reference.png [x=50..770, y=224..253]
const DOT_GLYPHS: Record<string, string[]> = {
  "&": ["0111", "0101", "1111", "1010", "1111", "0010"],
  " ": ["000", "000", "000", "000", "000"],
  "-": ["000", "000", "111", "000", "000"],
  ".": ["0", "0", "0", "0", "1"],
  ",": ["0", "0", "0", "0", "1", "1"],
  ":": ["0", "1", "0", "1", "0"],
  "'": ["1", "1", "0", "0", "0"],
  "!": ["1", "1", "1", "0", "1"],
  "/": ["001", "001", "010", "100", "100"],
  "(": ["010", "100", "100", "100", "010", "001"],
  ")": ["010", "001", "001", "001", "010", "100"],
  "[": ["11", "10", "10", "10", "11"],
  "]": ["11", "01", "01", "01", "11"],
  "*": ["101", "010", "111", "010", "101"],
  "~": ["0000", "0101", "1010", "0000", "0000"],
  A: ["0110", "1001", "1111", "1001", "1001"],
  B: ["1110", "1001", "1110", "1001", "1110"],
  C: ["0111", "1000", "1000", "1000", "0111"],
  D: ["1110", "1001", "1001", "1001", "1110"],
  E: ["1111", "1000", "1110", "1000", "1111"],
  F: ["1111", "1000", "1110", "1000", "1000"],
  G: ["0111", "1000", "1011", "1001", "0111"],
  H: ["1001", "1001", "1111", "1001", "1001"],
  I: ["111", "010", "010", "010", "111"],
  J: ["0011", "0001", "0001", "1001", "0110"],
  K: ["1001", "1010", "1110", "1001", "1001"],
  L: ["1000", "1000", "1000", "1000", "1111"],
  M: ["10001", "11011", "10101", "10001", "10001"],
  N: ["1001", "1101", "1011", "1001", "1001"],
  O: ["0110", "1001", "1001", "1001", "0110"],
  P: ["1110", "1001", "1110", "1000", "1000"],
  Q: ["0110", "1001", "1001", "1011", "0111"],
  R: ["1110", "1001", "1110", "1010", "1001"],
  S: ["0111", "1000", "0110", "0001", "1110"],
  T: ["1111", "0100", "0100", "0100", "0100"],
  U: ["1001", "1001", "1001", "1001", "0110"],
  V: ["1001", "1001", "1001", "0110", "0110"],
  W: ["10001", "10001", "10101", "11011", "10001"],
  X: ["1001", "1001", "0110", "1001", "1001"],
  Y: ["1001", "1001", "0110", "0100", "0100"],
  Z: ["1111", "0001", "0110", "1000", "1111"],
  "0": ["0110", "1001", "1001", "1001", "0110"],
  "1": ["010", "110", "010", "010", "111"],
  "2": ["0110", "1001", "0010", "0100", "1111"],
  "3": ["1110", "0001", "0110", "0001", "1110"],
  "4": ["1001", "1001", "1111", "0001", "0001"],
  "5": ["1111", "1000", "1110", "0001", "1110"],
  "6": ["0111", "1000", "1110", "1001", "0110"],
  "7": ["1111", "0001", "0010", "0100", "0100"],
  "8": ["0110", "1001", "0110", "1001", "0110"],
  "9": ["0110", "1001", "0111", "0001", "1110"],
}

// 7-segment bitmask: [top, topRight, botRight, bottom, botLeft, topLeft, mid]
const SEGMENTS_7: Record<string, [number, number, number, number, number, number, number]> = {
  "0": [1, 1, 1, 1, 1, 1, 0],
  "1": [0, 1, 1, 0, 0, 0, 0],
  "2": [1, 1, 0, 1, 1, 0, 1],
  "3": [1, 1, 1, 1, 0, 0, 1],
  "4": [0, 1, 1, 0, 0, 1, 1],
  "5": [1, 0, 1, 1, 0, 1, 1],
  "6": [1, 0, 1, 1, 1, 1, 1],
  "7": [1, 1, 1, 0, 0, 0, 0],
  "8": [1, 1, 1, 1, 1, 1, 1],
  "9": [1, 1, 1, 1, 0, 1, 1],
  "-": [0, 0, 0, 0, 0, 0, 1],
  " ": [0, 0, 0, 0, 0, 0, 0],
}

// Exact 18-column snapshot measured from reference.png [x=573..773, y=135..205]
// Columns 1..18 (0-indexed 0..17):
const INITIAL_BARS_18 = [0, 0, 1, 0, 0, 1, 1, 1, 3, 0.65, 1, 1, 0, 0, 0, 0, 0, 0]
const INITIAL_PEAKS_18 = [0, 0, 1, 2, 4.3, 1, 4.3, 3.8, 3, 0.65, 1, 1, 0, 0, 0, 0, 0, 0]

export interface LcdRenderState {
  status: PlaybackStatus
  currentTime: number
  track: TrackInfo
  repeat: boolean
  shuffle: boolean
  eqEnabled: boolean
  timeRemainingMode: boolean
  analyzerMode: AnalyzerMode
  liveBars18: number[] | null
  waveform: Uint8Array | null
  liveScrolling: boolean
}

export class WinampLcdRenderer {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private w = 776
  private readonly maxW = 2200
  private readonly h = 155
  private readonly dpr = 3
  private extraW = 0
  private mobileMode = false
  private lastState: LcdRenderState | null = null

  private bars = [...INITIAL_BARS_18]
  private peaks = [...INITIAL_PEAKS_18]
  private peakHoldFrames = new Array<number>(18).fill(22)
  private marqueePx = 0
  private manualDragActive = false
  private dragStartX = 0
  private dragStartMarquee = 0

  constructor(host: HTMLElement, hooks: { onToggleTimeMode: () => void; onCycleAnalyzer: () => void }) {
    // Pre-allocate backing store ONCE to maxW so resizing NEVER reassigns canvas.width
    // (reassigning canvas.width mid-frame clears the GPU buffer and causes LCD screen flicker!)
    this.canvas = document.createElement("canvas")
    this.canvas.width = this.maxW * this.dpr
    this.canvas.height = this.h * this.dpr
    this.canvas.className = "winamp-lcd-canvas"
    this.canvas.style.width = `${this.maxW}px`
    this.canvas.style.height = `${this.h}px`
    host.appendChild(this.canvas)

    const ctx = this.canvas.getContext("2d")
    if (!ctx) throw new Error("2D canvas context unavailable")
    this.ctx = ctx

    // Interactive regions inside the LCD (authentic Winamp 5 behavior):
    // - Click time digits [lx=60..205, ly=26..86] -> toggle Elapsed / Remaining
    // - Click spectrum analyzer [lx=542..755, ly=18..96] -> cycle Spectrum / Oscilloscope / Off
    // - Drag marquee band [ly=102..148] -> scrub songticker text!
    this.canvas.addEventListener("pointerdown", (e) => {
      const hostRect = host.getBoundingClientRect()
      const scaleX = this.w / hostRect.width
      const scaleY = this.h / hostRect.height
      const lx = (e.clientX - hostRect.left) * scaleX
      const ly = (e.clientY - hostRect.top) * scaleY

      if (ly >= 102) {
        this.manualDragActive = true
        this.dragStartX = e.clientX
        this.dragStartMarquee = this.marqueePx
        bindDrag(this.canvas, e, {
          onMove: ({ x }) => {
            const curRect = host.getBoundingClientRect()
            const curScaleX = this.w / curRect.width
            const dx = (x - this.dragStartX) * curScaleX
            this.marqueePx = this.dragStartMarquee - dx
          },
          onEnd: () => {
            this.manualDragActive = false
          },
        })
        return
      }
      if (lx >= 55 && lx <= 215 && ly >= 22 && ly <= 90) {
        hooks.onToggleTimeMode()
      } else if (lx >= (this.mobileMode ? 235 : 540) && lx <= this.w - 16 && ly >= 16 && ly <= 98) {
        hooks.onCycleAnalyzer()
      }
    })
  }

  public setLayout(rawDW: number, mobile = false): void {
    const dW = mobile ? 0 : Math.max(0, Math.min(this.maxW - 776, Math.round(rawDW)))
    if (dW === this.extraW && mobile === this.mobileMode) return
    this.extraW = dW
    this.mobileMode = mobile
    this.w = mobile ? 530 : 776 + dW
    if (this.lastState) {
      this.render(this.lastState)
    }
  }

  public resetSnapshot(): void {
    this.bars = [...INITIAL_BARS_18]
    this.peaks = [...INITIAL_PEAKS_18]
    this.marqueePx = 0
  }

  public stepAnimation(dtSec: number, state: LcdRenderState): void {
    if (state.liveScrolling && !this.manualDragActive) {
      this.marqueePx += dtSec * 42
    }
    if (state.liveBars18) {
      for (let i = 0; i < 18; i++) {
        const target = state.liveBars18[i] ?? 0
        if (target >= this.bars[i]!) {
          this.bars[i] = target
        } else {
          this.bars[i] = Math.max(0, this.bars[i]! - dtSec * 9.5)
        }
        if (this.bars[i]! >= this.peaks[i]!) {
          this.peaks[i] = this.bars[i]!
          this.peakHoldFrames[i] = 20
        } else if ((this.peakHoldFrames[i] ?? 0) > 0) {
          this.peakHoldFrames[i]! -= 1
        } else {
          this.peaks[i] = Math.max(this.bars[i]!, this.peaks[i]! - dtSec * 3.4)
        }
      }
    } else if (state.status === "stopped") {
      for (let i = 0; i < 18; i++) {
        this.bars[i] = Math.max(0, this.bars[i]! - dtSec * 12)
        this.peaks[i] = Math.max(0, this.peaks[i]! - dtSec * 5)
      }
    }
  }

  public render(state: LcdRenderState): void {
    this.lastState = state
    const ctx = this.ctx
    ctx.save()
    ctx.scale(this.dpr, this.dpr)
    ctx.clearRect(0, 0, this.w + 8, this.h)

    const W = this.w
    const dW = this.extraW

    // 1. Outer recessed dark metallic bezel [0, 0, W, 155]
    this.roundRect(ctx, 0, 0, W, 155, 18)
    const bezelGrad = ctx.createLinearGradient(0, 0, 0, 155)
    bezelGrad.addColorStop(0, "#141b2c")
    bezelGrad.addColorStop(0.15, "#1f283d")
    bezelGrad.addColorStop(0.85, "#1b243a")
    bezelGrad.addColorStop(1, "#5c6782")
    ctx.fillStyle = bezelGrad
    ctx.fill()

    // Subtle bottom-outer white highlight lip on silver body around bezel
    ctx.strokeStyle = "rgba(255,255,255,0.45)"
    ctx.lineWidth = 1.2
    this.roundRect(ctx, 0.6, 0.6, W - 1.2, 153.8, 18)
    ctx.stroke()

    // 2. Inner curved blue glass panel [4, 4, W - 8, 147]
    ctx.save()
    this.roundRect(ctx, 4, 4, W - 8, 147, 14.5)
    ctx.clip()

    // Measured vertical glass gradient — rich Winamp 5 cobalt royal blue
    const glassGrad = ctx.createLinearGradient(0, 4, 0, 151)
    glassGrad.addColorStop(0.0, "#768cc2")
    glassGrad.addColorStop(0.07, "#93aae0")
    glassGrad.addColorStop(0.15, "#365ba3")
    glassGrad.addColorStop(0.25, "#19428e")
    glassGrad.addColorStop(0.42, "#153984")
    glassGrad.addColorStop(0.55, "#234994")
    glassGrad.addColorStop(0.64, "#2c519d")
    glassGrad.addColorStop(0.7, "#1b3d84")
    glassGrad.addColorStop(0.71, "#112967") // Marquee top transition
    glassGrad.addColorStop(0.92, "#142e6d") // Marquee band
    glassGrad.addColorStop(0.97, "#3a5284")
    glassGrad.addColorStop(1.0, "#697fb2")
    ctx.fillStyle = glassGrad
    ctx.fillRect(4, 4, W - 8, 147)

    // Marquee darker inset band [ly = 104..143]
    const mqGrad = ctx.createLinearGradient(0, 103, 0, 145)
    mqGrad.addColorStop(0, "#0d2159")
    mqGrad.addColorStop(0.12, "#152d6b")
    mqGrad.addColorStop(0.85, "#142b68")
    mqGrad.addColorStop(1, "#233d78")
    ctx.fillStyle = mqGrad
    ctx.fillRect(4, 104, W - 8, 39)

    // Subtle divider line above marquee
    ctx.fillStyle = "rgba(8, 18, 46, 0.65)"
    ctx.fillRect(4, 103, W - 8, 1.5)
    ctx.fillStyle = "rgba(122, 152, 214, 0.18)"
    ctx.fillRect(4, 101.8, W - 8, 1)

    // Fine 5.22px LCD pixel-matrix background texture across upper glass
    ctx.fillStyle = "rgba(10, 24, 58, 0.2)"
    for (let gx = 10; gx < W - 10; gx += 5.22) {
      ctx.fillRect(gx, 16, 1, 85)
    }
    for (let gy = 18; gy < 101; gy += 5.22) {
      ctx.fillRect(8, gy, W - 16, 1)
    }

    // Top cylindrical glass specular highlight band [ly = 4.5..22]
    const specGrad = ctx.createLinearGradient(0, 4.5, 0, 23)
    specGrad.addColorStop(0, "rgba(222, 233, 255, 0.70)")
    specGrad.addColorStop(0.42, "rgba(186, 205, 245, 0.42)")
    specGrad.addColorStop(1, "rgba(110, 142, 212, 0)")
    ctx.fillStyle = specGrad
    this.roundRect(ctx, 6, 4.5, W - 12, 18.5, 9)
    ctx.fill()

    // Left & right dark blue glass vignette edges
    const leftVig = ctx.createLinearGradient(4, 0, 26, 0)
    leftVig.addColorStop(0, "rgba(10, 20, 48, 0.62)")
    leftVig.addColorStop(1, "rgba(10, 20, 48, 0)")
    ctx.fillStyle = leftVig
    ctx.fillRect(4, 4, 22, 147)

    const rightVig = ctx.createLinearGradient(W - 26, 0, W - 4, 0)
    rightVig.addColorStop(0, "rgba(10, 20, 48, 0)")
    rightVig.addColorStop(1, "rgba(10, 20, 48, 0.62)")
    ctx.fillStyle = rightVig
    ctx.fillRect(W - 26, 4, 22, 147)

    // 3. Left cluster: Play/Pause/Stop glyph + 7-segment time ("0:00")
    this.drawPlaybackGlyph(ctx, state.status)
    this.drawTimeDigits(ctx, state)

    // 4. Center badge column (ditched on mobile so time + spectrum breathe cleanly!)
    if (!this.mobileMode) {
      this.drawCenterBadges(ctx, state)
    }

    // 5. Right spectrum analyzer / oscilloscope
    this.drawAnalyzer(ctx, state, dW, this.mobileMode)

    // 6. Bottom dot-matrix marquee
    this.drawMarquee(ctx, state.track.marqueeTitle, dW, this.mobileMode)

    // Inner dark glass border shadow
    ctx.strokeStyle = "rgba(8, 15, 34, 0.78)"
    ctx.lineWidth = 2.2
    this.roundRect(ctx, 4.5, 4.5, W - 9, 146, 14)
    ctx.stroke()

    ctx.restore()
    ctx.restore()
  }

  private drawPlaybackGlyph(ctx: CanvasRenderingContext2D, status: PlaybackStatus): void {
    // Measured play triangle: wx=[48..62], wy=[163..175] -> lx=[23..37], ly=[50..62]
    ctx.save()
    ctx.shadowColor = "rgba(165, 196, 255, 0.55)"
    ctx.shadowBlur = 4
    ctx.fillStyle = "#dce7fb"
    if (status === "playing") {
      ctx.beginPath()
      ctx.moveTo(23.5, 49.5)
      ctx.lineTo(36.5, 56)
      ctx.lineTo(23.5, 62.5)
      ctx.closePath()
      ctx.fill()
    } else if (status === "paused") {
      ctx.fillRect(23.5, 50, 4.2, 12)
      ctx.fillRect(30.8, 50, 4.2, 12)
    } else {
      ctx.fillRect(24, 50.5, 11, 11)
    }
    ctx.restore()
  }

  private drawTimeDigits(ctx: CanvasRenderingContext2D, state: LcdRenderState): void {
    const rawSec = state.timeRemainingMode
      ? Math.max(0, Math.ceil(state.track.duration - state.currentTime))
      : Math.floor(state.currentTime)
    const mins = Math.floor(rawSec / 60)
    const secs = rawSec % 60
    const minTens = mins >= 10 ? String(Math.floor(mins / 10)) : state.timeRemainingMode ? "-" : " "
    const minOnes = String(mins % 10)
    const secTens = String(Math.floor(secs / 10))
    const secOnes = String(secs % 10)

    // Measured digit boxes in local coords (lx = wx - 25, ly = wy - 113):
    // Optional tens/sign: lx=61..86, minOnes: lx=93..118, colon: lx=124..128, secTens: lx=137..162, secOnes: lx=168..193
    // ly = 34..78 (height 44, width 25, thickness 5.6)
    if (minTens !== " ") {
      this.drawSevenSegDigit(ctx, 61, 34, 25, 44, minTens)
    } else {
      this.drawSevenSegDigit(ctx, 61, 34, 25, 44, " ", true)
    }
    this.drawSevenSegDigit(ctx, 93, 34, 25, 44, minOnes)

    // Colon dots at lx=126.5, ly=47 and ly=64
    ctx.save()
    ctx.shadowColor = "rgba(175, 205, 255, 0.6)"
    ctx.shadowBlur = 4
    ctx.fillStyle = "#e6f0ff"
    ctx.fillRect(124.2, 45.5, 4.8, 5.2)
    ctx.fillRect(124.2, 62.5, 4.8, 5.2)
    ctx.restore()

    this.drawSevenSegDigit(ctx, 137, 34, 25, 44, secTens)
    this.drawSevenSegDigit(ctx, 168.5, 34, 25, 44, secOnes)
  }

  private drawSevenSegDigit(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    ch: string,
    ghostOnly = false,
  ): void {
    const mask = SEGMENTS_7[ch] ?? SEGMENTS_7[" "]!
    const t = 5.4 // segment thickness
    const g = 1.35 // chamfer gap
    const midY = y + h / 2

    const polys: Array<[number, number][]> = [
      // 0: top horizontal
      [
        [x + g + 1, y],
        [x + w - g - 1, y],
        [x + w - t - g + 0.5, y + t],
        [x + t + g - 0.5, y + t],
      ],
      // 1: top-right vertical
      [
        [x + w, y + g + 1],
        [x + w, midY - g],
        [x + w - t, midY - t / 2 - g],
        [x + w - t, y + t + g],
      ],
      // 2: bottom-right vertical
      [
        [x + w, midY + g],
        [x + w, y + h - g - 1],
        [x + w - t, y + h - t - g],
        [x + w - t, midY + t / 2 + g],
      ],
      // 3: bottom horizontal
      [
        [x + t + g - 0.5, y + h - t],
        [x + w - t - g + 0.5, y + h - t],
        [x + w - g - 1, y + h],
        [x + g + 1, y + h],
      ],
      // 4: bottom-left vertical
      [
        [x, midY + g],
        [x + t, midY + t / 2 + g],
        [x + t, y + h - t - g],
        [x, y + h - g - 1],
      ],
      // 5: top-left vertical
      [
        [x, y + g + 1],
        [x + t, y + t + g],
        [x + t, midY - t / 2 - g],
        [x, midY - g],
      ],
      // 6: middle horizontal (hexagonal)
      [
        [x + g + 1.5, midY],
        [x + t, midY - t / 2 + 0.3],
        [x + w - t, midY - t / 2 + 0.3],
        [x + w - g - 1.5, midY],
        [x + w - t, midY + t / 2 - 0.3],
        [x + t, midY + t / 2 - 0.3],
      ],
    ]

    for (let i = 0; i < 7; i++) {
      const lit = !ghostOnly && mask[i] === 1
      ctx.save()
      if (lit) {
        ctx.shadowColor = "rgba(165, 198, 255, 0.65)"
        ctx.shadowBlur = 4.5
        ctx.fillStyle = "#e8f1ff"
      } else {
        ctx.fillStyle = "rgba(92, 128, 192, 0.11)"
      }
      ctx.beginPath()
      const pts = polys[i]!
      ctx.moveTo(pts[0]![0], pts[0]![1])
      for (let p = 1; p < pts.length; p++) {
        ctx.lineTo(pts[p]![0], pts[p]![1])
      }
      ctx.closePath()
      ctx.fill()
      ctx.restore()
    }
  }

  private drawCenterBadges(ctx: CanvasRenderingContext2D, state: LcdRenderState): void {
    // Row 1: "KBPS:" [lx=261, ly=48] + white pill "320" [lx=316, ly=34, w=52, h=18]
    //        "~KHZ:" [lx=389, ly=48] + white pill "44"  [lx=449, ly=34, w=41, h=18]
    ctx.save()
    ctx.font = '800 13px "Tahoma", "Trebuchet MS", Arial, sans-serif'
    ctx.fillStyle = "#c2d4f6"
    ctx.shadowColor = "rgba(155, 190, 255, 0.38)"
    ctx.shadowBlur = 2
    ctx.textAlign = "right"
    ctx.fillText("KBPS:", 309, 47.5)
    ctx.fillText("KHZ:", 443, 47.5)
    ctx.textAlign = "left"

    // Sine-wave tilde right before KHZ: at lx=389..402, ly=43
    ctx.strokeStyle = "#c2d4f6"
    ctx.lineWidth = 2.1
    ctx.beginPath()
    ctx.moveTo(389.5, 44.5)
    ctx.bezierCurveTo(392.2, 39, 395, 39, 396.8, 43.5)
    ctx.bezierCurveTo(398.6, 48, 401.4, 48, 403.8, 42.5)
    ctx.stroke()
    ctx.restore()

    // White pill "320"
    this.drawWhiteLcdPill(ctx, 316, 34, 52, 18, String(state.track.kbps))
    // White pill "44"
    this.drawWhiteLcdPill(ctx, 449, 34, 41, 18, String(state.track.khz))

    // Row 2: White pill "∞ STEREO" [lx=259, ly=60, w=109, h=22.5]
    ctx.save()
    ctx.shadowColor = "rgba(165, 200, 255, 0.45)"
    ctx.shadowBlur = 4
    ctx.fillStyle = "#edf3fc"
    this.roundRect(ctx, 259, 60, 109, 22.5, 4)
    ctx.fill()
    ctx.restore()

    // Interlocked stereo rings inside pill at lx=266..285, ly=71.2
    ctx.save()
    ctx.strokeStyle = "#2b4270"
    ctx.lineWidth = 2.1
    ctx.beginPath()
    ctx.arc(271.5, 71.3, 4.4, 0, Math.PI * 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(278.5, 71.3, 4.4, 0, Math.PI * 2)
    ctx.stroke()
    ctx.fillStyle = "#263d6b"
    ctx.font = '800 12.5px "Arial", "Helvetica Neue", sans-serif'
    ctx.letterSpacing = "0.6px"
    ctx.fillText(state.track.stereo ? "STEREO" : "MONO", 287.5, 75.8)
    ctx.restore()

    // Ghost / Lit LCD status icons row [lx = 377..529, ly = 61..85]:
    // 1) "EQ" badge [lx=378, ly=62, w=23, h=19]
    ctx.save()
    const eqAlpha = state.eqEnabled ? 0.95 : 0.22
    if (state.eqEnabled) {
      ctx.shadowColor = "rgba(175, 208, 255, 0.6)"
      ctx.shadowBlur = 4
    }
    ctx.fillStyle = `rgba(215, 232, 255, ${eqAlpha})`
    ctx.font = '800 12px "Arial Narrow", "Arial", sans-serif'
    ctx.fillText("EQ", 379, 76)
    ctx.restore()

    // 2) Ghosted framed level/mono bar [lx=405, ly=64, w=36, h=16]
    ctx.save()
    ctx.strokeStyle = "rgba(175, 202, 248, 0.22)"
    ctx.lineWidth = 1.6
    this.roundRect(ctx, 405, 64.5, 36, 15.5, 2.5)
    ctx.stroke()
    ctx.fillStyle = "rgba(175, 202, 248, 0.17)"
    ctx.fillRect(409, 68.5, 28, 7.5)
    ctx.restore()

    // 3) Repeat loop icon [lx=453, ly=64, w=32, h=19] — LIT in reference.png!
    this.drawLcdRepeatIcon(ctx, 454, 64, state.repeat)

    // 4) "123" shuffle icon [lx=495, ly=61] — ghosted in reference.png unless shuffle ON!
    this.drawLcdShuffleIcon(ctx, 496, 61, state.shuffle)
  }

  private drawWhiteLcdPill(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
  ): void {
    ctx.save()
    ctx.shadowColor = "rgba(165, 200, 255, 0.42)"
    ctx.shadowBlur = 3.5
    ctx.fillStyle = "#eef4fc"
    this.roundRect(ctx, x, y, w, h, 3.5)
    ctx.fill()

    ctx.shadowBlur = 0
    ctx.fillStyle = "#2b4270"
    ctx.font = '800 12.5px "Consolas", "Monaco", "Arial", monospace'
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText(label, x + w / 2, y + h / 2 + 0.6)
    ctx.restore()
  }

  private drawLcdRepeatIcon(ctx: CanvasRenderingContext2D, x: number, y: number, lit: boolean): void {
    ctx.save()
    const col = lit ? "#eaf3ff" : "rgba(175, 202, 248, 0.22)"
    if (lit) {
      ctx.shadowColor = "rgba(170, 204, 255, 0.68)"
      ctx.shadowBlur = 4.5
    }
    ctx.strokeStyle = col
    ctx.fillStyle = col
    ctx.lineWidth = 2.6
    ctx.lineJoin = "round"
    ctx.lineCap = "round"

    // Clockwise rounded loop rectangle with bottom LEFT-pointing arrowhead (matches reference.png!)
    ctx.beginPath()
    ctx.moveTo(x + 9, y + 13.5)
    ctx.lineTo(x + 5, y + 13.5)
    ctx.arcTo(x + 1, y + 13.5, x + 1, y + 9.5, 4)
    ctx.lineTo(x + 1, y + 5)
    ctx.arcTo(x + 1, y + 1, x + 5, y + 1, 4)
    ctx.lineTo(x + 25, y + 1)
    ctx.arcTo(x + 29, y + 1, x + 29, y + 5, 4)
    ctx.lineTo(x + 29, y + 9.5)
    ctx.arcTo(x + 29, y + 13.5, x + 25, y + 13.5, 4)
    ctx.lineTo(x + 17, y + 13.5)
    ctx.stroke()

    // Left-pointing arrowhead at bottom-center/right
    ctx.beginPath()
    ctx.moveTo(x + 19.5, y + 8.5)
    ctx.lineTo(x + 11.5, y + 13.8)
    ctx.lineTo(x + 19.5, y + 19.2)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }

  private drawLcdShuffleIcon(ctx: CanvasRenderingContext2D, x: number, y: number, lit: boolean): void {
    ctx.save()
    const col = lit ? "#eaf3ff" : "rgba(175, 202, 248, 0.25)"
    if (lit) {
      ctx.shadowColor = "rgba(170, 204, 255, 0.65)"
      ctx.shadowBlur = 4
    }
    ctx.strokeStyle = col
    ctx.fillStyle = col
    ctx.lineWidth = 1.9
    // Curved arrow arc above 1-2-3
    ctx.beginPath()
    ctx.arc(x + 15, y + 12, 11, -Math.PI * 0.82, -Math.PI * 0.18)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(x + 23, y + 3)
    ctx.lineTo(x + 27.5, y + 6.5)
    ctx.lineTo(x + 21.8, y + 7.8)
    ctx.closePath()
    ctx.fill()

    ctx.font = '800 10.5px "Arial", sans-serif'
    ctx.fillText("1", x + 2, y + 17)
    ctx.fillText("2", x + 10.5, y + 21)
    ctx.fillText("3", x + 19.5, y + 18)
    ctx.restore()
  }

  private drawAnalyzer(ctx: CanvasRenderingContext2D, state: LcdRenderState, dW = 0, mobile = false): void {
    const xLeft = mobile ? 248 : 548
    const xRight = mobile ? 504 : 748 + dW
    const yTop = 23
    const yMid = 56
    const yBase = 86
    const innerCols = Math.max(18, Math.round((xRight - xLeft) / 10.526) - 1)
    const colPitch = (xRight - xLeft) / (innerCols + 1)

    ctx.save()
    ctx.fillStyle = "rgba(165, 194, 245, 0.34)"
    for (let c = 1; c <= innerCols; c++) {
      const cx = xLeft + c * colPitch
      ctx.fillRect(cx - 2.5, yMid - 0.8, 5, 1.6)
    }
    ctx.fillStyle = "rgba(165, 194, 245, 0.22)"
    for (let c = 1; c <= innerCols; c++) {
      const cx = xLeft + c * colPitch
      ctx.fillRect(cx - 2, yTop - 0.6, 4, 1.2)
    }

    ctx.fillStyle = "#adc3ec"
    for (let ry = yTop; ry <= yBase; ry += 5.25) {
      ctx.fillRect(xLeft - 1.2, ry - 1.4, 2.4, 3.0)
      ctx.fillRect(xRight - 1.2, ry - 1.4, 2.4, 3.0)
    }
    for (const ty of [yTop, yMid, yBase]) {
      ctx.fillRect(xLeft - 2.5, ty - 1.1, 6.5, 2.2)
      ctx.fillRect(xRight - 4.0, ty - 1.1, 6.5, 2.2)
    }

    for (let c = 0; c <= innerCols + 1; c++) {
      const cx = xLeft + c * colPitch
      ctx.fillRect(cx - 3.6, yBase - 1.2, 7.2, 2.4)
      if (c > 0 && c <= innerCols && c % 2 === 1) {
        ctx.fillRect(cx - 1.1, yBase + 2.2, 2.4, 3.8)
      }
    }

    if (state.analyzerMode === "off") {
      ctx.restore()
      return
    }

    if (state.analyzerMode === "oscilloscope" && state.waveform) {
      ctx.strokeStyle = "#e5f0ff"
      ctx.shadowColor = "rgba(170, 205, 255, 0.7)"
      ctx.shadowBlur = 4
      ctx.lineWidth = 2.2
      ctx.beginPath()
      const usableW = xRight - xLeft - 12
      for (let i = 0; i < state.waveform.length; i++) {
        const px = xLeft + 6 + (i / (state.waveform.length - 1)) * usableW
        const norm = ((state.waveform[i] ?? 128) - 128) / 128
        const py = yMid + norm * 26
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.stroke()
      ctx.restore()
      return
    }

    const rowPitch = 5.25
    for (let i = 0; i < innerCols; i++) {
      const cx = xLeft + (i + 1) * colPitch
      const srcIdx = innerCols === 18 ? i : Math.min(17, Math.floor((i / innerCols) * 18))
      const barVal = this.bars[srcIdx] ?? 0
      const fullCells = Math.floor(barVal)
      const frac = barVal - fullCells

      for (let r = 1; r <= fullCells && r <= 11; r++) {
        const cy = yBase - r * rowPitch
        ctx.fillStyle = r >= 4 ? "#eaf3ff" : "#cbd9f3"
        this.roundRect(ctx, cx - 3.8, cy - 1.9, 7.6, 3.8, 1)
        ctx.fill()
      }
      if (frac > 0.35 && fullCells < 11) {
        const cy = yBase - (fullCells + 1) * rowPitch
        ctx.fillStyle = `rgba(203, 217, 243, ${Math.min(1, frac * 1.15)})`
        this.roundRect(ctx, cx - 3.8, cy - 1.9, 7.6, 3.8, 1)
        ctx.fill()
      }

      const peakVal = this.peaks[srcIdx] ?? 0
      if (peakVal >= 0.9 && peakVal > barVal + 0.35) {
        const py = yBase - peakVal * rowPitch
        ctx.fillStyle = "#dbe7fc"
        this.roundRect(ctx, cx - 3.8, py - 1.5, 7.6, 2.8, 0.8)
        ctx.fill()
      }
    }

    ctx.restore()
  }

  private drawMarquee(ctx: CanvasRenderingContext2D, text: string, dW = 0, mobile = false): void {
    const clipX = 22
    const clipW = mobile ? 486 : 730 + dW
    const startX = 25
    const dotPitchX = 4.94
    const dotPitchY = 5.15
    const baseDotY = 113

    ctx.save()
    ctx.beginPath()
    ctx.rect(clipX, 106, clipW, 37)
    ctx.clip()

    // Faint unlit LCD dot matrix grid in marquee strip
    ctx.fillStyle = "rgba(75, 110, 180, 0.13)"
    for (let gx = startX; gx < clipX + clipW; gx += dotPitchX) {
      for (let r = 0; r < 6; r++) {
        ctx.fillRect(gx, baseDotY + r * dotPitchY - 1.2, 2.6, 2.6)
      }
    }

    const upper = text.toUpperCase()
    // Build column bitmap stream for one full loop of `upper`
    const cols: number[] = []
    for (let idx = 0; idx < upper.length; idx++) {
      const ch = upper[idx]!
      const glyph = DOT_GLYPHS[ch] ?? DOT_GLYPHS[" "]!
      const glyphW = glyph[0]?.length ?? 3
      for (let c = 0; c < glyphW; c++) {
        let mask = 0
        for (let r = 0; r < glyph.length; r++) {
          if (glyph[r]?.[c] === "1") mask |= 1 << r
        }
        cols.push(mask)
      }
      // 1-dot inter-character gap
      cols.push(0)
    }

    const loopWidthPx = Math.max(1, cols.length * dotPitchX)
    const wrappedPx = ((this.marqueePx % loopWidthPx) + loopWidthPx) % loopWidthPx

    ctx.shadowColor = "rgba(165, 200, 255, 0.45)"
    ctx.shadowBlur = 2.2

    // Render two seamless copies for wraparound
    for (let copy = 0; copy < 2; copy++) {
      const copyOffset = startX - wrappedPx + copy * loopWidthPx
      if (copyOffset > clipX + clipW || copyOffset + loopWidthPx < clipX - 10) continue

      for (let c = 0; c < cols.length; c++) {
        const mask = cols[c]!
        if (mask === 0) continue
        const dx = copyOffset + c * dotPitchX
        if (dx < clipX - 5 || dx > clipX + clipW + 2) continue

        for (let r = 0; r < 6; r++) {
          if ((mask & (1 << r)) !== 0) {
            const dy = baseDotY + r * dotPitchY
            ctx.fillStyle = "#c4d5f7"
            ctx.fillRect(dx - 0.3, dy - 1.5, 3.3, 3.3)
          }
        }
      }
    }

    ctx.restore()
  }

  private roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
  ): void {
    ctx.beginPath()
    ctx.roundRect(x, y, w, h, r)
  }
}

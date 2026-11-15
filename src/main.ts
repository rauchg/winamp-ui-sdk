// 1. Register @ui-sdk/web Web Component tags (light DOM, zero dependencies)
import "@ui-sdk/web/menubar"
import "@ui-sdk/web/menu"
import "@ui-sdk/web/slider"
import "@ui-sdk/web/toggle"
import "@ui-sdk/web/button"
import "@ui-sdk/web/toolbar"
import "@ui-sdk/web/tabs"
import "@ui-sdk/web/overlays"
import "@ui-sdk/web/dialog"
import "@ui-sdk/web/events"

import { bindDrag } from "@ui-sdk/core"
import {
  registerShortcut,
  shortcuts,
  toast,
  type UiButtonElement,
  type UiMenuElement,
  type UiSliderElement,
  type UiTabsElement,
  type UiToggleElement,
} from "@ui-sdk/web"
import type { UiMenubarElement } from "@ui-sdk/web/menubar"
import { createAgent, registerTools } from "@ui-sdk/web/agent"

// 2. Register custom Winamp primitives (<winamp-window>, <winamp-titlebar>, <winamp-resize-handle>, <winamp-lcd>)
//    built with @ui-sdk/core's definePrimitive + createResize and @ui-sdk/web's createParts
import "./primitives/winamp-window"
import {
  COMPACT_HEIGHT,
  COMPACT_WIDTH,
  FULLVIEW_HEIGHT,
  FULLVIEW_WIDTH,
  type WinampGeometryDetail,
  type WinampWindowElement,
} from "./primitives/winamp-window"

import { EQ_FREQUENCIES, WinampAudioEngine } from "./audio-engine"
import { WinampLcdRenderer, type AnalyzerMode } from "./lcd-renderer"
import { ICONS, renderChassisSvg, updateChassisGeometry } from "./skin-chassis"

// 3. Initialize UI SDK Agent bridge BEFORE mounting the DOM, honoring data-agent-confirm prompts
const allowAgentStep = (step: { confirm?: string }) =>
  step.confirm ? window.confirm(step.confirm) : true

const agent = createAgent({ allow: allowAgentStep })
try {
  registerTools(agent, { allow: allowAgentStep })
} catch {
  // Guard against experimental browser ModelContext implementations throwing on registration
}
Object.assign(window, { winampAgent: agent })

const params = new URLSearchParams(window.location.search)
const isBare = params.get("bare") === "1"
if (isBare) {
  document.body.classList.add("bare-mode")
}

// Ensure iOS Safari/WebKit synthesizes click events on non-interactive body/stage taps
document.body.addEventListener("click", () => {})

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

const engine = new WinampAudioEngine()
let timeRemainingMode = false
let analyzerMode: AnalyzerMode = "spectrum"
let configDeckVisible = true
let isScrubbingSeek = false

// Media Library filter state
let mlGenreFilter = "ALL"
let mlArtistFilter = "ALL"
let mlAlbumFilter = "ALL"
let searchQuery = ""
let selectedPlIndices = new Set<number>([0])
let lastRenderedTrackSnapshot = ""

function formatDuration(sec: number): string {
  const s = Math.max(0, Math.floor(sec))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`
}

const app = document.querySelector<HTMLDivElement>("#app")!

app.innerHTML = `
  <ui-overlay-host></ui-overlay-host>
  <input id="winamp-file-picker" type="file" accept="audio/*" multiple hidden />

  <a
    class="demo-source-link"
    href="https://github.com/rauchg/winamp-ui-sdk"
    target="_blank"
    rel="noopener noreferrer"
    aria-label="View source on GitHub"
  >
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <path fill="currentColor" d="M8 .2a8 8 0 0 0-2.53 15.59c.4.07.55-.17.55-.38l-.01-1.49c-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.42 7.42 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48l-.01 2.2c0 .21.15.46.55.38A8.01 8.01 0 0 0 8 .2Z"/>
    </svg>
    <span>Source</span>
  </a>

  <main class="desktop-stage">
    <winamp-window id="winamp-main" title="Winamp 5 Modern" ${isBare ? "bare" : ""}>
      <!-- 8 @ui-sdk/core createResize handles (zero snap, smooth center-glide on release) -->
      <winamp-resize-handle handle="n"></winamp-resize-handle>
      <winamp-resize-handle handle="s"></winamp-resize-handle>
      <winamp-resize-handle handle="w"></winamp-resize-handle>
      <winamp-resize-handle handle="e"></winamp-resize-handle>
      <winamp-resize-handle handle="nw"></winamp-resize-handle>
      <winamp-resize-handle handle="ne"></winamp-resize-handle>
      <winamp-resize-handle handle="sw"></winamp-resize-handle>
      <winamp-resize-handle handle="se"></winamp-resize-handle>

      <div class="winamp-deck-scaler">
        <div class="winamp-shadow-plate" aria-hidden="true"></div>
        ${renderChassisSvg()}

        <!-- Draggable Titlebar (@ui-sdk/core createResize "move" handle) + Window Controls -->
        <winamp-titlebar id="winamp-titlebar">
          <ui-button id="btn-win-min">
            <button type="button" class="winamp-win-btn winamp-win-btn--min" aria-label="Minimize Winamp">${ICONS.winMin}</button>
          </ui-button>
          <ui-button id="btn-win-shade">
            <button type="button" class="winamp-win-btn winamp-win-btn--shade" aria-label="Toggle Windowshade">${ICONS.winShade}</button>
          </ui-button>
          <ui-button id="btn-win-close">
            <button type="button" class="winamp-win-btn winamp-win-btn--close" aria-label="Reset Winamp Window">${ICONS.winClose}</button>
          </ui-button>
        </winamp-titlebar>

        <!-- Menubar: File | Play | Options | View | Help (<ui-menubar> + <ui-menu>) -->
        <ui-menubar id="winamp-menubar" class="winamp-menubar" aria-label="Winamp Menu Bar">
          <ui-menu id="menu-file">
            <ui-menu-trigger>
              <button type="button" class="winamp-menu-trigger-btn winamp-menu-trigger--file"><span class="mnemonic">F</span>ile</button>
            </ui-menu-trigger>
            <ui-menu-content side-offset="4" align="start">
              <ui-menu-item value="open-file" data-agent-confirm="Open the local audio file picker?">Play File… <span class="menu-kbd">L</span></ui-menu-item>
              <ui-menu-separator></ui-menu-separator>
              <ui-menu-item value="track-0">1. The Magic Primitive (Suno v6)</ui-menu-item>
              <ui-menu-item value="track-1">2. Light DOM Fever (Suno v6)</ui-menu-item>
              <ui-menu-item value="track-2">3. Copy Paste Philosophy — shadcn (Suno v6)</ui-menu-item>
              <ui-menu-item value="track-3">4. Snapshot, Query, Act — WebMCP (Suno v6)</ui-menu-item>
              <ui-menu-item value="track-4">5. Whippin' the Llama's DOM (Suno v6)</ui-menu-item>
              <ui-menu-separator></ui-menu-separator>
              <ui-menu-item value="reset-snapshot">Reset Player State</ui-menu-item>
            </ui-menu-content>
          </ui-menu>

          <ui-menu id="menu-play">
            <ui-menu-trigger>
              <button type="button" class="winamp-menu-trigger-btn winamp-menu-trigger--play"><span class="mnemonic">P</span>lay</button>
            </ui-menu-trigger>
            <ui-menu-content side-offset="4" align="start">
              <ui-menu-item value="prev">Previous <span class="menu-kbd">Z</span></ui-menu-item>
              <ui-menu-item value="play">Play <span class="menu-kbd">X</span></ui-menu-item>
              <ui-menu-item value="pause">Pause <span class="menu-kbd">C</span></ui-menu-item>
              <ui-menu-item value="stop">Stop <span class="menu-kbd">V</span></ui-menu-item>
              <ui-menu-item value="next">Next <span class="menu-kbd">B</span></ui-menu-item>
              <ui-menu-separator></ui-menu-separator>
              <ui-menu-item value="back-5s">Back 5 Seconds <span class="menu-kbd">←</span></ui-menu-item>
              <ui-menu-item value="fwd-5s">Forward 5 Seconds <span class="menu-kbd">→</span></ui-menu-item>
            </ui-menu-content>
          </ui-menu>

          <ui-menu id="menu-options">
            <ui-menu-trigger>
              <button type="button" class="winamp-menu-trigger-btn winamp-menu-trigger--options"><span class="mnemonic">O</span>ptions</button>
            </ui-menu-trigger>
            <ui-menu-content side-offset="4" align="start">
              <ui-menu-checkbox-item id="menu-chk-repeat" value="repeat" default-checked>
                <ui-menu-item-indicator keep-mounted></ui-menu-item-indicator>
                Repeat <span class="menu-kbd">R</span>
              </ui-menu-checkbox-item>
              <ui-menu-checkbox-item id="menu-chk-shuffle" value="shuffle">
                <ui-menu-item-indicator keep-mounted></ui-menu-item-indicator>
                Shuffle <span class="menu-kbd">S</span>
              </ui-menu-checkbox-item>
              <ui-menu-checkbox-item id="menu-chk-eq" value="eq">
                <ui-menu-item-indicator keep-mounted></ui-menu-item-indicator>
                10-Band Equalizer Active
              </ui-menu-checkbox-item>
              <ui-menu-separator></ui-menu-separator>
              <ui-menu-checkbox-item id="menu-chk-remaining" value="remaining">
                <ui-menu-item-indicator keep-mounted></ui-menu-item-indicator>
                Time Remaining Mode
              </ui-menu-checkbox-item>
            </ui-menu-content>
          </ui-menu>

          <ui-menu id="menu-view">
            <ui-menu-trigger>
              <button type="button" class="winamp-menu-trigger-btn winamp-menu-trigger--view"><span class="mnemonic">V</span>iew</button>
            </ui-menu-trigger>
            <ui-menu-content side-offset="4" align="start">
              <ui-menu-item value="view-compact">Compact Player (${COMPACT_WIDTH}×${COMPACT_HEIGHT})</ui-menu-item>
              <ui-menu-item value="view-full">Full Winamp View (EQ + Playlist + ML) <span class="menu-kbd">⌘F</span></ui-menu-item>
              <ui-menu-separator></ui-menu-separator>
              <ui-menu-item value="open-pl">Playlist Editor (PL)</ui-menu-item>
              <ui-menu-item value="open-ml">Media Library (ML)</ui-menu-item>
              <ui-menu-item value="open-vis">AVS / Beat Visualizer</ui-menu-item>
              <ui-menu-item value="toggle-shade">Windowshade Mode</ui-menu-item>
              <ui-menu-separator></ui-menu-separator>
              <ui-menu-radio-group id="menu-rad-analyzer" name="analyzer" default-value="spectrum">
                <ui-menu-radio-item value="spectrum">
                  <ui-menu-item-indicator keep-mounted></ui-menu-item-indicator>
                  LCD Spectrum Analyzer
                </ui-menu-radio-item>
                <ui-menu-radio-item value="oscilloscope">
                  <ui-menu-item-indicator keep-mounted></ui-menu-item-indicator>
                  LCD Oscilloscope
                </ui-menu-radio-item>
                <ui-menu-radio-item value="off">
                  <ui-menu-item-indicator keep-mounted></ui-menu-item-indicator>
                  LCD Analyzer Off
                </ui-menu-radio-item>
              </ui-menu-radio-group>
            </ui-menu-content>
          </ui-menu>

          <ui-menu id="menu-help">
            <ui-menu-trigger>
              <button type="button" class="winamp-menu-trigger-btn winamp-menu-trigger--help"><span class="mnemonic">H</span>elp</button>
            </ui-menu-trigger>
            <ui-menu-content side-offset="4" align="start">
              <ui-menu-item value="about">About Winamp 5 × Vercel UI SDK</ui-menu-item>
              <ui-menu-item value="agent-snapshot">Open @ui-sdk/web Agent Inspector</ui-menu-item>
            </ui-menu-content>
          </ui-menu>
        </ui-menubar>

        <!-- Blue Dot-Matrix LCD Display (<winamp-lcd>) -->
        <winamp-lcd id="winamp-lcd"></winamp-lcd>

        <!-- Top-Right Visualization / Full View Toggle Pill (<ui-button>, Nullsoft videoavs.open!) -->
        <ui-button id="btn-top-vis">
          <button type="button" class="metal-pill-btn btn-top-dropdown" aria-label="Toggle Full Winamp View and Visualizer">
            ${ICONS.dropdownTri}
          </button>
        </ui-button>

        <!-- Repeat & Shuffle Toggles (<ui-toggle>) -->
        <ui-toggle id="toggle-repeat" default-pressed>
          <button type="button" class="metal-pill-btn btn-repeat" aria-label="Repeat">
            ${ICONS.repeatLoop}
          </button>
        </ui-toggle>

        <ui-toggle id="toggle-shuffle">
          <button type="button" class="metal-pill-btn btn-shuffle" aria-label="Shuffle">
            ${ICONS.shuffle123}
          </button>
        </ui-toggle>

        <!-- Seek Bar (<ui-slider>) — min=0 max=122 default-value=0 -->
        <ui-slider
          id="slider-seek"
          class="winamp-seek-slider"
          min="0"
          max="122"
          step="1"
          default-value="0"
          aria-label="Track Seek"
        >
          <ui-slider-control>
            <ui-slider-track>
              <ui-slider-indicator></ui-slider-indicator>
              <ui-slider-thumb aria-label="Track Seek Position"></ui-slider-thumb>
            </ui-slider-track>
          </ui-slider-control>
        </ui-slider>

        <!-- Capsule Buttons: Eject (<ui-button>) + PL / ML (<ui-toggle-group multiple>) -->
        <ui-button id="btn-eject" data-agent-confirm="Open the local audio file picker?">
          <button type="button" class="metal-pill-btn btn-eject" aria-label="Eject / Open Audio File">
            ${ICONS.eject}
          </button>
        </ui-button>

        <ui-toggle-group id="group-drawers" multiple default-value="pl" aria-label="Winamp Windows">
          <ui-toggle id="toggle-pl" value="pl" default-pressed>
            <button type="button" class="metal-pill-btn btn-pl" aria-label="Playlist Editor">PL</button>
          </ui-toggle>
          <ui-toggle id="toggle-ml" value="ml">
            <button type="button" class="metal-pill-btn btn-ml" aria-label="Media Library">ML</button>
          </ui-toggle>
        </ui-toggle-group>

        <!-- 5 Circular Transport Controls (<ui-toolbar> with roving keyboard focus) -->
        <ui-toolbar class="winamp-transport" loop aria-label="Playback Transport">
          <ui-toolbar-group aria-label="Transport Buttons">
            <ui-toolbar-button id="btn-prev">
              <button type="button" class="metal-round-btn btn-prev" aria-label="Previous Track">${ICONS.prev}</button>
            </ui-toolbar-button>
            <ui-toolbar-button id="btn-play">
              <button type="button" class="metal-round-btn btn-play" aria-label="Play">${ICONS.playBlue}</button>
            </ui-toolbar-button>
            <ui-toolbar-button id="btn-pause">
              <button type="button" class="metal-round-btn btn-pause" aria-label="Pause">${ICONS.pause}</button>
            </ui-toolbar-button>
            <ui-toolbar-button id="btn-stop">
              <button type="button" class="metal-round-btn btn-stop" aria-label="Stop">${ICONS.stop}</button>
            </ui-toolbar-button>
            <ui-toolbar-button id="btn-next">
              <button type="button" class="metal-round-btn btn-next" aria-label="Next Track">${ICONS.next}</button>
            </ui-toolbar-button>
          </ui-toolbar-group>
        </ui-toolbar>

        <!-- Mute Speaker Button (<ui-toggle>) -->
        <ui-toggle id="toggle-mute">
          <button type="button" id="btn-mute-inner" class="metal-round-btn btn-mute" aria-label="Mute Volume">
            ${ICONS.speakerOn}
          </button>
        </ui-toggle>

        <!-- Volume Slider (<ui-slider>) — min=0 max=100 default-value=99 -->
        <ui-slider
          id="slider-volume"
          class="winamp-volume-slider"
          min="0"
          max="100"
          step="1"
          default-value="99"
          aria-label="Master Volume"
        >
          <ui-slider-control>
            <ui-slider-track>
              <ui-slider-indicator></ui-slider-indicator>
              <ui-slider-thumb aria-label="Master Volume"></ui-slider-thumb>
            </ui-slider-track>
          </ui-slider-control>
        </ui-slider>

        <!-- CONFIG Bottom Tab (<ui-toggle>) -->
        <ui-toggle id="toggle-config">
          <button type="button" class="metal-pill-btn btn-config" aria-label="Toggle Equalizer and Full View">
            ${ICONS.configTri}
          </button>
        </ui-toggle>

        <!-- ================================================================
             INTEGRATED AUTHENTIC WINAMP 5 MODERN FULL VIEW BAY
             Revealed automatically as you drag-resize taller or click PL / ML / CONFIG
             ================================================================ -->
        <section id="winamp-fullview-bay" class="winamp-fullview-bay" aria-label="Winamp 5 Modern Full View">
          <!-- 1. Winamp 5 Modern Brushed-Silver Config / Equalizer Drawer (configdrawer.xml) -->
          <div id="wa-config-deck" class="wa-config-deck">
            <ui-tabs id="tabs-config" default-value="eq">
              <div class="wa-tabs-header">
                <ui-tabs-list class="wa-tab-list" aria-label="Winamp Config Tabs">
                  <ui-tabs-tab value="eq"><button type="button" class="wa-tab-btn">Equalizer</button></ui-tabs-tab>
                  <ui-tabs-tab value="themes"><button type="button" class="wa-tab-btn">Color Themes</button></ui-tabs-tab>
                  <ui-tabs-tab value="agent"><button type="button" class="wa-tab-btn">UI SDK Agent</button></ui-tabs-tab>
                </ui-tabs-list>
                <div style="display:flex;gap:8px;align-items:center;">
                  <button type="button" class="wa-mini-pill" data-eq-preset="flat">Flat</button>
                  <button type="button" class="wa-mini-pill" data-eq-preset="rock">Rock</button>
                  <button type="button" class="wa-mini-pill" data-eq-preset="club">Club</button>
                </div>
              </div>

              <!-- Equalizer Tab Panel -->
              <ui-tabs-panel value="eq">
                <div class="wa-eq-layout">
                  <div class="wa-eq-left">
                    <div style="display:flex;gap:8px;">
                      <ui-toggle id="toggle-eq-power">
                        <button type="button" class="wa-mini-pill"><span class="wa-mini-led"></span>ON</button>
                      </ui-toggle>
                      <ui-toggle id="toggle-eq-auto">
                        <button type="button" class="wa-mini-pill"><span class="wa-mini-led"></span>AUTO</button>
                      </ui-toggle>
                    </div>
                    <div class="wa-eq-spline-box">
                      <svg id="eq-spline-svg" viewBox="0 0 160 68" width="100%" height="100%" preserveAspectRatio="none">
                        <line x1="0" y1="34" x2="160" y2="34" stroke="rgba(165,198,255,0.3)" stroke-dasharray="3 3" />
                        <path id="eq-spline-fill" d="" fill="rgba(110,164,255,0.24)" />
                        <path id="eq-spline-path" d="" fill="none" stroke="#b8d4ff" stroke-width="2.4" />
                      </svg>
                    </div>
                  </div>

                  <div class="wa-eq-faders">
                    <div class="wa-eq-band wa-eq-band--preamp">
                      <ui-slider
                        id="slider-preamp"
                        class="eq-band-slider"
                        orientation="vertical"
                        min="-12"
                        max="12"
                        step="1"
                        default-value="0"
                        aria-label="EQ Preamp"
                      >
                        <ui-slider-control>
                          <ui-slider-track>
                            <ui-slider-indicator></ui-slider-indicator>
                            <ui-slider-thumb aria-label="EQ Preamp Gain"></ui-slider-thumb>
                          </ui-slider-track>
                        </ui-slider-control>
                      </ui-slider>
                      <span class="eq-freq-label">PRE</span>
                    </div>
                    ${EQ_FREQUENCIES.map(
                      (freq, i) => `
                      <div class="wa-eq-band">
                        <ui-slider
                          class="eq-band-slider"
                          data-eq-index="${i}"
                          orientation="vertical"
                          min="-12"
                          max="12"
                          step="1"
                          default-value="${engine.eqGains[i] ?? 0}"
                          aria-label="${freq >= 1000 ? `${freq / 1000}kHz` : `${freq}Hz`} EQ Band"
                        >
                          <ui-slider-control>
                            <ui-slider-track>
                              <ui-slider-indicator></ui-slider-indicator>
                              <ui-slider-thumb aria-label="${freq}Hz Gain"></ui-slider-thumb>
                            </ui-slider-track>
                          </ui-slider-control>
                        </ui-slider>
                        <span class="eq-freq-label">${freq >= 1000 ? `${freq / 1000}K` : freq}</span>
                      </div>`,
                    ).join("")}
                  </div>
                </div>
              </ui-tabs-panel>

              <!-- Color Themes Tab Panel (color-presets.xml) -->
              <ui-tabs-panel value="themes" hidden>
                <div class="wa-theme-swatches">
                  <button type="button" class="wa-mini-pill" data-hue="0deg">Default Cobalt</button>
                  <button type="button" class="wa-mini-pill" data-hue="265deg">Classic Nullsoft Green</button>
                  <button type="button" class="wa-mini-pill" data-hue="165deg">Winamp Fire Gold</button>
                  <button type="button" class="wa-mini-pill" data-hue="45deg">Cyber Violet</button>
                  <button type="button" class="wa-mini-pill" data-hue="125deg">Crimson Ruby</button>
                </div>
              </ui-tabs-panel>

              <!-- UI SDK Agent Bridge Tab Panel -->
              <ui-tabs-panel value="agent" hidden>
                <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
                  <span style="font-size:14.5px;font-weight:700;color:#253047;">
                    Live <code>@ui-sdk/web/agent</code> WebMCP Bridge
                  </span>
                  <div style="display:flex;gap:8px;">
                    <button type="button" id="btn-refresh-snapshot" class="wa-mini-pill">Refresh Snapshot</button>
                    <button type="button" id="btn-agent-demo" class="wa-mini-pill">Run agent.act() Demo</button>
                  </div>
                </div>
                <pre id="agent-snapshot-output" class="agent-snapshot-pre"></pre>
              </ui-tabs-panel>
            </ui-tabs>
          </div>

          <!-- 2. Winamp 5 Modern Lower Workspace: Playlist Editor (PL) | Media Library (ML) | AVS Visualizer -->
          <div class="wa-workspace">
            <ui-tabs id="tabs-workspace" default-value="pl">
              <div class="wa-tabs-header" style="margin-bottom:2px;">
                <ui-tabs-list class="wa-tab-list" aria-label="Winamp Workspace Views">
                  <ui-tabs-tab value="pl"><button type="button" class="wa-tab-btn">Playlist (PL)</button></ui-tabs-tab>
                  <ui-tabs-tab value="ml"><button type="button" class="wa-tab-btn">Media Library (ML)</button></ui-tabs-tab>
                  <ui-tabs-tab value="lyrics"><button type="button" class="wa-tab-btn">Suno Lyrics</button></ui-tabs-tab>
                  <ui-tabs-tab value="vis"><button type="button" class="wa-tab-btn">AVS Visualizer</button></ui-tabs-tab>
                </ui-tabs-list>
                <input id="wa-search-input" class="wa-search-input" type="search" placeholder="Search tracks, artists…" aria-label="Search Media Library" />
              </div>

              <!-- Authentic Winamp 5 Cobalt LCD Playlist Editor (pledit-normal.xml) -->
              <ui-tabs-panel value="pl">
                <div class="wa-lcd-pane">
                  <div id="playlist-rows" class="wa-pl-scroll"></div>
                </div>
              </ui-tabs-panel>

              <!-- 3-Pane Authentic Winamp 5 Media Library (ml-normal.xml) -->
              <ui-tabs-panel value="ml" hidden>
                <div class="wa-ml-grid">
                  <aside class="wa-ml-tree" id="ml-tree-pane" aria-label="Media Library Categories"></aside>
                  <div class="wa-ml-right">
                    <div class="wa-ml-filters">
                      <div class="wa-ml-filter-col" id="ml-artists-col"></div>
                      <div class="wa-ml-filter-col" id="ml-albums-col"></div>
                    </div>
                    <div class="wa-track-scroll">
                      <table class="wa-track-table">
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>Title</th>
                            <th>Artist</th>
                            <th>Album</th>
                            <th>Time</th>
                            <th>KBPS</th>
                          </tr>
                        </thead>
                        <tbody id="ml-tracks-tbody"></tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </ui-tabs-panel>

              <!-- Suno v6 Song Lyrics & Track Link Panel -->
              <ui-tabs-panel value="lyrics" hidden>
                <div class="wa-lcd-pane">
                  <div id="wa-lyrics-pane" class="wa-pl-scroll" style="padding:12px 18px;white-space:pre-wrap;font-family:var(--winamp-font-mono);font-size:15px;line-height:1.5;user-select:text;"></div>
                </div>
              </ui-tabs-panel>

              <!-- Live 60fps Beat-Reactive AVS / Oscilloscope Visualizer -->
              <ui-tabs-panel value="vis" hidden>
                <div class="wa-lcd-pane">
                  <canvas id="wa-vis-canvas" class="wa-vis-canvas" width="880" height="240"></canvas>
                </div>
              </ui-tabs-panel>
            </ui-tabs>

            <!-- Authentic Winamp 5 Modern Bottom Metallic Bar (+ADD, -REM, SEL, EQ, COMPACT, Total Time) -->
            <div class="wa-bottom-bar">
              <div class="wa-bottom-btns">
                <button type="button" id="pl-btn-add" class="wa-mini-pill" data-agent-confirm="Open the local audio file picker?">+ ADD</button>
                <button type="button" id="pl-btn-rem" class="wa-mini-pill">− REM</button>
                <button type="button" id="pl-btn-sel" class="wa-mini-pill">SEL ALL</button>
                <button type="button" id="pl-btn-eq-toggle" class="wa-mini-pill">HIDE EQ</button>
                <button type="button" id="pl-btn-compact" class="wa-mini-pill">▲ COMPACT</button>
              </div>
              <div id="wa-total-time" class="wa-lcd-time-pill">0:00 / 10:39</div>
            </div>
          </div>
        </section>
      </div>
    </winamp-window>
  </main>
`

// ============================================================================
// Grab Custom Element References & Wire Interactive Behaviors
// ============================================================================

const winampWin = document.querySelector("#winamp-main") as WinampWindowElement
const menubarEl = document.querySelector("#winamp-menubar") as UiMenubarElement
const chassisSvg = document.querySelector("#chassis-svg") as unknown as SVGSVGElement
const lcdHost = document.querySelector("#winamp-lcd") as HTMLElement
const filePicker = document.querySelector("#winamp-file-picker") as HTMLInputElement

const seekSlider = document.querySelector<UiSliderElement>("#slider-seek")!
const volSlider = document.querySelector<UiSliderElement>("#slider-volume")!
const preampSlider = document.querySelector<UiSliderElement>("#slider-preamp")!
const toggleRepeat = document.querySelector<UiToggleElement>("#toggle-repeat")!
const toggleShuffle = document.querySelector<UiToggleElement>("#toggle-shuffle")!
const toggleMute = document.querySelector<UiToggleElement>("#toggle-mute")!
const btnMuteInner = document.querySelector("#btn-mute-inner") as HTMLButtonElement
const toggleConfig = document.querySelector<UiToggleElement>("#toggle-config")!
const toggleEqPower = document.querySelector<UiToggleElement>("#toggle-eq-power")!
const toggleEqAuto = document.querySelector<UiToggleElement>("#toggle-eq-auto")!

const tabsConfig = document.querySelector<UiTabsElement>("#tabs-config")!
const tabsWorkspace = document.querySelector<UiTabsElement>("#tabs-workspace")!
const configDeckEl = document.querySelector("#wa-config-deck") as HTMLDivElement
const btnEqToggleLabel = document.querySelector("#pl-btn-eq-toggle") as HTMLButtonElement

const ledRepeatEl = document.querySelector("#led-repeat") as SVGGElement
const ledRepeatCore = ledRepeatEl.querySelector(".led-core") as SVGCircleElement
const ledShuffleEl = document.querySelector("#led-shuffle") as SVGGElement
const ledShuffleCore = ledShuffleEl.querySelector(".led-core") as SVGCircleElement

const menuChkRepeat = document.querySelector<HTMLElementTagNameMap["ui-menu-checkbox-item"]>("#menu-chk-repeat")!
const menuChkShuffle = document.querySelector<HTMLElementTagNameMap["ui-menu-checkbox-item"]>("#menu-chk-shuffle")!
const menuChkEq = document.querySelector<HTMLElementTagNameMap["ui-menu-checkbox-item"]>("#menu-chk-eq")!
const menuChkRemaining = document.querySelector<HTMLElementTagNameMap["ui-menu-checkbox-item"]>("#menu-chk-remaining")!
const menuRadAnalyzer = document.querySelector<HTMLElementTagNameMap["ui-menu-radio-group"]>("#menu-rad-analyzer")!

const playlistRows = document.querySelector("#playlist-rows") as HTMLDivElement
const mlTreePane = document.querySelector("#ml-tree-pane") as HTMLElement
const mlArtistsCol = document.querySelector("#ml-artists-col") as HTMLElement
const mlAlbumsCol = document.querySelector("#ml-albums-col") as HTMLElement
const mlTracksTbody = document.querySelector("#ml-tracks-tbody") as HTMLElement
const searchInputEl = document.querySelector("#wa-search-input") as HTMLInputElement
const totalTimePill = document.querySelector("#wa-total-time") as HTMLElement
const agentSnapshotOutput = document.querySelector("#agent-snapshot-output") as HTMLPreElement
const visCanvas = document.querySelector("#wa-vis-canvas") as HTMLCanvasElement
const visCtx = visCanvas.getContext("2d")!

// Reliable outside-tap dismissal on mobile touch & desktop even when tapping non-interactive
// background areas or elements whose pointerdown calls preventDefault() (like sliders/titlebar).
{
  let outsideTouchStart: { x: number; y: number } | null = null
  const isInsideOpenMenuOrMenubar = (e: Event): boolean => {
    for (const node of e.composedPath()) {
      if (node instanceof Element) {
        if (node === menubarEl || menubarEl.contains(node)) return true
        if (node.matches?.('[data-slot="menu-content"]') || node.closest?.('[data-slot="menu-content"]')) {
          return true
        }
      }
    }
    return false
  }

  window.addEventListener(
    "pointerdown",
    (e: PointerEvent) => {
      if (!menubarEl.api.isOpen()) {
        outsideTouchStart = null
        return
      }
      if (isInsideOpenMenuOrMenubar(e)) {
        outsideTouchStart = null
        return
      }
      if (e.pointerType === "touch") {
        outsideTouchStart = { x: e.clientX, y: e.clientY }
      } else {
        menubarEl.api.close()
      }
    },
    { capture: true },
  )

  window.addEventListener(
    "pointerup",
    (e: PointerEvent) => {
      if (e.pointerType !== "touch" || !outsideTouchStart) return
      const start = outsideTouchStart
      outsideTouchStart = null
      if (Math.hypot(e.clientX - start.x, e.clientY - start.y) <= 14 && menubarEl.api.isOpen()) {
        menubarEl.api.close()
      }
    },
    { capture: true },
  )

  // Prevent mobile pinch-to-zoom and double-tap zoom on iOS Safari & Android Chrome
  const preventZoomGesture = (e: Event) => {
    e.preventDefault()
  }
  document.addEventListener("gesturestart", preventZoomGesture, { passive: false })
  document.addEventListener("gesturechange", preventZoomGesture, { passive: false })
  document.addEventListener("gestureend", preventZoomGesture, { passive: false })
  document.addEventListener(
    "touchmove",
    (e: TouchEvent) => {
      if (e.touches.length > 1) {
        e.preventDefault()
      }
    },
    { passive: false },
  )
  document.addEventListener(
    "dblclick",
    (e: MouseEvent) => {
      e.preventDefault()
    },
    { passive: false },
  )
}

// Edge-to-edge pill slider pointer geometry powered by @ui-sdk/core's bindDrag
// (document-level pointerup/pointercancel, buttons===0 hover recovery, Escape cancel, rAF coalescing)
function bindEdgeToEdgeSlider(
  sliderEl: UiSliderElement,
  hooks?: { onStart?: () => void; onEnd?: (val: number) => void },
): void {
  const control = sliderEl.querySelector<HTMLElement>("ui-slider-control")
  const track = sliderEl.querySelector<HTMLElement>("ui-slider-track")
  const thumb = sliderEl.querySelector<HTMLElement>("ui-slider-thumb")
  if (!control || !track || !thumb) return

  let stopDrag: (() => void) | undefined

  sliderEl.addEventListener(
    "pointerdown",
    (e: PointerEvent) => {
      if (e.button !== 0) return
      e.stopImmediatePropagation()
      e.preventDefault()

      stopDrag?.()
      stopDrag = undefined

      const startValue = typeof sliderEl.value === "number" ? sliderEl.value : (sliderEl.value[0] ?? 0)
      const trackRect = track.getBoundingClientRect()
      const thumbRect = thumb.getBoundingClientRect()
      const travel = Math.max(1, trackRect.width - thumbRect.width)

      const clickedThumb = e.clientX >= thumbRect.left - 1 && e.clientX <= thumbRect.right + 1
      const grabOffset = clickedThumb ? e.clientX - thumbRect.left : thumbRect.width / 2

      const computeValue = (clientX: number): number => {
        const min = Number(sliderEl.min ?? sliderEl.getAttribute("min") ?? 0)
        const max = Number(sliderEl.max ?? sliderEl.getAttribute("max") ?? 100)
        const step = Number(sliderEl.step ?? sliderEl.getAttribute("step") ?? 1) || 1
        const frac = Math.max(0, Math.min(1, (clientX - grabOffset - trackRect.left) / travel))
        const raw = min + frac * (max - min)
        const snapped = min + Math.round((raw - min) / step) * step
        return Math.max(min, Math.min(max, snapped))
      }

      hooks?.onStart?.()
      sliderEl.setAttribute("data-dragging", "")

      if (!clickedThumb) {
        sliderEl.api.setValue(computeValue(e.clientX))
      }

      stopDrag = bindDrag(control, e, {
        cancelOnEscape: true,
        onMove: ({ x }) => {
          sliderEl.api.setValue(computeValue(x))
        },
        onEnd: (_endEvent, canceled) => {
          stopDrag = undefined
          sliderEl.removeAttribute("data-dragging")
          if (canceled) {
            sliderEl.api.setValue(startValue)
          }
          const finalVal = typeof sliderEl.value === "number" ? sliderEl.value : (sliderEl.value[0] ?? 0)
          hooks?.onEnd?.(finalVal)
          sliderEl.api.focus()
        },
      })
    },
    { capture: true },
  )
}

const lcd = new WinampLcdRenderer(lcdHost, {
  onToggleTimeMode: () => {
    timeRemainingMode = !timeRemainingMode
    menuChkRemaining.checked = timeRemainingMode
  },
  onCycleAnalyzer: () => {
    const order: AnalyzerMode[] = ["spectrum", "oscilloscope", "off"]
    analyzerMode = order[(order.indexOf(analyzerMode) + 1) % order.length]!
    menuRadAnalyzer.value = analyzerMode
  },
})

// Real-time 60fps geometry sync between <winamp-window>, SVG chassis, and LCD canvas!
winampWin.addEventListener("winampgeometry", (ev: Event) => {
  const { dW, dH, mobile } = (ev as CustomEvent<WinampGeometryDetail>).detail
  updateChassisGeometry(chassisSvg, dW, dH, mobile)
  lcd.setLayout(dW, mobile)
})
{
  const initGeom = winampWin.api.getGeometry()
  updateChassisGeometry(chassisSvg, initGeom.dW, initGeom.dH, initGeom.mobile)
  lcd.setLayout(initGeom.dW, initGeom.mobile)
}

function syncLed(groupEl: SVGGElement, coreEl: SVGCircleElement, lit: boolean): void {
  groupEl.setAttribute("data-lit", lit ? "true" : "false")
  coreEl.setAttribute("fill", lit ? "url(#ledLitGrad)" : "url(#ledOffGrad)")
  coreEl.setAttribute("stroke", lit ? "#2c4ba0" : "#686f84")
}

function updateEqSpline(): void {
  const pts = engine.eqGains.map((db, idx) => {
    const x = 8 + (idx / 9) * 144
    const y = 34 - (db / 12) * 26
    return [x, y] as const
  })
  const first = pts[0]
  const last = pts[pts.length - 1]
  if (!first || !last) return
  let d = `M ${first[0]} ${first[1]}`
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1]!
    const cur = pts[i]!
    const midX = (prev[0] + cur[0]) / 2
    d += ` C ${midX} ${prev[1]}, ${midX} ${cur[1]}, ${cur[0]} ${cur[1]}`
  }
  const fillD = `${d} L ${last[0]} 68 L ${first[0]} 68 Z`
  document.querySelector("#eq-spline-path")?.setAttribute("d", d)
  document.querySelector("#eq-spline-fill")?.setAttribute("d", fillD)
}

function renderPlaylistAndMediaLibrary(): void {
  const q = searchQuery.trim().toLowerCase()

  // 1. Playlist Editor (escaped + data-agent-hidden on imported local files)
  playlistRows.innerHTML = engine.tracks
    .map((t, i) => {
      if (q && !`${t.artist} ${t.title} ${t.album}`.toLowerCase().includes(q)) return ""
      const selMark = selectedPlIndices.has(i) ? "• " : ""
      const agentAttr = t.fileUrl?.startsWith("blob:") ? " data-agent-hidden" : ""
      return `
        <button type="button" class="wa-pl-row" data-track-idx="${i}" data-current="${i === engine.trackIndex}"${agentAttr}>
          <span>${selMark}${i + 1}. ${escapeHtml(t.artist)} — ${escapeHtml(t.title)}</span>
          <span>${formatDuration(t.duration)}</span>
        </button>`
    })
    .join("")

  playlistRows.querySelectorAll<HTMLButtonElement>(".wa-pl-row").forEach((btn) => {
    btn.addEventListener("click", (ev) => {
      const idx = Number(btn.dataset.trackIdx ?? 0)
      if (ev.metaKey || ev.ctrlKey) {
        if (selectedPlIndices.has(idx)) selectedPlIndices.delete(idx)
        else selectedPlIndices.add(idx)
        renderPlaylistAndMediaLibrary()
      } else {
        selectedPlIndices = new Set([idx])
        engine.selectTrack(idx, true)
      }
    })
  })

  // 2. 3-Pane Media Library (integer-indexed filter attributes -> zero attribute injection)
  const genres = ["ALL", ...Array.from(new Set(engine.tracks.map((t) => t.genre)))]
  mlTreePane.innerHTML = `
    <div class="wa-ml-tree-title">Local Media</div>
    ${genres
      .map(
        (g, idx) => `
      <button type="button" class="wa-ml-tree-btn" data-genre-idx="${idx}" data-active="${mlGenreFilter === g}">
        ${g === "ALL" ? `All Audio (${engine.tracks.length})` : escapeHtml(g)}
      </button>`,
      )
      .join("")}
  `
  mlTreePane.querySelectorAll<HTMLButtonElement>("[data-genre-idx]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.dataset.genreIdx ?? 0)
      mlGenreFilter = genres[idx] ?? "ALL"
      mlArtistFilter = "ALL"
      mlAlbumFilter = "ALL"
      renderPlaylistAndMediaLibrary()
    })
  })

  const genreMatched = engine.tracks.filter((t) => mlGenreFilter === "ALL" || t.genre === mlGenreFilter)
  const artists = ["ALL", ...Array.from(new Set(genreMatched.map((t) => t.artist)))]
  mlArtistsCol.innerHTML = `
    <div class="wa-col-hdr">Artists (${artists.length - 1})</div>
    ${artists
      .map(
        (a, idx) => `
      <button type="button" class="wa-filter-item" data-artist-idx="${idx}" data-active="${mlArtistFilter === a}">
        ${a === "ALL" ? `All (${artists.length - 1} artists)` : escapeHtml(a)}
      </button>`,
      )
      .join("")}
  `
  mlArtistsCol.querySelectorAll<HTMLButtonElement>("[data-artist-idx]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.dataset.artistIdx ?? 0)
      mlArtistFilter = artists[idx] ?? "ALL"
      mlAlbumFilter = "ALL"
      renderPlaylistAndMediaLibrary()
    })
  })

  const artistMatched = genreMatched.filter((t) => mlArtistFilter === "ALL" || t.artist === mlArtistFilter)
  const albums = ["ALL", ...Array.from(new Set(artistMatched.map((t) => t.album)))]
  mlAlbumsCol.innerHTML = `
    <div class="wa-col-hdr">Albums (${albums.length - 1})</div>
    ${albums
      .map(
        (al, idx) => `
      <button type="button" class="wa-filter-item" data-album-idx="${idx}" data-active="${mlAlbumFilter === al}">
        ${al === "ALL" ? `All (${albums.length - 1} albums)` : escapeHtml(al)}
      </button>`,
      )
      .join("")}
  `
  mlAlbumsCol.querySelectorAll<HTMLButtonElement>("[data-album-idx]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.dataset.albumIdx ?? 0)
      mlAlbumFilter = albums[idx] ?? "ALL"
      renderPlaylistAndMediaLibrary()
    })
  })

  const finalTracks = engine.tracks
    .map((track, index) => ({ track, index }))
    .filter(({ track }) => {
      if (mlGenreFilter !== "ALL" && track.genre !== mlGenreFilter) return false
      if (mlArtistFilter !== "ALL" && track.artist !== mlArtistFilter) return false
      if (mlAlbumFilter !== "ALL" && track.album !== mlAlbumFilter) return false
      if (q && !`${track.artist} ${track.title} ${track.album}`.toLowerCase().includes(q)) return false
      return true
    })

  mlTracksTbody.innerHTML = finalTracks
    .map(({ track, index }) => {
      const agentAttr = track.fileUrl?.startsWith("blob:") ? " data-agent-hidden" : ""
      return `
      <tr data-ml-play="${index}" data-playing="${index === engine.trackIndex}"${agentAttr}>
        <td>${index + 1}</td>
        <td>${escapeHtml(track.title)}</td>
        <td>${escapeHtml(track.artist)}</td>
        <td>${escapeHtml(track.album)}</td>
        <td>${formatDuration(track.duration)}</td>
        <td>${track.kbps}</td>
      </tr>`
    })
    .join("")

  mlTracksTbody.querySelectorAll<HTMLTableRowElement>("[data-ml-play]").forEach((tr) => {
    tr.addEventListener("click", () => {
      const idx = Number(tr.dataset.mlPlay ?? 0)
      engine.selectTrack(idx, true)
    })
  })

  const lyricsEl = document.querySelector("#wa-lyrics-pane")
  if (lyricsEl) {
    const ct = engine.currentTrack
    const header = `${ct.artist} — ${ct.title}${ct.sunoUrl ? `\nSuno v6: ${ct.sunoUrl}` : ""}\n${"─".repeat(44)}\n`
    lyricsEl.textContent = header + (ct.lyrics ?? "Instrumental / Imported Audio Track")
  }
}

function refreshAgentSnapshot(): void {
  const snap = agent.snapshot()
  agentSnapshotOutput.textContent = JSON.stringify(snap, null, 2)
}

function syncUiFromEngine(): void {
  seekSlider.max = engine.currentTrack.duration
  if (!isScrubbingSeek) {
    seekSlider.value = Math.round(engine.currentTime)
  }
  volSlider.value = Math.round(engine.volume)

  toggleRepeat.pressed = engine.repeat
  menuChkRepeat.checked = engine.repeat
  syncLed(ledRepeatEl, ledRepeatCore, engine.repeat)

  toggleShuffle.pressed = engine.shuffle
  menuChkShuffle.checked = engine.shuffle
  syncLed(ledShuffleEl, ledShuffleCore, engine.shuffle)

  toggleMute.pressed = engine.muted
  btnMuteInner.innerHTML = engine.muted ? ICONS.speakerMuted : ICONS.speakerOn

  toggleEqPower.pressed = engine.eqEnabled
  menuChkEq.checked = engine.eqEnabled
  updateEqSpline()

  const totalSec = engine.tracks.reduce((acc, t) => acc + t.duration, 0)
  totalTimePill.textContent = `${formatDuration(engine.currentTime)} / ${formatDuration(totalSec)}`

  const snapKey = `${engine.trackIndex}:${engine.tracks.map((t) => `${t.id}:${t.duration}`).join("|")}`
  if (snapKey !== lastRenderedTrackSnapshot) {
    lastRenderedTrackSnapshot = snapKey
    renderPlaylistAndMediaLibrary()
  }
}

engine.onChange(syncUiFromEngine)
syncUiFromEngine()

// ============================================================================
// Wire @ui-sdk/web Events
// ============================================================================

bindEdgeToEdgeSlider(seekSlider, {
  onStart: () => {
    isScrubbingSeek = true
  },
  onEnd: (val) => {
    isScrubbingSeek = false
    engine.seek(val)
  },
})

bindEdgeToEdgeSlider(volSlider)

seekSlider.addEventListener("valuechange", (e) => {
  if (e.detail.reason === "imperative") return
  const val = typeof e.detail.value === "number" ? e.detail.value : (e.detail.value[0] ?? 0)
  engine.seek(val)
})
seekSlider.addEventListener("valuecommit", (e) => {
  isScrubbingSeek = false
  const val = typeof e.detail.value === "number" ? e.detail.value : (e.detail.value[0] ?? 0)
  engine.seek(val)
})

volSlider.addEventListener("valuechange", (e) => {
  const val = typeof e.detail.value === "number" ? e.detail.value : (e.detail.value[0] ?? 99)
  engine.setVolume(val)
  if (engine.muted && val > 0) engine.setMuted(false)
})

preampSlider.addEventListener("valuechange", (e) => {
  const val = typeof e.detail.value === "number" ? e.detail.value : (e.detail.value[0] ?? 0)
  if (!engine.eqEnabled) engine.setEqEnabled(true)
  engine.setPreamp(val)
})

toggleRepeat.addEventListener("pressedchange", (e) => engine.setRepeat(e.detail.value))
toggleShuffle.addEventListener("pressedchange", (e) => engine.setShuffle(e.detail.value))
toggleMute.addEventListener("pressedchange", (e) => engine.setMuted(e.detail.value))

document.querySelector("#btn-prev button")!.addEventListener("click", () => engine.previous())
document.querySelector("#btn-play button")!.addEventListener("click", () => void engine.play())
document.querySelector("#btn-pause button")!.addEventListener("click", () => engine.pause())
document.querySelector("#btn-stop button")!.addEventListener("click", () => engine.stop())
document.querySelector("#btn-next button")!.addEventListener("click", () => engine.next())

document.querySelector<UiButtonElement>("#btn-eject")!.addEventListener("action", () => filePicker.click())
document.querySelector("#pl-btn-add")!.addEventListener("click", () => filePicker.click())
filePicker.addEventListener("change", () => {
  if (filePicker.files && filePicker.files.length > 0) {
    void engine.loadFiles(filePicker.files)
  }
})

document.querySelector("#pl-btn-rem")!.addEventListener("click", () => {
  engine.removeTracks(selectedPlIndices)
  selectedPlIndices = new Set([engine.trackIndex])
  lastRenderedTrackSnapshot = ""
  renderPlaylistAndMediaLibrary()
})

document.querySelector("#pl-btn-sel")!.addEventListener("click", () => {
  selectedPlIndices = new Set(engine.tracks.map((_, i) => i))
  renderPlaylistAndMediaLibrary()
})

document.querySelector("#pl-btn-eq-toggle")!.addEventListener("click", () => {
  configDeckVisible = !configDeckEl.hidden ? false : true
  configDeckEl.hidden = !configDeckVisible
  btnEqToggleLabel.textContent = configDeckVisible ? "HIDE EQ" : "SHOW EQ"
})

document.querySelector("#pl-btn-compact")!.addEventListener("click", () => {
  winampWin.api.setFullView(false)
})

searchInputEl.addEventListener("input", () => {
  searchQuery = searchInputEl.value
  renderPlaylistAndMediaLibrary()
})

winampWin.addEventListener("dragover", (e) => e.preventDefault())
winampWin.addEventListener("drop", (e) => {
  e.preventDefault()
  if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
    void engine.loadFiles(e.dataTransfer.files)
  }
})

// Opening Full View sections via PL, ML, CONFIG, or top-right ▼ button
function openFullViewTab(workspaceTab: "pl" | "ml" | "vis", showEq = true): void {
  const alreadyOpen = winampWin.api.isFullView()
  const sameTab = tabsWorkspace.value === workspaceTab
  if (alreadyOpen && sameTab) {
    winampWin.api.setFullView(false)
    return
  }
  configDeckVisible = showEq
  configDeckEl.hidden = !showEq
  btnEqToggleLabel.textContent = showEq ? "HIDE EQ" : "SHOW EQ"
  tabsWorkspace.value = workspaceTab
  winampWin.api.setFullView(true)
}

document.querySelector("#toggle-pl button")!.addEventListener("click", () => openFullViewTab("pl", true))
document.querySelector("#toggle-ml button")!.addEventListener("click", () => openFullViewTab("ml", true))
document.querySelector<UiButtonElement>("#btn-top-vis")!.addEventListener("action", () => openFullViewTab("vis", true))

toggleConfig.addEventListener("pressedchange", () => {
  if (!winampWin.api.isFullView()) {
    configDeckVisible = true
    configDeckEl.hidden = false
    btnEqToggleLabel.textContent = "HIDE EQ"
    tabsConfig.value = "eq"
    winampWin.api.setFullView(true)
  } else {
    winampWin.api.setFullView(false)
  }
})

// 10-Band EQ & Color Theme controls
toggleEqPower.addEventListener("pressedchange", (e) => engine.setEqEnabled(e.detail.value))
toggleEqAuto.addEventListener("pressedchange", (e) => {
  engine.eqAuto = e.detail.value
})

const eqSliders = document.querySelectorAll<UiSliderElement>('ui-slider.eq-band-slider[data-eq-index]')
eqSliders.forEach((sl) => {
  sl.addEventListener("valuechange", (e) => {
    const idx = Number(sl.dataset.eqIndex ?? 0)
    const val = typeof e.detail.value === "number" ? e.detail.value : (e.detail.value[0] ?? 0)
    if (!engine.eqEnabled) engine.setEqEnabled(true)
    engine.setEqBand(idx, val)
    updateEqSpline()
  })
})

function applyEqPreset(gains: number[]): void {
  engine.setEqEnabled(true)
  gains.forEach((g, idx) => {
    engine.setEqBand(idx, g)
    const sl = eqSliders[idx]
    if (sl) sl.value = g
  })
  updateEqSpline()
}

document.querySelectorAll<HTMLButtonElement>("[data-eq-preset]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const p = btn.dataset.eqPreset
    if (p === "flat") applyEqPreset([0, 0, 0, 0, 0, 0, 0, 0, 0, 0])
    else if (p === "rock") applyEqPreset([5, 4, 2, -1, -2, 1, 3, 5, 6, 6])
    else if (p === "club") applyEqPreset([6, 5, 3, 1, 0, 1, 3, 4, 4, 3])
  })
})

document.querySelectorAll<HTMLButtonElement>("[data-hue]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const hue = btn.dataset.hue ?? "0deg"
    document.documentElement.style.setProperty("--winamp-hue-rotate", hue)
    if (hue === "0deg") {
      document.documentElement.removeAttribute("data-winamp-themed")
    } else {
      document.documentElement.setAttribute("data-winamp-themed", "true")
    }
  })
})

tabsConfig.addEventListener("valuechange", (e) => {
  if (e.detail.value === "agent") refreshAgentSnapshot()
})

document.querySelector<UiButtonElement>("#btn-win-min")!.addEventListener("action", () => {
  winampWin.api.setMinimized(!winampWin.api.isMinimized())
})
document.querySelector<UiButtonElement>("#btn-win-shade")!.addEventListener("action", () => {
  winampWin.api.toggleShaded()
})
document.querySelector<UiButtonElement>("#btn-win-close")!.addEventListener("action", () => {
  winampWin.api.setShaded(false)
  winampWin.api.setMinimized(false)
  winampWin.api.resetPosition()
})

function restoreExactScreenshotState(): void {
  engine.stop()
  engine.trackIndex = 0
  engine.currentTime = 0.0
  engine.status = "playing"
  engine.liveAudioRunning = false
  engine.setVolume(99)
  engine.setMuted(false)
  engine.setRepeat(true)
  engine.setShuffle(false)
  engine.setEqEnabled(false)
  document.documentElement.style.setProperty("--winamp-hue-rotate", "0deg")
  document.documentElement.removeAttribute("data-winamp-themed")
  timeRemainingMode = false
  analyzerMode = "spectrum"
  lcd.resetSnapshot()
  winampWin.api.setShaded(false)
  winampWin.api.setMinimized(false)
  winampWin.api.resetPosition()
  lastRenderedTrackSnapshot = ""
  syncUiFromEngine()
}

document.querySelectorAll<UiMenuElement>("ui-menu").forEach((menu) => {
  menu.addEventListener("action", (e) => {
    const cmd = e.detail.value
    switch (cmd) {
      case "open-file":
        filePicker.click()
        break
      case "track-0":
      case "track-1":
      case "track-2":
      case "track-3":
      case "track-4":
        engine.selectTrack(Number(cmd.split("-")[1]), true)
        break
      case "reset-snapshot":
        restoreExactScreenshotState()
        break
      case "prev":
        engine.previous()
        break
      case "play":
        void engine.play()
        break
      case "pause":
        engine.pause()
        break
      case "stop":
        engine.stop()
        break
      case "next":
        engine.next()
        break
      case "back-5s":
        engine.seek(engine.currentTime - 5)
        break
      case "fwd-5s":
        engine.seek(engine.currentTime + 5)
        break
      case "view-compact":
        winampWin.api.setFullView(false)
        break
      case "view-full":
        winampWin.api.setDimensions(FULLVIEW_WIDTH, FULLVIEW_HEIGHT)
        break
      case "open-pl":
        openFullViewTab("pl", true)
        break
      case "open-ml":
        openFullViewTab("ml", true)
        break
      case "open-vis":
        openFullViewTab("vis", true)
        break
      case "toggle-shade":
        winampWin.api.toggleShaded()
        break
      case "agent-snapshot":
        configDeckVisible = true
        configDeckEl.hidden = false
        tabsConfig.value = "agent"
        winampWin.api.setFullView(true)
        refreshAgentSnapshot()
        break
      case "about":
        toast("Winamp 5 Modern — Built with Vercel UI SDK (@ui-sdk/web + @ui-sdk/core) Web Components")
        break
    }
  })
})

menuChkRepeat.addEventListener("checkedchange", (e) => engine.setRepeat(e.detail.value))
menuChkShuffle.addEventListener("checkedchange", (e) => engine.setShuffle(e.detail.value))
menuChkEq.addEventListener("checkedchange", (e) => engine.setEqEnabled(e.detail.value))
menuChkRemaining.addEventListener("checkedchange", (e) => {
  timeRemainingMode = e.detail.value
})
menuRadAnalyzer.addEventListener("valuechange", (e) => {
  analyzerMode = e.detail.value as AnalyzerMode
})

document.querySelector("#btn-refresh-snapshot")!.addEventListener("click", refreshAgentSnapshot)
document.querySelector("#btn-agent-demo")!.addEventListener("click", async () => {
  await agent.act({
    steps: [
      { ref: "Shuffle", action: "toggle", args: [] },
      { ref: "Master Volume", action: "setValue", args: [84] },
    ],
  })
  refreshAgentSnapshot()
  toast("Executed agent.act(): toggled Shuffle & set Master Volume to 84")
})

// Classic Winamp Z X C V B R S M + Full View (Cmd/Ctrl+F) Shortcuts via @ui-sdk/web
shortcuts.setScope("winamp", true)
registerShortcut("z", () => engine.previous(), { scope: "winamp", description: "Previous Track" })
registerShortcut("x", () => void engine.play(), { scope: "winamp", description: "Play" })
registerShortcut("c", () => engine.pause(), { scope: "winamp", description: "Pause" })
registerShortcut("v", () => engine.stop(), { scope: "winamp", description: "Stop" })
registerShortcut("b", () => engine.next(), { scope: "winamp", description: "Next Track" })
registerShortcut("r", () => engine.setRepeat(!engine.repeat), { scope: "winamp", description: "Toggle Repeat" })
registerShortcut("s", () => engine.setShuffle(!engine.shuffle), { scope: "winamp", description: "Toggle Shuffle" })
registerShortcut("m", () => engine.setMuted(!engine.muted), { scope: "winamp", description: "Toggle Mute" })
registerShortcut("mod+f", () => winampWin.api.toggleFullView(), {
  scope: "winamp",
  description: "Toggle Full Winamp View",
})

// Keep centered & responsive across desktop/mobile viewport changes
window.addEventListener("resize", () => {
  if (isBare) return
  winampWin.api.syncViewportResize()
})

// ============================================================================
// 60fps Render Loop for LCD Screen + Full View AVS Visualizer
// ============================================================================

let prevFrameTime = performance.now()

function renderAvsVisualizer(now: number, bars18: number[] | null, wave: Uint8Array | null): void {
  if (tabsWorkspace.value !== "vis" || !winampWin.api.isFullView()) return
  const w = visCanvas.width
  const h = visCanvas.height
  visCtx.fillStyle = "rgba(10, 22, 54, 0.32)"
  visCtx.fillRect(0, 0, w, h)

  const t = now * 0.002
  const bars = bars18 ?? [1, 2, 3, 2, 4, 3, 5, 4, 3, 2, 3, 2, 1, 2, 1, 1, 1, 0.5]

  // Glowing radial frequency bars + oscilloscope ribbon
  const barW = (w - 48) / 36
  for (let i = 0; i < 36; i++) {
    const src = bars[Math.floor(i / 2)] ?? 0
    const idlePulse = engine.liveAudioRunning ? 0 : (Math.sin(t * 2 + i * 0.45) * 0.5 + 0.6) * 2.2
    const val = Math.min(6, src + idlePulse)
    const bh = (val / 6) * (h * 0.68)
    const x = 24 + i * barW
    const grad = visCtx.createLinearGradient(0, h - 16 - bh, 0, h - 16)
    grad.addColorStop(0, "#eef6ff")
    grad.addColorStop(0.45, "#74a8ff")
    grad.addColorStop(1, "#2652b8")
    visCtx.fillStyle = grad
    visCtx.fillRect(x + 2, h - 16 - bh, barW - 4, bh)
  }

  // Oscilloscope wave across center
  visCtx.strokeStyle = "#e6f2ff"
  visCtx.lineWidth = 2.4
  visCtx.beginPath()
  const samples = 96
  for (let i = 0; i < samples; i++) {
    const px = 24 + (i / (samples - 1)) * (w - 48)
    const wy = wave
      ? (((wave[Math.floor((i / samples) * wave.length)] ?? 128) - 128) / 128) * 58
      : Math.sin(t * 3 + i * 0.22) * 18 * Math.cos(t + i * 0.07)
    const py = h * 0.38 + wy
    if (i === 0) visCtx.moveTo(px, py)
    else visCtx.lineTo(px, py)
  }
  visCtx.stroke()
}

function animationFrame(now: number): void {
  const dtSec = Math.min(0.1, Math.max(0, (now - prevFrameTime) / 1000))
  prevFrameTime = now

  const timeChanged = engine.tick(now, isScrubbingSeek)
  if (timeChanged && !isScrubbingSeek) {
    seekSlider.value = Math.floor(engine.currentTime)
    const totalSec = engine.tracks.reduce((acc, t) => acc + t.duration, 0)
    totalTimePill.textContent = `${formatDuration(engine.currentTime)} / ${formatDuration(totalSec)}`
  }

  const liveBars = engine.readFrequencyBars18()
  const liveWave = engine.readWaveform()

  const lcdState = {
    status: engine.status,
    currentTime: engine.currentTime,
    track: engine.currentTrack,
    repeat: engine.repeat,
    shuffle: engine.shuffle,
    eqEnabled: engine.eqEnabled,
    timeRemainingMode,
    analyzerMode,
    liveBars18: liveBars,
    waveform: liveWave,
    liveScrolling: engine.liveAudioRunning && engine.status === "playing",
  }

  lcd.stepAnimation(dtSec, lcdState)
  lcd.render(lcdState)
  renderAvsVisualizer(now, liveBars, liveWave)

  requestAnimationFrame(animationFrame)
}

requestAnimationFrame(animationFrame)

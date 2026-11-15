import {
  createChange,
  createResize,
  css,
  definePrimitive,
  live,
  type ResizeBox,
  type ResizeDraft,
  type ResizeHandle,
} from "@ui-sdk/core"
import { createParts } from "@ui-sdk/web"

export const LOGICAL_WIDTH = 927
export const MOBILE_LOGICAL_WIDTH = 580
export const LOGICAL_HEIGHT = 442

// Desktop default compact Winamp size (496 x 236 px)
export const COMPACT_WIDTH = 496
export const BASE_SCALE = COMPACT_WIDTH / LOGICAL_WIDTH // 0.53505933
export const COMPACT_HEIGHT = Math.round(LOGICAL_HEIGHT * BASE_SCALE) // 236px

// Desktop Full View size
export const FULLVIEW_WIDTH = 760
export const FULLVIEW_HEIGHT = 560

export const MOBILE_BREAKPOINT = 560

export interface WinampGeometryDetail {
  width: number
  height: number
  scale: number
  dW: number
  dH: number
  mobile: boolean
}

export type WinampWindowOptions = {
  title?: string
  bare?: boolean
  onShadeChange?: (shaded: boolean) => void
  onMinimizeChange?: (minimized: boolean) => void
  onResizeChange?: (box: ResizeBox) => void
}

export type WinampWindowState = {
  boxes: Record<string, ResizeBox>
  resizing: ResizeDraft | null
  shaded: boolean
  minimized: boolean
}

export function isMobileViewport(bare?: boolean): boolean {
  if (bare || typeof window === "undefined") return false
  return window.innerWidth <= MOBILE_BREAKPOINT
}

function mobileCompactDimensions(): { width: number; height: number } {
  const vw = typeof window !== "undefined" ? window.innerWidth : 390
  const width = Math.max(296, Math.min(420, vw - 24))
  const scale = width / MOBILE_LOGICAL_WIDTH
  const height = Math.round(LOGICAL_HEIGHT * scale)
  return { width, height }
}

function centeredPosition(w: number, h: number): { x: number; y: number } {
  const vw = typeof window !== "undefined" ? window.innerWidth : 1280
  const vh = typeof window !== "undefined" ? window.innerHeight : 800
  return {
    x: Math.max(12, Math.round((vw - w) / 2)),
    y: Math.max(44, Math.round((vh - h) / 2)),
  }
}

function initialBox(bare?: boolean): ResizeBox {
  if (bare) {
    return { x: 0, y: 0, width: LOGICAL_WIDTH, height: LOGICAL_HEIGHT }
  }
  if (isMobileViewport(false)) {
    const { width, height } = mobileCompactDimensions()
    const pos = centeredPosition(width, height)
    return { ...pos, width, height }
  }
  const pos = centeredPosition(COMPACT_WIDTH, COMPACT_HEIGHT)
  return {
    ...pos,
    width: COMPACT_WIDTH,
    height: COMPACT_HEIGHT,
  }
}

function computeGeometry(box: ResizeBox, bare?: boolean): WinampGeometryDetail {
  if (bare) {
    return { width: box.width, height: box.height, scale: 1, dW: 0, dH: 0, mobile: false }
  }
  const mobile = isMobileViewport(false)
  if (mobile) {
    const scale = box.width / MOBILE_LOGICAL_WIDTH
    const dH = Math.max(0, box.height / scale - LOGICAL_HEIGHT)
    return { width: box.width, height: box.height, scale, dW: 0, dH, mobile: true }
  }
  const scale = BASE_SCALE
  const dW = Math.max(0, box.width / scale - LOGICAL_WIDTH)
  const dH = Math.max(0, box.height / scale - LOGICAL_HEIGHT)
  return { width: box.width, height: box.height, scale, dW, dH, mobile: false }
}

export const winampWindowPrimitive = definePrimitive({
  name: "winamp-window",
  options: {
    title: "string",
    bare: "boolean",
    onShadeChange: "callback",
    onMinimizeChange: "callback",
    onResizeChange: "callback",
  },
  state: (options: WinampWindowOptions): WinampWindowState => ({
    boxes: { main: initialBox(options.bare) },
    resizing: null,
    shaded: false,
    minimized: false,
  }),
  live: ["resizing"],
  api: (context) => {
    const change = createChange(context)
    let lastDragHandle: ResizeHandle | undefined
    let centerTimer: number | null = null

    const emitGeometry = (box: ResizeBox) => {
      const rootEl = context.element("root")
      if (!rootEl) return
      const detail = computeGeometry(box, context.options().bare)
      rootEl.dispatchEvent(new CustomEvent<WinampGeometryDetail>("winampgeometry", { detail }))
    }

    const animateBoxCentered = (targetW: number, targetH: number, animateSize = false) => {
      const rootEl = context.element("root")
      const mobile = isMobileViewport(context.options().bare)
      const minW = mobile ? 296 : COMPACT_WIDTH
      const minH = mobile ? mobileCompactDimensions().height : COMPACT_HEIGHT
      const vw = typeof window !== "undefined" ? window.innerWidth : 1280
      const vh = typeof window !== "undefined" ? window.innerHeight : 800
      const clampedW = Math.max(minW, Math.min(Math.min(1240, vw - 20), Math.round(targetW)))
      const clampedH = Math.max(minH, Math.min(Math.min(840, vh - 56), Math.round(targetH)))
      const { x: cx, y: cy } = centeredPosition(clampedW, clampedH)

      if (centerTimer !== null) {
        window.clearTimeout(centerTimer)
        centerTimer = null
      }

      if (rootEl) {
        rootEl.setAttribute("data-centering", animateSize ? "all" : "pos")
      }

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const nextBox: ResizeBox = { x: cx, y: cy, width: clampedW, height: clampedH }
          resize.resizeTo("main", nextBox, { reason: "imperative" })
          emitGeometry(nextBox)
          centerTimer = window.setTimeout(() => {
            rootEl?.removeAttribute("data-centering")
            centerTimer = null
          }, 450)
        })
      })
    }

    const resize = createResize(context, {
      boxes: (state) => state.boxes,
      draft: "resizing",
      set: (value, details) => {
        const handleUsed = lastDragHandle
        lastDragHandle = undefined
        const ok = change("boxes", value, details)
        if (ok && value.main) {
          emitGeometry(value.main)
          context.options().onResizeChange?.(value.main)
          if (details.reason === "drag" && handleUsed && handleUsed !== "move") {
            animateBoxCentered(value.main.width, value.main.height, false)
          }
        }
        return ok
      },
      min: () => {
        if (isMobileViewport(context.options().bare)) {
          return mobileCompactDimensions()
        }
        return { width: COMPACT_WIDTH, height: COMPACT_HEIGHT }
      },
      max: () => ({ width: 1240, height: 840 }),
      step: () => 1,
      largeStep: () => 20,
      label: () => context.options().title || "Winamp",
    })

    return {
      resize,
      recordHandleStart: (h: ResizeHandle) => {
        lastDragHandle = h
        context.element("root")?.removeAttribute("data-centering")
      },
      emitGeometry,
      getBox: () => resize.box(context.store.get(), "main"),
      getGeometry: () => computeGeometry(resize.box(context.store.get(), "main"), context.options().bare),
      isFullView: () => {
        const g = computeGeometry(resize.box(context.store.get(), "main"), context.options().bare)
        return g.dH > 40
      },
      setFullView: (open: boolean) => {
        if (isMobileViewport(context.options().bare)) {
          const { width, height } = mobileCompactDimensions()
          const vh = typeof window !== "undefined" ? window.innerHeight : 780
          const expandedH = Math.min(vh - 64, Math.round(height + 250))
          animateBoxCentered(width, open ? expandedH : height, true)
          return
        }
        const cur = resize.box(context.store.get(), "main")
        if (open) {
          animateBoxCentered(Math.max(FULLVIEW_WIDTH, cur.width), Math.max(FULLVIEW_HEIGHT, cur.height), true)
        } else {
          animateBoxCentered(COMPACT_WIDTH, COMPACT_HEIGHT, true)
        }
      },
      toggleFullView: () => {
        const g = computeGeometry(resize.box(context.store.get(), "main"), context.options().bare)
        const isOpen = g.dH > 40
        if (isMobileViewport(context.options().bare)) {
          const { width, height } = mobileCompactDimensions()
          const vh = typeof window !== "undefined" ? window.innerHeight : 780
          const expandedH = Math.min(vh - 64, Math.round(height + 250))
          animateBoxCentered(width, isOpen ? height : expandedH, true)
          return
        }
        if (isOpen) {
          animateBoxCentered(COMPACT_WIDTH, COMPACT_HEIGHT, true)
        } else {
          const cur = resize.box(context.store.get(), "main")
          animateBoxCentered(Math.max(FULLVIEW_WIDTH, cur.width), FULLVIEW_HEIGHT, true)
        }
      },
      setDimensions: (width: number, height: number) => {
        animateBoxCentered(width, height, true)
      },
      syncViewportResize: () => {
        if (context.options().bare) return
        if (isMobileViewport(false)) {
          const { width, height } = mobileCompactDimensions()
          const wasOpen = computeGeometry(resize.box(context.store.get(), "main"), false).dH > 40
          const vh = typeof window !== "undefined" ? window.innerHeight : 780
          const nextH = wasOpen ? Math.min(vh - 64, Math.round(height + 250)) : height
          const pos = centeredPosition(width, nextH)
          const nextBox: ResizeBox = { ...pos, width, height: nextH }
          resize.resizeTo("main", nextBox, { reason: "imperative" })
          emitGeometry(nextBox)
          return
        }
        const cur = resize.box(context.store.get(), "main")
        const nextW = Math.max(COMPACT_WIDTH, cur.width)
        const nextH = cur.width < COMPACT_WIDTH ? COMPACT_HEIGHT : Math.max(COMPACT_HEIGHT, cur.height)
        const pos = centeredPosition(nextW, nextH)
        const nextBox: ResizeBox = { ...pos, width: nextW, height: nextH }
        resize.resizeTo("main", nextBox, { reason: "imperative" })
        emitGeometry(nextBox)
      },
      isShaded: () => context.store.get().shaded,
      setShaded: (shaded: boolean) => {
        change("shaded", Boolean(shaded), { reason: "imperative" })
        context.options().onShadeChange?.(Boolean(shaded))
      },
      toggleShaded: () => {
        const next = !context.store.get().shaded
        change("shaded", next, { reason: "imperative" })
        context.options().onShadeChange?.(next)
      },
      isMinimized: () => context.store.get().minimized,
      setMinimized: (minimized: boolean) => {
        change("minimized", Boolean(minimized), { reason: "imperative" })
        context.options().onMinimizeChange?.(Boolean(minimized))
      },
      resetPosition: () => {
        if (context.options().bare) {
          const b = initialBox(true)
          resize.resizeTo("main", b, { reason: "imperative" })
          emitGeometry(b)
          return
        }
        if (isMobileViewport(false)) {
          const { width, height } = mobileCompactDimensions()
          animateBoxCentered(width, height, true)
          return
        }
        animateBoxCentered(COMPACT_WIDTH, COMPACT_HEIGHT, true)
      },
    }
  },
  slots: (slot) => ({
    root: slot({
      role: "region",
      attrs: (state, { api }) => {
        const box = state.boxes.main ?? initialBox(false)
        const bare = box.width === LOGICAL_WIDTH && box.x === 0 && box.y === 0
        const geom = computeGeometry(box, bare)
        const baseStyle = api.resize.boxStyle(state, "main") ?? ""
        const shadedHeight = Math.round(54 * geom.scale)
        const seekTrackNum = geom.mobile ? 448 : Math.round(639 + geom.dW)
        return {
          "aria-label": "Winamp 5 Modern Player",
          "data-shaded": state.shaded ? "" : undefined,
          "data-minimized": state.minimized ? "" : undefined,
          "data-mobile": geom.mobile ? "" : undefined,
          "data-fullview": geom.dH > 6 ? "" : undefined,
          style: `${baseStyle};--winamp-scale:${geom.scale.toFixed(6)};--base-dw:${geom.dW.toFixed(2)}px;--base-dh:${geom.dH.toFixed(2)}px;--base-seek-num:${seekTrackNum};--winamp-shaded-h:${shadedHeight}px`,
        }
      },
      live: live((state, { api }) => {
        const activeHandle = api.resize.dragging(state, "main")
        const liveVars = api.resize.style(state, "main")
        if (!liveVars) {
          return {
            "data-dragging": undefined,
            "data-resizing": undefined,
            "data-live-fullview": undefined,
            style: undefined,
          }
        }
        const draftBox = api.resize.box(state, "main")
        api.emitGeometry(draftBox)
        const geom = computeGeometry(draftBox, false)
        const seekTrackNum = geom.mobile ? 448 : Math.round(639 + geom.dW)
        return {
          "data-dragging": activeHandle === "move" ? "" : undefined,
          "data-resizing": activeHandle && activeHandle !== "move" ? activeHandle : undefined,
          "data-live-fullview": geom.dH > 6 ? "" : undefined,
          style: `${liveVars};--live-dw:${geom.dW.toFixed(2)}px;--live-dh:${geom.dH.toFixed(2)}px;--live-seek-num:${seekTrackNum}`,
        }
      }),
    }),
    titlebar: slot({
      attrs: () => ({
        tabindex: "0",
        role: "toolbar",
        "aria-label": "Winamp Titlebar (Drag to move, Double-click for Windowshade)",
        style: css({ "touch-action": "none" }),
      }),
      on: {
        pointerdown: (e, { el, api }) => {
          if (isMobileViewport(false)) return
          const ev = e as PointerEvent
          const target = ev.target as HTMLElement | null
          if (target?.closest("button, ui-button, [data-resize-handle]")) return
          api.recordHandleStart("move")
          if (el) api.resize.pointerdown(ev, "main", "move", el)
        },
        keydown: (e, { api }) => {
          if (isMobileViewport(false)) return
          api.resize.keydown(e as KeyboardEvent, "main", "move")
        },
        dblclick: (e, { api }) => {
          const target = (e as MouseEvent).target as HTMLElement | null
          if (target?.closest("button, ui-button")) return
          api.toggleShaded()
        },
      },
    }),
    handle: slot<{ handle: ResizeHandle }>({
      props: { handle: "string" },
      attrs: (_state, { props, api }) => {
        const h = (props.handle || "se") as ResizeHandle
        return {
          ...api.resize.handleAttrs(h),
          tabindex: h === "se" ? "0" : "-1",
          role: "separator",
          "aria-label": `Resize Winamp (${h.toUpperCase()})`,
        }
      },
      on: {
        pointerdown: (e, { el, api, props }) => {
          if (isMobileViewport(false)) return
          const h = (props.handle || "se") as ResizeHandle
          api.recordHandleStart(h)
          if (el) api.resize.pointerdown(e as PointerEvent, "main", h, el)
        },
        keydown: (e, { api, props }) => {
          if (isMobileViewport(false)) return
          const h = (props.handle || "se") as ResizeHandle
          api.resize.keydown(e as KeyboardEvent, "main", h)
          api.emitGeometry(api.getBox())
        },
      },
    }),
    lcd: slot({
      attrs: () => ({
        role: "status",
        "aria-live": "off",
        "aria-label": "Winamp LCD Display",
      }),
    }),
  }),
  agent: {
    actions: ["setFullView", "toggleFullView", "setDimensions", "setShaded", "toggleShaded", "resetPosition"],
  },
})

export const winampWindowParts = createParts(winampWindowPrimitive, {
  root: {
    tag: "winamp-window",
    display: "block",
    api: [
      "getBox",
      "getGeometry",
      "isFullView",
      "setFullView",
      "toggleFullView",
      "setDimensions",
      "syncViewportResize",
      "setShaded",
      "toggleShaded",
      "isShaded",
      "setMinimized",
      "isMinimized",
      "resetPosition",
    ],
    state: {
      shaded: {
        get: (api) => api.isShaded(),
        set: (api, value: boolean) => {
          api.setShaded(value)
        },
      },
      minimized: {
        get: (api) => api.isMinimized(),
        set: (api, value: boolean) => {
          api.setMinimized(value)
        },
      },
    },
  },
  titlebar: {
    tag: "winamp-titlebar",
    display: "block",
  },
  handle: {
    tag: "winamp-resize-handle",
    display: "block",
    context: (el) => {
      const h = (el.getAttribute("handle") || "se") as ResizeHandle
      return { id: h, handle: h }
    },
  },
  lcd: {
    tag: "winamp-lcd",
    display: "block",
  },
})

export interface WinampWindowElement extends HTMLElement {
  shaded: boolean
  minimized: boolean
  api: {
    getBox(): ResizeBox
    getGeometry(): WinampGeometryDetail
    isFullView(): boolean
    setFullView(open: boolean): void
    toggleFullView(): void
    setDimensions(width: number, height: number): void
    syncViewportResize(): void
    setShaded(shaded: boolean): void
    toggleShaded(): void
    isShaded(): boolean
    setMinimized(minimized: boolean): void
    isMinimized(): boolean
    resetPosition(): void
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "winamp-window": WinampWindowElement
    "winamp-titlebar": HTMLElement
    "winamp-resize-handle": HTMLElement
    "winamp-lcd": HTMLElement
  }
}

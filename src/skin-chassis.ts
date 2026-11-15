// Elastic 927x442 (+ dW, + dH) SVG industrial chassis & vector icons for Winamp 5 Modern Skin.
// Supports 60fps elastic horizontal widening (dW >= 0) and integrated Full View height (dH >= 0).

function buildInnerPanelPath(dW: number): string {
  return `
    M 11 104
    Q 11 96 19 96
    L ${809 + dW} 96
    Q ${815 + dW} 96 ${815 + dW} 103
    L ${815 + dW} 123
    Q ${815 + dW} 136 ${829 + dW} 136
    L ${908 + dW} 136
    Q ${916 + dW} 136 ${916 + dW} 144
    L ${916 + dW} 330
    Q ${916 + dW} 339 ${907 + dW} 339
    L 19 339
    Q 11 339 11 330
    Z
  `
}

function buildStepShadowPath(dW: number): string {
  return `
    M ${815 + dW} 97
    L ${815 + dW} 123
    Q ${815 + dW} 136 ${829 + dW} 136
    L ${916 + dW} 136
  `
}

function buildScurveShadow(dW: number): string {
  return `
    M 374 429
    C 394 414, 401 398, 404 382
    C 407 364, 418 343, 447 343
    L ${923 + dW} 343
    L ${923 + dW} 429
    Z
  `
}

function buildScurveRidge(dW: number): string {
  return `
    M 380 429
    C 399 414, 405 398, 408 382
    C 411 364, 422 344, 450 344
    L ${923 + dW} 344
    L ${923 + dW} 429
    Z
  `
}

function buildScurveFace(dW: number): string {
  return `
    M 389 429
    C 407 414, 412 399, 415 383
    C 418 366, 428 348, 454 348
    L ${923 + dW} 348
    L ${923 + dW} 429
    Z
  `
}

function buildScurveCrest(dW: number): string {
  return `
    M 390 428
    C 408 413, 413 399, 416 383
    C 419 366, 429 349, 454 349
    L ${919 + dW} 349
  `
}

export function renderChassisSvg(): string {
  // 8 bottom-aligned stepped embossed oval bars above the volume slider (cx = 496..685, bottom y = 377)
  const volumeDots = [496, 523, 550, 577, 604, 631, 658, 685]
    .map((cx, idx) => {
      const t = idx / 7
      const w = (10.5 + t * 5.5).toFixed(2)
      const h = (6.8 + t * 12.2).toFixed(2)
      const x = (cx - Number(w) / 2).toFixed(2)
      const y = (377.5 - Number(h)).toFixed(2)
      const rx = (Number(w) / 2).toFixed(2)
      const hiAlpha = (0.28 + t * 0.56).toFixed(2)
      const shAlpha = (0.14 + t * 0.18).toFixed(2)
      return `
        <g>
          <rect x="${(Number(x) + 0.9).toFixed(2)}" y="${(Number(y) + 1.1).toFixed(2)}" width="${w}" height="${h}" rx="${rx}" fill="rgba(88,94,114,${shAlpha})" />
          <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="url(#volDotGrad-${idx})" stroke="rgba(128,134,154,${(0.18 + t * 0.22).toFixed(2)})" stroke-width="0.85" />
          <ellipse cx="${(cx - 1.3).toFixed(2)}" cy="${(Number(y) + Number(h) * 0.34).toFixed(2)}" rx="${(Number(w) * 0.28).toFixed(2)}" ry="${(Number(h) * 0.25).toFixed(2)}" fill="rgba(255,255,255,${hiAlpha})" />
        </g>`
    })
    .join("")

  const volumeDotGrads = [0, 1, 2, 3, 4, 5, 6, 7]
    .map((idx) => {
      const topLight = Math.round(220 + idx * 5)
      const botLight = Math.round(188 + idx * 4.5)
      return `
        <linearGradient id="volDotGrad-${idx}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="rgb(${topLight},${topLight + 1},${topLight + 6})" />
          <stop offset="100%" stop-color="rgb(${Math.round(botLight)},${Math.round(botLight + 2)},${Math.round(botLight + 10)})" />
        </linearGradient>`
    })
    .join("")

  const transportSockets = [
    { cx: 55, cy: 372, rBezel: 29.5, rOuter: 25.2, rInner: 22.2 },
    { cx: 130, cy: 374, rBezel: 33.5, rOuter: 28.5, rInner: 25.2 },
    { cx: 208, cy: 374, rBezel: 33.5, rOuter: 28.5, rInner: 25.2 },
    { cx: 286, cy: 374, rBezel: 33.5, rOuter: 28.5, rInner: 25.2 },
    { cx: 363, cy: 372, rBezel: 29.5, rOuter: 25.2, rInner: 22.2 },
  ]
    .map(
      ({ cx, cy, rBezel, rOuter, rInner }) => `
      <g>
        <circle cx="${cx}" cy="${cy + 1}" r="${rBezel}" fill="url(#donutBezelGrad)" stroke="rgba(42,46,62,0.55)" stroke-width="1" />
        <circle cx="${cx}" cy="${cy}" r="${rOuter}" fill="url(#socketRingGrad)" stroke="#242838" stroke-width="1.3" />
        <circle cx="${cx}" cy="${cy}" r="${rInner}" fill="#171a26" />
      </g>`,
    )
    .join("")

  const gripLines = [0, 1, 2, 3, 4]
    .map((i) => {
      const offset = i * 6.2
      const x1 = 886 + offset
      const y1 = 425
      const x2 = 920
      const y2 = 391 + offset
      return `
        <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#484b57" stroke-width="1.6" stroke-linecap="round" />
        <line x1="${x1 + 1.2}" y1="${y1 + 0.8}" x2="${x2 + 1.2}" y2="${y2 + 0.8}" stroke="rgba(255,255,255,0.78)" stroke-width="1.1" stroke-linecap="round" />`
    })
    .join("")

  return `
  <svg id="chassis-svg" class="winamp-chassis-svg" viewBox="0 0 927 442" width="927" height="442" aria-hidden="true" focusable="false">
    <defs>
      <filter id="windowDropShadow" x="-3%" y="-2%" width="106%" height="108%">
        <feDropShadow dx="0" dy="5" stdDeviation="4.5" flood-color="#0f172a" flood-opacity="0.38" />
      </filter>
      <filter id="blueLedBloom" x="-120%" y="-120%" width="340%" height="340%">
        <feGaussianBlur stdDeviation="4.5" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <filter id="softBevelBlur" x="-10%" y="-10%" width="120%" height="120%">
        <feGaussianBlur stdDeviation="2.2" />
      </filter>

      <linearGradient id="titlebarGrad" x1="0" y1="6" x2="0" y2="50" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="#4e586e" />
        <stop offset="9%" stop-color="#c3cce0" />
        <stop offset="16%" stop-color="#8793aa" />
        <stop offset="28%" stop-color="#55627d" />
        <stop offset="46%" stop-color="#283145" />
        <stop offset="58%" stop-color="#142347" />
        <stop offset="78%" stop-color="#142852" />
        <stop offset="90%" stop-color="#24385c" />
        <stop offset="100%" stop-color="#13192f" />
      </linearGradient>

      <linearGradient id="chromeBarGrad" x1="0" y1="22" x2="0" y2="30" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="#cfd7e8" />
        <stop offset="45%" stop-color="#8b97b0" />
        <stop offset="85%" stop-color="#3c465e" />
        <stop offset="100%" stop-color="#141c32" />
      </linearGradient>

      <linearGradient id="menubarGrad" x1="0" y1="51" x2="0" y2="93" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="#f8f8fb" />
        <stop offset="42%" stop-color="#e7e6ec" />
        <stop offset="85%" stop-color="#dedde5" />
        <stop offset="100%" stop-color="#faf9fd" />
      </linearGradient>

      <linearGradient id="silverBodyGrad" x1="0" y1="95" x2="0" y2="345" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="#ececf2" />
        <stop offset="8%" stop-color="#d8dae4" />
        <stop offset="52%" stop-color="#cfd2de" />
        <stop offset="82%" stop-color="#b8bccb" />
        <stop offset="95%" stop-color="#9ea3b6" />
        <stop offset="100%" stop-color="#878ca0" />
      </linearGradient>

      <linearGradient id="innerPanelGrad" x1="0" y1="98" x2="0" y2="338" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="#dedfe8" />
        <stop offset="30%" stop-color="#c9cddb" />
        <stop offset="76%" stop-color="#b7bccd" />
        <stop offset="100%" stop-color="#a2a7bc" />
      </linearGradient>

      <linearGradient id="pewterDeckGrad" x1="0" y1="336" x2="0" y2="428" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="#969bae" />
        <stop offset="18%" stop-color="#787d91" />
        <stop offset="68%" stop-color="#696d81" />
        <stop offset="92%" stop-color="#5d6175" />
        <stop offset="100%" stop-color="#8b90a4" />
      </linearGradient>

      <linearGradient id="donutBezelGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#b8bdd0" />
        <stop offset="48%" stop-color="#7e8499" />
        <stop offset="100%" stop-color="#51566a" />
      </linearGradient>

      <linearGradient id="volumeDeckGrad" x1="0" y1="342" x2="0" y2="428" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="#fcfcfe" />
        <stop offset="12%" stop-color="#e8e8ef" />
        <stop offset="62%" stop-color="#dedfe8" />
        <stop offset="90%" stop-color="#cfd1dc" />
        <stop offset="100%" stop-color="#adb1c0" />
      </linearGradient>

      <linearGradient id="fullViewHullGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#d8dbe6" />
        <stop offset="50%" stop-color="#c9cddc" />
        <stop offset="95%" stop-color="#b4b9cb" />
        <stop offset="100%" stop-color="#969cb2" />
      </linearGradient>

      <linearGradient id="socketRingGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#2c3040" />
        <stop offset="50%" stop-color="#4d5265" />
        <stop offset="100%" stop-color="#8c92a6" />
      </linearGradient>

      <linearGradient id="capsuleRecessGrad" x1="0" y1="279" x2="0" y2="333" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="#696e80" />
        <stop offset="28%" stop-color="#8d92a5" />
        <stop offset="85%" stop-color="#b8bdd0" />
        <stop offset="100%" stop-color="#f6f7fb" />
      </linearGradient>

      <radialGradient id="ledLitGrad" cx="42%" cy="38%" r="58%">
        <stop offset="0%" stop-color="#ebfbff" />
        <stop offset="32%" stop-color="#90bbf8" />
        <stop offset="70%" stop-color="#355ec7" />
        <stop offset="100%" stop-color="#243f8a" />
      </radialGradient>

      <radialGradient id="ledOffGrad" cx="40%" cy="36%" r="60%">
        <stop offset="0%" stop-color="#d7dce9" />
        <stop offset="48%" stop-color="#9fa6be" />
        <stop offset="100%" stop-color="#6f758b" />
      </radialGradient>

      <linearGradient id="winampBoltGrad" x1="850" y1="362" x2="884" y2="402" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="#fff066" />
        <stop offset="35%" stop-color="#ffbe30" />
        <stop offset="72%" stop-color="#df6d24" />
        <stop offset="100%" stop-color="#b84318" />
      </linearGradient>

      ${volumeDotGrads}

      <clipPath id="windowClip">
        <rect id="chassis-clip-rect" x="3" y="6" width="920" height="423" rx="19" ry="19" />
      </clipPath>
    </defs>

    <!-- Outer window frame (shadow handled by GPU-composited CSS on <winamp-window> to avoid SVG filter thrash during resize) -->
    <rect id="chassis-shadow-rect" x="3" y="6" width="920" height="423" rx="19" ry="19" fill="#1b2030" />

    <g clip-path="url(#windowClip)">
      <!-- Integrated Winamp 5 Modern Full View Lower Metallic Hull (visible when dH > 0) -->
      <rect id="chassis-fullview-hull" x="3" y="424" width="920" height="6" fill="url(#fullViewHullGrad)" />

      <!-- 1. Base brushed-silver body + bottom pewter layer -->
      <rect id="chassis-pewter-rect" x="3" y="50" width="920" height="379" fill="url(#pewterDeckGrad)" />
      <rect id="chassis-silver-rect" x="3" y="50" width="920" height="292" fill="url(#silverBodyGrad)" />

      <!-- 2. Dark Navy Metallic Titlebar -->
      <rect id="chassis-titlebar-bg" x="3" y="6" width="920" height="45" fill="url(#titlebarGrad)" />
      <line id="chassis-titlebar-spec" x1="22" y1="9.5" x2="904" y2="9.5" stroke="rgba(235,242,255,0.72)" stroke-width="2" stroke-linecap="round" />
      <line id="chassis-titlebar-line" x1="3" y1="50.5" x2="923" y2="50.5" stroke="#0c1122" stroke-width="1.2" />

      <!-- Titlebar left Winamp icon box -->
      <rect x="19" y="15" width="27" height="25" rx="4" fill="#2c3852" stroke="#10172b" stroke-width="1.3" />
      <rect x="20.5" y="16.5" width="24" height="22" rx="3" fill="none" stroke="rgba(182,196,224,0.38)" stroke-width="1" />
      <path d="M 24 27.5 L 29.5 27.5 L 32.5 20.5 L 35 34.5 L 37.5 27.5 L 41.5 27.5" fill="none" stroke="#9eb0d1" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />

      <!-- Titlebar Left & Right 3D Chrome Pill Bars + Centered Engraved "WINAMP" -->
      <rect id="chassis-left-bar" x="64" y="22.5" width="323" height="7.5" rx="3.75" fill="url(#chromeBarGrad)" stroke="#141c30" stroke-width="0.9" />
      <line id="chassis-left-bar-hi" x1="67" y1="24.2" x2="384" y2="24.2" stroke="rgba(242,247,255,0.68)" stroke-width="1.1" stroke-linecap="round" />

      <text id="chassis-winamp-sh" x="463.5" y="33.5" text-anchor="middle" font-family="'Trebuchet MS', 'Arial Black', Arial, sans-serif" font-weight="800" font-size="21" letter-spacing="2.2" fill="#0d152b">WINAMP</text>
      <text id="chassis-winamp-tx" x="462.5" y="32.5" text-anchor="middle" font-family="'Trebuchet MS', 'Arial Black', Arial, sans-serif" font-weight="800" font-size="21" letter-spacing="2.2" fill="#94a1ba">WINAMP</text>

      <rect id="chassis-right-bar" x="539" y="22.5" width="258" height="7.5" rx="3.75" fill="url(#chromeBarGrad)" stroke="#141c30" stroke-width="0.9" />
      <line id="chassis-right-bar-hi" x1="542" y1="24.2" x2="794" y2="24.2" stroke="rgba(242,247,255,0.68)" stroke-width="1.1" stroke-linecap="round" />

      <!-- 3. Menubar Strip -->
      <rect id="chassis-menubar-bg" x="3" y="51" width="920" height="42" fill="url(#menubarGrad)" />
      <line id="chassis-menubar-hi" x1="3" y1="52" x2="923" y2="52" stroke="#ffffff" stroke-width="1.2" />
      <line id="chassis-menubar-r1" x1="5" y1="93.2" x2="921" y2="93.2" stroke="#858994" stroke-width="1.8" />
      <line id="chassis-menubar-r2" x1="5" y1="95" x2="921" y2="95" stroke="#f7f7fb" stroke-width="1.2" />

      <!-- 4. Sculpted Inner Silver Panel -->
      <path id="chassis-inner-panel" d="${buildInnerPanelPath(0)}" fill="url(#innerPanelGrad)" stroke="#ffffff" stroke-width="1.4" />
      <path id="chassis-step-shadow" d="${buildStepShadowPath(0)}" fill="none" stroke="#858a9c" stroke-width="2" />

      <!-- Sculpted 3D metallic chamfer frame around the LCD -->
      <rect id="chassis-lcd-chamfer1" x="20" y="108" width="786" height="165" rx="22" fill="#8d93a8" />
      <rect id="chassis-lcd-chamfer2" x="21.5" y="109.5" width="783" height="163" rx="21" fill="none" stroke="#f5f6fb" stroke-width="2" />

      <!-- Right-side Upper Controls + LEDs + Capsule (shifts right by +dW) -->
      <g id="chassis-right-upper">
        <rect x="824" y="99" width="75" height="26" rx="13" fill="#9ea3b5" stroke="#6c7183" stroke-width="1.1" />
        <rect x="825" y="100" width="73" height="25" rx="12.5" fill="none" stroke="rgba(255,255,255,0.65)" stroke-width="1" />

        <rect x="816" y="144" width="58" height="49" rx="24.5" fill="#7d8397" stroke="#53586a" stroke-width="1.2" />
        <rect x="817" y="145.5" width="56" height="47.5" rx="23.5" fill="none" stroke="rgba(255,255,255,0.65)" stroke-width="1.2" />

        <g id="led-repeat" data-lit="true">
          <circle class="led-bloom" cx="891" cy="169" r="12.5" fill="rgba(72, 122, 238, 0.48)" filter="url(#blueLedBloom)" />
          <circle cx="891" cy="169" r="8.2" fill="#6f768d" stroke="rgba(255,255,255,0.72)" stroke-width="1.1" />
          <circle class="led-core" cx="891" cy="169" r="6.6" fill="url(#ledLitGrad)" stroke="#2c4ba0" stroke-width="0.8" />
        </g>

        <rect x="816" y="202" width="58" height="46" rx="23" fill="#7d8397" stroke="#53586a" stroke-width="1.2" />
        <rect x="817" y="203.5" width="56" height="44.5" rx="22" fill="none" stroke="rgba(255,255,255,0.65)" stroke-width="1.2" />

        <g id="led-shuffle" data-lit="false">
          <circle class="led-bloom" cx="891" cy="225" r="12.5" fill="rgba(72, 122, 238, 0.48)" filter="url(#blueLedBloom)" />
          <circle cx="891" cy="225" r="8.2" fill="#6f768d" stroke="rgba(255,255,255,0.72)" stroke-width="1.1" />
          <circle class="led-core" cx="891" cy="225" r="6.6" fill="url(#ledOffGrad)" stroke="#686f84" stroke-width="0.8" />
        </g>

        <!-- Triple Oval Capsule Housing for Eject / PL / ML -->
        <rect x="689" y="279" width="213" height="53" rx="26.5" fill="url(#capsuleRecessGrad)" stroke="#666b7e" stroke-width="1.3" />
        <path d="M 714 331.5 L 877 331.5" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round" />
        <rect x="695.5" y="284.5" width="57" height="42.5" rx="21.2" fill="#232737" />
        <rect x="762.5" y="284.5" width="65" height="42.5" rx="21.2" fill="#232737" />
        <rect x="830.5" y="284.5" width="65" height="42.5" rx="21.2" fill="#232737" />
      </g>

      <!-- 5. Seek Row Recessed Groove (widens by +dW) -->
      <rect id="chassis-seek-g1" x="28" y="298" width="641" height="11" rx="5.5" fill="#f7f7fc" />
      <rect id="chassis-seek-g2" x="29" y="297" width="639" height="8.5" rx="4.2" fill="#171b2a" stroke="#575d70" stroke-width="1" />

      <!-- 6. Iconic Sculpted S-Curve Bevel Seam + Raised Right Silver Volume Deck -->
      <path id="chassis-scurve-sh" d="${buildScurveShadow(0)}" fill="#46495a" filter="url(#softBevelBlur)" />
      <path id="chassis-scurve-rd" d="${buildScurveRidge(0)}" fill="#9fa5b8" />
      <path id="chassis-scurve-fc" d="${buildScurveFace(0)}" fill="url(#volumeDeckGrad)" />
      <path id="chassis-scurve-cr" d="${buildScurveCrest(0)}" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" />

      <!-- 7. Five Recessed Circular Transport Button Sockets on Pewter Deck -->
      ${transportSockets}

      <!-- 8. Mute Button Socket + 8 Stepped Volume Ramp Bars + Volume Groove (hidden on mobile) -->
      <g id="chassis-volume-cluster">
        <circle cx="448" cy="386" r="20" fill="rgba(255,255,255,0.65)" />
        <circle cx="448" cy="385" r="19.2" fill="url(#socketRingGrad)" stroke="#3e4354" stroke-width="1.1" />
        <circle cx="448" cy="385" r="15.6" fill="#1d2130" />
        ${volumeDots}
        <rect x="482" y="392.5" width="213" height="9.5" rx="4.7" fill="#ffffff" />
        <rect x="483" y="391" width="211" height="7.5" rx="3.75" fill="#181d2e" stroke="#5b6278" stroke-width="0.9" />
      </g>

      <!-- Mobile-only single PL capsule socket & Lightning Bolt (shown only when data-mobile) -->
      <g id="chassis-mobile-accents" display="none">
        <rect x="486" y="280" width="76" height="51" rx="25.5" fill="url(#capsuleRecessGrad)" stroke="#666b7e" stroke-width="1.2" />
        <rect x="492.5" y="285" width="63" height="41" rx="20.5" fill="#232737" />
        <g transform="translate(-334, 0)">
          <polygon points="872,363 853,384 865,384 851,405 883,380 870,380 884,363" fill="rgba(40,35,32,0.32)" transform="translate(1.5, 2)" />
          <polygon points="872,363 853,384 865,384 851,405 883,380 870,380 884,363" fill="url(#winampBoltGrad)" stroke="#2b1910" stroke-width="1.7" stroke-linejoin="round" />
          <polyline points="881,365 872.5,365 856.5,382.5 866.5,382.5 855,400" fill="none" stroke="rgba(255,248,190,0.78)" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" />
        </g>
      </g>

      <!-- 9. Bottom-Right CONFIG Arch + Winamp Lightning Bolt (shifts right by +dW) -->
      <g id="chassis-right-bottom">
        <text x="769" y="385" text-anchor="middle" font-family="'Arial Narrow', 'Trebuchet MS', Arial, sans-serif" font-weight="700" font-size="16.5" letter-spacing="0.8" fill="#2d3039">CONFIG</text>
        <path d="
          M 717 429
          L 721 403
          Q 723 393 735 393
          L 804 393
          Q 816 393 818 403
          L 822 429
          Z
        " fill="#6f7486" stroke="#3c4050" stroke-width="1.3" />
        <path d="
          M 720 429
          L 723.5 405
          Q 725 396.5 736 396.5
          L 803 396.5
          Q 814 396.5 815.5 405
          L 819 429
          Z
        " fill="#aeb3c4" />

        <g>
          <polygon points="872,363 853,384 865,384 851,405 883,380 870,380 884,363" fill="rgba(40,35,32,0.32)" transform="translate(1.5, 2)" />
          <polygon points="872,363 853,384 865,384 851,405 883,380 870,380 884,363" fill="url(#winampBoltGrad)" stroke="#2b1910" stroke-width="1.7" stroke-linejoin="round" />
          <polyline points="881,365 872.5,365 856.5,382.5 866.5,382.5 855,400" fill="none" stroke="rgba(255,248,190,0.78)" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" />
        </g>
      </g>

      <!-- Full View Horizontal Bevel Divider at y=428 (shown when dH > 4) -->
      <g id="chassis-fullview-seam" opacity="0">
        <line id="chassis-fv-line1" x1="6" y1="428.5" x2="920" y2="428.5" stroke="#5b6174" stroke-width="2" />
        <line id="chassis-fv-line2" x1="6" y1="430.5" x2="920" y2="430.5" stroke="#f4f5fa" stroke-width="1.5" />
      </g>

      <!-- 10. Bottom-right 5 Diagonal 45° Corner Resize Grip Ridges (shifts by +dW, +dH) -->
      <g id="chassis-grip-group">
        ${gripLines}
      </g>

      <!-- Outer metallic inner rim highlight around whole window -->
      <rect id="chassis-rim1" x="4" y="7" width="918" height="421" rx="18.2" ry="18.2" fill="none" stroke="rgba(255,255,255,0.28)" stroke-width="1.3" />
      <rect id="chassis-rim2" x="3.5" y="6.5" width="919" height="422" rx="18.6" ry="18.6" fill="none" stroke="#181d2c" stroke-width="1.2" />
    </g>
  </svg>`
}

export function updateChassisGeometry(svg: SVGSVGElement, rawDW: number, rawDH: number, mobile = false): void {
  const dW = mobile ? 0 : Math.max(0, rawDW)
  const dH = Math.max(0, rawDH)
  const totalW = mobile ? 580 : 927 + dW
  const totalH = 442 + dH
  const bodyW = mobile ? 573 : 920 + dW
  const bodyH = 423 + dH
  const halfDW = dW / 2

  svg.setAttribute("viewBox", `0 0 ${totalW.toFixed(1)} ${totalH.toFixed(1)}`)
  svg.setAttribute("width", totalW.toFixed(1))
  svg.setAttribute("height", totalH.toFixed(1))

  const setAttr = (id: string, attrs: Record<string, string | number>) => {
    const el = svg.querySelector(`#${id}`)
    if (!el) return
    for (const [k, v] of Object.entries(attrs)) {
      el.setAttribute(k, typeof v === "number" ? v.toFixed(2) : v)
    }
  }

  setAttr("chassis-clip-rect", { width: bodyW, height: bodyH })
  setAttr("chassis-shadow-rect", { width: bodyW, height: bodyH })
  setAttr("chassis-fullview-hull", { width: bodyW, height: Math.max(6, dH + 10) })
  setAttr("chassis-pewter-rect", { width: bodyW })
  setAttr("chassis-silver-rect", { width: bodyW })

  setAttr("chassis-titlebar-bg", { width: bodyW })
  setAttr("chassis-titlebar-spec", { x2: mobile ? 558 : 904 + dW })
  setAttr("chassis-titlebar-line", { x2: mobile ? 576 : 923 + dW })

  if (mobile) {
    setAttr("chassis-left-bar", { width: 150 })
    setAttr("chassis-left-bar-hi", { x2: 211 })
    setAttr("chassis-winamp-sh", { x: 290.5 })
    setAttr("chassis-winamp-tx", { x: 289.5 })
    setAttr("chassis-right-bar", { x: 366, width: 188 })
    setAttr("chassis-right-bar-hi", { x1: 369, x2: 551 })
  } else {
    setAttr("chassis-left-bar", { width: 323 + halfDW })
    setAttr("chassis-left-bar-hi", { x2: 384 + halfDW })
    setAttr("chassis-winamp-sh", { x: 463.5 + halfDW })
    setAttr("chassis-winamp-tx", { x: 462.5 + halfDW })
    setAttr("chassis-right-bar", { x: 539 + halfDW, width: 258 + halfDW })
    setAttr("chassis-right-bar-hi", { x1: 542 + halfDW, x2: 794 + dW })
  }

  setAttr("chassis-menubar-bg", { width: bodyW })
  setAttr("chassis-menubar-hi", { x2: mobile ? 576 : 923 + dW })
  setAttr("chassis-menubar-r1", { x2: mobile ? 574 : 921 + dW })
  setAttr("chassis-menubar-r2", { x2: mobile ? 574 : 921 + dW })

  if (mobile) {
    setAttr("chassis-inner-panel", {
      d: `M 11 104 Q 11 96 19 96 L 560 96 Q 569 96 569 105 L 569 330 Q 569 339 560 339 L 19 339 Q 11 339 11 330 Z`,
    })
    setAttr("chassis-step-shadow", { d: "M 0 0" })
    setAttr("chassis-lcd-chamfer1", { width: 540 })
    setAttr("chassis-lcd-chamfer2", { width: 537 })
    setAttr("chassis-right-upper", { display: "none" })
    setAttr("chassis-seek-g1", { width: 450 })
    setAttr("chassis-seek-g2", { width: 448 })
    setAttr("chassis-scurve-sh", { display: "none" })
    setAttr("chassis-scurve-rd", { display: "none" })
    setAttr("chassis-scurve-fc", { display: "none" })
    setAttr("chassis-scurve-cr", { display: "none" })
    setAttr("chassis-volume-cluster", { display: "none" })
    setAttr("chassis-right-bottom", { display: "none" })
    setAttr("chassis-grip-group", { display: "none" })
    setAttr("chassis-mobile-accents", { display: "inline" })
  } else {
    setAttr("chassis-inner-panel", { d: buildInnerPanelPath(dW) })
    setAttr("chassis-step-shadow", { d: buildStepShadowPath(dW) })
    setAttr("chassis-lcd-chamfer1", { width: 786 + dW })
    setAttr("chassis-lcd-chamfer2", { width: 783 + dW })
    setAttr("chassis-right-upper", { display: "inline", transform: `translate(${dW.toFixed(2)}, 0)` })
    setAttr("chassis-seek-g1", { width: 641 + dW })
    setAttr("chassis-seek-g2", { width: 639 + dW })
    setAttr("chassis-scurve-sh", { display: "inline", d: buildScurveShadow(dW) })
    setAttr("chassis-scurve-rd", { display: "inline", d: buildScurveRidge(dW) })
    setAttr("chassis-scurve-fc", { display: "inline", d: buildScurveFace(dW) })
    setAttr("chassis-scurve-cr", { display: "inline", d: buildScurveCrest(dW) })
    setAttr("chassis-volume-cluster", { display: "inline" })
    setAttr("chassis-right-bottom", { display: "inline", transform: `translate(${dW.toFixed(2)}, 0)` })
    setAttr("chassis-grip-group", { display: "inline", transform: `translate(${dW.toFixed(2)}, ${dH.toFixed(2)})` })
    setAttr("chassis-mobile-accents", { display: "none" })
  }

  setAttr("chassis-fullview-seam", { opacity: dH > 6 ? 1 : 0 })
  setAttr("chassis-fv-line1", { x2: mobile ? 573 : 920 + dW })
  setAttr("chassis-fv-line2", { x2: mobile ? 573 : 920 + dW })

  setAttr("chassis-rim1", { width: mobile ? 571 : 918 + dW, height: 421 + dH })
  setAttr("chassis-rim2", { width: mobile ? 572 : 919 + dW, height: 422 + dH })
}

export const ICONS = {
  dropdownTri: `<svg viewBox="0 0 20 12" width="15" height="9" aria-hidden="true"><polygon points="4,2.5 16,2.5 10,9.5" fill="#1e222d"/></svg>`,
  repeatLoop: `<svg viewBox="0 0 34 24" width="31" height="22" aria-hidden="true">
    <path d="M 11 16 L 7 16 A 4.5 4.5 0 0 1 2.5 11.5 L 2.5 7.5 A 4.5 4.5 0 0 1 7 3 L 27 3 A 4.5 4.5 0 0 1 31.5 7.5 L 31.5 11.5 A 4.5 4.5 0 0 1 27 16 L 19 16" fill="none" stroke="#1d222e" stroke-width="2.5" stroke-linecap="round"/>
    <polygon points="21,11 13,16.2 21,21.4" fill="#1d222e"/>
  </svg>`,
  shuffle123: `<svg viewBox="0 0 38 28" width="34" height="25" aria-hidden="true">
    <path d="M 6 11 A 14 11 0 0 1 29 7.5" fill="none" stroke="#1d222e" stroke-width="2.1" stroke-linecap="round"/>
    <polygon points="26,3.5 33,8.5 25.5,10.5" fill="#1d222e"/>
    <text x="5" y="21" font-family="Arial, sans-serif" font-weight="800" font-size="11.5" fill="#1d222e">1</text>
    <text x="14" y="25" font-family="Arial, sans-serif" font-weight="800" font-size="11.5" fill="#1d222e">2</text>
    <text x="23" y="21.5" font-family="Arial, sans-serif" font-weight="800" font-size="11.5" fill="#1d222e">3</text>
  </svg>`,
  eject: `<svg viewBox="0 0 24 22" width="19" height="18" aria-hidden="true">
    <polygon points="12,3 21,12.5 3,12.5" fill="#1b1f2a"/>
    <rect x="3" y="15.5" width="18" height="3.6" rx="0.8" fill="#1b1f2a"/>
  </svg>`,
  prev: `<svg viewBox="0 0 24 18" width="21" height="16" aria-hidden="true">
    <polygon points="12,2 2,9 12,16" fill="#111520"/>
    <polygon points="22,2 12,9 22,16" fill="#111520"/>
  </svg>`,
  playBlue: `<svg viewBox="0 0 28 28" width="25" height="25" aria-hidden="true">
    <defs>
      <linearGradient id="playBlueTriGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#5d84cb"/>
        <stop offset="52%" stop-color="#3868c4"/>
        <stop offset="100%" stop-color="#224588"/>
      </linearGradient>
    </defs>
    <polygon points="6,3 25,14 6,25" fill="url(#playBlueTriGrad)" stroke="#1d3972" stroke-width="1.1" stroke-linejoin="round"/>
  </svg>`,
  pause: `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
    <rect x="5.2" y="4" width="5" height="16" rx="0.8" fill="#111520"/>
    <rect x="13.8" y="4" width="5" height="16" rx="0.8" fill="#111520"/>
  </svg>`,
  stop: `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
    <rect x="5" y="5" width="14" height="14" rx="0.9" fill="#111520"/>
  </svg>`,
  next: `<svg viewBox="0 0 24 18" width="21" height="16" aria-hidden="true">
    <polygon points="2,2 12,9 2,16" fill="#111520"/>
    <polygon points="12,2 22,9 12,16" fill="#111520"/>
  </svg>`,
  speakerOn: `<svg viewBox="0 0 24 20" width="20" height="17" aria-hidden="true">
    <polygon points="3,7 7.5,7 13,2.5 13,17.5 7.5,13 3,13" fill="#181c26"/>
    <path d="M 16 6.5 Q 19 10 16 13.5" fill="none" stroke="#181c26" stroke-width="1.9" stroke-linecap="round"/>
    <line x1="18.5" y1="10" x2="21.5" y2="10" stroke="#181c26" stroke-width="1.7" stroke-linecap="round"/>
  </svg>`,
  speakerMuted: `<svg viewBox="0 0 24 20" width="20" height="17" aria-hidden="true">
    <polygon points="3,7 7.5,7 13,2.5 13,17.5 7.5,13 3,13" fill="#181c26"/>
    <line x1="15.5" y1="6.5" x2="21.5" y2="13.5" stroke="#b4232a" stroke-width="2.2" stroke-linecap="round"/>
    <line x1="21.5" y1="6.5" x2="15.5" y2="13.5" stroke="#b4232a" stroke-width="2.2" stroke-linecap="round"/>
  </svg>`,
  configTri: `<svg viewBox="0 0 18 10" width="14" height="8" aria-hidden="true"><polygon points="2,1.5 16,1.5 9,8.5" fill="#1e222d"/></svg>`,
  winMin: `<svg viewBox="0 0 14 12" width="12" height="10" aria-hidden="true"><rect x="2" y="8" width="10" height="2.4" fill="#9aa8c4"/></svg>`,
  winShade: `<svg viewBox="0 0 14 12" width="12" height="10" aria-hidden="true"><rect x="2" y="2" width="10" height="2.4" fill="#9aa8c4"/><rect x="2" y="7" width="10" height="3.2" fill="none" stroke="#9aa8c4" stroke-width="1.4"/></svg>`,
  winClose: `<svg viewBox="0 0 14 12" width="12" height="10" aria-hidden="true"><path d="M 3 2 L 11 10 M 11 2 L 3 10" stroke="#9aa8c4" stroke-width="2" stroke-linecap="round"/></svg>`,
}

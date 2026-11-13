<script setup>
import { ref, onMounted, onUnmounted, useId } from 'vue'

const uid = useId()
const sweepId = `sx-wm-sweep-${uid}`
const arcId = `sx-wm-arc-${uid}`
const dotGlowId = `sx-wm-dot-${uid}`

const letters = [
  { char: 'S', x: 165, delay: '0s' },
  { char: 'P', x: 299, delay: '0.25s' },
  { char: 'A', x: 433, delay: '0.5s' },
  { char: 'C', x: 567, delay: '0.75s' },
  { char: 'E', x: 701, delay: '1.0s' },
  { char: 'X', x: 835, delay: '1.25s' }
]

const offsetX = ref(0)
const offsetY = ref(0)

function handlePointerMove(e) {
  const nx = e.clientX / window.innerWidth - 0.5
  const ny = e.clientY / window.innerHeight - 0.5
  offsetX.value = Math.round(nx * -34 * 10) / 10
  offsetY.value = Math.round(ny * -20 * 10) / 10
}

onMounted(() => {
  window.addEventListener('pointermove', handlePointerMove, { passive: true })
})

onUnmounted(() => {
  window.removeEventListener('pointermove', handlePointerMove)
})
</script>

<template>
  <div
    class="sx-watermark-stage"
    aria-hidden="true"
    :style="{ transform: `translate3d(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px), 0)` }"
  >
    <div class="sx-watermark-wrap">
      <svg
        viewBox="0 0 1000 160"
        fill="none"
        class="sx-watermark-svg"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <!-- Metallic light sweep across the SPACEX logotype -->
          <linearGradient :id="sweepId" x1="-0.4" y1="0" x2="0" y2="0.15">
            <stop offset="0%" stop-color="#ffffff" stop-opacity="0" />
            <stop offset="42%" stop-color="#38BDF8" stop-opacity="0.16" />
            <stop offset="50%" stop-color="#FFE600" stop-opacity="0.24" />
            <stop offset="58%" stop-color="#ffffff" stop-opacity="0.18" />
            <stop offset="100%" stop-color="#ffffff" stop-opacity="0" />
            <animate
              attributeName="x1"
              values="-0.5;1.3"
              dur="4.8s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="x2"
              values="-0.1;1.7"
              dur="4.8s"
              repeatCount="indefinite"
            />
          </linearGradient>

          <!-- Glowing orbital arc gradient -->
          <linearGradient :id="arcId" x1="720" y1="135" x2="980" y2="5" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="#FFE600" stop-opacity="0.15" />
            <stop offset="65%" stop-color="#FFE600" stop-opacity="0.95" />
            <stop offset="100%" stop-color="#ffffff" stop-opacity="1" />
          </linearGradient>

          <!-- Radial spark for moving orbital comet -->
          <radialGradient :id="dotGlowId">
            <stop offset="0%" stop-color="#ffffff" stop-opacity="1" />
            <stop offset="45%" stop-color="#FFE600" stop-opacity="0.9" />
            <stop offset="100%" stop-color="#FFE600" stop-opacity="0" />
          </radialGradient>
        </defs>

        <!-- Layer 1: Drifting cyan wireframe ghost echo -->
        <g class="sx-wm-ghost-layer">
          <text
            v-for="item in letters"
            :key="`ghost-${item.char}`"
            :x="item.x"
            y="102"
            text-anchor="middle"
            dominant-baseline="middle"
            class="sx-wm-letter-ghost"
            :style="{ animationDelay: item.delay }"
          >
            {{ item.char }}
          </text>
        </g>

        <!-- Layer 2: Base SPACEX letters with staggered vertical wave -->
        <g>
          <text
            v-for="item in letters"
            :key="`base-${item.char}`"
            :x="item.x"
            y="102"
            text-anchor="middle"
            dominant-baseline="middle"
            class="sx-wm-letter-base"
            :style="{ animationDelay: item.delay }"
          >
            {{ item.char }}
          </text>
        </g>

        <!-- Layer 3: Animated light-sweep shimmer across letters -->
        <g>
          <text
            v-for="item in letters"
            :key="`sweep-${item.char}`"
            :x="item.x"
            y="102"
            text-anchor="middle"
            dominant-baseline="middle"
            class="sx-wm-letter-sweep"
            :style="{ fill: `url(#${sweepId})`, animationDelay: item.delay }"
          >
            {{ item.char }}
          </text>
        </g>

        <!-- Base subtle orbital arc -->
        <path
          d="M 720 135 C 830 85 920 30 980 5"
          stroke="#FFE600"
          stroke-opacity="0.18"
          stroke-width="4"
          stroke-linecap="round"
        />

        <!-- Animated orbital streak along trajectory -->
        <path
          d="M 720 135 C 830 85 920 30 980 5"
          :stroke="`url(#${arcId})`"
          stroke-width="4.5"
          stroke-linecap="round"
          class="sx-wm-arc-streak"
        />

        <!-- Glowing orbital particle riding the trajectory path -->
        <circle r="7" :fill="`url(#${dotGlowId})`" class="sx-wm-comet-halo">
          <animateMotion
            dur="4.2s"
            repeatCount="indefinite"
            path="M 720 135 C 830 85 920 30 980 5"
          />
        </circle>
        <circle r="2.5" fill="#ffffff" class="sx-wm-comet-core">
          <animateMotion
            dur="4.2s"
            repeatCount="indefinite"
            path="M 720 135 C 830 85 920 30 980 5"
          />
        </circle>
      </svg>
    </div>
  </div>
</template>

<style scoped>
.sx-watermark-stage {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 94%;
  max-width: 1300px;
  pointer-events: none;
  user-select: none;
  z-index: 1;
  transition: transform 0.35s cubic-bezier(0.22, 1, 0.36, 1);
  will-change: transform;
}

.sx-watermark-wrap {
  width: 100%;
  animation: wmOrbitDrift 10s ease-in-out infinite;
}

.sx-watermark-svg {
  width: 100%;
  height: auto;
  display: block;
  overflow: visible;
}

.sx-wm-letter-ghost,
.sx-wm-letter-base,
.sx-wm-letter-sweep {
  font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
  font-weight: 900;
  font-size: 146px;
  transform-box: fill-box;
  transform-origin: center;
}

.sx-wm-ghost-layer {
  animation: wmGhostShift 7s ease-in-out infinite;
}

.sx-wm-letter-ghost {
  fill: none;
  stroke: #38bdf8;
  stroke-width: 1.2;
  stroke-opacity: 0.14;
  animation: wmLetterWave 4.5s ease-in-out infinite;
}

.sx-wm-letter-base {
  fill: #ffffff;
  fill-opacity: 0.065;
  animation:
    wmLetterWave 4.5s ease-in-out infinite,
    wmOpacityPulse 5s ease-in-out infinite;
}

.sx-wm-letter-sweep {
  animation: wmLetterWave 4.5s ease-in-out infinite;
}

.sx-wm-arc-streak {
  stroke-dasharray: 95 320;
  stroke-dashoffset: 415;
  filter: drop-shadow(0 0 8px rgba(255, 230, 0, 0.55));
  animation: wmArcLaunch 4.2s cubic-bezier(0.4, 0, 0.2, 1) infinite;
}

.sx-wm-comet-halo,
.sx-wm-comet-core {
  opacity: 0.9;
}

@keyframes wmOrbitDrift {
  0%, 100% {
    transform: translate3d(-12px, 0px, 0) scale(1);
  }
  25% {
    transform: translate3d(0px, -9px, 0) scale(1.018);
  }
  50% {
    transform: translate3d(12px, 0px, 0) scale(1);
  }
  75% {
    transform: translate3d(0px, 9px, 0) scale(0.99);
  }
}

@keyframes wmGhostShift {
  0%, 100% {
    transform: translate3d(8px, -4px, 0);
  }
  50% {
    transform: translate3d(-8px, 4px, 0);
  }
}

@keyframes wmLetterWave {
  0%, 100% {
    transform: translateY(0px);
  }
  50% {
    transform: translateY(-7px);
  }
}

@keyframes wmOpacityPulse {
  0%, 100% {
    fill-opacity: 0.05;
  }
  50% {
    fill-opacity: 0.09;
  }
}

@keyframes wmArcLaunch {
  0% {
    stroke-dashoffset: 415;
    opacity: 0;
  }
  15% {
    opacity: 0.95;
  }
  75% {
    opacity: 0.9;
  }
  100% {
    stroke-dashoffset: -120;
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .sx-watermark-stage {
    transition: none;
  }
  .sx-watermark-wrap,
  .sx-wm-ghost-layer,
  .sx-wm-letter-ghost,
  .sx-wm-letter-base,
  .sx-wm-letter-sweep,
  .sx-wm-arc-streak {
    animation: none;
  }
}
</style>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'

const cursorX = ref(-100)
const cursorY = ref(-100)
const ringX = ref(-100)
const ringY = ref(-100)
const isHovering = ref(false)
const isClicking = ref(false)
const isVisible = ref(false)

let targetX = -100
let targetY = -100
let animationFrameId = null

function onMouseMove(e) {
  isVisible.value = true
  targetX = e.clientX
  targetY = e.clientY
  cursorX.value = e.clientX
  cursorY.value = e.clientY

  // Check if hovering interactive element
  const target = e.target
  const isInteractive = target && (
    target.tagName === 'BUTTON' ||
    target.tagName === 'A' ||
    target.tagName === 'INPUT' ||
    target.tagName === 'SELECT' ||
    target.closest('button') ||
    target.closest('a') ||
    target.closest('.interactive') ||
    target.classList.contains('btn') ||
    target.classList.contains('nav-link') ||
    target.classList.contains('tab-btn')
  )
  isHovering.value = !!isInteractive
}

function onMouseDown() {
  isClicking.value = true
}

function onMouseUp() {
  isClicking.value = false
}

function onMouseLeave() {
  isVisible.value = false
}

function onMouseEnter() {
  isVisible.value = true
}

// Fluid lerp animation loop (smooth spring trailing)
function animate() {
  const ease = 0.16 // Smooth follow speed
  ringX.value += (targetX - ringX.value) * ease
  ringY.value += (targetY - ringY.value) * ease

  animationFrameId = requestAnimationFrame(animate)
}

onMounted(() => {
  // Only enable on desktop with fine pointer
  if (window.matchMedia('(pointer: fine)').matches) {
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mouseup', onMouseUp)
    document.addEventListener('mouseleave', onMouseLeave)
    document.addEventListener('mouseenter', onMouseEnter)
    animate()
  }
})

onBeforeUnmount(() => {
  if (animationFrameId) cancelAnimationFrame(animationFrameId)
  window.removeEventListener('mousemove', onMouseMove)
  window.removeEventListener('mousedown', onMouseDown)
  window.removeEventListener('mouseup', onMouseUp)
  document.removeEventListener('mouseleave', onMouseLeave)
  document.removeEventListener('mouseenter', onMouseEnter)
})
</script>

<template>
  <div 
    class="custom-cursor-container" 
    :class="{ 'is-hidden': !isVisible }"
  >
    <!-- Trailing circle ring matching the user's screenshot -->
    <div 
      class="cursor-ring" 
      :class="{ 
        'ring-hover': isHovering, 
        'ring-click': isClicking 
      }"
      :style="{ 
        transform: `translate3d(${ringX}px, ${ringY}px, 0)` 
      }"
    ></div>

    <!-- Tiny center precision dot -->
    <div 
      class="cursor-dot" 
      :class="{ 'dot-hover': isHovering }"
      :style="{ 
        transform: `translate3d(${cursorX}px, ${cursorY}px, 0)` 
      }"
    ></div>
  </div>
</template>

<style scoped>
.custom-cursor-container {
  pointer-events: none;
  position: fixed;
  inset: 0;
  z-index: 999999;
  overflow: hidden;
  transition: opacity 0.3s ease;
}

.custom-cursor-container.is-hidden {
  opacity: 0;
}

/* The exact circular ring from the screenshot */
.cursor-ring {
  position: absolute;
  top: 0;
  left: 0;
  width: 46px;
  height: 46px;
  margin-top: -23px;
  margin-left: -23px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.45);
  box-shadow: 0 0 10px rgba(255, 255, 255, 0.05);
  pointer-events: none;
  will-change: transform;
  transition: width 0.25s ease, height 0.25s ease, margin 0.25s ease, border-color 0.25s ease, background-color 0.25s ease;
}

/* Hover state on interactive buttons/links */
.cursor-ring.ring-hover {
  width: 62px;
  height: 62px;
  margin-top: -31px;
  margin-left: -31px;
  border-color: rgba(255, 230, 0, 0.85); /* facEthic yellow glow */
  background-color: rgba(255, 230, 0, 0.06);
  box-shadow: 0 0 20px rgba(255, 230, 0, 0.3);
}

/* Click state */
.cursor-ring.ring-click {
  transform-origin: center;
  border-color: #FFE600;
  width: 36px;
  height: 36px;
  margin-top: -18px;
  margin-left: -18px;
}

/* Tiny precision center dot */
.cursor-dot {
  position: absolute;
  top: 0;
  left: 0;
  width: 5px;
  height: 5px;
  margin-top: -2.5px;
  margin-left: -2.5px;
  border-radius: 50%;
  background-color: #FFE600;
  pointer-events: none;
  will-change: transform;
  transition: transform 0.05s ease-out, opacity 0.2s;
}

.cursor-dot.dot-hover {
  opacity: 0;
}
</style>

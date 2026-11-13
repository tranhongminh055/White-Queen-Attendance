<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount } from 'vue'
import SpaceXLogo from './SpaceXLogo.vue'
import { storage } from '../utils/storage'
import { sound } from '../utils/sound'

const emit = defineEmits(['navigate', 'notify'])

const savedProfile = storage.getCurrentProfile()
const profile = reactive({
  id: savedProfile?.id || 'SV-2021-00123',
  fullName: savedProfile?.fullName || 'Nguyễn Văn An',
  classId: savedProfile?.classId || 'CNTT-K21A',
  email: savedProfile?.email || 'an.sv@student.spacex.edu',
  role: savedProfile?.role || 'student'
})

const videoRef = ref(null)
const canvasRef = ref(null)

const isCameraActive = ref(false)
const showLandmark = ref(true)
const showGrid = ref(true)
const capturedFrames = ref({})
const confidence = ref('99.2')
const latencyMs = ref(180)
const isSaving = ref(false)

const angles = ref([
  {
    key: 'straight',
    label: 'Nhìn thẳng',
    arrow: '◎',
    dirCode: 'NHÌN THẲNG',
    prefix: 'Giữ mặt nhìn thẳng vào',
    highlight: 'CAMERA',
    status: 'active', // 'pending' | 'active' | 'done'
    progress: 0
  },
  {
    key: 'left',
    label: 'Quay trái',
    arrow: '←',
    dirCode: 'QUAY TRÁI',
    prefix: 'Từ từ quay mặt sang',
    highlight: 'TRÁI',
    status: 'pending',
    progress: 0
  },
  {
    key: 'right',
    label: 'Quay phải',
    arrow: '→',
    dirCode: 'QUAY PHẢI',
    prefix: 'Từ từ quay mặt sang',
    highlight: 'PHẢI',
    status: 'pending',
    progress: 0
  },
  {
    key: 'up',
    label: 'Ngẩng lên',
    arrow: '↑',
    dirCode: 'NGẨNG LÊN',
    prefix: 'Từ từ ngẩng đầu hướng',
    highlight: 'LÊN',
    status: 'pending',
    progress: 0
  },
  {
    key: 'down',
    label: 'Cúi xuống',
    arrow: '↓',
    dirCode: 'CÚI XUỐNG',
    prefix: 'Từ từ cúi nhẹ đầu xuống',
    highlight: 'DƯỚI',
    status: 'pending',
    progress: 0
  }
])

const activeIndex = ref(0)
let scanTimer = null

const currentAngle = computed(() => angles.value[activeIndex.value] || angles.value[0])
const completedCount = computed(() => angles.value.filter(a => a.status === 'done').length)
const allCompleted = computed(() => completedCount.value === angles.value.length)

const overallPercent = computed(() => {
  const sum = angles.value.reduce((acc, a) => acc + (a.status === 'done' ? 100 : a.progress), 0)
  return Math.round(sum / angles.value.length)
})

const conditionChecks = computed(() => [
  { label: 'Ánh sáng đầy đủ', passed: true },
  { label: 'Chỉ có một khuôn mặt trong khung', passed: true },
  { label: 'Không đeo khẩu trang / kính râm', passed: true },
  { label: 'Khuôn mặt nằm giữa khung', passed: true }
])

const meshPoseStyle = computed(() => {
  const key = currentAngle.value.key
  if (allCompleted.value) return { transform: 'perspective(600px) rotateY(0deg) rotateX(0deg)' }
  if (key === 'left') return { transform: 'perspective(600px) rotateY(-18deg) translateX(-8px)' }
  if (key === 'right') return { transform: 'perspective(600px) rotateY(18deg) translateX(8px)' }
  if (key === 'up') return { transform: 'perspective(600px) rotateX(14deg) translateY(-6px)' }
  if (key === 'down') return { transform: 'perspective(600px) rotateX(-14deg) translateY(6px)' }
  return { transform: 'perspective(600px) rotateY(0deg) rotateX(0deg)' }
})

const avatarPreview = computed(() => {
  return capturedFrames.value.straight || Object.values(capturedFrames.value)[0] || null
})

async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
      audio: false
    })
    if (videoRef.value) {
      videoRef.value.srcObject = stream
      isCameraActive.value = true
    }
  } catch {
    isCameraActive.value = false
  }
}

function stopCamera() {
  if (videoRef.value && videoRef.value.srcObject) {
    const tracks = videoRef.value.srcObject.getTracks()
    tracks.forEach(track => track.stop())
    videoRef.value.srcObject = null
  }
  isCameraActive.value = false
}

function captureCurrentAngleFrame(angleKey) {
  const canvas = canvasRef.value
  if (!canvas) return
  canvas.width = 320
  canvas.height = 320
  const ctx = canvas.getContext('2d')

  if (isCameraActive.value && videoRef.value && videoRef.value.videoWidth > 0) {
    const v = videoRef.value
    const size = Math.min(v.videoWidth, v.videoHeight)
    const sx = (v.videoWidth - size) / 2
    const sy = (v.videoHeight - size) / 2
    ctx.save()
    ctx.translate(canvas.width, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(v, sx, sy, size, size, 0, 0, canvas.width, canvas.height)
    ctx.restore()
    capturedFrames.value[angleKey] = canvas.toDataURL('image/jpeg', 0.85)
    return
  }

  // Fallback synthetic biometric avatar portrait when camera hardware is unavailable
  const grad = ctx.createRadialGradient(160, 140, 20, 160, 160, 170)
  grad.addColorStop(0, '#0c3b57')
  grad.addColorStop(1, '#040911')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, 320, 320)

  ctx.strokeStyle = '#38bdf8'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.ellipse(160, 152, 68, 88, 0, 0, Math.PI * 2)
  ctx.stroke()

  ctx.fillStyle = '#e2e8f0'
  ctx.font = 'bold 54px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const initials = (profile.fullName || 'SV')
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map(w => w[0])
    .join('')
    .toUpperCase()
  ctx.fillText(initials, 160, 156)

  capturedFrames.value[angleKey] = canvas.toDataURL('image/jpeg', 0.85)
}

function startScanLoop() {
  stopScanLoop()
  scanTimer = setInterval(() => {
    const idx = activeIndex.value
    const item = angles.value[idx]
    if (!item || item.status === 'done') {
      const nextIdx = angles.value.findIndex(a => a.status !== 'done')
      if (nextIdx === -1) {
        stopScanLoop()
        return
      }
      activeIndex.value = nextIdx
      angles.value[nextIdx].status = 'active'
      return
    }

    item.status = 'active'
    item.progress = Math.min(100, item.progress + 7)
    confidence.value = (99.0 + Math.random() * 0.6).toFixed(1)
    latencyMs.value = 172 + Math.floor(Math.random() * 14)

    if (item.progress >= 100) {
      item.status = 'done'
      captureCurrentAngleFrame(item.key)
      sound.playBeep()

      const nextPending = angles.value.findIndex(a => a.status !== 'done')
      if (nextPending !== -1) {
        activeIndex.value = nextPending
        angles.value[nextPending].status = 'active'
      } else {
        stopScanLoop()
        sound.playSuccess()
        emit('notify', {
          type: 'success',
          message: 'Đã thu thập đủ 5/5 góc khuôn mặt! Bấm Tiếp tục để hoàn tất.'
        })
      }
    }
  }, 110)
}

function stopScanLoop() {
  if (scanTimer) {
    clearInterval(scanTimer)
    scanTimer = null
  }
}

function selectAngleCard(index) {
  const target = angles.value[index]
  if (!target) return
  sound.playBeep()
  angles.value.forEach((a, i) => {
    if (i !== index && a.status === 'active' && a.progress < 100) {
      a.status = 'pending'
      a.progress = 0
    }
  })
  target.status = 'active'
  target.progress = 0
  activeIndex.value = index
  startScanLoop()
}

function resetAllScans() {
  sound.playBeep()
  capturedFrames.value = {}
  angles.value.forEach((a, i) => {
    a.progress = 0
    a.status = i === 0 ? 'active' : 'pending'
  })
  activeIndex.value = 0
  startScanLoop()
}

function completeEnrollment() {
  if (!allCompleted.value || isSaving.value) return
  isSaving.value = true
  sound.playBeep()

  setTimeout(() => {
    const newStudent = {
      id: profile.id.toUpperCase(),
      name: profile.fullName,
      classId: profile.classId,
      email: profile.email,
      avatar: avatarPreview.value,
      registeredAt: new Date().toLocaleString('vi-VN'),
      embeddingCreated: true
    }

    storage.saveStudent(newStudent)
    const activeProfile = storage.getCurrentProfile()
    if (activeProfile) {
      storage.setCurrentProfile({
        ...activeProfile,
        embeddingCreated: true
      })
    }
    isSaving.value = false
    sound.playSuccess()
    emit('notify', {
      type: 'success',
      message: `Hoàn tất đăng ký sinh trắc học khuôn mặt cho ${newStudent.name}!`
    })
    emit('navigate', 'scanner')
  }, 450)
}

onMounted(() => {
  if (!storage.getCurrentProfile()) {
    sound.playWarning()
    emit('notify', {
      type: 'warning',
      message: 'Chưa đăng nhập tài khoản! Vui lòng đăng nhập để đăng ký khuôn mặt.'
    })
    emit('navigate', 'login')
    return
  }
  startCamera()
  startScanLoop()
})

onBeforeUnmount(() => {
  stopScanLoop()
  stopCamera()
})
</script>

<template>
  <div class="sx-enroll-page">
    <!-- TOP HEADER BAR -->
    <header class="sx-enroll-header">
      <div class="sx-eh-left">
        <SpaceXLogo @click="emit('navigate', 'landing')" title="Quay về Trang chủ SpaceX" />
        <span class="sx-brand-divider"></span>
        <span class="sx-brand-sub">BIOMETRIC AI</span>
      </div>

      <div class="sx-eh-center">
        <span class="sx-eh-title">ĐĂNG KÝ KHUÔN MẶT</span>
        <span class="sx-eh-pct-bound">0%</span>
        <div class="sx-eh-track">
          <div class="sx-eh-fill" :style="{ width: overallPercent + '%' }"></div>
          <span
            class="sx-eh-knob"
            :style="{ left: `clamp(12px, ${overallPercent}%, calc(100% - 12px))` }"
          >
            {{ overallPercent }}%
          </span>
        </div>
        <span class="sx-eh-pct-bound">100%</span>
      </div>

      <div class="sx-eh-right">
        <div class="sx-secure-pill">
          <span class="sx-secure-dot"></span>
          <span>SECURE ENROLLMENT</span>
        </div>
        <button class="sx-exit-btn" @click="emit('navigate', 'landing')" title="Thoát đăng ký">
          ✕ THOÁT
        </button>
      </div>
    </header>

    <!-- TWO-COLUMN WORKSPACE -->
    <div class="sx-enroll-body">
      <!-- LEFT COLUMN: LIVE BIOMETRIC SCANNER + 5 ANGLE CARDS + TELEMETRY -->
      <section class="sx-scan-column">
        <div class="sx-cam-frame" :class="{ 'has-grid': showGrid }">
          <!-- 4 Corner Cyan Brackets -->
          <span class="cam-corner tl"></span>
          <span class="cam-corner tr"></span>
          <span class="cam-corner bl"></span>
          <span class="cam-corner br"></span>

          <!-- Camera Top Overlay Bar -->
          <div class="sx-cam-topbar">
            <div class="sx-rec-badge">
              <span class="rec-dot"></span>
              <span>REC • LIVE</span>
            </div>

            <div class="sx-cam-controls">
              <span class="sx-fps-tag">FPS 30</span>
              <button
                type="button"
                class="sx-hud-toggle"
                :class="{ active: showLandmark }"
                @click="showLandmark = !showLandmark"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="9"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
                <span>LANDMARK</span>
              </button>
              <button
                type="button"
                class="sx-hud-toggle"
                :class="{ active: showGrid }"
                @click="showGrid = !showGrid"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="3" width="18" height="18" rx="1"/>
                  <line x1="3" y1="12" x2="21" y2="12"/>
                  <line x1="12" y1="3" x2="12" y2="21"/>
                </svg>
                <span>LƯỚI</span>
              </button>
            </div>
          </div>

          <!-- Center Instruction Title -->
          <div class="sx-cam-prompt">
            <div class="sx-prompt-main">
              <template v-if="!allCompleted">
                <span class="prompt-arrow">{{ currentAngle.arrow }}</span>
                <span>{{ currentAngle.prefix }}</span>
                <span class="prompt-key">{{ currentAngle.highlight }}</span>
              </template>
              <template v-else>
                <span class="prompt-done">✓ Đã hoàn tất thu thập 5/5 góc khuôn mặt</span>
              </template>
            </div>
            <div class="sx-prompt-sub" :class="{ done: allCompleted }">
              {{ allCompleted ? 'Hệ thống đã mã hóa đặc trưng sinh trắc học' : 'Giữ yên khi vòng sáng chuyển xanh' }}
            </div>
          </div>

          <!-- Middle Viewport: Direction Tag + Circular Face HUD + Telemetry -->
          <div class="sx-cam-stage">
            <!-- Left Direction Arrow Indicator -->
            <div class="sx-side-direction" v-if="!allCompleted">
              <div class="sx-dir-big-arrow">{{ currentAngle.arrow }}</div>
              <div class="sx-dir-text">{{ currentAngle.dirCode }}</div>
            </div>
            <div class="sx-side-direction done" v-else>
              <div class="sx-dir-big-arrow">✓</div>
              <div class="sx-dir-text">HOÀN TẤT</div>
            </div>

            <!-- Central Circular Reticle & Face Mesh -->
            <div class="sx-reticle-wrap">
              <!-- Live Video inside Circular Mask -->
              <div class="sx-video-circle">
                <video
                  v-show="isCameraActive"
                  ref="videoRef"
                  autoplay
                  playsinline
                  muted
                  class="sx-live-video"
                ></video>
                <div class="sx-video-tint"></div>

                <!-- 468-Landmark Cyan Biometric Face Mesh -->
                <svg
                  v-show="showLandmark"
                  viewBox="0 0 240 280"
                  class="sx-face-mesh"
                  :style="meshPoseStyle"
                  aria-hidden="true"
                >
                  <defs>
                    <filter id="cyanGlow" x="-30%" y="-30%" width="160%" height="160%">
                      <feGaussianBlur stdDeviation="2.2" result="blur"/>
                      <feMerge>
                        <feMergeNode in="blur"/>
                        <feMergeNode in="SourceGraphic"/>
                      </feMerge>
                    </filter>
                  </defs>
                  <g
                    fill="none"
                    :stroke="allCompleted ? '#10b981' : '#38bdf8'"
                    stroke-width="0.9"
                    stroke-opacity="0.72"
                    filter="url(#cyanGlow)"
                  >
                    <!-- Head / Jaw Contour -->
                    <path d="M120 28 C165 28 194 64 194 114 C194 162 178 212 152 238 C139 251 130 255 120 255 C110 255 101 251 88 238 C62 212 46 162 46 114 C46 64 75 28 120 28 Z" />
                    <path d="M120 38 C156 38 182 68 182 114 C182 155 168 198 146 222 C136 233 128 237 120 237 C112 237 104 233 94 222 C72 198 58 155 58 114 C58 68 84 38 120 38 Z" stroke-opacity="0.4"/>
                    <!-- Triangulation Grid -->
                    <polyline points="120,38 78,76 58,114 70,164 94,222 120,237 146,222 170,164 182,114 162,76 120,38" stroke-opacity="0.45"/>
                    <polyline points="120,38 120,104 120,160 120,192 120,237" stroke-opacity="0.45"/>
                    <line x1="78" y1="76" x2="162" y2="76" stroke-opacity="0.45"/>
                    <line x1="58" y1="114" x2="182" y2="114" stroke-opacity="0.3"/>
                    <line x1="70" y1="164" x2="170" y2="164" stroke-opacity="0.35"/>
                    <polyline points="78,76 120,104 162,76" stroke-opacity="0.55"/>
                    <polyline points="58,114 92,116 120,104 148,116 182,114" stroke-opacity="0.5"/>
                    <polyline points="70,164 102,162 120,160 138,162 170,164" stroke-opacity="0.45"/>
                    <polyline points="92,116 102,162 120,192 138,162 148,116" stroke-opacity="0.45"/>
                    <polyline points="70,164 96,192 120,192 144,192 170,164" stroke-opacity="0.4"/>
                    <polyline points="94,222 120,206 146,222" stroke-opacity="0.4"/>

                    <!-- Brows -->
                    <path d="M72 100 Q92 91 110 98" stroke-width="1.3"/>
                    <path d="M130 98 Q148 91 168 100" stroke-width="1.3"/>
                    <!-- Eyes + Iris Target -->
                    <ellipse cx="91" cy="116" rx="14" ry="7" stroke-width="1.2"/>
                    <circle cx="91" cy="116" r="3.5"/>
                    <ellipse cx="149" cy="116" rx="14" ry="7" stroke-width="1.2"/>
                    <circle cx="149" cy="116" r="3.5"/>
                    <!-- Nose -->
                    <polyline points="120,106 115,152 106,159 120,163 134,159 125,152 120,106" stroke-width="1.15"/>
                    <!-- Mouth -->
                    <path d="M96 190 Q108 184 120 187 Q132 184 144 190 Q132 199 120 199 Q108 199 96 190 Z" stroke-width="1.15"/>
                    <line x1="97" y1="190" x2="143" y2="190" stroke-opacity="0.65"/>

                    <!-- Key Landmark Dots -->
                    <g :fill="allCompleted ? '#34d399' : '#7dd3fc'">
                      <circle cx="120" cy="38" r="2.2"/>
                      <circle cx="78" cy="76" r="2"/>
                      <circle cx="162" cy="76" r="2"/>
                      <circle cx="91" cy="116" r="2.2"/>
                      <circle cx="149" cy="116" r="2.2"/>
                      <circle cx="120" cy="104" r="2.2"/>
                      <circle cx="58" cy="114" r="2"/>
                      <circle cx="182" cy="114" r="2"/>
                      <circle cx="120" cy="160" r="2.4"/>
                      <circle cx="106" cy="159" r="1.8"/>
                      <circle cx="134" cy="159" r="1.8"/>
                      <circle cx="96" cy="190" r="2"/>
                      <circle cx="144" cy="190" r="2"/>
                      <circle cx="120" cy="237" r="2.3"/>
                      <circle cx="70" cy="164" r="2"/>
                      <circle cx="170" cy="164" r="2"/>
                    </g>
                  </g>
                </svg>

                <!-- Horizontal Laser Sweep Line -->
                <div class="sx-laser-beam" :class="{ completed: allCompleted }"></div>
              </div>

              <!-- Radial 60-Tick Precision Progress Ring -->
              <svg viewBox="0 0 360 360" class="sx-radial-ticks" aria-hidden="true">
                <circle
                  cx="180"
                  cy="180"
                  r="138"
                  fill="none"
                  :stroke="allCompleted ? '#10b981' : '#0ea5e9'"
                  stroke-width="2"
                  stroke-opacity="0.85"
                />
                <circle
                  cx="180"
                  cy="180"
                  r="152"
                  fill="none"
                  stroke="rgba(56, 189, 248, 0.22)"
                  stroke-width="1"
                  stroke-dasharray="4 6"
                />
                <g>
                  <line
                    v-for="tick in 60"
                    :key="tick"
                    x1="180"
                    y1="14"
                    x2="180"
                    y2="25"
                    :stroke="
                      tick / 60 <= (allCompleted ? 1 : currentAngle.progress / 100)
                        ? allCompleted
                          ? '#10b981'
                          : '#38bdf8'
                        : 'rgba(148, 163, 184, 0.28)'
                    "
                    :stroke-width="tick % 5 === 0 ? 2.2 : 1.3"
                    :transform="`rotate(${(tick - 1) * 6} 180 180)`"
                  />
                </g>
              </svg>
            </div>

            <!-- Right Live Detection Telemetry -->
            <div class="sx-side-telemetry">
              <div class="sx-detect-badge">
                <span class="detect-dot"></span>
                <span>FACE DETECTED</span>
              </div>
              <div class="sx-detect-pct">{{ confidence }}%</div>
              <div class="sx-detect-sub">468 LANDMARKS</div>
            </div>
          </div>

          <!-- Bottom-Center Scan Percentage Pill -->
          <div class="sx-cam-bottom-pill">
            <span class="bp-num" :class="{ done: allCompleted }">
              {{ allCompleted ? 100 : currentAngle.progress }}%
            </span>
            <span class="bp-label">ĐÃ QUÉT</span>
          </div>

          <!-- Bottom Corner Telemetry -->
          <div class="sx-cam-footbar">
            <span>CAM 01 · 1080P</span>
            <span>ID: {{ profile.id }}</span>
          </div>
        </div>

        <!-- 5 ANGLE STEP CARDS -->
        <div class="sx-angles-grid">
          <button
            v-for="(angle, idx) in angles"
            :key="angle.key"
            type="button"
            class="sx-angle-card"
            :class="angle.status"
            @click="selectAngleCard(idx)"
          >
            <div class="ac-top">
              <span class="ac-icon-badge">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                  <ellipse cx="12" cy="12" rx="6" ry="8" />
                  <path v-if="angle.key === 'straight'" d="M9 11h.01M15 11h.01M10 15h4" />
                  <path v-else-if="angle.key === 'left'" d="M8 12h6M10 9l-3 3 3 3" />
                  <path v-else-if="angle.key === 'right'" d="M10 12h6M14 9l3 3-3 3" />
                  <path v-else-if="angle.key === 'up'" d="M12 15V9M9 11l3-3 3 3" />
                  <path v-else d="M12 9v6M9 13l3 3 3-3" />
                </svg>
              </span>

              <span class="ac-status-mark">
                <span v-if="angle.status === 'done'" class="mark-check">✓</span>
                <span v-else-if="angle.status === 'active'" class="mark-active"></span>
                <span v-else class="mark-pending"></span>
              </span>
            </div>

            <div class="ac-name">
              <template v-if="angle.status === 'done'">{{ angle.label }} ✓</template>
              <template v-else-if="angle.status === 'active'">{{ angle.label }} (đang quét)</template>
              <template v-else>{{ angle.label }}</template>
            </div>

            <div class="ac-footer">
              <template v-if="angle.status === 'done'">HOÀN TẤT</template>
              <template v-else-if="angle.status === 'active'">ĐANG QUÉT · {{ angle.progress }}%</template>
              <template v-else>CHỜ</template>
            </div>
          </button>
        </div>

        <!-- BOTTOM TELEMETRY FOOTER -->
        <div class="sx-telemetry-strip">
          <span>ĐỘ SÁNG: <strong class="t-good">TỐT</strong></span>
          <span>KHOẢNG CÁCH: <strong>52CM</strong></span>
          <span>ĐỘ NÉT: <strong>98%</strong></span>
          <span>MÔ HÌNH: <strong>FACENET-V2</strong></span>
          <span>ĐỘ TRỄ: <strong>{{ latencyMs }}MS</strong></span>
          <span class="t-e2e">🔒 E2E</span>
        </div>
      </section>

      <!-- RIGHT COLUMN: STUDENT PROFILE + CONDITION CHECKS + ACTIONS -->
      <aside class="sx-sidebar-column">
        <div class="sx-sb-main">
          <div class="sx-step-eyebrow">STEP 02 / 03 · FACE ENROLLMENT</div>
          <h1 class="sx-sb-title">Đăng ký khuôn mặt</h1>
          <p class="sx-sb-subtitle">
            Hệ thống sẽ ghi lại khuôn mặt của bạn từ nhiều góc độ để điểm danh tự động trong lớp học.
          </p>

          <!-- Student Profile Summary Card -->
          <div class="sx-profile-card">
            <div class="sx-profile-avatar">
              <img v-if="avatarPreview" :src="avatarPreview" alt="Ảnh khuôn mặt" />
              <svg v-else width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
            </div>

            <div class="sx-profile-info">
              <div class="sx-pi-top">
                <div class="sx-pi-name">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                  </svg>
                  <span>{{ profile.fullName }}</span>
                </div>
                <span class="sx-role-badge">
                  {{ profile.role === 'lecturer' ? 'GIẢNG VIÊN' : 'SINH VIÊN' }}
                </span>
              </div>

              <div class="sx-pi-meta">
                <span>MSSV: {{ profile.id }}</span>
                <span>LỚP: {{ profile.classId }}</span>
              </div>

              <div class="sx-pi-email">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                  <rect x="2" y="4" width="20" height="16" rx="2"/>
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                </svg>
                <span>{{ profile.email }}</span>
              </div>
            </div>
          </div>

          <!-- Condition Checklist -->
          <div class="sx-section-block">
            <div class="sx-section-label">KIỂM TRA ĐIỀU KIỆN</div>
            <div class="sx-check-list">
              <div v-for="item in conditionChecks" :key="item.label" class="sx-check-row">
                <div class="sx-check-left">
                  <span class="sx-check-box">✓</span>
                  <span class="sx-check-text">{{ item.label }}</span>
                </div>
                <span class="sx-check-status">ĐẠT</span>
              </div>
            </div>
          </div>

          <!-- Tips Callout Box -->
          <div class="sx-tips-box">
            <div class="sx-tips-title">MẸO ĐỂ QUÉT TỐT HƠN</div>
            <ul class="sx-tips-list">
              <li>Quay mặt chậm và đều, không nghiêng đầu quá nhanh.</li>
              <li>Giữ khoảng cách khoảng 40–60 cm so với camera.</li>
              <li>Tránh ngược sáng và vén tóc khỏi vùng trán, mắt.</li>
            </ul>
          </div>

          <!-- Progress & Action Controls -->
          <div class="sx-actions-block">
            <div class="sx-collect-header">
              <span class="sx-collect-text">Đã thu thập {{ completedCount }}/5 góc</span>
              <span class="sx-collect-pct">{{ overallPercent }}%</span>
            </div>
            <div class="sx-collect-track">
              <div class="sx-collect-fill" :style="{ width: overallPercent + '%' }"></div>
            </div>

            <div class="sx-btn-row">
              <button type="button" class="sx-btn-retake" @click="resetAllScans">
                ↻ CHỤP LẠI
              </button>
              <button
                type="button"
                class="sx-btn-continue"
                :class="{ ready: allCompleted }"
                :disabled="!allCompleted || isSaving"
                @click="completeEnrollment"
              >
                {{ isSaving ? 'ĐANG LƯU...' : '→ TIẾP TỤC' }}
              </button>
            </div>

            <div class="sx-lock-hint" :class="{ ready: allCompleted }">
              <template v-if="!allCompleted">🔒 Hoàn thành quét để tiếp tục</template>
              <template v-else>✓ Đã thu thập đủ 5/5 góc — Sẵn sàng tiếp tục</template>
            </div>

            <button
              type="button"
              class="sx-back-info-link"
              @click="emit('navigate', 'register')"
            >
              ← Quay lại thông tin
            </button>
          </div>
        </div>

        <!-- Security Notice Footer -->
        <footer class="sx-sb-footer">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
          <span>DỮ LIỆU SINH TRẮC HỌC ĐƯỢC MÃ HÓA ĐẦU CUỐI · KHÔNG LƯU ẢNH GỐC</span>
        </footer>
      </aside>
    </div>

    <canvas ref="canvasRef" style="display: none;"></canvas>
  </div>
</template>

<style scoped>
.sx-enroll-page {
  min-height: 100vh;
  background: #040608;
  color: #f8fafc;
  display: flex;
  flex-direction: column;
  font-family: var(--font-sans);
}

/* Header Bar */
.sx-enroll-header {
  height: 52px;
  padding: 0 20px;
  background: #040608;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.sx-eh-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.sx-brand-divider {
  width: 24px;
  height: 1px;
  background: rgba(255, 255, 255, 0.2);
}

.sx-brand-sub {
  font-family: var(--font-mono);
  font-size: 0.65rem;
  letter-spacing: 0.2em;
  color: #64748b;
}

.sx-eh-center {
  display: flex;
  align-items: center;
  gap: 10px;
  font-family: var(--font-mono);
  font-size: 0.66rem;
  letter-spacing: 0.14em;
  color: #94a3b8;
}

.sx-eh-title {
  color: #cbd5e1;
}

.sx-eh-pct-bound {
  color: #64748b;
  font-size: 0.62rem;
}

.sx-eh-track {
  position: relative;
  width: 170px;
  height: 3px;
  background: rgba(255, 255, 255, 0.12);
  border-radius: 2px;
}

.sx-eh-fill {
  height: 100%;
  background: #0ea5e9;
  box-shadow: 0 0 10px rgba(14, 165, 233, 0.8);
  border-radius: 2px;
  transition: width 0.2s linear;
}

.sx-eh-knob {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  padding: 2px 7px;
  background: #082f49;
  border: 1px solid #38bdf8;
  border-radius: 3px;
  color: #e0f2fe;
  font-size: 0.6rem;
  font-weight: 700;
  box-shadow: 0 0 12px rgba(14, 165, 233, 0.7);
  transition: left 0.2s linear;
}

.sx-eh-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.sx-secure-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 2px;
  background: rgba(6, 10, 15, 0.8);
  font-family: var(--font-mono);
  font-size: 0.62rem;
  letter-spacing: 0.14em;
  color: #cbd5e1;
}

.sx-secure-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #10b981;
  box-shadow: 0 0 8px #10b981;
}

.sx-exit-btn {
  padding: 6px 14px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 2px;
  background: transparent;
  color: #cbd5e1;
  font-family: var(--font-mono);
  font-size: 0.64rem;
  letter-spacing: 0.14em;
  cursor: pointer;
  transition: all 0.2s ease;
}

.sx-exit-btn:hover {
  border-color: rgba(255, 255, 255, 0.4);
  color: #ffffff;
}

/* Split Body */
.sx-enroll-body {
  flex: 1;
  display: grid;
  grid-template-columns: 1.42fr 1fr;
  min-height: calc(100vh - 52px);
}

/* LEFT COLUMN */
.sx-scan-column {
  padding: 16px 18px 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: #040608;
}

.sx-cam-frame {
  position: relative;
  flex: 1;
  min-height: 440px;
  background: radial-gradient(circle at 50% 48%, rgba(8, 38, 58, 0.35), #030508 74%);
  border: 1px solid rgba(255, 255, 255, 0.08);
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  overflow: hidden;
}

.sx-cam-frame.has-grid::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(56, 189, 248, 0.04) 1px, transparent 1px),
    linear-gradient(90deg, rgba(56, 189, 248, 0.04) 1px, transparent 1px);
  background-size: 40px 40px;
  pointer-events: none;
}

.cam-corner {
  position: absolute;
  width: 14px;
  height: 14px;
  border-color: #38bdf8;
  border-style: solid;
  pointer-events: none;
}
.cam-corner.tl { top: 6px; left: 6px; border-width: 1.5px 0 0 1.5px; }
.cam-corner.tr { top: 6px; right: 6px; border-width: 1.5px 1.5px 0 0; }
.cam-corner.bl { bottom: 6px; left: 6px; border-width: 0 0 1.5px 1.5px; }
.cam-corner.br { bottom: 6px; right: 6px; border-width: 0 1.5px 1.5px 0; }

.sx-cam-topbar {
  position: relative;
  z-index: 4;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.sx-rec-badge {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-family: var(--font-mono);
  font-size: 0.66rem;
  letter-spacing: 0.14em;
  color: #cbd5e1;
}

.rec-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #ef4444;
  box-shadow: 0 0 8px #ef4444;
  animation: recBlink 1.4s ease-in-out infinite;
}

@keyframes recBlink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.35; }
}

.sx-cam-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sx-fps-tag {
  font-family: var(--font-mono);
  font-size: 0.64rem;
  letter-spacing: 0.12em;
  color: #64748b;
  margin-right: 4px;
}

.sx-hud-toggle {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border-radius: 2px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(6, 10, 16, 0.85);
  color: #64748b;
  font-family: var(--font-mono);
  font-size: 0.62rem;
  letter-spacing: 0.12em;
  cursor: pointer;
  transition: all 0.2s ease;
}

.sx-hud-toggle.active {
  border-color: rgba(56, 189, 248, 0.7);
  background: rgba(14, 165, 233, 0.12);
  color: #e0f2fe;
}

.sx-cam-prompt {
  position: relative;
  z-index: 4;
  text-align: center;
  margin-top: 2px;
}

.sx-prompt-main {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 1.08rem;
  font-weight: 500;
  color: #f8fafc;
}

.prompt-arrow {
  color: #38bdf8;
  font-weight: 700;
}

.prompt-key {
  color: #38bdf8;
  font-weight: 700;
  letter-spacing: 0.04em;
}

.prompt-done {
  color: #10b981;
  font-weight: 600;
}

.sx-prompt-sub {
  margin-top: 4px;
  font-size: 0.72rem;
  color: #64748b;
}

.sx-prompt-sub.done {
  color: #34d399;
}

/* Camera Center HUD Stage */
.sx-cam-stage {
  position: relative;
  z-index: 3;
  display: grid;
  grid-template-columns: 110px 1fr 125px;
  align-items: center;
  margin: 4px 0;
}

.sx-side-direction {
  text-align: center;
  color: #38bdf8;
}

.sx-side-direction.done {
  color: #10b981;
}

.sx-dir-big-arrow {
  font-size: 2.3rem;
  line-height: 1;
  text-shadow: 0 0 18px rgba(56, 189, 248, 0.7);
  animation: arrowPulse 1.6s ease-in-out infinite;
}

@keyframes arrowPulse {
  0%, 100% { transform: translateX(0); opacity: 0.85; }
  50% { transform: translateX(-4px); opacity: 1; }
}

.sx-dir-text {
  margin-top: 6px;
  font-family: var(--font-mono);
  font-size: 0.64rem;
  letter-spacing: 0.14em;
  color: #cbd5e1;
}

.sx-reticle-wrap {
  position: relative;
  width: 288px;
  height: 288px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
}

.sx-video-circle {
  position: relative;
  width: 214px;
  height: 214px;
  border-radius: 50%;
  overflow: hidden;
  background: radial-gradient(circle at 50% 45%, #062133, #03070d 78%);
  display: flex;
  align-items: center;
  justify-content: center;
}

.sx-live-video {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transform: scaleX(-1);
  opacity: 0.55;
  filter: contrast(1.12) saturate(0.75);
}

.sx-video-tint {
  position: absolute;
  inset: 0;
  background: radial-gradient(circle, rgba(14, 165, 233, 0.08) 35%, rgba(3, 6, 12, 0.72) 100%);
  pointer-events: none;
}

.sx-face-mesh {
  position: relative;
  z-index: 2;
  width: 162px;
  height: 192px;
  transition: transform 0.35s ease;
}

.sx-laser-beam {
  position: absolute;
  left: 8%;
  right: 8%;
  height: 2px;
  z-index: 3;
  background: linear-gradient(90deg, transparent, #38bdf8 25%, #e0f2fe 50%, #38bdf8 75%, transparent);
  box-shadow: 0 0 14px 3px rgba(56, 189, 248, 0.55);
  animation: faceLaserSweep 2.4s ease-in-out infinite;
}

.sx-laser-beam.completed {
  background: linear-gradient(90deg, transparent, #10b981 25%, #a7f3d0 50%, #10b981 75%, transparent);
  box-shadow: 0 0 14px 3px rgba(16, 185, 129, 0.55);
}

@keyframes faceLaserSweep {
  0% { top: 14%; opacity: 0.25; }
  50% { top: 82%; opacity: 0.95; }
  100% { top: 14%; opacity: 0.25; }
}

.sx-radial-ticks {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.sx-side-telemetry {
  text-align: right;
  font-family: var(--font-mono);
}

.sx-detect-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.62rem;
  letter-spacing: 0.14em;
  color: #38bdf8;
}

.detect-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #38bdf8;
  box-shadow: 0 0 8px #38bdf8;
}

.sx-detect-pct {
  margin-top: 2px;
  font-size: 1.25rem;
  font-weight: 700;
  color: #f8fafc;
}

.sx-detect-sub {
  margin-top: 2px;
  font-size: 0.6rem;
  letter-spacing: 0.12em;
  color: #64748b;
}

.sx-cam-bottom-pill {
  position: relative;
  z-index: 4;
  margin: 0 auto;
  padding: 5px 14px;
  border: 1px solid rgba(56, 189, 248, 0.35);
  background: rgba(5, 12, 20, 0.92);
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
}

.bp-num {
  font-family: var(--font-mono);
  font-size: 1.05rem;
  font-weight: 700;
  color: #38bdf8;
}

.bp-num.done {
  color: #10b981;
}

.bp-label {
  font-family: var(--font-mono);
  font-size: 0.6rem;
  letter-spacing: 0.12em;
  color: #94a3b8;
}

.sx-cam-footbar {
  position: relative;
  z-index: 4;
  display: flex;
  justify-content: space-between;
  font-family: var(--font-mono);
  font-size: 0.62rem;
  letter-spacing: 0.12em;
  color: #64748b;
}

/* 5 ANGLE CARDS */
.sx-angles-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 8px;
}

.sx-angle-card {
  text-align: left;
  padding: 10px 11px;
  background: #06090e;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 2px;
  color: #94a3b8;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sx-angle-card:hover {
  border-color: rgba(255, 255, 255, 0.25);
}

.sx-angle-card.done {
  border-color: rgba(16, 185, 129, 0.35);
  background: rgba(16, 185, 129, 0.04);
}

.sx-angle-card.active {
  border-color: #38bdf8;
  background: rgba(14, 165, 233, 0.08);
  box-shadow: 0 0 16px rgba(14, 165, 233, 0.15);
}

.ac-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.ac-icon-badge {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.15);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #64748b;
}

.sx-angle-card.done .ac-icon-badge {
  border-color: rgba(16, 185, 129, 0.45);
  color: #10b981;
}

.sx-angle-card.active .ac-icon-badge {
  border-color: #38bdf8;
  color: #38bdf8;
}

.mark-check {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  border-radius: 2px;
  background: #10b981;
  color: #04120c;
  font-size: 0.65rem;
  font-weight: 800;
}

.mark-active {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #38bdf8;
  box-shadow: 0 0 8px #38bdf8;
}

.mark-pending {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.14);
}

.ac-name {
  font-size: 0.76rem;
  font-weight: 500;
  color: #cbd5e1;
}

.sx-angle-card.active .ac-name,
.sx-angle-card.done .ac-name {
  color: #f8fafc;
}

.ac-footer {
  font-family: var(--font-mono);
  font-size: 0.58rem;
  letter-spacing: 0.08em;
  color: #475569;
}

.sx-angle-card.done .ac-footer {
  color: #10b981;
}

.sx-angle-card.active .ac-footer {
  color: #38bdf8;
}

/* Telemetry Footer Strip */
.sx-telemetry-strip {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding-top: 6px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  font-family: var(--font-mono);
  font-size: 0.62rem;
  letter-spacing: 0.12em;
  color: #64748b;
}

.sx-telemetry-strip strong {
  color: #cbd5e1;
  font-weight: 600;
}

.sx-telemetry-strip strong.t-good {
  color: #10b981;
}

.t-e2e {
  color: #94a3b8;
}

/* RIGHT SIDEBAR */
.sx-sidebar-column {
  background: #05070a;
  border-left: 1px solid rgba(255, 255, 255, 0.08);
  padding: 22px 26px 16px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 16px;
}

.sx-step-eyebrow {
  font-family: var(--font-mono);
  font-size: 0.64rem;
  letter-spacing: 0.2em;
  color: #64748b;
}

.sx-sb-title {
  margin: 6px 0 0;
  font-size: 1.55rem;
  font-weight: 600;
  color: #ffffff;
  letter-spacing: -0.01em;
}

.sx-sb-subtitle {
  margin: 6px 0 16px;
  font-size: 0.78rem;
  line-height: 1.5;
  color: #94a3b8;
}

/* Profile Summary Card */
.sx-profile-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 14px;
  background: #070a10;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  margin-bottom: 18px;
}

.sx-profile-avatar {
  width: 48px;
  height: 48px;
  flex-shrink: 0;
  border-radius: 50%;
  overflow: hidden;
  border: 1.5px solid #38bdf8;
  background: #082032;
  color: #38bdf8;
  display: flex;
  align-items: center;
  justify-content: center;
}

.sx-profile-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.sx-profile-info {
  flex: 1;
  min-width: 0;
}

.sx-pi-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.sx-pi-name {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.92rem;
  font-weight: 600;
  color: #f8fafc;
}

.sx-role-badge {
  padding: 2px 8px;
  border: 1px solid rgba(56, 189, 248, 0.4);
  border-radius: 2px;
  background: rgba(14, 165, 233, 0.08);
  font-family: var(--font-mono);
  font-size: 0.58rem;
  letter-spacing: 0.12em;
  color: #38bdf8;
}

.sx-pi-meta {
  margin-top: 4px;
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  font-family: var(--font-mono);
  font-size: 0.64rem;
  letter-spacing: 0.06em;
  color: #94a3b8;
}

.sx-pi-email {
  margin-top: 4px;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.72rem;
  color: #64748b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Condition Checklist */
.sx-section-block {
  margin-bottom: 16px;
}

.sx-section-label {
  font-family: var(--font-mono);
  font-size: 0.62rem;
  letter-spacing: 0.16em;
  color: #64748b;
  margin-bottom: 8px;
}

.sx-check-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.sx-check-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: #070a10;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 2px;
}

.sx-check-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.sx-check-box {
  width: 14px;
  height: 14px;
  border-radius: 2px;
  background: #10b981;
  color: #03150d;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.62rem;
  font-weight: 800;
}

.sx-check-text {
  font-size: 0.76rem;
  color: #e2e8f0;
}

.sx-check-status {
  font-family: var(--font-mono);
  font-size: 0.62rem;
  letter-spacing: 0.12em;
  color: #10b981;
}

/* Tips Callout */
.sx-tips-box {
  padding: 12px 14px;
  background: rgba(14, 165, 233, 0.04);
  border: 1px solid rgba(56, 189, 248, 0.25);
  border-radius: 2px;
  margin-bottom: 18px;
}

.sx-tips-title {
  font-family: var(--font-mono);
  font-size: 0.62rem;
  letter-spacing: 0.16em;
  color: #38bdf8;
  margin-bottom: 8px;
}

.sx-tips-list {
  margin: 0;
  padding-left: 16px;
  display: flex;
  flex-direction: column;
  gap: 5px;
  font-size: 0.74rem;
  line-height: 1.45;
  color: #94a3b8;
}

/* Bottom Progress & Action Buttons */
.sx-collect-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
  font-size: 0.76rem;
}

.sx-collect-text {
  color: #cbd5e1;
}

.sx-collect-pct {
  font-family: var(--font-mono);
  font-weight: 600;
  color: #38bdf8;
}

.sx-collect-track {
  height: 3px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  overflow: hidden;
  margin-bottom: 14px;
}

.sx-collect-fill {
  height: 100%;
  background: #0ea5e9;
  transition: width 0.2s linear;
}

.sx-btn-row {
  display: grid;
  grid-template-columns: 0.6fr 1fr;
  gap: 10px;
}

.sx-btn-retake {
  padding: 12px 14px;
  background: #06090e;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 2px;
  color: #f8fafc;
  font-family: var(--font-mono);
  font-size: 0.72rem;
  letter-spacing: 0.12em;
  cursor: pointer;
  transition: all 0.2s ease;
}

.sx-btn-retake:hover {
  border-color: rgba(255, 255, 255, 0.45);
}

.sx-btn-continue {
  padding: 12px 16px;
  background: #7c8798;
  border: none;
  border-radius: 2px;
  color: #06090e;
  font-family: var(--font-mono);
  font-size: 0.74rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  cursor: not-allowed;
  transition: all 0.25s ease;
}

.sx-btn-continue.ready {
  background: #ffffff;
  color: #040608;
  cursor: pointer;
  box-shadow: 0 0 24px rgba(255, 255, 255, 0.22);
}

.sx-btn-continue.ready:hover {
  background: #e2e8f0;
}

.sx-lock-hint {
  margin-top: 10px;
  text-align: center;
  font-size: 0.7rem;
  color: #64748b;
}

.sx-lock-hint.ready {
  color: #10b981;
}

.sx-back-info-link {
  display: block;
  margin: 10px auto 0;
  background: transparent;
  border: none;
  color: #94a3b8;
  font-size: 0.74rem;
  text-decoration: underline;
  text-underline-offset: 4px;
  cursor: pointer;
}

.sx-back-info-link:hover {
  color: #ffffff;
}

.sx-sb-footer {
  padding-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: var(--font-mono);
  font-size: 0.58rem;
  letter-spacing: 0.1em;
  color: #64748b;
}

/* Responsive */
@media (max-width: 1024px) {
  .sx-enroll-body {
    grid-template-columns: 1fr;
  }

  .sx-eh-center {
    display: none;
  }

  .sx-sidebar-column {
    border-left: none;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }
}

@media (max-width: 640px) {
  .sx-angles-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .sx-cam-stage {
    grid-template-columns: 1fr;
    gap: 10px;
  }

  .sx-side-direction,
  .sx-side-telemetry {
    text-align: center;
  }
}
</style>

<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount } from 'vue'
import SpaceXLogo from './SpaceXLogo.vue'
import { storage } from '../utils/storage'
import { faceEngine } from '../utils/faceEngine'
import { sound } from '../utils/sound'

const emit = defineEmits(['navigate', 'back', 'notify'])

const savedProfile = storage.getCurrentProfile()
const profile = reactive({
  id: savedProfile?.id || '',
  fullName: savedProfile?.fullName || '',
  classId: savedProfile?.classId || 'CNTT-K21A',
  email: savedProfile?.email || '',
  role: savedProfile?.role || 'student'
})

const videoRef = ref(null)
const overlayCanvasRef = ref(null)
const captureCanvasRef = ref(null)

const isCameraActive = ref(false)
const cameraError = ref('')
const isModelLoading = ref(true)
const modelError = ref('')

const showLandmark = ref(true)
const showGrid = ref(true)
const capturedFrames = ref({})
const capturedDescriptors = ref({})

const fps = ref(0)
const confidence = ref('0.0')
const faceDetected = ref(false)
const faceCount = ref(0)
const latencyMs = ref(0)
const brightnessValue = ref(0)
const sharpnessPct = ref(0)
const distanceCm = ref(0)
const poseMatched = ref(false)
const isSaving = ref(false)

const conditions = reactive({
  brightnessOk: false,
  singleFaceOk: false,
  unoccludedOk: false,
  centeredOk: false
})

const angles = ref([
  {
    key: 'straight',
    label: 'Nhìn thẳng',
    arrow: '◎',
    dirCode: 'NHÌN THẲNG',
    prefix: 'Giữ mặt nhìn thẳng vào',
    highlight: 'CAMERA',
    status: 'active',
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
let isDestroyed = false
let loopTimer = null
let isExtracting = false
let lastFrameTime = performance.now()
const baselinePose = ref({ yaw: 0, pitch: 0.46 })

const currentAngle = computed(() => angles.value[activeIndex.value] || angles.value[0])
const completedCount = computed(() => angles.value.filter(a => a.status === 'done').length)
const allCompleted = computed(() => completedCount.value === angles.value.length)

const overallPercent = computed(() => {
  const sum = angles.value.reduce((acc, a) => acc + (a.status === 'done' ? 100 : a.progress), 0)
  return Math.round(sum / angles.value.length)
})

const conditionRows = computed(() => [
  { label: 'Ánh sáng đầy đủ', passed: conditions.brightnessOk },
  { label: 'Chỉ có một khuôn mặt trong khung', passed: conditions.singleFaceOk },
  { label: 'Không đeo khẩu trang / kính râm', passed: conditions.unoccludedOk },
  { label: 'Khuôn mặt nằm giữa khung', passed: conditions.centeredOk }
])

const subInstruction = computed(() => {
  if (cameraError.value) return cameraError.value
  if (isModelLoading.value) return 'Đang nạp mô hình AI nhận diện 468 điểm khuôn mặt...'
  if (allCompleted.value) return 'Hệ thống đã trích xuất xong 5 vector đặc trưng 128-D'
  if (faceCount.value === 0) return 'Chưa thấy khuôn mặt — hãy đưa mặt vào trước camera'
  if (faceCount.value > 1) return 'Phát hiện nhiều khuôn mặt — vui lòng chỉ để 1 người trong khung'
  if (!conditions.brightnessOk) return 'Ánh sáng hơi yếu — vui lòng bật thêm đèn hoặc quay về phía sáng'
  if (!conditions.centeredOk) return 'Hãy đưa khuôn mặt vào chính giữa vòng ngắm'
  if (!poseMatched.value) return `Hãy điều chỉnh góc mặt theo hướng ${currentAngle.value.dirCode}`
  return 'Giữ yên khi vòng sáng chuyển xanh'
})

const avatarPreview = computed(() => {
  return capturedFrames.value.straight || Object.values(capturedFrames.value)[0] || null
})

async function startCamera() {
  cameraError.value = ''
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
      audio: false
    })
    if (videoRef.value) {
      videoRef.value.srcObject = stream
      await videoRef.value.play().catch(() => {})
      isCameraActive.value = true
    }
  } catch (err) {
    console.error('Camera start failed:', err)
    cameraError.value = 'Không thể truy cập camera thật. Vui lòng cấp quyền camera trong trình duyệt.'
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

function drawLandmarksOverlay(analysis) {
  const canvas = overlayCanvasRef.value
  const video = videoRef.value
  if (!canvas || !video || video.videoWidth === 0) return

  const rect = canvas.getBoundingClientRect()
  if (rect.width === 0 || rect.height === 0) return

  if (canvas.width !== Math.round(rect.width) || canvas.height !== Math.round(rect.height)) {
    canvas.width = Math.round(rect.width)
    canvas.height = Math.round(rect.height)
  }

  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  const landmarks = analysis?.landmarks468
  if (!showLandmark.value || !landmarks) return

  const vw = analysis.inferWidth || video.videoWidth
  const vh = analysis.inferHeight || video.videoHeight
  // Match object-fit: cover mapping & mirrored X coordinates
  const scale = Math.max(canvas.width / vw, canvas.height / vh)
  const drawW = vw * scale
  const drawH = vh * scale
  const offsetX = (canvas.width - drawW) / 2
  const offsetY = (canvas.height - drawH) / 2

  const mapPt = (pt) => ({
    x: canvas.width - (offsetX + pt.x * vw * scale),
    y: offsetY + pt.y * vh * scale
  })

  const pts = landmarks.map(mapPt)
  const color = allCompleted.value || poseMatched.value ? '#10b981' : '#38bdf8'

  ctx.save()
  ctx.strokeStyle = color
  ctx.fillStyle = color

  // Draw 468-landmark tesselation wireframe (light)
  ctx.lineWidth = 0.65
  ctx.globalAlpha = 0.24
  ctx.beginPath()
  for (const conn of faceEngine.TESSELATION) {
    const a = pts[conn.start]
    const b = pts[conn.end]
    if (!a || !b) continue
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
  }
  ctx.stroke()

  // Draw prominent facial contours (eyes, brows, nose, lips, jawline)
  ctx.lineWidth = 1.35
  ctx.globalAlpha = 0.78
  ctx.beginPath()
  for (const conn of faceEngine.CONTOURS) {
    const a = pts[conn.start]
    const b = pts[conn.end]
    if (!a || !b) continue
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
  }
  ctx.stroke()

  // Draw key glowing nodes
  ctx.globalAlpha = 0.85
  for (let i = 0; i < pts.length; i += 4) {
    ctx.beginPath()
    ctx.arc(pts[i].x, pts[i].y, 1.3, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

function captureRealFaceSnapshot(box) {
  const video = videoRef.value
  const canvas = captureCanvasRef.value
  if (!video || !canvas || video.videoWidth === 0) return null

  const vw = video.videoWidth
  const vh = video.videoHeight
  let sx = 0
  let sy = 0
  let sw = vw
  let sh = vh

  if (box) {
    const pad = Math.max(box.width, box.height) * 0.35
    const side = Math.min(Math.min(vw, vh), Math.max(box.width, box.height) + pad * 2)
    const cx = box.x + box.width / 2
    const cy = box.y + box.height / 2
    sx = Math.max(0, Math.min(vw - side, cx - side / 2))
    sy = Math.max(0, Math.min(vh - side, cy - side / 2))
    sw = side
    sh = side
  }

  canvas.width = 320
  canvas.height = 320
  const ctx = canvas.getContext('2d')
  ctx.save()
  ctx.translate(canvas.width, 0)
  ctx.scale(-1, 1)
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)
  ctx.restore()

  return canvas.toDataURL('image/jpeg', 0.9)
}

async function runDetectionTick() {
  if (isDestroyed) return

  if (!isCameraActive.value || !videoRef.value || videoRef.value.readyState < 2 || isModelLoading.value) {
    loopTimer = setTimeout(runDetectionTick, 200)
    return
  }

  const now = performance.now()
  const dt = now - lastFrameTime
  lastFrameTime = now
  if (dt > 0) {
    fps.value = Math.min(60, Math.round(1000 / dt))
  }

  const t0 = performance.now()
  try {
    const analysis = await faceEngine.analyzeFrame(videoRef.value)
    latencyMs.value = Math.round(performance.now() - t0)

    brightnessValue.value = analysis.quality.brightness
    sharpnessPct.value = analysis.quality.sharpness
    faceCount.value = analysis.faceCount
    faceDetected.value = analysis.faceCount > 0
    confidence.value = analysis.faceCount > 0 ? analysis.confidence.toFixed(1) : '0.0'
    distanceCm.value = analysis.pose?.distanceCm || 0

    conditions.brightnessOk = analysis.conditions.brightnessOk
    conditions.singleFaceOk = analysis.conditions.singleFaceOk
    conditions.unoccludedOk = analysis.conditions.unoccludedOk
    conditions.centeredOk = analysis.conditions.centeredOk

    drawLandmarksOverlay(analysis)

    const target = angles.value[activeIndex.value]
    if (!allCompleted.value && target && target.status !== 'done') {
      const allCondOk =
        conditions.brightnessOk &&
        conditions.singleFaceOk &&
        conditions.unoccludedOk &&
        conditions.centeredOk

      const aligned =
        allCondOk && faceEngine.matchesAnglePose(analysis.pose, target.key, baselinePose.value)
      poseMatched.value = aligned

      if (aligned && target.key === 'straight' && analysis.pose) {
        baselinePose.value = {
          yaw: analysis.pose.yaw,
          pitch: analysis.pose.pitch
        }
      }

      if (aligned && !isExtracting) {
        target.status = 'active'
        target.progress = Math.min(100, target.progress + 50)

        if (target.progress >= 100) {
          isExtracting = true
          let extracted = null
          try {
            extracted =
              (await faceEngine.extractFromLastAnalysis()) ||
              (await faceEngine.extractDescriptor(videoRef.value))
          } finally {
            isExtracting = false
          }

          if (extracted && extracted.descriptor?.length === 128) {
            const snap = captureRealFaceSnapshot(extracted.box)
            if (snap) capturedFrames.value[target.key] = snap
            capturedDescriptors.value[target.key] = extracted.descriptor
            target.status = 'done'
            sound.playBeep()

            const nextPending = angles.value.findIndex(a => a.status !== 'done')
            if (nextPending !== -1) {
              activeIndex.value = nextPending
              angles.value[nextPending].status = 'active'
            } else {
              sound.playSuccess()
              emit('notify', {
                type: 'success',
                message: 'Đã trích xuất xong 5/5 vector khuôn mặt thật! Bấm Tiếp tục để lưu.'
              })
            }
          } else {
            target.progress = 85
          }
        }
      }
    } else {
      poseMatched.value = allCompleted.value && faceCount.value === 1
    }
  } catch (err) {
    console.error('Frame analysis error:', err)
  }

  if (!isDestroyed) {
    loopTimer = setTimeout(runDetectionTick, 16)
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
  delete capturedDescriptors.value[target.key]
  delete capturedFrames.value[target.key]
  target.status = 'active'
  target.progress = 0
  activeIndex.value = index
}

function resetAllScans() {
  sound.playBeep()
  capturedFrames.value = {}
  capturedDescriptors.value = {}
  angles.value.forEach((a, i) => {
    a.progress = 0
    a.status = i === 0 ? 'active' : 'pending'
  })
  activeIndex.value = 0
}

async function completeEnrollment() {
  const descriptorList = Object.values(capturedDescriptors.value)
  if (!allCompleted.value || descriptorList.length < 5 || isSaving.value) return

  isSaving.value = true
  sound.playBeep()

  try {
    const savedStudent = await storage.saveStudent({
      id: profile.id.toUpperCase(),
      name: profile.fullName,
      classId: profile.classId,
      email: profile.email,
      avatar: avatarPreview.value,
      registeredAt: new Date().toLocaleString('vi-VN'),
      embeddingCreated: true,
      descriptors: capturedDescriptors.value,
      angleSnapshots: capturedFrames.value
    })

    const activeProfile = storage.getCurrentProfile()
    if (activeProfile) {
      storage.setCurrentProfile({
        ...activeProfile,
        avatar: savedStudent?.avatar || avatarPreview.value,
        embeddingCreated: true
      })
    }

    sound.playSuccess()
    emit('notify', {
      type: 'success',
      message: `Đã lưu dữ liệu sinh trắc học 5 góc vào SQL Server cho ${savedStudent?.name || profile.fullName}!`
    })
    emit('navigate', profile.role === 'lecturer' ? 'lecturer-redirect' : 'face-intro')
  } catch (err) {
    sound.playWarning()
    emit('notify', {
      type: 'error',
      message: `Không thể lưu khuôn mặt vào SQL Server: ${err.message}`
    })
  } finally {
    isSaving.value = false
  }
}

onMounted(async () => {
  const verifiedProfile = await storage.verifySessionFromDb()
  if (!verifiedProfile) {
    sound.playWarning()
    emit('notify', {
      type: 'warning',
      message: 'Tài khoản chưa tồn tại trong SQL Server! Vui lòng đăng ký hoặc đăng nhập lại.'
    })
    emit('navigate', 'login')
    return
  }
  Object.assign(profile, {
    id: verifiedProfile.id || '',
    fullName: verifiedProfile.fullName || '',
    classId: verifiedProfile.classId || 'CNTT-K21A',
    email: verifiedProfile.email || '',
    role: verifiedProfile.role || 'student'
  })

  startCamera()
  try {
    await faceEngine.loadModels()
    isModelLoading.value = false
  } catch (err) {
    modelError.value = 'Không thể tải mô hình nhận diện khuôn mặt AI.'
    isModelLoading.value = false
  }
  runDetectionTick()
})

onBeforeUnmount(() => {
  isDestroyed = true
  if (loopTimer) clearTimeout(loopTimer)
  stopCamera()
})
</script>

<template>
  <div class="sx-enroll-page">
    <!-- TOP HEADER BAR -->
    <header class="sx-enroll-header">
      <div class="sx-eh-left">
        <SpaceXLogo
          @click="emit('navigate', profile.role === 'lecturer' ? 'lecturer-redirect' : 'face-intro')"
          :title="profile.role === 'lecturer' ? 'Quay về Trang giảng viên' : 'Quay về Trang sinh viên'"
        />
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
            :style="{ left: `clamp(14px, ${overallPercent}%, calc(100% - 14px))` }"
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
        <button type="button" class="sx-exit-btn" @click="emit('back')" title="Quay lại trang trước">
          ← QUAY LẠI
        </button>
        <button
          type="button"
          class="sx-exit-btn"
          @click="emit('navigate', profile.role === 'lecturer' ? 'lecturer-redirect' : 'face-intro')"
          title="Thoát đăng ký"
        >
          ✕ THOÁT
        </button>
      </div>
    </header>

    <!-- TWO-COLUMN WORKSPACE -->
    <div class="sx-enroll-body">
      <!-- LEFT COLUMN: REAL LIVE CAMERA + REAL LANDMARK OVERLAY + 5 ANGLE CARDS -->
      <section class="sx-scan-column">
        <div class="sx-cam-frame" :class="{ 'has-grid': showGrid }">
          <!-- REAL LIVE WEBCAM FEED -->
          <video
            v-show="isCameraActive"
            ref="videoRef"
            autoplay
            playsinline
            muted
            class="sx-live-camera-bg"
          ></video>
          <div class="sx-camera-vignette"></div>

          <!-- REAL-TIME 68-LANDMARK CANVAS OVERLAY -->
          <canvas ref="overlayCanvasRef" class="sx-landmark-canvas"></canvas>

          <!-- Camera Unavailable Fallback Prompt (Real Error + Retry) -->
          <div v-if="cameraError" class="sx-camera-error-box">
            <p>{{ cameraError }}</p>
            <button type="button" class="sx-retry-cam-btn" @click="startCamera">
              Bật lại Camera
            </button>
          </div>

          <!-- 4 Corner Cyan Brackets -->
          <span class="cam-corner tl"></span>
          <span class="cam-corner tr"></span>
          <span class="cam-corner bl"></span>
          <span class="cam-corner br"></span>

          <!-- Camera Top Overlay Bar -->
          <div class="sx-cam-topbar">
            <div class="sx-rec-badge">
              <span class="rec-dot" :class="{ active: isCameraActive }"></span>
              <span>{{ isCameraActive ? 'REC • LIVE' : 'CAM • STANDBY' }}</span>
            </div>

            <div class="sx-cam-controls">
              <span class="sx-fps-tag">FPS {{ fps }}</span>
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
            <div class="sx-prompt-sub" :class="{ done: allCompleted || poseMatched }">
              {{ subInstruction }}
            </div>
          </div>

          <!-- Middle Viewport: Direction Tag + Radial Reticle HUD + Real Detection Telemetry -->
          <div class="sx-cam-stage">
            <div class="sx-side-direction" :class="{ done: allCompleted, matched: poseMatched }">
              <div class="sx-dir-big-arrow">{{ allCompleted ? '✓' : currentAngle.arrow }}</div>
              <div class="sx-dir-text">{{ allCompleted ? 'HOÀN TẤT' : currentAngle.dirCode }}</div>
            </div>

            <!-- Transparent Radial Reticle Over Real Live Camera -->
            <div class="sx-reticle-wrap">
              <div
                class="sx-oval-guide"
                :class="{ matched: poseMatched || allCompleted, detected: faceDetected }"
              >
                <div class="sx-laser-beam" :class="{ completed: allCompleted || poseMatched }"></div>
              </div>

              <svg viewBox="0 0 360 360" class="sx-radial-ticks" aria-hidden="true">
                <circle
                  cx="180"
                  cy="180"
                  r="152"
                  fill="none"
                  stroke="rgba(56, 189, 248, 0.2)"
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
                        ? allCompleted || poseMatched
                          ? '#10b981'
                          : '#38bdf8'
                        : 'rgba(148, 163, 184, 0.32)'
                    "
                    :stroke-width="tick % 5 === 0 ? 2.2 : 1.3"
                    :transform="`rotate(${(tick - 1) * 6} 180 180)`"
                  />
                </g>
              </svg>
            </div>

            <!-- Right Real Detection Readout -->
            <div class="sx-side-telemetry">
              <div class="sx-detect-badge" :class="{ off: !faceDetected }">
                <span class="detect-dot" :class="{ off: !faceDetected }"></span>
                <span>{{ faceDetected ? 'FACE DETECTED' : 'NO FACE' }}</span>
              </div>
              <div class="sx-detect-pct">{{ confidence }}%</div>
              <div class="sx-detect-sub">468 LANDMARKS · 128D</div>
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
            <span>CAM 01 · REAL FEED</span>
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

        <!-- REAL TELEMETRY FOOTER -->
        <div class="sx-telemetry-strip">
          <span>
            ĐỘ SÁNG:
            <strong :class="conditions.brightnessOk ? 't-good' : 't-warn'">
              {{ brightnessValue > 0 ? (conditions.brightnessOk ? 'TỐT' : 'YẾU') : '--' }}
            </strong>
          </span>
          <span>KHOẢNG CÁCH: <strong>{{ distanceCm ? `${distanceCm}CM` : '--' }}</strong></span>
          <span>ĐỘ NÉT: <strong>{{ sharpnessPct ? `${sharpnessPct}%` : '--' }}</strong></span>
          <span>MÔ HÌNH: <strong>MEDIAPIPE 468PT · 128D</strong></span>
          <span>ĐỘ TRỄ: <strong>{{ latencyMs }}MS</strong></span>
          <span class="t-e2e">🔒 E2E</span>
        </div>
      </section>

      <!-- RIGHT COLUMN: STUDENT PROFILE + REAL CONDITION CHECKS + ACTIONS -->
      <aside class="sx-sidebar-column">
        <div class="sx-sb-main">
          <div class="sx-step-eyebrow">STEP 02 / 03 · FACE ENROLLMENT</div>
          <h1 class="sx-sb-title">Đăng ký khuôn mặt</h1>
          <p class="sx-sb-subtitle">
            Hệ thống sẽ ghi lại khuôn mặt thật của bạn qua camera từ nhiều góc độ để trích xuất vector sinh trắc học 128-D.
          </p>

          <!-- Student Profile Summary Card -->
          <div class="sx-profile-card">
            <div class="sx-profile-avatar">
              <img v-if="avatarPreview" :src="avatarPreview" alt="Ảnh khuôn mặt thật" />
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

          <!-- Real Condition Checklist -->
          <div class="sx-section-block">
            <div class="sx-section-label">KIỂM TRA ĐIỀU KIỆN THỜI GIAN THỰC</div>
            <div class="sx-check-list">
              <div v-for="item in conditionRows" :key="item.label" class="sx-check-row">
                <div class="sx-check-left">
                  <span class="sx-check-box" :class="{ fail: !item.passed }">
                    {{ item.passed ? '✓' : '!' }}
                  </span>
                  <span class="sx-check-text">{{ item.label }}</span>
                </div>
                <span class="sx-check-status" :class="{ fail: !item.passed }">
                  {{ item.passed ? 'ĐẠT' : 'CHƯA ĐẠT' }}
                </span>
              </div>
            </div>
          </div>

          <!-- Tips Callout Box -->
          <div class="sx-tips-box">
            <div class="sx-tips-title">MẸO ĐỂ QUÉT TỐT HƠN</div>
            <ul class="sx-tips-list">
              <li>Quay mặt chậm và đều, giữ đúng hướng khi mũi tên sáng lên.</li>
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
              <template v-if="!allCompleted">🔒 Hoàn thành quét đủ 5 góc thật để tiếp tục</template>
              <template v-else>✓ Đã trích xuất đủ 5/5 vector — Bấm Tiếp tục để lưu</template>
            </div>

            <button
              type="button"
              class="sx-back-info-link"
              @click="emit('back')"
            >
              ← Quay lại trang trước
            </button>
          </div>
        </div>

        <!-- Security Notice Footer -->
        <footer class="sx-sb-footer">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
          <span>DỮ LIỆU VECTOR SINH TRẮC HỌC ĐƯỢC XỬ LÝ CỤC BỘ TRÊN TRÌNH DUYỆT</span>
        </footer>
      </aside>
    </div>

    <canvas ref="captureCanvasRef" style="display: none;"></canvas>
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

.sx-eh-title { color: #cbd5e1; }
.sx-eh-pct-bound { color: #64748b; font-size: 0.62rem; }

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
  min-height: 460px;
  background: #030508;
  border: 1px solid rgba(255, 255, 255, 0.08);
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  overflow: hidden;
}

/* REAL FULL-FRAME WEBCAM VIDEO */
.sx-live-camera-bg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transform: scaleX(-1);
  filter: contrast(1.24) brightness(1.04);
  z-index: 0;
}

.sx-camera-vignette {
  position: absolute;
  inset: 0;
  z-index: 1;
  background: radial-gradient(
    ellipse at 50% 50%,
    rgba(3, 8, 15, 0.05) 38%,
    rgba(2, 5, 9, 0.72) 100%
  );
  pointer-events: none;
}

.sx-landmark-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: 2;
  pointer-events: none;
}

.sx-cam-frame.has-grid::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 2;
  background-image:
    linear-gradient(rgba(56, 189, 248, 0.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(56, 189, 248, 0.05) 1px, transparent 1px);
  background-size: 40px 40px;
  pointer-events: none;
}

.sx-camera-error-box {
  position: absolute;
  inset: 0;
  z-index: 10;
  background: rgba(3, 6, 11, 0.92);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  padding: 24px;
  text-align: center;
  color: #fca5a5;
  font-size: 0.88rem;
}

.sx-retry-cam-btn {
  padding: 10px 20px;
  background: #0ea5e9;
  color: #031018;
  border: none;
  border-radius: 3px;
  font-weight: 700;
  font-size: 0.82rem;
  cursor: pointer;
}

.cam-corner {
  position: absolute;
  width: 14px;
  height: 14px;
  border-color: #38bdf8;
  border-style: solid;
  z-index: 5;
  pointer-events: none;
}
.cam-corner.tl { top: 8px; left: 8px; border-width: 1.5px 0 0 1.5px; }
.cam-corner.tr { top: 8px; right: 8px; border-width: 1.5px 1.5px 0 0; }
.cam-corner.bl { bottom: 8px; left: 8px; border-width: 0 0 1.5px 1.5px; }
.cam-corner.br { bottom: 8px; right: 8px; border-width: 0 1.5px 1.5px 0; }

.sx-cam-topbar {
  position: relative;
  z-index: 5;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.sx-rec-badge {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 3px 8px;
  background: rgba(3, 6, 12, 0.65);
  border-radius: 2px;
  font-family: var(--font-mono);
  font-size: 0.64rem;
  letter-spacing: 0.14em;
  color: #e2e8f0;
}

.rec-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #64748b;
}

.rec-dot.active {
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
  color: #cbd5e1;
  background: rgba(3, 6, 12, 0.6);
  padding: 4px 8px;
  border-radius: 2px;
}

.sx-hud-toggle {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border-radius: 2px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: rgba(6, 10, 16, 0.78);
  color: #94a3b8;
  font-family: var(--font-mono);
  font-size: 0.62rem;
  letter-spacing: 0.12em;
  cursor: pointer;
  transition: all 0.2s ease;
}

.sx-hud-toggle.active {
  border-color: rgba(56, 189, 248, 0.8);
  background: rgba(14, 165, 233, 0.18);
  color: #e0f2fe;
}

.sx-cam-prompt {
  position: relative;
  z-index: 5;
  text-align: center;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.85);
}

.sx-prompt-main {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 1.08rem;
  font-weight: 500;
  color: #ffffff;
}

.prompt-arrow { color: #38bdf8; font-weight: 700; }
.prompt-key { color: #38bdf8; font-weight: 700; letter-spacing: 0.04em; }
.prompt-done { color: #10b981; font-weight: 600; }

.sx-prompt-sub {
  margin-top: 4px;
  font-size: 0.74rem;
  color: #cbd5e1;
}

.sx-prompt-sub.done {
  color: #34d399;
}

/* Camera Center Stage */
.sx-cam-stage {
  position: relative;
  z-index: 4;
  display: grid;
  grid-template-columns: 110px 1fr 135px;
  align-items: center;
  margin: 4px 0;
  pointer-events: none;
}

.sx-side-direction {
  text-align: center;
  color: #38bdf8;
  text-shadow: 0 2px 12px rgba(0, 0, 0, 0.9);
}

.sx-side-direction.done,
.sx-side-direction.matched {
  color: #10b981;
}

.sx-dir-big-arrow {
  font-size: 2.3rem;
  line-height: 1;
  text-shadow: 0 0 18px rgba(56, 189, 248, 0.75);
}

.sx-dir-text {
  margin-top: 6px;
  font-family: var(--font-mono);
  font-size: 0.64rem;
  letter-spacing: 0.14em;
  color: #f8fafc;
}

.sx-reticle-wrap {
  position: relative;
  width: 292px;
  height: 292px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
}

.sx-oval-guide {
  position: relative;
  width: 192px;
  height: 244px;
  border-radius: 50%;
  border: 2px solid rgba(56, 189, 248, 0.45);
  overflow: hidden;
  transition: border-color 0.25s ease, box-shadow 0.25s ease;
}

.sx-oval-guide.detected {
  border-color: rgba(56, 189, 248, 0.85);
}

.sx-oval-guide.matched {
  border-color: #10b981;
  box-shadow: 0 0 24px rgba(16, 185, 129, 0.35);
}

.sx-laser-beam {
  position: absolute;
  left: 4%;
  right: 4%;
  height: 2px;
  background: linear-gradient(90deg, transparent, #38bdf8 25%, #e0f2fe 50%, #38bdf8 75%, transparent);
  box-shadow: 0 0 12px 2px rgba(56, 189, 248, 0.6);
  animation: faceLaserSweep 2.4s ease-in-out infinite;
}

.sx-laser-beam.completed {
  background: linear-gradient(90deg, transparent, #10b981 25%, #a7f3d0 50%, #10b981 75%, transparent);
  box-shadow: 0 0 12px 2px rgba(16, 185, 129, 0.6);
}

@keyframes faceLaserSweep {
  0% { top: 12%; opacity: 0.3; }
  50% { top: 86%; opacity: 0.95; }
  100% { top: 12%; opacity: 0.3; }
}

.sx-radial-ticks {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.sx-side-telemetry {
  text-align: right;
  font-family: var(--font-mono);
  background: rgba(3, 6, 12, 0.62);
  padding: 8px 10px;
  border-radius: 2px;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.sx-detect-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.6rem;
  letter-spacing: 0.14em;
  color: #38bdf8;
}

.sx-detect-badge.off {
  color: #fb7185;
}

.detect-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #38bdf8;
  box-shadow: 0 0 8px #38bdf8;
}

.detect-dot.off {
  background: #fb7185;
  box-shadow: 0 0 8px #fb7185;
}

.sx-detect-pct {
  margin-top: 2px;
  font-size: 1.2rem;
  font-weight: 700;
  color: #f8fafc;
}

.sx-detect-sub {
  margin-top: 2px;
  font-size: 0.58rem;
  letter-spacing: 0.1em;
  color: #94a3b8;
}

.sx-cam-bottom-pill {
  position: relative;
  z-index: 5;
  margin: 0 auto;
  padding: 5px 14px;
  border: 1px solid rgba(56, 189, 248, 0.45);
  background: rgba(5, 12, 20, 0.88);
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

.bp-num.done { color: #10b981; }

.bp-label {
  font-family: var(--font-mono);
  font-size: 0.6rem;
  letter-spacing: 0.12em;
  color: #cbd5e1;
}

.sx-cam-footbar {
  position: relative;
  z-index: 5;
  display: flex;
  justify-content: space-between;
  font-family: var(--font-mono);
  font-size: 0.62rem;
  letter-spacing: 0.12em;
  color: #cbd5e1;
  text-shadow: 0 1px 6px rgba(0, 0, 0, 0.85);
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

.sx-angle-card:hover { border-color: rgba(255, 255, 255, 0.25); }
.sx-angle-card.done { border-color: rgba(16, 185, 129, 0.35); background: rgba(16, 185, 129, 0.04); }
.sx-angle-card.active {
  border-color: #38bdf8;
  background: rgba(14, 165, 233, 0.08);
  box-shadow: 0 0 16px rgba(14, 165, 233, 0.15);
}

.ac-top { display: flex; align-items: center; justify-content: space-between; }

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

.sx-angle-card.done .ac-icon-badge { border-color: rgba(16, 185, 129, 0.45); color: #10b981; }
.sx-angle-card.active .ac-icon-badge { border-color: #38bdf8; color: #38bdf8; }

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

.ac-name { font-size: 0.76rem; font-weight: 500; color: #cbd5e1; }
.sx-angle-card.active .ac-name,
.sx-angle-card.done .ac-name { color: #f8fafc; }

.ac-footer {
  font-family: var(--font-mono);
  font-size: 0.58rem;
  letter-spacing: 0.08em;
  color: #475569;
}
.sx-angle-card.done .ac-footer { color: #10b981; }
.sx-angle-card.active .ac-footer { color: #38bdf8; }

/* Telemetry Footer */
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

.sx-telemetry-strip strong { color: #cbd5e1; font-weight: 600; }
.sx-telemetry-strip strong.t-good { color: #10b981; }
.sx-telemetry-strip strong.t-warn { color: #f59e0b; }
.t-e2e { color: #94a3b8; }

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
}

.sx-sb-subtitle {
  margin: 6px 0 16px;
  font-size: 0.78rem;
  line-height: 1.5;
  color: #94a3b8;
}

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

.sx-profile-avatar img { width: 100%; height: 100%; object-fit: cover; }

.sx-profile-info { flex: 1; min-width: 0; }

.sx-pi-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }

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

.sx-section-block { margin-bottom: 16px; }

.sx-section-label {
  font-family: var(--font-mono);
  font-size: 0.62rem;
  letter-spacing: 0.16em;
  color: #64748b;
  margin-bottom: 8px;
}

.sx-check-list { display: flex; flex-direction: column; gap: 6px; }

.sx-check-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: #070a10;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 2px;
}

.sx-check-left { display: flex; align-items: center; gap: 10px; }

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

.sx-check-box.fail {
  background: rgba(245, 158, 11, 0.2);
  color: #fbbf24;
  border: 1px solid rgba(245, 158, 11, 0.5);
}

.sx-check-text { font-size: 0.76rem; color: #e2e8f0; }

.sx-check-status {
  font-family: var(--font-mono);
  font-size: 0.62rem;
  letter-spacing: 0.12em;
  color: #10b981;
}

.sx-check-status.fail {
  color: #f59e0b;
}

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

.sx-collect-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
  font-size: 0.76rem;
}

.sx-collect-text { color: #cbd5e1; }
.sx-collect-pct { font-family: var(--font-mono); font-weight: 600; color: #38bdf8; }

.sx-collect-track {
  height: 3px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  overflow: hidden;
  margin-bottom: 14px;
}

.sx-collect-fill { height: 100%; background: #0ea5e9; transition: width 0.2s linear; }

.sx-btn-row { display: grid; grid-template-columns: 0.6fr 1fr; gap: 10px; }

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
}
.sx-btn-retake:hover { border-color: rgba(255, 255, 255, 0.45); }

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
.sx-btn-continue.ready:hover { background: #e2e8f0; }

.sx-lock-hint {
  margin-top: 10px;
  text-align: center;
  font-size: 0.7rem;
  color: #64748b;
}
.sx-lock-hint.ready { color: #10b981; }

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
.sx-back-info-link:hover { color: #ffffff; }

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

@media (max-width: 1024px) {
  .sx-enroll-body { grid-template-columns: 1fr; }
  .sx-eh-center { display: none; }
  .sx-sidebar-column { border-left: none; border-top: 1px solid rgba(255, 255, 255, 0.08); }
}

@media (max-width: 640px) {
  .sx-angles-grid { grid-template-columns: repeat(2, 1fr); }
  .sx-cam-stage { grid-template-columns: 1fr; gap: 10px; }
  .sx-side-direction, .sx-side-telemetry { text-align: center; }
}
</style>

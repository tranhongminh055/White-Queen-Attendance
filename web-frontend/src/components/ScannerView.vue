<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { storage } from '../utils/storage'
import { sound } from '../utils/sound'

const emit = defineEmits(['notify', 'update:stats'])

const classes = ref(storage.getClasses())
const selectedClassId = ref(classes.value[0]?.id || 'CS101')

const videoRef = ref(null)
const canvasRef = ref(null)
const isCameraActive = ref(false)
const autoScanEnabled = ref(true)
const isScanning = ref(false)
const cameraError = ref(null)

// Current matched student state
const lastMatched = ref(null)
const matchStatus = ref(null) // 'success' | 'duplicate' | 'searching'

// Live Attendance Logs
const logs = ref([])
const students = ref([])

function refreshData() {
  students.value = storage.getStudents()
  logs.value = storage.getAttendanceLogs(selectedClassId.value)
  updateParentStats()
}

const currentClassStudents = computed(() => {
  return students.value.filter(s => s.classId === selectedClassId.value)
})

const attendanceStats = computed(() => {
  const total = currentClassStudents.value.length
  const present = logs.value.length
  const percentage = total > 0 ? Math.round((present / total) * 100) : 0
  return { total, present, percentage }
})

function updateParentStats() {
  emit('update:stats', {
    present: attendanceStats.value.present,
    total: attendanceStats.value.total
  })
}

// Camera controls
async function startCamera() {
  cameraError.value = null
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: 'user'
      },
      audio: false
    })
    if (videoRef.value) {
      videoRef.value.srcObject = stream
      isCameraActive.value = true
    }
  } catch (err) {
    console.error('Camera error in Scanner:', err)
    cameraError.value = 'Không thể mở camera iPad. Vui lòng cấp quyền truy cập camera.'
    isCameraActive.value = false
  }
}

function stopCamera() {
  if (videoRef.value && videoRef.value.srcObject) {
    const stream = videoRef.value.srcObject
    const tracks = stream.getTracks()
    tracks.forEach(track => track.stop())
    videoRef.value.srcObject = null
  }
  isCameraActive.value = false
}

// Recognition Process
let autoScanTimer = null

function triggerScan() {
  if (isScanning.value) return
  isScanning.value = true
  matchStatus.value = 'searching'

  // Capture frame if camera active
  if (isCameraActive.value && videoRef.value && canvasRef.value) {
    const canvas = canvasRef.value
    const video = videoRef.value
    canvas.width = 320
    canvas.height = 240
    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
  }

  // Matching logic (Local Mock or API)
  setTimeout(() => {
    performMatch()
    isScanning.value = false
  }, 450)
}

function performMatch(targetStudent = null) {
  // If target specified (e.g. demo button) or pick random from un-attended
  const classStudents = currentClassStudents.value
  if (classStudents.length === 0) {
    matchStatus.value = null
    return
  }

  let candidate = targetStudent
  if (!candidate) {
    // Find students not yet attended
    const unChecked = classStudents.filter(s => !logs.value.some(l => l.studentId === s.id))
    if (unChecked.length > 0) {
      candidate = unChecked[Math.floor(Math.random() * unChecked.length)]
    } else {
      // Pick any to demonstrate duplicate detection
      candidate = classStudents[Math.floor(Math.random() * classStudents.length)]
    }
  }

  if (!candidate) return

  const result = storage.recordAttendance({
    studentId: candidate.id,
    studentName: candidate.name,
    classId: candidate.classId,
    avatar: candidate.avatar
  })

  lastMatched.value = {
    ...candidate,
    confidence: (96 + Math.random() * 3.5).toFixed(1) + '%',
    timestamp: new Date().toLocaleTimeString('vi-VN'),
    alreadyMarked: !result.success
  }

  if (result.success) {
    matchStatus.value = 'success'
    sound.playSuccess()
    emit('notify', { 
      type: 'success', 
      message: `[Điểm danh] ${candidate.name} (${candidate.id}) - Có mặt!` 
    })
  } else {
    matchStatus.value = 'duplicate'
    sound.playWarning()
    emit('notify', { 
      type: 'warning', 
      message: `${candidate.name} đã được điểm danh trước đó.` 
    })
  }

  refreshData()

  // Reset match status badge after 3.5s
  setTimeout(() => {
    if (matchStatus.value !== 'searching') {
      matchStatus.value = null
    }
  }, 3500)
}

function toggleAutoScan() {
  autoScanEnabled.value = !autoScanEnabled.value
  if (autoScanEnabled.value) {
    startAutoScanLoop()
  } else {
    stopAutoScanLoop()
  }
}

function startAutoScanLoop() {
  stopAutoScanLoop()
  autoScanTimer = setInterval(() => {
    if (isCameraActive.value && autoScanEnabled.value && !isScanning.value) {
      // Simulates real-time face detection trigger when person is in front
      // 30% chance per interval to match a student if un-attended students exist
      const unChecked = currentClassStudents.value.filter(s => !logs.value.some(l => l.studentId === s.id))
      if (unChecked.length > 0) {
        triggerScan()
      }
    }
  }, 3000)
}

function stopAutoScanLoop() {
  if (autoScanTimer) {
    clearInterval(autoScanTimer)
    autoScanTimer = null
  }
}

function simulateStudentScan(student) {
  performMatch(student)
}

onMounted(() => {
  refreshData()
  startCamera()
  if (autoScanEnabled.value) {
    startAutoScanLoop()
  }
})

onBeforeUnmount(() => {
  stopCamera()
  stopAutoScanLoop()
})
</script>

<template>
  <div class="scanner-page">
    <!-- Top Bar for iPad View -->
    <div class="scanner-toolbar glass-panel">
      <div class="class-selector">
        <label for="class-select" class="selector-label">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/>
            <path d="M6 6h10"/>
            <path d="M6 10h10"/>
          </svg>
          <span>Lớp điểm danh:</span>
        </label>
        <select 
          id="class-select" 
          v-model="selectedClassId" 
          @change="refreshData" 
          class="class-dropdown"
        >
          <option v-for="cls in classes" :key="cls.id" :value="cls.id">
            {{ cls.name }}
          </option>
        </select>
      </div>

      <div class="scanner-actions">
        <button 
          class="btn" 
          :class="autoScanEnabled ? 'btn-success' : 'btn-secondary'"
          @click="toggleAutoScan"
          id="btn-toggle-autoscan"
        >
          <span class="live-dot" :class="{ 'live-dot-active': autoScanEnabled }"></span>
          <span>Tự động quét: {{ autoScanEnabled ? 'BẬT' : 'TẮT' }}</span>
        </button>

        <button 
          class="btn btn-primary" 
          :disabled="isScanning"
          @click="triggerScan"
          id="btn-scan-now"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <path d="m10 15 5-3-5-3v6Z"/>
          </svg>
          <span>Quét ngay</span>
        </button>
      </div>
    </div>

    <!-- Main iPad Split View: Camera Stage on Left, Realtime Feed on Right -->
    <div class="scanner-layout">
      <!-- Camera Stage -->
      <div class="scanner-stage glass-panel">
        <div class="stage-header">
          <div class="stage-tag">
            <span class="badge badge-live">iPad Scanner Pro</span>
            <span class="model-tag">ArcFace 512D AI Engine</span>
          </div>
          <div class="camera-switch">
            <button class="cam-btn" @click="isCameraActive ? stopCamera() : startCamera()">
              {{ isCameraActive ? 'Tắt Cam' : 'Bật Cam' }}
            </button>
          </div>
        </div>

        <div class="viewport-box" :class="{ 'matched-success': matchStatus === 'success', 'matched-duplicate': matchStatus === 'duplicate' }">
          <!-- Realtime Live Video -->
          <video 
            ref="videoRef" 
            autoplay 
            playsinline 
            muted 
            class="viewport-video"
            :class="{ hidden: !isCameraActive }"
          ></video>

          <canvas ref="canvasRef" style="display: none;"></canvas>

          <!-- Fallback if camera off -->
          <div v-if="!isCameraActive" class="viewport-placeholder">
            <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" class="placeholder-icon">
              <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/>
              <circle cx="12" cy="13" r="3"/>
            </svg>
            <p class="placeholder-text">{{ cameraError || 'Camera đang tắt' }}</p>
            <button class="btn btn-primary" @click="startCamera">Kích hoạt Camera</button>
          </div>

          <!-- Laser Scan Line -->
          <div v-if="isCameraActive && autoScanEnabled" class="scan-line"></div>

          <!-- SpaceX Live Watermark Overlay -->
          <div v-if="isCameraActive" class="spacex-camera-watermark">
            <svg viewBox="0 0 24 24" fill="currentColor" class="watermark-rocket-icon">
              <path d="M24 7.417C8.882 8.287 1.89 14.75.321 16.28L0 16.583h2.797C10.356 9.005 21.222 7.663 24 7.417zm-17.046 6.35c-.472.321-.945.68-1.398 1.02l2.457 1.796h2.778zM2.948 10.8H.189l3.25 2.381c.473-.321 1.02-.661 1.512-.945Z"/>
            </svg>
            <span>SPACEX SECURE BIO-SCAN</span>
          </div>

          <!-- Face Detection Box Overlay -->
          <div v-if="isCameraActive" class="face-target-box" :class="{ 'target-locked': matchStatus === 'success' }">
            <div class="box-corner top-left"></div>
            <div class="box-corner top-right"></div>
            <div class="box-corner bottom-left"></div>
            <div class="box-corner bottom-right"></div>
            <div class="target-radar-pulse"></div>
            
            <div class="target-tag">
              <span v-if="matchStatus === 'searching'">Đang phân tích khuôn mặt...</span>
              <span v-else-if="matchStatus === 'success'">Khuôn mặt hợp lệ ✓</span>
              <span v-else-if="matchStatus === 'duplicate'">Đã có mặt ⚠</span>
              <span v-else>Đưa khuôn mặt vào khung quét</span>
            </div>
          </div>

          <!-- Floating Result Popup on Success -->
          <transition name="pop">
            <div v-if="lastMatched && matchStatus" class="attendance-popup" :class="matchStatus">
              <div class="popup-avatar">
                <img :src="lastMatched.avatar" :alt="lastMatched.name" />
                <div class="popup-badge-icon">
                  <span v-if="matchStatus === 'success'">✓</span>
                  <span v-else>!</span>
                </div>
              </div>
              <div class="popup-details">
                <div class="popup-status">
                  {{ matchStatus === 'success' ? 'ĐIỂM DANH THÀNH CÔNG' : 'ĐÃ ĐIỂM DANH TRƯỚC ĐÓ' }}
                </div>
                <div class="popup-name">{{ lastMatched.name }}</div>
                <div class="popup-meta">
                  <span class="popup-id">{{ lastMatched.id }}</span>
                  <span class="popup-time">{{ lastMatched.timestamp }}</span>
                  <span class="popup-conf">Độ khớp: {{ lastMatched.confidence }}</span>
                </div>
              </div>
            </div>
          </transition>
        </div>

        <!-- Quick Interactive Demo Toolbar -->
        <div class="stage-footer">
          <div class="demo-trigger-label">
            <span>Thử nghiệm nhanh:</span>
            <small>Bấm để giả lập sinh viên bước vào trước camera</small>
          </div>
          <div class="demo-pills">
            <button 
              v-for="st in currentClassStudents.slice(0, 4)" 
              :key="st.id"
              class="demo-pill-btn"
              @click="simulateStudentScan(st)"
            >
              <img :src="st.avatar" class="pill-avatar" />
              <span>{{ st.name.split(' ').slice(-1)[0] }}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Realtime Attendance Feed on Right -->
      <div class="scanner-sidebar glass-panel">
        <div class="sidebar-header">
          <h2 class="sidebar-title">Danh Sách Có Mặt Hôm Nay</h2>
          <div class="attendance-meter">
            <div class="meter-labels">
              <span>Sĩ số: {{ attendanceStats.present }}/{{ attendanceStats.total }}</span>
              <span class="meter-pct">{{ attendanceStats.percentage }}%</span>
            </div>
            <div class="meter-bar">
              <div class="meter-fill" :style="{ width: attendanceStats.percentage + '%' }"></div>
            </div>
          </div>
        </div>

        <!-- Scrollable Student Attendance Feed -->
        <div class="attendance-feed">
          <div v-if="logs.length === 0" class="empty-feed">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 6v6l4 2"/>
            </svg>
            <p>Chưa có sinh viên nào điểm danh cho lớp này.</p>
            <small>Hãy đứng trước camera iPad hoặc bấm Quét để bắt đầu.</small>
          </div>

          <transition-group name="list" tag="div" class="feed-list">
            <div 
              v-for="log in logs" 
              :key="log.id" 
              class="feed-item"
            >
              <div class="feed-avatar-wrap">
                <img :src="log.avatar" :alt="log.studentName" class="feed-avatar" />
                <span class="feed-check-icon">✓</span>
              </div>
              <div class="feed-info">
                <div class="feed-top">
                  <span class="feed-name">{{ log.studentName }}</span>
                  <span class="feed-time">{{ log.timestamp.split(' ')[0] }}</span>
                </div>
                <div class="feed-bottom">
                  <span class="feed-id">{{ log.studentId }}</span>
                  <span class="feed-conf">{{ log.confidence }}</span>
                </div>
              </div>
            </div>
          </transition-group>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.scanner-page {
  max-width: 1440px;
  margin: 0 auto;
  padding: 20px 24px 40px;
}

/* Toolbar */
.scanner-toolbar {
  padding: 14px 20px;
  margin-bottom: 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
}

.class-selector {
  display: flex;
  align-items: center;
  gap: 12px;
}

.selector-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-muted);
}

.class-dropdown {
  background: rgba(15, 23, 42, 0.8);
  border: 1px solid var(--border-subtle);
  color: var(--text-main);
  padding: 8px 14px;
  border-radius: var(--radius-md);
  font-size: 0.95rem;
  font-weight: 600;
  outline: none;
  cursor: pointer;
}
.class-dropdown:focus {
  border-color: var(--primary-light);
}

.scanner-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.live-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--text-dim);
}

.live-dot-active {
  background: #34d399;
  box-shadow: 0 0 0 3px rgba(52, 211, 153, 0.3);
  animation: pulse-ring 1.5s infinite;
}

/* Layout */
.scanner-layout {
  display: grid;
  grid-template-columns: 1fr 380px;
  gap: 20px;
  align-items: start;
}

/* Camera Stage */
.scanner-stage {
  padding: 20px;
  display: flex;
  flex-direction: column;
}

.stage-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
}

.stage-tag {
  display: flex;
  align-items: center;
  gap: 10px;
}

.model-tag {
  font-size: 0.75rem;
  font-family: var(--font-mono);
  color: var(--cyan-neon);
  background: rgba(6, 182, 212, 0.1);
  padding: 3px 8px;
  border-radius: var(--radius-sm);
  border: 1px solid rgba(6, 182, 212, 0.25);
}

.cam-btn {
  background: transparent;
  border: 1px solid var(--border-subtle);
  color: var(--text-muted);
  padding: 4px 10px;
  border-radius: var(--radius-sm);
  font-size: 0.775rem;
  cursor: pointer;
}
.cam-btn:hover {
  color: var(--text-main);
  border-color: rgba(255, 255, 255, 0.25);
}

/* Viewport */
.viewport-box {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 10;
  background: #030712;
  border-radius: var(--radius-md);
  overflow: hidden;
  border: 2px solid var(--border-subtle);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: border-color 0.4s, box-shadow 0.4s;
}

.viewport-box.matched-success {
  border-color: #10b981;
  box-shadow: 0 0 30px rgba(16, 185, 129, 0.4);
}

.viewport-box.matched-duplicate {
  border-color: #f59e0b;
  box-shadow: 0 0 30px rgba(245, 158, 11, 0.4);
}

/* SpaceX Camera Watermark */
.spacex-camera-watermark {
  position: absolute;
  top: 14px;
  left: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: var(--font-mono);
  font-size: 0.725rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: rgba(255, 255, 255, 0.65);
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  padding: 5px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid rgba(255, 255, 255, 0.12);
  pointer-events: none;
  z-index: 20;
}

.watermark-rocket-icon {
  width: 15px;
  height: 15px;
  color: #FFE600;
}

.viewport-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transform: scaleX(-1);
}
.viewport-video.hidden {
  display: none;
}

.viewport-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  color: var(--text-muted);
}
.placeholder-icon {
  color: var(--text-dim);
}

/* Target Face Box */
.face-target-box {
  position: absolute;
  width: 250px;
  height: 310px;
  pointer-events: none;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.box-corner {
  position: absolute;
  width: 28px;
  height: 28px;
  border-color: #38bdf8;
  border-style: solid;
  transition: all 0.3s ease;
}
.box-corner.top-left { top: 0; left: 0; border-width: 4px 0 0 4px; }
.box-corner.top-right { top: 0; right: 0; border-width: 4px 4px 0 0; }
.box-corner.bottom-left { bottom: 0; left: 0; border-width: 0 0 4px 4px; }
.box-corner.bottom-right { bottom: 0; right: 0; border-width: 0 4px 4px 0; }

.target-locked .box-corner {
  border-color: #10b981;
  box-shadow: 0 0 15px #10b981;
}

.target-radar-pulse {
  position: absolute;
  inset: -10px;
  border: 1px dashed rgba(56, 189, 248, 0.4);
  border-radius: 8px;
  animation: pulse-ring 3s infinite;
}

.target-tag {
  background: rgba(15, 23, 42, 0.85);
  backdrop-filter: blur(8px);
  color: #e2e8f0;
  font-size: 0.775rem;
  font-weight: 600;
  padding: 6px 14px;
  border-radius: var(--radius-full);
  margin-bottom: -18px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
}

/* Attendance Popup Card */
.attendance-popup {
  position: absolute;
  bottom: 24px;
  left: 24px;
  right: 24px;
  background: rgba(15, 23, 42, 0.95);
  backdrop-filter: blur(16px);
  border-radius: var(--radius-lg);
  padding: 16px 20px;
  display: flex;
  align-items: center;
  gap: 18px;
  border: 2px solid #10b981;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.7), 0 0 30px rgba(16, 185, 129, 0.3);
  z-index: 50;
}

.attendance-popup.duplicate {
  border-color: #f59e0b;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.7), 0 0 30px rgba(245, 158, 11, 0.3);
}

.popup-avatar {
  position: relative;
  width: 64px;
  height: 64px;
  border-radius: var(--radius-md);
  overflow: hidden;
  border: 2px solid #fff;
  flex-shrink: 0;
}
.popup-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.popup-badge-icon {
  position: absolute;
  bottom: -2px;
  right: -2px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #10b981;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 800;
}
.duplicate .popup-badge-icon {
  background: #f59e0b;
}

.popup-details {
  flex: 1;
}
.popup-status {
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 0.05em;
  color: #34d399;
}
.duplicate .popup-status {
  color: #fbbf24;
}
.popup-name {
  font-size: 1.25rem;
  font-weight: 800;
  color: #ffffff;
  margin-top: 2px;
}
.popup-meta {
  display: flex;
  gap: 14px;
  font-size: 0.8rem;
  color: var(--text-muted);
  margin-top: 4px;
  font-family: var(--font-mono);
}
.popup-id {
  color: #93c5fd;
}
.popup-conf {
  color: #86efac;
}

/* Animations for popup */
.pop-enter-active, .pop-leave-active {
  transition: all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.pop-enter-from, .pop-leave-to {
  transform: translateY(30px) scale(0.95);
  opacity: 0;
}

/* Stage Footer */
.stage-footer {
  margin-top: 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  padding-top: 12px;
  border-top: 1px solid var(--border-subtle);
}

.demo-trigger-label {
  display: flex;
  flex-direction: column;
}
.demo-trigger-label span {
  font-size: 0.825rem;
  font-weight: 700;
  color: var(--text-main);
}
.demo-trigger-label small {
  font-size: 0.725rem;
  color: var(--text-dim);
}

.demo-pills {
  display: flex;
  gap: 8px;
}

.demo-pill-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--border-subtle);
  color: var(--text-main);
  padding: 5px 12px 5px 6px;
  border-radius: var(--radius-full);
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.2s;
}
.demo-pill-btn:hover {
  background: rgba(99, 102, 241, 0.2);
  border-color: var(--primary-light);
  transform: translateY(-1px);
}
.pill-avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  object-fit: cover;
}

/* Sidebar */
.scanner-sidebar {
  padding: 20px;
  display: flex;
  flex-direction: column;
  max-height: calc(100vh - 180px);
}

.sidebar-title {
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--text-main);
  margin-bottom: 12px;
}

.attendance-meter {
  background: rgba(0, 0, 0, 0.3);
  padding: 12px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-subtle);
  margin-bottom: 16px;
}
.meter-labels {
  display: flex;
  justify-content: space-between;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-muted);
  margin-bottom: 8px;
}
.meter-pct {
  color: #34d399;
  font-family: var(--font-mono);
  font-weight: 700;
}
.meter-bar {
  height: 8px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: var(--radius-full);
  overflow: hidden;
}
.meter-fill {
  height: 100%;
  background: linear-gradient(90deg, #38bdf8, #10b981);
  transition: width 0.4s ease;
}

/* Attendance Feed List */
.attendance-feed {
  overflow-y: auto;
  flex: 1;
  padding-right: 4px;
}

.empty-feed {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 10px;
  text-align: center;
  color: var(--text-dim);
  gap: 10px;
}
.empty-feed p {
  font-size: 0.9rem;
  color: var(--text-muted);
}
.empty-feed small {
  font-size: 0.775rem;
}

.feed-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.feed-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  transition: all 0.25s ease;
}
.feed-item:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.15);
}

.feed-avatar-wrap {
  position: relative;
  width: 42px;
  height: 42px;
  border-radius: var(--radius-md);
  overflow: hidden;
  flex-shrink: 0;
}
.feed-avatar {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.feed-check-icon {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 16px;
  height: 16px;
  background: #10b981;
  color: #fff;
  font-size: 0.65rem;
  font-weight: 800;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.feed-info {
  flex: 1;
  min-width: 0;
}
.feed-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.feed-name {
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--text-main);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.feed-time {
  font-size: 0.75rem;
  color: var(--text-dim);
  font-family: var(--font-mono);
}
.feed-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 2px;
}
.feed-id {
  font-size: 0.775rem;
  color: var(--primary-light);
  font-family: var(--font-mono);
}
.feed-conf {
  font-size: 0.725rem;
  color: #34d399;
  font-family: var(--font-mono);
}

/* List animation */
.list-enter-active, .list-leave-active {
  transition: all 0.4s ease;
}
.list-enter-from {
  opacity: 0;
  transform: translateX(-20px);
}
.list-leave-to {
  opacity: 0;
  transform: translateX(20px);
}

@media (max-width: 1024px) {
  .scanner-layout {
    grid-template-columns: 1fr;
  }
  .scanner-sidebar {
    max-height: 400px;
  }
}
</style>

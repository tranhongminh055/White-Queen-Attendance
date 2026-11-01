<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { storage } from '../utils/storage'
import { sound } from '../utils/sound'

const emit = defineEmits(['notify'])

const classes = ref(storage.getClasses())
const form = ref({
  id: '',
  name: '',
  classId: classes.value[0]?.id || 'CS101',
  email: ''
})

const videoRef = ref(null)
const canvasRef = ref(null)
const fileInputRef = ref(null)

const isCameraActive = ref(false)
const capturedImage = ref(null)
const isProcessing = ref(false)
const cameraError = ref(null)
const isSubmitting = ref(false)

// Start Camera
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
    console.error('Camera access error:', err)
    cameraError.value = 'Không thể truy cập camera. Vui lòng cấp quyền trong trình duyệt hoặc sử dụng tính năng tải ảnh.'
    isCameraActive.value = false
  }
}

// Stop Camera
function stopCamera() {
  if (videoRef.value && videoRef.value.srcObject) {
    const stream = videoRef.value.srcObject
    const tracks = stream.getTracks()
    tracks.forEach(track => track.stop())
    videoRef.value.srcObject = null
  }
  isCameraActive.value = false
}

// Capture Snapshot
function capturePhoto() {
  if (!videoRef.value || !canvasRef.value) return
  sound.playBeep()
  const video = videoRef.value
  const canvas = canvasRef.value
  canvas.width = video.videoWidth || 640
  canvas.height = video.videoHeight || 480

  const ctx = canvas.getContext('2d')
  // Mirror if user camera
  ctx.translate(canvas.width, 0)
  ctx.scale(-1, 1)
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

  capturedImage.value = canvas.toDataURL('image/jpeg', 0.85)
  isProcessing.value = true
  setTimeout(() => {
    isProcessing.value = false
  }, 400)
}

function retake() {
  capturedImage.value = null
}

function handleFileUpload(e) {
  const file = e.target.files[0]
  if (file) {
    const reader = new FileReader()
    reader.onload = (event) => {
      capturedImage.value = event.target.result
    }
    reader.readAsDataURL(file)
  }
}

function triggerFileInput() {
  fileInputRef.value?.click()
}

// Handle Form Submit
async function submitRegistration() {
  if (!form.value.id.trim() || !form.value.name.trim()) {
    emit('notify', { type: 'error', message: 'Vui lòng nhập đầy đủ Mã sinh viên và Họ tên!' })
    sound.playWarning()
    return
  }

  if (!capturedImage.value) {
    emit('notify', { type: 'error', message: 'Vui lòng chụp ảnh khuôn mặt trước khi đăng ký!' })
    sound.playWarning()
    return
  }

  isSubmitting.value = true

  try {
    const newStudent = {
      id: form.value.id.trim().toUpperCase(),
      name: form.value.name.trim(),
      classId: form.value.classId,
      email: form.value.email.trim() || `${form.value.id.toLowerCase()}@facethic.edu.vn`,
      avatar: capturedImage.value,
      registeredAt: new Date().toLocaleString('vi-VN'),
      embeddingCreated: true
    }

    // Save to storage
    storage.saveStudent(newStudent)
    sound.playSuccess()

    emit('notify', { 
      type: 'success', 
      message: `Đăng ký khuôn mặt thành công cho sinh viên ${newStudent.name} (${newStudent.id})!` 
    })

    // Reset Form
    form.value.id = ''
    form.value.name = ''
    form.value.email = ''
    capturedImage.value = null
  } catch (error) {
    emit('notify', { type: 'error', message: 'Lỗi trong quá trình đăng ký khuôn mặt!' })
  } finally {
    isSubmitting.value = false
  }
}

onMounted(() => {
  startCamera()
})

onBeforeUnmount(() => {
  stopCamera()
})
</script>

<template>
  <div class="enrollment-container">
    <div class="enrollment-header">
      <div class="badge badge-primary">Bước 1: Thu thập dữ liệu sinh trắc học</div>
      <h1 class="page-title">Đăng Ký Khuôn Mặt Sinh Viên</h1>
      <p class="page-desc">
        Hệ thống AI sẽ tự động phân tích và trích xuất vector đặc trưng khuôn mặt (Face Embeddings) 
        để phục vụ điểm danh tự động tại lớp học.
      </p>
    </div>

    <div class="enrollment-grid">
      <!-- Left Column: Camera Preview -->
      <div class="camera-card glass-panel">
        <div class="card-top-bar">
          <div class="status-indicator">
            <span class="pulse-dot" :class="{ active: isCameraActive && !capturedImage }"></span>
            <span class="status-text">
              {{ capturedImage ? 'Đã chụp ảnh chân dung' : (isCameraActive ? 'Camera AI đang hoạt động' : 'Camera chưa bật') }}
            </span>
          </div>
          <button 
            v-if="!capturedImage" 
            class="camera-toggle-btn" 
            @click="isCameraActive ? stopCamera() : startCamera()"
          >
            {{ isCameraActive ? 'Tắt camera' : 'Bật camera' }}
          </button>
        </div>

        <div class="viewfinder-wrapper">
          <!-- Live Video -->
          <video 
            ref="videoRef" 
            autoplay 
            playsinline 
            muted 
            class="camera-video"
            :class="{ hidden: capturedImage || !isCameraActive }"
          ></video>

          <!-- Captured Photo Preview -->
          <img 
            v-if="capturedImage" 
            :src="capturedImage" 
            alt="Ảnh khuôn mặt đã chụp" 
            class="captured-preview"
          />

          <!-- Hidden Canvas for frame snapshot -->
          <canvas ref="canvasRef" style="display: none;"></canvas>

          <!-- Face Alignment Oval & HUD Guidelines -->
          <div v-if="isCameraActive && !capturedImage" class="face-guide">
            <div class="guide-oval"></div>
            <div class="scan-laser-subtle"></div>
            <div class="guide-corner top-left"></div>
            <div class="guide-corner top-right"></div>
            <div class="guide-corner bottom-left"></div>
            <div class="guide-corner bottom-right"></div>
            <span class="guide-hint">Giữ khuôn mặt ngay ngắn trong vòng elip</span>
          </div>

          <!-- Camera Error / Fallback State -->
          <div v-if="!isCameraActive && !capturedImage" class="camera-fallback">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="camera-icon">
              <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/>
              <circle cx="12" cy="13" r="3"/>
            </svg>
            <p v-if="cameraError" class="fallback-error">{{ cameraError }}</p>
            <p v-else class="fallback-text">Bật camera để chụp ảnh chân dung trực tiếp</p>
            <div class="fallback-actions">
              <button class="btn btn-primary" @click="startCamera">
                Mở Camera
              </button>
              <button class="btn btn-secondary" @click="triggerFileInput">
                Tải ảnh từ máy
              </button>
            </div>
          </div>
        </div>

        <!-- Camera Actions Bar -->
        <div class="camera-controls">
          <input 
            type="file" 
            ref="fileInputRef" 
            accept="image/*" 
            style="display: none;" 
            @change="handleFileUpload" 
          />

          <template v-if="!capturedImage">
            <button 
              class="btn btn-primary btn-large capture-btn" 
              :disabled="!isCameraActive"
              @click="capturePhoto"
              id="btn-capture-photo"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <circle cx="12" cy="12" r="10"/>
                <circle cx="12" cy="12" r="4" fill="currentColor"/>
              </svg>
              <span>Chụp ảnh chân dung</span>
            </button>
            <button class="btn btn-secondary" @click="triggerFileInput" title="Tải ảnh có sẵn">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              <span>Tải file ảnh</span>
            </button>
          </template>

          <template v-else>
            <button class="btn btn-secondary" @click="retake">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                <path d="M3 3v5h5"/>
              </svg>
              <span>Chụp lại ảnh khác</span>
            </button>
            <div class="badge badge-success">
              ✓ Ảnh đạt chuẩn chất lượng
            </div>
          </template>
        </div>

        <!-- AI Vector Extraction Visualizer -->
        <div v-if="capturedImage" class="ai-vector-preview">
          <div class="vector-title">
            <span>Đặc trưng Vector khuôn mặt (Simulated 512D)</span>
            <span class="vector-status">Sẵn sàng lập chỉ mục</span>
          </div>
          <div class="vector-matrix">
            <div v-for="i in 32" :key="i" class="vector-cell" :style="{ opacity: 0.3 + (i * 17) % 70 / 100 }"></div>
          </div>
        </div>
      </div>

      <!-- Right Column: Student Info Form -->
      <div class="form-card glass-panel">
        <h2 class="form-title">Thông Tin Sinh Viên</h2>
        <p class="form-subtitle">Điền thông tin định danh để liên kết với khuôn mặt vừa chụp.</p>

        <form @submit.prevent="submitRegistration" class="student-form">
          <div class="input-group">
            <label class="input-label" for="student-id">Mã số sinh viên (MSSV) *</label>
            <input 
              id="student-id" 
              type="text" 
              v-model="form.id" 
              placeholder="VD: SV202610" 
              class="input-field" 
              required
            />
          </div>

          <div class="input-group">
            <label class="input-label" for="student-name">Họ và tên sinh viên *</label>
            <input 
              id="student-name" 
              type="text" 
              v-model="form.name" 
              placeholder="VD: Nguyễn Văn An" 
              class="input-field" 
              required
            />
          </div>

          <div class="input-group">
            <label class="input-label" for="student-class">Lớp học phần *</label>
            <select id="student-class" v-model="form.classId" class="input-field select-field">
              <option v-for="cls in classes" :key="cls.id" :value="cls.id">
                {{ cls.name }}
              </option>
            </select>
          </div>

          <div class="input-group">
            <label class="input-label" for="student-email">Email thông báo (tùy chọn)</label>
            <input 
              id="student-email" 
              type="email" 
              v-model="form.email" 
              placeholder="VD: an.nv@facethic.edu.vn" 
              class="input-field" 
            />
          </div>

          <!-- Requirements Checklist -->
          <div class="rules-card">
            <div class="rules-title">Yêu cầu ảnh khuôn mặt chuẩn AI:</div>
            <ul class="rules-list">
              <li>Mặt nhìn thẳng vào camera, không nghiêng quá 15 độ.</li>
              <li>Không đeo khẩu trang hoặc kính râm che khuất mắt.</li>
              <li>Đảm bảo ánh sáng rõ ràng, tránh chụp ngược sáng hoặc bóng tối.</li>
            </ul>
          </div>

          <!-- Submit Button -->
          <button 
            type="submit" 
            class="btn btn-success btn-large submit-btn" 
            :disabled="isSubmitting || !capturedImage"
            id="btn-submit-registration"
          >
            <span v-if="isSubmitting">Đang tạo vector sinh trắc học...</span>
            <template v-else>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                <polyline points="17 21 17 13 7 13 7 21"/>
                <polyline points="7 3 7 8 15 8"/>
              </svg>
              <span>Xác nhận đăng ký khuôn mặt</span>
            </template>
          </button>
        </form>
      </div>
    </div>
  </div>
</template>

<style scoped>
.enrollment-container {
  max-width: 1300px;
  margin: 0 auto;
  padding: 30px 24px 60px;
}

.enrollment-header {
  margin-bottom: 28px;
  text-align: center;
}

.page-title {
  font-size: 2.2rem;
  font-weight: 800;
  letter-spacing: -0.03em;
  margin-top: 10px;
  background: linear-gradient(135deg, #ffffff 0%, #cbd5e1 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.page-desc {
  color: var(--text-muted);
  max-width: 650px;
  margin: 8px auto 0;
  font-size: 0.95rem;
}

.enrollment-grid {
  display: grid;
  grid-template-columns: 1.15fr 0.85fr;
  gap: 24px;
}

/* Camera Card */
.camera-card {
  padding: 20px;
  display: flex;
  flex-direction: column;
}

.card-top-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
}

.pulse-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--text-dim);
}

.pulse-dot.active {
  background: #34d399;
  box-shadow: 0 0 0 3px rgba(52, 211, 153, 0.25);
  animation: pulse-ring 2s infinite;
}

.status-text {
  font-size: 0.825rem;
  font-weight: 600;
  color: var(--text-muted);
}

.camera-toggle-btn {
  background: transparent;
  border: 1px solid var(--border-subtle);
  color: var(--text-muted);
  padding: 4px 10px;
  border-radius: var(--radius-sm);
  font-size: 0.775rem;
  cursor: pointer;
  transition: all 0.2s;
}
.camera-toggle-btn:hover {
  color: var(--text-main);
  border-color: rgba(255, 255, 255, 0.2);
}

.viewfinder-wrapper {
  position: relative;
  width: 100%;
  aspect-ratio: 4 / 3;
  background: #060911;
  border-radius: var(--radius-md);
  overflow: hidden;
  border: 1px solid var(--border-subtle);
  display: flex;
  align-items: center;
  justify-content: center;
}

.camera-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transform: scaleX(-1); /* Mirror camera */
}

.camera-video.hidden {
  display: none;
}

.captured-preview {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* Face Guide HUD */
.face-guide {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.guide-oval {
  width: 200px;
  height: 270px;
  border-radius: 50%;
  border: 2px dashed rgba(56, 189, 248, 0.6);
  box-shadow: 0 0 20px rgba(56, 189, 248, 0.2), inset 0 0 20px rgba(56, 189, 248, 0.1);
  transition: border-color 0.3s;
}

.scan-laser-subtle {
  position: absolute;
  width: 210px;
  height: 2px;
  background: linear-gradient(90deg, transparent, #38bdf8, transparent);
  box-shadow: 0 0 10px #38bdf8;
  animation: scan-laser 2.8s ease-in-out infinite;
}

.guide-corner {
  position: absolute;
  width: 24px;
  height: 24px;
  border-color: #38bdf8;
  border-style: solid;
}
.guide-corner.top-left { top: 20px; left: 20px; border-width: 3px 0 0 3px; }
.guide-corner.top-right { top: 20px; right: 20px; border-width: 3px 3px 0 0; }
.guide-corner.bottom-left { bottom: 20px; left: 20px; border-width: 0 0 3px 3px; }
.guide-corner.bottom-right { bottom: 20px; right: 20px; border-width: 0 3px 3px 0; }

.guide-hint {
  position: absolute;
  bottom: 24px;
  font-size: 0.8rem;
  font-weight: 500;
  color: #e2e8f0;
  background: rgba(15, 23, 42, 0.75);
  backdrop-filter: blur(8px);
  padding: 4px 14px;
  border-radius: var(--radius-full);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

/* Fallback state */
.camera-fallback {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 24px;
  text-align: center;
}

.camera-icon {
  color: var(--text-dim);
}

.fallback-text {
  color: var(--text-muted);
  font-size: 0.9rem;
}

.fallback-error {
  color: #fb7185;
  font-size: 0.85rem;
  max-width: 380px;
}

.fallback-actions {
  display: flex;
  gap: 12px;
  margin-top: 8px;
}

/* Camera Controls */
.camera-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 16px;
}

.btn-large {
  padding: 12px 24px;
  font-size: 1rem;
}

.capture-btn {
  flex: 1;
}

/* AI Vector Preview */
.ai-vector-preview {
  margin-top: 16px;
  padding: 12px 14px;
  background: rgba(0, 0, 0, 0.35);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-subtle);
}

.vector-title {
  display: flex;
  justify-content: space-between;
  font-size: 0.775rem;
  color: var(--text-muted);
  font-weight: 600;
  margin-bottom: 8px;
}

.vector-status {
  color: #34d399;
  font-family: var(--font-mono);
}

.vector-matrix {
  display: grid;
  grid-template-columns: repeat(16, 1fr);
  gap: 4px;
}

.vector-cell {
  height: 10px;
  background: #38bdf8;
  border-radius: 2px;
  transition: opacity 0.3s;
}

/* Form Card */
.form-card {
  padding: 28px;
}

.form-title {
  font-size: 1.4rem;
  font-weight: 700;
  color: var(--text-main);
}

.form-subtitle {
  font-size: 0.875rem;
  color: var(--text-muted);
  margin-top: 4px;
  margin-bottom: 22px;
}

.student-form {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.select-field {
  appearance: none;
  background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
  background-repeat: no-repeat;
  background-position: right 14px center;
  background-size: 16px;
  cursor: pointer;
}

.rules-card {
  background: rgba(99, 102, 241, 0.08);
  border: 1px solid rgba(99, 102, 241, 0.2);
  border-radius: var(--radius-md);
  padding: 14px;
}

.rules-title {
  font-size: 0.825rem;
  font-weight: 700;
  color: var(--primary-light);
  margin-bottom: 6px;
}

.rules-list {
  padding-left: 18px;
  font-size: 0.8rem;
  color: #cbd5e1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.submit-btn {
  width: 100%;
  margin-top: 10px;
}

@media (max-width: 950px) {
  .enrollment-grid {
    grid-template-columns: 1fr;
  }
}
</style>

<script setup>
import { ref, reactive } from 'vue'
import SpaceXLogo from './SpaceXLogo.vue'
import SpaceXWatermark from './SpaceXWatermark.vue'
import { sound } from '../utils/sound'
import { storage } from '../utils/storage'
import { validateLoginIdentifier, validateLoginPassword } from '../utils/validation'
import heroBiometricImg from '../assets/hero-biometric.jpg'

const emit = defineEmits(['login-success', 'navigate', 'notify'])

const username = ref('')
const password = ref('')
const rememberMe = ref(true)
const showPassword = ref(false)
const isLoading = ref(false)

const errors = reactive({
  username: '',
  password: ''
})

function validateField(field) {
  if (field === 'username') {
    errors.username = validateLoginIdentifier(username.value)
  } else if (field === 'password') {
    errors.password = validateLoginPassword(password.value)
  }
}

function handleLogin() {
  validateField('username')
  validateField('password')

  if (errors.username || errors.password) {
    sound.playWarning()
    emit('notify', {
      type: 'error',
      message: errors.username || errors.password
    })
    return
  }

  isLoading.value = true
  sound.playBeep()

  setTimeout(() => {
    const result = storage.authenticate(username.value, password.value)
    isLoading.value = false

    if (!result.success) {
      errors[result.field] = result.message
      sound.playWarning()
      emit('notify', { type: 'error', message: result.message })
      return
    }

    const students = storage.getStudents()
    const studentRecord = students.find(
      s => (s.id || '').toUpperCase() === result.account.employeeId.toUpperCase()
    )
    const hasFaceEnrolled = Boolean(studentRecord?.embeddingCreated)

    storage.setCurrentProfile({
      id: result.account.employeeId,
      fullName: result.account.fullName,
      email: result.account.email,
      role: result.account.role,
      classId: studentRecord?.classId || (result.account.role === 'lecturer' ? 'FACULTY' : 'CNTT-K21A'),
      embeddingCreated: hasFaceEnrolled
    })

    sound.playSuccess()
    emit('login-success')

    if (!hasFaceEnrolled) {
      emit('notify', {
        type: 'info',
        message: `Đăng nhập thành công! Vui lòng hoàn tất đăng ký khuôn mặt cho ${result.account.fullName}.`
      })
      emit('navigate', 'enrollment')
      return
    }

    emit('notify', {
      type: 'success',
      message: `Đăng nhập thành công! Chào mừng ${result.account.fullName} trở lại hệ thống SpaceX.`
    })
    emit('navigate', 'scanner')
  }, 450)
}

function handleFaceLogin() {
  sound.playBeep()
  emit('navigate', 'scanner')
}

function handleForgotPassword() {
  sound.playBeep()
  emit('notify', {
    type: 'info',
    message: 'Vui lòng liên hệ quản trị viên SpaceX để cấp lại mật khẩu!'
  })
}
</script>

<template>
  <div class="sx-login-split">
    <!-- LEFT PANEL: Biometric Face Visual & Live Telemetry -->
    <section class="sx-login-visual">
      <img
        :src="heroBiometricImg"
        alt="SpaceX Biometric Face Scan"
        class="sx-visual-bg"
      />
      <div class="sx-visual-vignette"></div>

      <!-- Precision Cyan Biometric Reticle HUD Overlay -->
      <div class="sx-visual-hud" aria-hidden="true">
        <div class="sx-hud-scan-tag">SCANNING · 12,800 PTS</div>
        <div class="sx-hud-reticle">
          <span class="r-corner tl"></span>
          <span class="r-corner tr"></span>
          <span class="r-corner bl"></span>
          <span class="r-corner br"></span>
          <div class="sx-hud-eye-line"></div>
          <span class="sx-hud-pulse-dot"></span>
        </div>
      </div>

      <!-- Top Bar -->
      <div class="sx-visual-top">
        <div class="sx-secure-pill">
          <span class="sx-secure-dot"></span>
          <span>SECURE AUTHENTICATION</span>
        </div>
        <span class="sx-version-tag">V2.2 • FACE ATTENDANCE</span>
      </div>

      <!-- Bottom Copy & System Status Telemetry Box -->
      <div class="sx-visual-bottom">
        <div class="sx-visual-eyebrow">BIOMETRIC FACE ATTENDANCE</div>
        <h2 class="sx-visual-headline">
          Chạm mặt một lần.<br />
          Chấm công tự động, an toàn<br />
          tuyệt đối.
        </h2>

        <div class="sx-status-card">
          <div class="sx-status-row">
            <span class="sx-st-label">SYSTEM STATUS</span>
            <span class="sx-st-val nominal">NOMINAL</span>
          </div>
          <div class="sx-status-row">
            <span class="sx-st-label">MODEL</span>
            <span class="sx-st-val">FACENET-V2</span>
          </div>
          <div class="sx-status-row">
            <span class="sx-st-label">LATENCY</span>
            <span class="sx-st-val">180MS</span>
          </div>
          <div class="sx-status-bar-track">
            <div class="sx-status-bar-fill"></div>
          </div>
        </div>
      </div>
    </section>

    <!-- RIGHT PANEL: Access Portal Login Form -->
    <section class="sx-login-panel">
      <SpaceXWatermark />

      <!-- Top Brand Bar -->
      <header class="sx-panel-top">
        <div class="sx-panel-brand">
          <SpaceXLogo @click="emit('navigate', 'landing')" title="Quay về Trang chủ SpaceX" />
          <span class="sx-brand-divider"></span>
          <span class="sx-brand-sub">BIOMETRIC AI</span>
        </div>

        <button class="sx-back-link" @click="emit('navigate', 'landing')" title="Quay về Trang chủ">
          ← Trang chủ
        </button>
      </header>

      <!-- Center Auth Form -->
      <div class="sx-form-container">
        <div class="sx-portal-eyebrow">ACCESS PORTAL</div>
        <h1 class="sx-portal-title">Đăng nhập</h1>
        <p class="sx-portal-subtitle">
          Truy cập hệ thống chấm công khuôn mặt bằng tài khoản của bạn.
        </p>

        <form @submit.prevent="handleLogin" class="sx-auth-form" novalidate>
          <!-- Email / Employee ID -->
          <div class="sx-field">
            <label for="sx-username" class="sx-field-label">EMAIL / MÃ NHÂN VIÊN</label>
            <div class="sx-input-box">
              <span class="sx-input-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
              </span>
              <input
                id="sx-username"
                v-model="username"
                type="text"
                placeholder="nhanvien@spacex.com hoặc SX-00123"
                class="sx-input"
                :class="{ 'is-error': errors.username }"
                autocomplete="username"
                @blur="validateField('username')"
                @input="errors.username && validateField('username')"
              />
            </div>
            <span v-if="errors.username" class="sx-field-error">{{ errors.username }}</span>
          </div>

          <!-- Password -->
          <div class="sx-field">
            <label for="sx-password" class="sx-field-label">MẬT KHẨU</label>
            <div class="sx-input-box">
              <span class="sx-input-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              </span>
              <input
                id="sx-password"
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                placeholder="Nhập mật khẩu của bạn"
                class="sx-input"
                :class="{ 'is-error': errors.password }"
                autocomplete="current-password"
                @blur="validateField('password')"
                @input="errors.password && validateField('password')"
              />
              <button
                type="button"
                class="sx-eye-btn"
                @click="showPassword = !showPassword"
                aria-label="Hiển thị hoặc ẩn mật khẩu"
              >
                <svg v-if="!showPassword" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
                <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                  <line x1="1" y1="1" x2="23" y2="23"/>
                </svg>
              </button>
            </div>
            <span v-if="errors.password" class="sx-field-error">{{ errors.password }}</span>
          </div>

          <!-- Remember & Forgot -->
          <div class="sx-auth-meta">
            <label class="sx-remember">
              <input v-model="rememberMe" type="checkbox" class="sx-checkbox" />
              <span class="sx-checkbox-ui">
                <svg v-if="rememberMe" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </span>
              <span>Ghi nhớ đăng nhập</span>
            </label>

            <a href="#forgot" class="sx-forgot-link" @click.prevent="handleForgotPassword">
              QUÊN MẬT KHẨU?
            </a>
          </div>

          <!-- Primary White Submit Button -->
          <button type="submit" class="sx-btn-submit" :disabled="isLoading">
            <span v-if="isLoading">ĐANG XÁC THỰC...</span>
            <span v-else>ĐĂNG NHẬP →</span>
          </button>

          <!-- Divider -->
          <div class="sx-or-divider">
            <span>HOẶC</span>
          </div>

          <!-- Secondary Face Login Button -->
          <button type="button" class="sx-btn-face" @click="handleFaceLogin">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 7V5a2 2 0 0 1 2-2h2"/>
              <path d="M17 3h2a2 2 0 0 1 2 2v2"/>
              <path d="M21 17v2a2 2 0 0 1-2 2h-2"/>
              <path d="M7 21H5a2 2 0 0 1-2-2v-2"/>
              <circle cx="12" cy="12" r="2.5"/>
            </svg>
            <span>ĐĂNG NHẬP BẰNG KHUÔN MẶT</span>
          </button>
        </form>
      </div>

      <!-- Bottom Security Footer -->
      <footer class="sx-panel-footer">
        <div class="sx-register-row">
          <span>Chưa có tài khoản?</span>
          <a href="#register" class="sx-register-link" @click.prevent="emit('navigate', 'register')">
            Đăng ký
          </a>
        </div>
        <div class="sx-e2ee-note">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
          <span>DỮ LIỆU SINH TRẮC HỌC ĐƯỢC MÃ HÓA ĐẦU CUỐI</span>
        </div>
      </footer>
    </section>
  </div>
</template>

<style scoped>
.sx-login-split {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 1.38fr 1fr;
  background-color: #000000;
  color: #ffffff;
  font-family: var(--font-sans);
}

/* ===========================
   LEFT BIOMETRIC VISUAL PANEL
   =========================== */
.sx-login-visual {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 28px 36px 32px;
  overflow: hidden;
  background-color: #02050a;
  border-right: 1px dashed rgba(148, 163, 184, 0.32);
}

.sx-visual-bg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: 68% 34%;
  opacity: 0.78;
  filter: saturate(1.1) contrast(1.08);
  pointer-events: none;
}

.sx-visual-vignette {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 58% 42%, rgba(6, 182, 212, 0.12) 0%, rgba(2, 5, 10, 0.58) 58%, #02050a 95%),
    linear-gradient(180deg, rgba(2, 5, 10, 0.75) 0%, transparent 22%, transparent 55%, rgba(2, 5, 10, 0.96) 100%);
  pointer-events: none;
}

/* Center Face Reticle Overlay */
.sx-visual-hud {
  position: absolute;
  top: 42%;
  left: 52%;
  transform: translate(-50%, -50%);
  pointer-events: none;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.sx-hud-scan-tag {
  font-family: var(--font-mono);
  font-size: 0.62rem;
  letter-spacing: 0.2em;
  color: rgba(103, 232, 249, 0.8);
}

.sx-hud-reticle {
  position: relative;
  width: 220px;
  height: 130px;
}

.r-corner {
  position: absolute;
  width: 18px;
  height: 18px;
  border-color: rgba(56, 189, 248, 0.72);
  border-style: solid;
}
.r-corner.tl { top: 0; left: 0; border-width: 1.5px 0 0 1.5px; }
.r-corner.tr { top: 0; right: 0; border-width: 1.5px 1.5px 0 0; }
.r-corner.bl { bottom: 0; left: 0; border-width: 0 0 1.5px 1.5px; }
.r-corner.br { bottom: 0; right: 0; border-width: 0 1.5px 1.5px 0; }

.sx-hud-eye-line {
  position: absolute;
  top: 50%;
  left: 14px;
  right: 14px;
  height: 1px;
  background: linear-gradient(90deg, rgba(56, 189, 248, 0.2), rgba(56, 189, 248, 0.95), rgba(56, 189, 248, 0.2));
}

.sx-hud-pulse-dot {
  position: absolute;
  top: 50%;
  right: 26%;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  transform: translate(50%, -50%);
  background: radial-gradient(circle, #67e8f9 0%, rgba(56, 189, 248, 0.35) 55%, transparent 75%);
  box-shadow: 0 0 18px rgba(56, 189, 248, 0.85);
}

/* Top Bar */
.sx-visual-top {
  position: relative;
  z-index: 5;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.sx-secure-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: rgba(5, 8, 14, 0.75);
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 2px;
  font-family: var(--font-mono);
  font-size: 0.62rem;
  letter-spacing: 0.16em;
  color: #cbd5e1;
}

.sx-secure-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #10b981;
  box-shadow: 0 0 8px #10b981;
}

.sx-version-tag {
  font-family: var(--font-mono);
  font-size: 0.62rem;
  letter-spacing: 0.18em;
  color: #64748b;
}

/* Bottom Left Copy & Telemetry */
.sx-visual-bottom {
  position: relative;
  z-index: 5;
  max-width: 460px;
}

.sx-visual-eyebrow {
  font-family: var(--font-mono);
  font-size: 0.66rem;
  letter-spacing: 0.22em;
  color: #94a3b8;
  margin-bottom: 12px;
}

.sx-visual-headline {
  font-size: clamp(1.7rem, 2.5vw, 2.35rem);
  font-weight: 500;
  line-height: 1.2;
  letter-spacing: -0.02em;
  color: #ffffff;
  margin-bottom: 24px;
}

.sx-status-card {
  width: 280px;
  background: rgba(5, 8, 14, 0.86);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 2px;
  padding: 14px 16px;
}

.sx-status-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-family: var(--font-mono);
  font-size: 0.62rem;
  letter-spacing: 0.12em;
  margin-bottom: 7px;
}

.sx-st-label {
  color: #64748b;
}

.sx-st-val {
  color: #e2e8f0;
  font-weight: 600;
}

.sx-st-val.nominal {
  color: #10b981;
}

.sx-status-bar-track {
  margin-top: 10px;
  height: 2px;
  background: rgba(255, 255, 255, 0.08);
}

.sx-status-bar-fill {
  width: 68%;
  height: 100%;
  background: linear-gradient(90deg, #0284c7, #38bdf8);
}

/* ===========================
   RIGHT ACCESS PORTAL PANEL
   =========================== */
.sx-login-panel {
  position: relative;
  overflow: hidden;
  background-color: #000000;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 28px 52px 32px;
}

.sx-panel-top {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.sx-panel-brand {
  display: flex;
  align-items: center;
  gap: 14px;
}

.sx-brand-divider {
  width: 22px;
  height: 1px;
  background: rgba(255, 255, 255, 0.25);
}

.sx-brand-sub {
  font-family: var(--font-mono);
  font-size: 0.64rem;
  letter-spacing: 0.2em;
  color: #64748b;
}

.sx-back-link {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 2px;
  color: #94a3b8;
  font-family: var(--font-mono);
  font-size: 0.66rem;
  letter-spacing: 0.08em;
  padding: 6px 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}
.sx-back-link:hover {
  color: #ffffff;
  border-color: rgba(255, 255, 255, 0.35);
}

/* Form Container */
.sx-form-container {
  position: relative;
  z-index: 2;
  width: 100%;
  max-width: 390px;
  margin: 36px auto;
}

.sx-portal-eyebrow {
  font-family: var(--font-mono);
  font-size: 0.66rem;
  letter-spacing: 0.22em;
  color: #64748b;
  margin-bottom: 10px;
}

.sx-portal-title {
  font-size: 2rem;
  font-weight: 600;
  letter-spacing: -0.02em;
  color: #ffffff;
  margin-bottom: 8px;
}

.sx-portal-subtitle {
  font-size: 0.85rem;
  line-height: 1.55;
  color: #64748b;
  margin-bottom: 28px;
}

.sx-auth-form {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.sx-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sx-field-label {
  font-family: var(--font-mono);
  font-size: 0.64rem;
  letter-spacing: 0.16em;
  color: #64748b;
}

.sx-input-box {
  position: relative;
  display: flex;
  align-items: center;
}

.sx-input-icon {
  position: absolute;
  left: 14px;
  color: #64748b;
  display: flex;
  align-items: center;
  pointer-events: none;
}

.sx-input {
  width: 100%;
  background: #06090e;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 2px;
  padding: 13px 40px 13px 42px;
  font-family: var(--font-sans);
  font-size: 0.875rem;
  color: #f8fafc;
  outline: none;
  transition: border-color 0.2s ease, background-color 0.2s ease;
}

.sx-input::placeholder {
  color: #475569;
}

.sx-input:focus {
  border-color: rgba(56, 189, 248, 0.6);
  background: #090d14;
}

.sx-input.is-error {
  border-color: #f43f5e;
  background: rgba(244, 63, 94, 0.06);
}

.sx-input:-webkit-autofill,
.sx-input:-webkit-autofill:hover,
.sx-input:-webkit-autofill:focus {
  -webkit-box-shadow: 0 0 0 1000px #06090e inset;
  -webkit-text-fill-color: #f8fafc;
  caret-color: #f8fafc;
  transition: background-color 5000s ease-in-out 0s;
}

.sx-field-error {
  font-size: 0.72rem;
  color: #fb7185;
  line-height: 1.35;
}

.sx-eye-btn {
  position: absolute;
  right: 12px;
  background: transparent;
  border: none;
  color: #64748b;
  cursor: pointer;
  display: flex;
  align-items: center;
  padding: 4px;
  transition: color 0.2s ease;
}
.sx-eye-btn:hover {
  color: #e2e8f0;
}

/* Remember & Forgot Row */
.sx-auth-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: -2px;
}

.sx-remember {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 0.78rem;
  color: #94a3b8;
  cursor: pointer;
  user-select: none;
}

.sx-checkbox {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

.sx-checkbox-ui {
  width: 15px;
  height: 15px;
  border-radius: 2px;
  border: 1px solid rgba(255, 255, 255, 0.25);
  background: #06090e;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  transition: all 0.2s ease;
}

.sx-checkbox:checked + .sx-checkbox-ui {
  background: #0284c7;
  border-color: #0ea5e9;
}

.sx-forgot-link {
  font-family: var(--font-mono);
  font-size: 0.64rem;
  letter-spacing: 0.12em;
  color: #38bdf8;
  text-decoration: none;
  transition: color 0.2s ease;
}
.sx-forgot-link:hover {
  color: #7dd3fc;
  text-decoration: underline;
}

/* Primary White Button */
.sx-btn-submit {
  width: 100%;
  background: #ffffff;
  color: #000000;
  border: 1px solid #ffffff;
  border-radius: 2px;
  padding: 14px;
  font-family: var(--font-sans);
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  cursor: pointer;
  margin-top: 4px;
  transition: all 0.2s ease;
}

.sx-btn-submit:hover:not(:disabled) {
  background: #e2e8f0;
  border-color: #e2e8f0;
}

.sx-btn-submit:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

/* Divider */
.sx-or-divider {
  display: flex;
  align-items: center;
  gap: 14px;
  color: #475569;
  font-family: var(--font-mono);
  font-size: 0.62rem;
  letter-spacing: 0.18em;
}
.sx-or-divider::before,
.sx-or-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: rgba(255, 255, 255, 0.08);
}

/* Face Login Secondary Button */
.sx-btn-face {
  width: 100%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  background: transparent;
  color: #e2e8f0;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 2px;
  padding: 13px;
  font-family: var(--font-mono);
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.12em;
  cursor: pointer;
  transition: all 0.2s ease;
}

.sx-btn-face:hover {
  border-color: #38bdf8;
  color: #38bdf8;
  background: rgba(56, 189, 248, 0.06);
}

/* Panel Footer */
.sx-panel-footer {
  position: relative;
  z-index: 2;
  width: 100%;
  max-width: 390px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.sx-register-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.8rem;
  color: #64748b;
}

.sx-register-link {
  color: #ffffff;
  font-weight: 600;
  text-decoration: none;
  border-bottom: 1px solid rgba(255, 255, 255, 0.35);
  padding-bottom: 1px;
}
.sx-register-link:hover {
  color: #38bdf8;
  border-bottom-color: #38bdf8;
}

.sx-e2ee-note {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-family: var(--font-mono);
  font-size: 0.6rem;
  letter-spacing: 0.12em;
  color: #475569;
}
.sx-e2ee-note svg {
  color: #10b981;
}

/* Responsive */
@media (max-width: 980px) {
  .sx-login-split {
    grid-template-columns: 1fr;
  }
  .sx-login-visual {
    display: none;
  }
  .sx-login-panel {
    padding: 24px 24px 32px;
  }
}
</style>

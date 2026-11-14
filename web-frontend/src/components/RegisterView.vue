<script setup>
import { ref, reactive, computed } from 'vue'
import SpaceXLogo from './SpaceXLogo.vue'
import SpaceXWatermark from './SpaceXWatermark.vue'
import { sound } from '../utils/sound'
import { storage } from '../utils/storage'
import {
  validateFullName,
  validateEmployeeId,
  validateEmail,
  evaluatePasswordStrength,
  validateRegistrationPassword
} from '../utils/validation'
import heroBiometricImg from '../assets/hero-biometric.jpg'

const emit = defineEmits(['navigate', 'back', 'notify'])

const fullName = ref('')
const employeeId = ref('')
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const showPassword = ref(false)
const showConfirmPassword = ref(false)
const agreeTerms = ref(true)
const agreeBiometric = ref(true)
const isSubmitting = ref(false)

const errors = reactive({
  fullName: '',
  employeeId: '',
  email: '',
  password: '',
  confirmPassword: '',
  consents: ''
})

const passwordStrength = computed(() => evaluatePasswordStrength(password.value))

async function validateField(field) {
  if (field === 'fullName') {
    errors.fullName = validateFullName(fullName.value)
  } else if (field === 'employeeId') {
    const formatError = validateEmployeeId(employeeId.value)
    if (formatError) {
      errors.employeeId = formatError
    } else {
      const conflicts = await storage.findRegisteredConflicts({ employeeId: employeeId.value })
      errors.employeeId = conflicts.employeeId || ''
    }
  } else if (field === 'email') {
    const formatError = validateEmail(email.value)
    if (formatError) {
      errors.email = formatError
    } else {
      const conflicts = await storage.findRegisteredConflicts({ email: email.value })
      errors.email = conflicts.email || ''
    }
  } else if (field === 'password') {
    errors.password = validateRegistrationPassword(password.value)
    if (confirmPassword.value) {
      errors.confirmPassword =
        confirmPassword.value !== password.value ? 'Mật khẩu xác nhận không khớp.' : ''
    }
  } else if (field === 'confirmPassword') {
    if (!confirmPassword.value) {
      errors.confirmPassword = 'Vui lòng nhập xác nhận mật khẩu.'
    } else if (confirmPassword.value !== password.value) {
      errors.confirmPassword = 'Mật khẩu xác nhận không khớp.'
    } else {
      errors.confirmPassword = ''
    }
  } else if (field === 'consents') {
    errors.consents =
      !agreeTerms.value || !agreeBiometric.value
        ? 'Vui lòng đồng ý với điều khoản sử dụng và thu thập dữ liệu sinh trắc học.'
        : ''
  }
}

async function validateAll() {
  await Promise.all([
    validateField('fullName'),
    validateField('employeeId'),
    validateField('email'),
    validateField('password'),
    validateField('confirmPassword'),
    validateField('consents')
  ])
  return !(
    errors.fullName ||
    errors.employeeId ||
    errors.email ||
    errors.password ||
    errors.confirmPassword ||
    errors.consents
  )
}

async function handleRegisterSubmit() {
  if (!(await validateAll())) {
    const firstError =
      errors.fullName ||
      errors.employeeId ||
      errors.email ||
      errors.password ||
      errors.confirmPassword ||
      errors.consents
    emit('notify', { type: 'error', message: firstError })
    sound.playWarning()
    return
  }

  isSubmitting.value = true
  sound.playBeep()

  try {
    const res = await storage.registerAccount({
      fullName: fullName.value,
      employeeId: employeeId.value,
      email: email.value,
      role: 'student',
      password: password.value
    })

    if (!res.success) {
      if (res.errors) {
        Object.assign(errors, res.errors)
      } else if (res.field && res.field in errors) {
        errors[res.field] = res.message
      }
      sound.playWarning()
      emit('notify', { type: 'error', message: res.message })
      return
    }

    sound.playSuccess()
    emit('notify', {
      type: 'success',
      message: `Đăng ký tài khoản ${res.account.fullName} vào SQL Server thành công! Vui lòng đăng nhập để đăng ký khuôn mặt.`
    })
    emit('navigate', 'login')
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="sx-reg-split">
    <!-- LEFT PANEL: Biometric Enrollment Visual -->
    <section class="sx-reg-visual">
      <img
        :src="heroBiometricImg"
        alt="SpaceX Biometric Enrollment"
        class="sx-visual-bg"
      />
      <div class="sx-visual-vignette"></div>

      <!-- Biometric Enrollment Mesh & HUD Overlay -->
      <div class="sx-visual-hud" aria-hidden="true">
        <div class="sx-hud-scan-tag">ENROLLING · 12,800 PTS</div>
        <div class="sx-hud-reticle">
          <span class="r-corner tl"></span>
          <span class="r-corner tr"></span>
          <span class="r-corner bl"></span>
          <span class="r-corner br"></span>
          <div class="sx-hud-eye-line"></div>
          <span class="sx-hud-id-tag">ID: {{ employeeId.trim() ? employeeId.trim().toUpperCase() : 'NEW' }}</span>
        </div>
      </div>

      <!-- Top Bar -->
      <div class="sx-visual-top">
        <div class="sx-secure-pill">
          <span class="sx-secure-dot"></span>
          <span>SECURE ENROLLMENT</span>
        </div>
        <span class="sx-version-tag">V2.2 • FACE ATTENDANCE</span>
      </div>

      <!-- Bottom Copy & Telemetry -->
      <div class="sx-visual-bottom">
        <div class="sx-visual-eyebrow">BIOMETRIC FACE ATTENDANCE</div>
        <h2 class="sx-visual-headline">
          Đăng ký một lần.<br />
          Chấm công bằng gương mặt.
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

    <!-- RIGHT PANEL: Create Account Form -->
    <section class="sx-reg-panel">
      <SpaceXWatermark />

      <!-- Top Brand Bar -->
      <header class="sx-panel-top">
        <div class="sx-panel-brand">
          <SpaceXLogo @click="emit('navigate', 'landing')" title="Quay về Trang chủ SpaceX" />
          <span class="sx-brand-divider"></span>
          <span class="sx-brand-sub">BIOMETRIC AI</span>
        </div>

        <button class="sx-back-link" @click="emit('back')" title="Quay lại trang trước">
          ← Quay lại
        </button>
      </header>

      <!-- Main Registration Container -->
      <div class="sx-form-container">
        <div class="sx-portal-eyebrow">CREATE ACCOUNT</div>
        <h1 class="sx-portal-title">Đăng ký</h1>
        <p class="sx-portal-subtitle">
          Tạo tài khoản và đăng ký khuôn mặt để sử dụng hệ thống chấm công sinh trắc học.
        </p>

        <!-- Account Information Form -->
        <form @submit.prevent="handleRegisterSubmit" class="sx-auth-form" novalidate>
          <!-- Full Name -->
          <div class="sx-field">
            <label for="reg-fullname" class="sx-field-label">HỌ VÀ TÊN</label>
            <div class="sx-input-box">
              <span class="sx-input-icon">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
              </span>
              <input
                id="reg-fullname"
                v-model="fullName"
                type="text"
                placeholder="Nguyễn Văn An"
                :class="['sx-input', { 'is-error': errors.fullName }]"
                @blur="validateField('fullName')"
                @input="errors.fullName && validateField('fullName')"
              />
            </div>
            <p v-if="errors.fullName" class="sx-field-error">{{ errors.fullName }}</p>
          </div>

          <!-- Employee ID -->
          <div class="sx-field">
            <label for="reg-empid" class="sx-field-label">MÃ NHÂN VIÊN</label>
            <div class="sx-input-box">
              <span class="sx-input-icon">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                  <rect x="3" y="4" width="18" height="16" rx="2"/>
                  <circle cx="9" cy="10" r="2"/>
                  <path d="M14 9h4M14 13h4"/>
                </svg>
              </span>
              <input
                id="reg-empid"
                v-model="employeeId"
                type="text"
                placeholder="SX-00123"
                :class="['sx-input', { 'is-error': errors.employeeId }]"
                @blur="validateField('employeeId')"
                @input="errors.employeeId && validateField('employeeId')"
              />
            </div>
            <p v-if="errors.employeeId" class="sx-field-error">{{ errors.employeeId }}</p>
          </div>

          <!-- Company Email -->
          <div class="sx-field">
            <label for="reg-email" class="sx-field-label">EMAIL CÔNG TY</label>
            <div class="sx-input-box">
              <span class="sx-input-icon">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                  <rect x="2" y="4" width="20" height="16" rx="2"/>
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                </svg>
              </span>
              <input
                id="reg-email"
                v-model="email"
                type="email"
                placeholder="nhanvien@spacex.com"
                :class="['sx-input', { 'is-error': errors.email }]"
                @blur="validateField('email')"
                @input="errors.email && validateField('email')"
              />
            </div>
            <p v-if="errors.email" class="sx-field-error">{{ errors.email }}</p>
          </div>

          <!-- Password + 4-Bar Strength Meter -->
          <div class="sx-field">
            <label for="reg-password" class="sx-field-label">MẬT KHẨU</label>
            <div class="sx-input-box">
              <span class="sx-input-icon">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              </span>
              <input
                id="reg-password"
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                placeholder="Ít nhất 8 ký tự, chữ hoa, số & ký tự đặc biệt"
                :class="['sx-input', { 'is-error': errors.password }]"
                autocomplete="new-password"
                @blur="validateField('password')"
                @input="errors.password && validateField('password')"
              />
              <button
                type="button"
                class="sx-eye-btn"
                @click="showPassword = !showPassword"
                aria-label="Hiển thị hoặc ẩn mật khẩu"
              >
                <svg v-if="!showPassword" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
                <svg v-else width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                  <line x1="1" y1="1" x2="23" y2="23"/>
                </svg>
              </button>
            </div>

            <div class="sx-strength-row">
              <div class="sx-strength-bars">
                <span
                  v-for="idx in 4"
                  :key="idx"
                  class="sx-strength-bar"
                  :style="{
                    backgroundColor: idx <= passwordStrength.level ? passwordStrength.color : 'rgba(255,255,255,0.08)'
                  }"
                ></span>
              </div>
              <span class="sx-strength-label" :style="{ color: passwordStrength.color }">
                {{ passwordStrength.label }}
              </span>
            </div>
            <p v-if="errors.password" class="sx-field-error">{{ errors.password }}</p>
            <p
              v-else-if="password && passwordStrength.level < 3"
              class="sx-field-hint"
            >
              Gợi ý: cần thêm {{ passwordStrength.missing.join(', ') }}
            </p>
          </div>

          <!-- Confirm Password -->
          <div class="sx-field">
            <label for="reg-confirm-password" class="sx-field-label">XÁC NHẬN MẬT KHẨU</label>
            <div class="sx-input-box">
              <span class="sx-input-icon">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              </span>
              <input
                id="reg-confirm-password"
                v-model="confirmPassword"
                :type="showConfirmPassword ? 'text' : 'password'"
                placeholder="Nhập lại mật khẩu"
                :class="['sx-input', { 'is-error': errors.confirmPassword }]"
                autocomplete="new-password"
                @blur="validateField('confirmPassword')"
                @input="errors.confirmPassword && validateField('confirmPassword')"
              />
              <button
                type="button"
                class="sx-eye-btn"
                @click="showConfirmPassword = !showConfirmPassword"
                aria-label="Hiển thị hoặc ẩn mật khẩu xác nhận"
              >
                <svg v-if="!showConfirmPassword" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
                <svg v-else width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                  <line x1="1" y1="1" x2="23" y2="23"/>
                </svg>
              </button>
            </div>
            <p v-if="errors.confirmPassword" class="sx-field-error">{{ errors.confirmPassword }}</p>
          </div>

          <!-- Consent Checkboxes -->
          <div class="sx-consents">
            <label class="sx-consent-item">
              <input
                v-model="agreeTerms"
                type="checkbox"
                class="sx-checkbox"
                @change="errors.consents && validateField('consents')"
              />
              <span class="sx-checkbox-ui">
                <svg v-if="agreeTerms" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </span>
              <span>
                Tôi đồng ý với <a href="#terms" @click.prevent>Điều khoản sử dụng</a> và
                <a href="#privacy" @click.prevent>Chính sách bảo mật</a>.
              </span>
            </label>

            <label class="sx-consent-item">
              <input
                v-model="agreeBiometric"
                type="checkbox"
                class="sx-checkbox"
                @change="errors.consents && validateField('consents')"
              />
              <span class="sx-checkbox-ui">
                <svg v-if="agreeBiometric" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </span>
              <span>
                Tôi đồng ý cho hệ thống thu thập và xử lý dữ liệu sinh trắc học khuôn mặt phục vụ chấm công.
              </span>
            </label>
            <p v-if="errors.consents" class="sx-field-error">{{ errors.consents }}</p>
          </div>

          <!-- Primary White CTA Button -->
          <button type="submit" class="sx-btn-submit" :disabled="isSubmitting">
            <span>{{ isSubmitting ? 'ĐANG ĐĂNG KÝ...' : '→ ĐĂNG KÝ TÀI KHOẢN' }}</span>
          </button>
        </form>
      </div>

      <!-- Bottom Security Footer -->
      <footer class="sx-panel-footer">
        <div class="sx-register-row">
          <span>Đã có tài khoản?</span>
          <a href="#login" class="sx-register-link" @click.prevent="emit('navigate', 'login')">
            Đăng nhập
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
.sx-reg-split {
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
.sx-reg-visual {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 28px 36px 32px;
  overflow: hidden;
  background-color: #02060c;
  border-right: 1px dashed rgba(148, 163, 184, 0.32);
}

.sx-visual-bg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: 68% 34%;
  opacity: 0.72;
  filter: hue-rotate(16deg) saturate(1.25) contrast(1.08);
  pointer-events: none;
}

.sx-visual-vignette {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 52% 42%, rgba(14, 165, 233, 0.2) 0%, rgba(2, 6, 12, 0.65) 58%, #02050a 96%),
    linear-gradient(180deg, rgba(2, 5, 10, 0.75) 0%, transparent 22%, transparent 55%, rgba(2, 5, 10, 0.96) 100%);
  pointer-events: none;
}

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
  color: rgba(103, 232, 249, 0.85);
}

.sx-hud-reticle {
  position: relative;
  width: 225px;
  height: 135px;
}

.r-corner {
  position: absolute;
  width: 18px;
  height: 18px;
  border-color: rgba(56, 189, 248, 0.78);
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

.sx-hud-id-tag {
  position: absolute;
  right: 6px;
  bottom: -24px;
  font-family: var(--font-mono);
  font-size: 0.6rem;
  letter-spacing: 0.14em;
  color: rgba(148, 163, 184, 0.8);
}

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
  line-height: 1.22;
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

.sx-st-label { color: #64748b; }
.sx-st-val { color: #e2e8f0; font-weight: 600; }
.sx-st-val.nominal { color: #10b981; }

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
   RIGHT CREATE ACCOUNT PANEL
   =========================== */
.sx-reg-panel {
  position: relative;
  overflow: hidden;
  background-color: #000000;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 26px 48px 28px;
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

.sx-form-container {
  position: relative;
  z-index: 2;
  width: 100%;
  max-width: 410px;
  margin: 22px auto;
}

.sx-portal-eyebrow {
  font-family: var(--font-mono);
  font-size: 0.64rem;
  letter-spacing: 0.22em;
  color: #64748b;
  margin-bottom: 8px;
}

.sx-portal-title {
  font-size: 1.9rem;
  font-weight: 600;
  letter-spacing: -0.02em;
  color: #ffffff;
  margin-bottom: 6px;
}

.sx-portal-subtitle {
  font-size: 0.82rem;
  line-height: 1.5;
  color: #64748b;
  margin-bottom: 24px;
}

/* Auth Form */
.sx-auth-form {
  display: flex;
  flex-direction: column;
  gap: 13px;
}

.sx-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.sx-field-label {
  font-family: var(--font-mono);
  font-size: 0.6rem;
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
  left: 13px;
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
  padding: 11px 38px 11px 40px;
  font-family: var(--font-sans);
  font-size: 0.85rem;
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
  border-color: rgba(244, 63, 94, 0.85);
  background: rgba(244, 63, 94, 0.05);
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
  margin: 4px 0 0;
  font-size: 0.72rem;
  color: #fb7185;
  line-height: 1.4;
}

.sx-field-hint {
  margin: 4px 0 0;
  font-size: 0.7rem;
  color: #94a3b8;
  line-height: 1.4;
}

.sx-eye-btn {
  position: absolute;
  right: 10px;
  background: transparent;
  border: none;
  color: #64748b;
  cursor: pointer;
  display: flex;
  align-items: center;
  padding: 4px;
}
.sx-eye-btn:hover { color: #e2e8f0; }

/* Password Strength Bar */
.sx-strength-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 2px;
}

.sx-strength-bars {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 5px;
}

.sx-strength-bar {
  height: 2px;
  transition: background-color 0.25s ease;
}

.sx-strength-label {
  font-family: var(--font-mono);
  font-size: 0.58rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  min-width: 44px;
  text-align: right;
}

/* Consents */
.sx-consents {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 2px;
}

.sx-consent-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 0.72rem;
  line-height: 1.45;
  color: #94a3b8;
  cursor: pointer;
  user-select: none;
}

.sx-consent-item a {
  color: #38bdf8;
  text-decoration: none;
}
.sx-consent-item a:hover {
  text-decoration: underline;
}

.sx-checkbox {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

.sx-checkbox-ui {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  margin-top: 2px;
  border-radius: 2px;
  border: 1px solid rgba(255, 255, 255, 0.25);
  background: #06090e;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
}

.sx-checkbox:checked + .sx-checkbox-ui {
  background: #0284c7;
  border-color: #0ea5e9;
}

/* Submit Button */
.sx-btn-submit {
  width: 100%;
  background: #ffffff;
  color: #000000;
  border: 1px solid #ffffff;
  border-radius: 2px;
  padding: 13px;
  font-family: var(--font-sans);
  font-size: 0.76rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  cursor: pointer;
  margin-top: 4px;
  transition: all 0.2s ease;
}

.sx-btn-submit:hover:not(:disabled) {
  background: #e2e8f0;
}

.sx-btn-submit:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

/* Footer */
.sx-panel-footer {
  position: relative;
  z-index: 2;
  width: 100%;
  max-width: 410px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
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
.sx-e2ee-note svg { color: #10b981; }

@media (max-width: 980px) {
  .sx-reg-split {
    grid-template-columns: 1fr;
  }
  .sx-reg-visual {
    display: none;
  }
  .sx-reg-panel {
    padding: 24px 24px 28px;
  }
}
</style>


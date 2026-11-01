<script setup>
import { ref } from 'vue'
import SpaceXLogo from './SpaceXLogo.vue'
import { sound } from '../utils/sound'

const emit = defineEmits(['login-success', 'navigate', 'notify'])

// Selected role: 'educator' | 'face_reg' | 'student'
const selectedRole = ref('educator')
const username = ref('teacher.spacex')
const password = ref('••••••••')
const showPassword = ref(false)
const isLoading = ref(false)

function selectRole(role) {
  selectedRole.value = role
  sound.playBeep()
  if (role === 'face_reg') {
    emit('navigate', 'enrollment')
  }
}

function handleLogin() {
  if (!username.value.trim()) {
    emit('notify', { type: 'error', message: 'Vui lòng nhập tên đăng nhập!' })
    sound.playWarning()
    return
  }

  isLoading.value = true
  sound.playBeep()

  setTimeout(() => {
    isLoading.value = false
    sound.playSuccess()
    emit('notify', { 
      type: 'success', 
      message: `Đăng nhập thành công! Chào mừng Giáo viên trở lại hệ thống SpaceX.` 
    })
    emit('login-success')
    emit('navigate', 'scanner') // Navigate to iPad Scanner
  }, 600)
}
</script>

<template>
  <div class="login-page">
    <!-- Back to Home button -->
    <button class="back-home-btn" @click="emit('navigate', 'landing')" title="Quay về Trang chủ">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M19 12H5"/>
        <polyline points="12 19 5 12 12 5"/>
      </svg>
      <span>Trang chủ</span>
    </button>

    <!-- Layered 3D Papercut Cloud Landscape Background matching screenshot -->
    <div class="papercut-bg-scene">
      <!-- Sunset warm sunburst glow -->
      <div class="sunset-glow"></div>

      <!-- Faint Holographic AI Face Silhouette in Center -->
      <div class="hologram-face">
        <svg viewBox="0 0 200 240" fill="none" xmlns="http://www.w3.org/2000/svg">
          <ellipse cx="100" cy="110" rx="60" ry="85" fill="white" fill-opacity="0.25" filter="blur(20px)" />
          <ellipse cx="78" cy="100" rx="12" ry="7" fill="#38BDF8" fill-opacity="0.4" />
          <ellipse cx="122" cy="100" rx="12" ry="7" fill="#38BDF8" fill-opacity="0.4" />
          <path d="M100 100V135H92" stroke="#FFFFFF" stroke-opacity="0.3" stroke-width="3" stroke-linecap="round"/>
          <path d="M85 155C92 162 108 162 115 155" stroke="#FFFFFF" stroke-opacity="0.3" stroke-width="3" stroke-linecap="round"/>
        </svg>
      </div>

      <!-- Giant SpaceX Watermark in Background (Exact from Page 1) -->
      <div class="spacex-hero-watermark" aria-hidden="true">
        <svg viewBox="0 0 1000 160" fill="none" class="watermark-svg" xmlns="http://www.w3.org/2000/svg">
          <text x="50%" y="65%" text-anchor="middle" dominant-baseline="middle" class="watermark-text">
            SPACEX
          </text>
          <!-- Orbital rocket trajectory swoosh through the X -->
          <path d="M 720 135 C 830 85 920 30 980 5" stroke="#FFE600" stroke-width="5" stroke-linecap="round" class="watermark-arc" />
        </svg>
      </div>

      <!-- 3D Layered Cloud Waves -->
      <div class="cloud-layer cloud-back-coral"></div>
      <div class="cloud-layer cloud-mid-white"></div>
      <div class="cloud-layer cloud-front-blue"></div>
      
      <!-- Puffy Floating 3D Spheres -->
      <div class="sphere sphere-1"></div>
      <div class="sphere sphere-2"></div>
      <div class="sphere sphere-3"></div>
      <div class="sphere sphere-4"></div>
    </div>

    <!-- Main Glassmorphism Login Card matching screenshot -->
    <div class="login-card-wrapper">
      <div class="glass-login-card">
        <!-- Logo Header: Official SpaceX Logo ONLY (No extra line 2 text) -->
        <div class="login-header">
          <div class="login-logo-container">
            <SpaceXLogo />
          </div>
        </div>

        <!-- 3 Role Selection Cards -->
        <div class="role-selector-grid">
          <!-- 1. Face Registration Card -->
          <div 
            class="role-card" 
            :class="{ active: selectedRole === 'face_reg' }"
            @click="selectRole('face_reg')"
          >
            <div class="role-avatar-wrap">
              <img 
                src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80" 
                alt="Face Registration" 
                class="role-avatar-img"
              />
            </div>
            <div class="role-name">
              <span>Face</span>
              <span>Registration</span>
            </div>
          </div>

          <!-- 2. Educator Account Card (Active Default) -->
          <div 
            class="role-card" 
            :class="{ active: selectedRole === 'educator' }"
            @click="selectRole('educator')"
          >
            <div class="role-avatar-wrap">
              <img 
                src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=150&q=80" 
                alt="Educator Account" 
                class="role-avatar-img"
              />
            </div>
            <div class="role-name">
              <span>Educator</span>
              <span>Account</span>
            </div>
          </div>

          <!-- 3. Student Account Card (Coming Soon) -->
          <div 
            class="role-card disabled" 
            title="Tính năng tài khoản học sinh đang được phát triển"
          >
            <span class="coming-soon-badge">Coming Soon</span>
            <div class="role-avatar-wrap">
              <img 
                src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80" 
                alt="Student Account" 
                class="role-avatar-img"
              />
            </div>
            <div class="role-name text-muted">
              <span>Student</span>
              <span>Account</span>
            </div>
          </div>
        </div>

        <!-- Login Form -->
        <form @submit.prevent="handleLogin" class="login-form">
          <!-- Username Input -->
          <div class="login-input-group">
            <span class="input-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
            </span>
            <input 
              type="text" 
              v-model="username" 
              placeholder="Enter your username" 
              class="login-input"
              required
            />
          </div>

          <!-- Password Input -->
          <div class="login-input-group">
            <span class="input-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </span>
            <input 
              :type="showPassword ? 'text' : 'password'" 
              v-model="password" 
              placeholder="Enter your password" 
              class="login-input"
              required
            />
            <span class="input-eye-icon" @click="showPassword = !showPassword">
              <svg v-if="!showPassword" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
              <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                <line x1="1" y1="1" x2="23" y2="23"/>
              </svg>
            </span>
          </div>

          <!-- Forgot Password Link -->
          <div class="forgot-row">
            <a href="#forgot" class="forgot-link" @click.prevent="emit('notify', { type: 'info', message: 'Vui lòng liên hệ quản trị viên để cấp lại mật khẩu!' })">
              Forgot Password?
            </a>
          </div>

          <!-- Sign In Submit Button -->
          <button 
            type="submit" 
            class="btn-sign-in" 
            :disabled="isLoading"
          >
            <span v-if="isLoading" class="btn-loader">Đang xác thực...</span>
            <span v-else>Sign In</span>
          </button>
        </form>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  position: relative;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  font-family: var(--font-sans);
  background-color: #f87171; /* Fallback coral */
}

/* Back Button */
.back-home-btn {
  position: absolute;
  top: 24px;
  left: 32px;
  z-index: 50;
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(15, 23, 42, 0.4);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #ffffff;
  padding: 8px 16px;
  border-radius: 9999px;
  font-weight: 600;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.25s ease;
}
.back-home-btn:hover {
  background: rgba(15, 23, 42, 0.7);
  transform: translateX(-3px);
}

/* 3D Papercut Background Scene */
.papercut-bg-scene {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
  background: linear-gradient(180deg, #ea580c 0%, #f43f5e 40%, #fb7185 70%, #93c5fd 100%);
}

.sunset-glow {
  position: absolute;
  top: 20%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 600px;
  height: 600px;
  border-radius: 50%;
  background: radial-gradient(circle, #fde047 0%, #fb923c 45%, transparent 75%);
  filter: blur(40px);
  opacity: 0.85;
}

/* Hologram AI Face Silhouette */
.hologram-face {
  position: absolute;
  top: 48%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 220px;
  height: 260px;
  opacity: 0.65;
  filter: drop-shadow(0 0 25px rgba(255, 255, 255, 0.4));
  z-index: 2;
}

/* SpaceX Giant Background Watermark (Exact from Page 1, positioned in upper sunset sky) */
.spacex-hero-watermark {
  position: absolute;
  top: 15%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 92%;
  max-width: 1250px;
  pointer-events: none;
  z-index: 3;
  opacity: 0.15; /* Beautiful, clearly visible SpaceX watermark across the sky */
  user-select: none;
  transition: opacity 0.5s ease;
}

.watermark-svg {
  width: 100%;
  height: auto;
  display: block;
}

.watermark-text {
  font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
  font-weight: 900;
  font-size: 150px;
  letter-spacing: 0.24em;
  fill: #ffffff;
  text-shadow: 0 0 30px rgba(255, 255, 255, 0.4);
}

.watermark-arc {
  opacity: 0.95;
  filter: drop-shadow(0 0 8px rgba(255, 230, 0, 0.8));
}

/* Layered Papercut Waves */
.cloud-layer {
  position: absolute;
  left: -5%;
  right: -5%;
  height: 55%;
  background-repeat: no-repeat;
  background-size: cover;
  border-radius: 50% 50% 0 0;
}

.cloud-back-coral {
  top: 0;
  height: 38%;
  background: radial-gradient(ellipse at 50% 0%, #be123c 0%, #e11d48 50%, transparent 80%);
  opacity: 0.7;
}

.cloud-mid-white {
  bottom: 0;
  height: 36%;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.45) 0%, rgba(241, 245, 249, 0.7) 100%);
  backdrop-filter: blur(20px);
  border-radius: 40% 40% 0 0;
  box-shadow: 0 -20px 40px rgba(0, 0, 0, 0.15);
  z-index: 4;
}

.cloud-front-blue {
  bottom: -5%;
  height: 28%;
  background: linear-gradient(180deg, #93c5fd 0%, #60a5fa 50%, #3b82f6 100%);
  border-radius: 35% 35% 0 0;
  opacity: 0.9;
  z-index: 5;
  box-shadow: 0 -15px 30px rgba(0, 0, 0, 0.1);
}

/* Floating Spheres */
.sphere {
  position: absolute;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 35%, #ffffff 0%, #cbd5e1 60%, #94a3b8 100%);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25);
  z-index: 6;
}
.sphere-1 { width: 90px; height: 90px; top: 12%; left: 8%; background: radial-gradient(circle at 35% 35%, #fda4af, #f43f5e); }
.sphere-2 { width: 110px; height: 110px; top: 8%; right: 12%; background: radial-gradient(circle at 35% 35%, #fda4af, #e11d48); }
.sphere-3 { width: 75px; height: 75px; top: 18%; right: 28%; background: radial-gradient(circle at 35% 35%, #ffffff, #e2e8f0); }
.sphere-4 { width: 65px; height: 65px; bottom: 35%; right: 30%; background: radial-gradient(circle at 35% 35%, #fecdd3, #fb7185); }

/* Main Glass Card */
.login-card-wrapper {
  position: relative;
  z-index: 20;
  width: 100%;
  max-width: 480px;
  padding: 20px;
}

.glass-login-card {
  position: relative;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.42);
  backdrop-filter: blur(28px);
  -webkit-backdrop-filter: blur(28px);
  border: 1.5px solid rgba(255, 255, 255, 0.75);
  border-radius: 28px;
  padding: 32px 30px 28px;
  box-shadow: 
    0 25px 60px rgba(0, 0, 0, 0.25),
    inset 0 0 25px rgba(255, 255, 255, 0.5);
}

/* Header with SpaceX Logo ONLY */
.login-header {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  margin-bottom: 24px;
}

.login-logo-container {
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Role Selector Grid matching screenshot */
.role-selector-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-bottom: 24px;
}

.role-card {
  position: relative;
  background: rgba(255, 255, 255, 0.4);
  border: 1.5px solid rgba(255, 255, 255, 0.6);
  border-radius: 14px;
  padding: 14px 6px 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  user-select: none;
}

.role-card:hover:not(.disabled) {
  background: rgba(255, 255, 255, 0.6);
  transform: translateY(-2px);
}

.role-card.active {
  background: rgba(255, 255, 255, 0.7);
  border-color: #3b82f6; /* Blue border like educator active in screenshot */
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.35);
}

.role-card.disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.role-avatar-wrap {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  overflow: hidden;
  border: 1.5px solid #ffffff;
  margin-bottom: 8px;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
}

.role-avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.role-name {
  font-size: 0.775rem;
  font-weight: 700;
  color: #0f172a;
  line-height: 1.25;
  display: flex;
  flex-direction: column;
}

.coming-soon-badge {
  position: absolute;
  top: -8px;
  right: -4px;
  background: #fde047;
  color: #854d0e;
  font-size: 0.6rem;
  font-weight: 800;
  padding: 2px 6px;
  border-radius: 9999px;
  white-space: nowrap;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
}

/* Form */
.login-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.login-input-group {
  position: relative;
  display: flex;
  align-items: center;
}

.input-icon {
  position: absolute;
  left: 14px;
  color: #64748b;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.input-eye-icon {
  position: absolute;
  right: 14px;
  color: #64748b;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
}
.input-eye-icon:hover {
  color: #1e293b;
}

.login-input {
  width: 100%;
  padding: 13px 40px 13px 42px;
  background: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.8);
  border-radius: 12px;
  font-family: var(--font-sans);
  font-size: 0.925rem;
  color: #0f172a;
  outline: none;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.04);
  transition: all 0.2s ease;
}

.login-input::placeholder {
  color: #94a3b8;
}

.login-input:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
}

.forgot-row {
  display: flex;
  justify-content: flex-end;
  margin-top: -4px;
  margin-bottom: 6px;
}

.forgot-link {
  font-size: 0.8rem;
  font-weight: 600;
  color: #334155;
  text-decoration: none;
  transition: color 0.2s;
}
.forgot-link:hover {
  color: #0f172a;
  text-decoration: underline;
}

/* Sign In Button */
.btn-sign-in {
  width: 100%;
  padding: 13px;
  background: #334155; /* Slate dark from screenshot */
  color: #ffffff;
  border: none;
  border-radius: 12px;
  font-family: var(--font-sans);
  font-weight: 700;
  font-size: 0.95rem;
  cursor: pointer;
  box-shadow: 0 4px 15px rgba(51, 65, 85, 0.35);
  transition: all 0.25s ease;
  user-select: none;
}

.btn-sign-in:hover {
  background: #1e293b;
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(15, 23, 42, 0.45);
}

.btn-sign-in:active {
  transform: translateY(0);
}

@media (max-width: 600px) {
  .glass-login-card {
    padding: 24px 20px;
  }
  .role-selector-grid {
    gap: 8px;
  }
}
</style>

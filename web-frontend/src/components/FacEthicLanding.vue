<script setup>
import { ref } from 'vue'
import SpaceXLogo from './SpaceXLogo.vue'

const emit = defineEmits(['navigate'])

const showCookieBanner = ref(!localStorage.getItem('facethic_cookies_accepted'))
const currentLang = ref('Vi') // 'En' | 'Vi'

function acceptCookies() {
  localStorage.setItem('facethic_cookies_accepted', 'true')
  showCookieBanner.value = false
}

function rejectCookies() {
  localStorage.setItem('facethic_cookies_accepted', 'false')
  showCookieBanner.value = false
}

function goTo(tab) {
  emit('navigate', tab)
}
</script>

<template>
  <div class="landing-page">
    <!-- Navbar matching screenshot -->
    <header class="facethic-nav">
      <div class="nav-container">
        <!-- SpaceX Logo -->
        <SpaceXLogo @click="goTo('landing')" />

        <!-- Links -->
        <nav class="nav-links">
          <a href="#home" class="nav-link active">Home</a>
          <a href="#about" class="nav-link">About us</a>
          <div class="nav-dropdown">
            <a href="#benefits" class="nav-link">
              Benefits
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="m6 9 6 6 6-6"/>
              </svg>
            </a>
          </div>
          <a href="#product" class="nav-link" @click.prevent="goTo('scanner')">Product</a>
          <a href="#vision" class="nav-link">Vision</a>
          <button class="nav-login-btn" @click="goTo('login')">Login</button>

          <!-- Lang switch -->
          <div class="lang-switch">
            <span :class="{ active: currentLang === 'En' }" @click="currentLang = 'En'">En</span>
            <span class="lang-divider"></span>
            <span :class="{ active: currentLang === 'Vi' }" @click="currentLang = 'Vi'">Vi</span>
          </div>
        </nav>
      </div>
    </header>

    <!-- Hero Section -->
    <section class="hero-section" id="home">
      <!-- Dark particle / fireworks glow background -->
      <div class="hero-bg-overlay"></div>
      <div class="hero-sparks"></div>

      <!-- Giant SpaceX Watermark in Background -->
      <div class="spacex-hero-watermark" aria-hidden="true">
        <svg viewBox="0 0 1000 160" fill="none" class="watermark-svg" xmlns="http://www.w3.org/2000/svg">
          <text x="50%" y="65%" text-anchor="middle" dominant-baseline="middle" class="watermark-text">
            SPACEX
          </text>
          <!-- Orbital rocket trajectory swoosh through the X -->
          <path d="M 720 135 C 830 85 920 30 980 5" stroke="#FFE600" stroke-width="5" stroke-linecap="round" class="watermark-arc" />
        </svg>
      </div>

      <div class="hero-content">
        <div class="hero-badge">AI-POWERED SMART EDUCATION</div>
        
        <!-- Big Yellow Headline like the screenshot -->
        <h1 class="hero-title">
          <span class="text-yellow-glow">DAILY</span>
          <span class="hero-subline">STUDENT RECORD MANAGEMENT SYSTEM</span>
        </h1>

        <p class="hero-desc">
          Giải pháp điểm danh tự động bằng nhận diện khuôn mặt thế hệ mới. 
          Chỉ cần đứng trước camera iPad, hệ thống AI sẽ định danh sinh viên và lưu chuyên cần trong 0.3 giây.
        </p>

        <!-- CTA Buttons -->
        <div class="hero-cta-group">
          <button class="btn-yellow-solid" @click="goTo('scanner')">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M3 7V5a2 2 0 0 1 2-2h2"/>
              <path d="M17 3h2a2 2 0 0 1 2 2v2"/>
              <path d="M21 17v2a2 2 0 0 1-2 2h-2"/>
              <path d="M7 21H5a2 2 0 0 1-2-2v-2"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
            <span>Mở Máy Quét Điểm Danh (iPad)</span>
          </button>

          <button class="btn-yellow-outline" @click="goTo('enrollment')">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <line x1="19" y1="8" x2="19" y2="14"/>
              <line x1="22" y1="11" x2="16" y2="11"/>
            </svg>
            <span>Đăng Ký Khuôn Mặt Sinh Viên</span>
          </button>

          <button class="btn-glass" @click="goTo('dashboard')">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="20" x2="18" y2="10"/>
              <line x1="12" y1="20" x2="12" y2="4"/>
              <line x1="6" y1="20" x2="6" y2="14"/>
            </svg>
            <span>Báo Cáo Chuyên Cần</span>
          </button>
        </div>
      </div>
    </section>

    <!-- Cookie Banner exactly as in screenshot -->
  </div>
</template>

<style scoped>
.landing-page {
  min-height: 100vh;
  background-color: #050608;
  color: #ffffff;
  position: relative;
  overflow-x: hidden;
  font-family: var(--font-sans);
}

/* Nav */
.facethic-nav {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 50;
  padding: 24px 48px;
  background: transparent;
}

.nav-container {
  max-width: 1440px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.logo-box {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
}

.facethic-logo-svg {
  width: 36px;
  height: 36px;
}

.logo-text {
  font-size: 1.35rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: #ffffff;
}

.nav-links {
  display: flex;
  align-items: center;
  gap: 32px;
}

.nav-link {
  color: #ffffff;
  text-decoration: none;
  font-size: 0.95rem;
  font-weight: 600;
  transition: color 0.2s ease;
  display: flex;
  align-items: center;
  gap: 4px;
}

.nav-link:hover,
.nav-link.active {
  color: #FFE600;
}

.nav-login-btn {
  background: transparent;
  color: #ffffff;
  border: none;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  transition: color 0.2s ease;
}
.nav-login-btn:hover {
  color: #FFE600;
}

.lang-switch {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.9rem;
  font-weight: 600;
  color: #94a3b8;
  cursor: pointer;
  margin-left: 8px;
}
.lang-switch span.active {
  color: #ffffff;
}
.lang-divider {
  width: 1px;
  height: 14px;
  background: rgba(255, 255, 255, 0.25);
}

/* Hero Section */
.hero-section {
  position: relative;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 120px 24px 100px;
  background: radial-gradient(circle at 50% 30%, #151922 0%, #050608 75%);
}

.hero-bg-overlay {
  position: absolute;
  inset: 0;
  background-image: 
    radial-gradient(circle at 75% 45%, rgba(255, 230, 0, 0.08) 0%, transparent 40%),
    radial-gradient(circle at 25% 65%, rgba(56, 189, 248, 0.06) 0%, transparent 45%);
  pointer-events: none;
}

.hero-sparks {
  position: absolute;
  inset: 0;
  background-image: radial-gradient(rgba(255, 255, 255, 0.15) 1px, transparent 1px);
  background-size: 48px 48px;
  opacity: 0.35;
  pointer-events: none;
}

/* SpaceX Giant Background Watermark */
.spacex-hero-watermark {
  position: absolute;
  top: 48%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 95%;
  max-width: 1300px;
  pointer-events: none;
  z-index: 1;
  opacity: 0.048; /* Subtle, elegant watermark */
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
}

.watermark-arc {
  opacity: 0.9;
}

.hero-content {
  position: relative;
  z-index: 10;
  max-width: 980px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.hero-badge {
  font-size: 0.775rem;
  font-weight: 800;
  letter-spacing: 0.15em;
  color: #FFE600;
  background: rgba(255, 230, 0, 0.1);
  border: 1px solid rgba(255, 230, 0, 0.25);
  padding: 6px 16px;
  border-radius: 9999px;
  margin-bottom: 24px;
}

.hero-title {
  display: flex;
  flex-direction: column;
  align-items: center;
  line-height: 0.95;
  margin-bottom: 24px;
}

.text-yellow-glow {
  font-size: clamp(4.5rem, 12vw, 8.5rem);
  font-weight: 900;
  letter-spacing: -0.04em;
  color: #FFE600;
  text-shadow: 0 0 60px rgba(255, 230, 0, 0.45);
}

.hero-subline {
  font-size: clamp(1.2rem, 3vw, 2.2rem);
  font-weight: 800;
  letter-spacing: 0.02em;
  color: #ffffff;
  margin-top: 12px;
}

.hero-desc {
  font-size: 1.1rem;
  color: #cbd5e1;
  max-width: 680px;
  line-height: 1.6;
  margin-bottom: 36px;
}

/* CTA Group */
.hero-cta-group {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  justify-content: center;
  margin-bottom: 50px;
}

.btn-yellow-solid {
  background: #FFE600;
  color: #000000;
  font-weight: 700;
  font-size: 1rem;
  padding: 14px 28px;
  border-radius: 12px;
  border: none;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  box-shadow: 0 4px 25px rgba(255, 230, 0, 0.35);
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}
.btn-yellow-solid:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 35px rgba(255, 230, 0, 0.55);
  background: #FFF033;
}

.btn-yellow-outline {
  background: rgba(255, 230, 0, 0.05);
  color: #FFE600;
  font-weight: 700;
  font-size: 1rem;
  padding: 14px 28px;
  border-radius: 12px;
  border: 1.5px solid #FFE600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  transition: all 0.25s ease;
}
.btn-yellow-outline:hover {
  background: rgba(255, 230, 0, 0.15);
  transform: translateY(-2px);
}

.btn-glass {
  background: rgba(255, 255, 255, 0.06);
  color: #ffffff;
  font-weight: 600;
  font-size: 1rem;
  padding: 14px 24px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  transition: all 0.2s ease;
}
.btn-glass:hover {
  background: rgba(255, 255, 255, 0.12);
  border-color: rgba(255, 255, 255, 0.25);
}

@media (max-width: 800px) {
  .facethic-nav {
    padding: 16px 20px;
  }
  .nav-links {
    display: none;
  }
}
</style>

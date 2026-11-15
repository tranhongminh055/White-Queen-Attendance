<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import HeaderNav from './components/HeaderNav.vue'
import FacEthicLanding from './components/FacEthicLanding.vue'
import ScannerView from './components/ScannerView.vue'
import EnrollmentView from './components/EnrollmentView.vue'
import DashboardView from './components/DashboardView.vue'
import SettingsModal from './components/SettingsModal.vue'
import CustomCursor from './components/CustomCursor.vue'
import CookieBanner from './components/CookieBanner.vue'
import LoginView from './components/LoginView.vue'
import RegisterView from './components/RegisterView.vue'
import StudentPortalIntroView from './components/StudentPortalIntroView.vue'
import StudentClassesView from './components/StudentClassesView.vue'
import LecturerRedirectView from './components/LecturerRedirectView.vue'
import FaceLoginView from './components/FaceLoginView.vue'
import SpaceXLogo from './components/SpaceXLogo.vue'
import { storage } from './utils/storage'
import { sound } from './utils/sound'

// Start on 'landing' (The exact facEthic UI from screenshot)
const currentTab = ref('landing')
const navHistory = ref(['landing'])
const historyIndex = ref(0)
const canGoBack = computed(() => historyIndex.value > 0)
const canGoForward = computed(() => historyIndex.value < navHistory.value.length - 1)
const showSettings = ref(false)
const notifications = ref([])
const globalStats = ref({ present: 0, total: 0 })

const cookiesAccepted = ref(localStorage.getItem('facethic_cookies') === 'accepted')
const showCookieBanner = ref(!cookiesAccepted.value)
const cookieAttention = ref(false)

function triggerCookieAttention() {
  showCookieBanner.value = true
  cookieAttention.value = false
  requestAnimationFrame(() => {
    cookieAttention.value = true
    setTimeout(() => {
      cookieAttention.value = false
    }, 500)
  })
}

function handleCookieAccept() {
  cookiesAccepted.value = true
  showCookieBanner.value = false
  sound.playSuccess()
  addNotification({
    type: 'success',
    message: 'Đã chấp nhận Cookie. Bạn có thể chuyển trang ngay!'
  })
}

function handleCookieReject() {
  cookiesAccepted.value = false
  showCookieBanner.value = false
  sound.playWarning()
  addNotification({
    type: 'warning',
    message: 'Bạn đã từ chối Cookie — chuyển trang tạm thời bị dừng cho đến khi Accept.'
  })
}

const protectedTabs = ['face-intro', 'classes', 'scanner', 'enrollment', 'dashboard', 'lecturer-redirect']

function applyTab(tab, pushHistory = true) {
  if (tab !== 'landing' && !cookiesAccepted.value) {
    sound.playWarning()
    triggerCookieAttention()
    addNotification({
      type: 'warning',
      message: 'Vui lòng nhấn Accept Cookie trước khi chuyển trang!'
    })
    return false
  }

  if (protectedTabs.includes(tab) && !storage.getCurrentProfile()) {
    sound.playWarning()
    addNotification({
      type: 'warning',
      message: 'Vui lòng đăng ký và đăng nhập tài khoản trước khi đăng ký khuôn mặt hoặc điểm danh!'
    })
    tab = 'login'
  } else if (
    protectedTabs.includes(tab) &&
    tab !== 'lecturer-redirect' &&
    tab !== 'enrollment' &&
    storage.getCurrentProfile()?.role === 'lecturer'
  ) {
    tab = 'lecturer-redirect'
  }

  if (tab === 'settings') {
    showSettings.value = true
    return false
  }

  if (pushHistory && tab !== currentTab.value) {
    const trimmed = navHistory.value.slice(0, historyIndex.value + 1)
    trimmed.push(tab)
    navHistory.value = trimmed
    historyIndex.value = trimmed.length - 1
    window.history.pushState({ tab, index: historyIndex.value }, '', `#${tab}`)
  }

  currentTab.value = tab
  window.scrollTo({ top: 0, behavior: 'smooth' })
  return true
}

function handleTabChange(tab) {
  applyTab(tab, true)
}

function handleGoBack(fallback = 'landing') {
  if (canGoBack.value) {
    window.history.back()
    return
  }
  applyTab(fallback, true)
}

function handleGoForward() {
  if (canGoForward.value) {
    window.history.forward()
  }
}

function handlePopState(event) {
  const hashTab = window.location.hash ? window.location.hash.replace('#', '') : ''
  const targetTab = event.state?.tab || hashTab || 'landing'
  if (typeof event.state?.index === 'number') {
    historyIndex.value = event.state.index
  } else if (historyIndex.value > 0 && navHistory.value[historyIndex.value - 1] === targetTab) {
    historyIndex.value--
  }
  applyTab(targetTab, false)
}

function handleStatsUpdate(newStats) {
  globalStats.value = newStats
}

function addNotification({ type = 'info', message = '' }) {
  const id = Date.now() + Math.random()
  notifications.value.push({ id, type, message })
  setTimeout(() => {
    notifications.value = notifications.value.filter(n => n.id !== id)
  }, 4000)
}

function removeNotification(id) {
  notifications.value = notifications.value.filter(n => n.id !== id)
}

onMounted(async () => {
  window.history.replaceState({ tab: 'landing', index: 0 }, '', '#landing')
  window.addEventListener('popstate', handlePopState)

  try {
    const mig = await storage.migrateLegacyData()
    if (mig?.migrated && (mig.migrated.accounts > 0 || mig.migrated.embeddings > 0)) {
      addNotification({
        type: 'success',
        message: `Đã đồng bộ ${mig.migrated.accounts} tài khoản và ${mig.migrated.embeddings} góc khuôn mặt vào SQL Server!`
      })
    }
    const verifiedProfile = await storage.verifySessionFromDb()
    if (!verifiedProfile && protectedTabs.includes(currentTab.value)) {
      applyTab('login', false)
    }
    const [students, logs] = await Promise.all([
      storage.getStudents(),
      storage.getAttendanceLogs('CNTT-K21A')
    ])
    globalStats.value = {
      present: logs.length,
      total: students.filter(s => s.classId === 'CNTT-K21A').length
    }
  } catch {
    globalStats.value = { present: 0, total: 0 }
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('popstate', handlePopState)
})
</script>

<template>
  <div class="app-layout">
    <!-- Custom Follower Ring Cursor matching facEthic -->
    <CustomCursor />

    <!-- Show Top Nav on app screens, or custom nav on Landing/Auth/Intro/Enrollment -->
    <HeaderNav 
      v-if="currentTab !== 'landing' && currentTab !== 'login' && currentTab !== 'register' && currentTab !== 'face-login' && currentTab !== 'face-intro' && currentTab !== 'classes' && currentTab !== 'enrollment' && currentTab !== 'lecturer-redirect'"
      :current-tab="currentTab" 
      :stats="globalStats"
      :can-back="canGoBack"
      :can-forward="canGoForward"
      @update:tab="handleTabChange"
      @back="handleGoBack()"
      @forward="handleGoForward()"
    />

    <!-- Main Content Stage -->
    <main class="main-content">
      <transition name="fade" mode="out-in">
        <!-- Exact facEthic Homepage from screenshot -->
        <FacEthicLanding 
          v-if="currentTab === 'landing'" 
          @navigate="handleTabChange" 
        />

        <!-- SpaceX Biometric Login Page -->
        <LoginView 
          v-else-if="currentTab === 'login'" 
          @navigate="handleTabChange"
          @back="handleGoBack('landing')"
          @notify="addNotification"
        />

        <!-- SpaceX Biometric Face Login Page -->
        <FaceLoginView
          v-else-if="currentTab === 'face-login'"
          @navigate="handleTabChange"
          @back="handleGoBack('login')"
          @notify="addNotification"
        />

        <!-- SpaceX Biometric Register Page -->
        <RegisterView
          v-else-if="currentTab === 'register'"
          @navigate="handleTabChange"
          @back="handleGoBack('login')"
          @notify="addNotification"
        />

        <!-- Student Face Onboarding Intro Page (before camera enrollment) -->
        <StudentPortalIntroView
          v-else-if="currentTab === 'face-intro'"
          @navigate="handleTabChange"
          @back="handleGoBack('login')"
          @notify="addNotification"
        />

        <!-- Student Class Registration Page -->
        <StudentClassesView
          v-else-if="currentTab === 'classes'"
          @navigate="handleTabChange"
          @back="handleGoBack('face-intro')"
          @notify="addNotification"
        />

        <!-- Lecturer Desktop Redirect Page -->
        <LecturerRedirectView
          v-else-if="currentTab === 'lecturer-redirect'"
          @navigate="handleTabChange"
          @notify="addNotification"
        />

        <!-- iPad Live Scanner -->
        <ScannerView 
          v-else-if="currentTab === 'scanner'" 
          @notify="addNotification"
          @update:stats="handleStatsUpdate"
        />

        <!-- Student Face Registration -->
        <EnrollmentView 
          v-else-if="currentTab === 'enrollment'" 
          @navigate="handleTabChange"
          @back="handleGoBack('face-intro')"
          @notify="addNotification"
        />

        <!-- Dashboard & Records -->
        <DashboardView 
          v-else-if="currentTab === 'dashboard'" 
          @notify="addNotification"
        />
      </transition>
    </main>

    <!-- Web App Footer (matching Landing Page sx-footer on all other pages) -->
    <footer
      v-if="currentTab !== 'landing'"
      class="app-footer"
    >
      <div class="app-footer-inner">
        <div class="app-footer-brand">
          <SpaceXLogo @click="handleTabChange('landing')" />
        </div>
        <div class="app-footer-subtitle">BIOMETRIC FACE ATTENDANCE &amp; AI VISION SYSTEM</div>

        <div class="app-footer-links">
          <a href="#landing" @click.prevent="handleTabChange('landing')">HOME</a>
          <a href="#scanner" @click.prevent="handleTabChange('scanner')">SCANNER</a>
          <a href="#enrollment" @click.prevent="handleTabChange('enrollment')">ENROLLMENT</a>
          <a href="#dashboard" @click.prevent="handleTabChange('dashboard')">DASHBOARD</a>
          <a href="#login" @click.prevent="handleTabChange('login')">LOGIN</a>
        </div>

        <div class="app-footer-copy">© 2026 SPACEX BIOMETRIC VISION. ALL RIGHTS RESERVED.</div>
      </div>
    </footer>

    <!-- Settings Modal -->
    <SettingsModal 
      v-if="showSettings" 
      @close="showSettings = false"
      @notify="addNotification"
    />

    <!-- Cookie Banner (hidden on auth screens unless blocking redirect) -->
    <CookieBanner
      v-if="currentTab !== 'login' && currentTab !== 'register' && currentTab !== 'face-login' && currentTab !== 'face-intro' && currentTab !== 'enrollment' && currentTab !== 'lecturer-redirect'"
      :visible="showCookieBanner"
      :attention="cookieAttention"
      @accept="handleCookieAccept"
      @reject="handleCookieReject"
    />

    <!-- Toast Notifications Stack -->
    <div class="toast-container">
      <transition-group name="toast">
        <div 
          v-for="toast in notifications" 
          :key="toast.id" 
          class="toast-item"
          :class="toast.type"
          @click="removeNotification(toast.id)"
        >
          <div class="toast-icon">
            <span v-if="toast.type === 'success'">✓</span>
            <span v-else-if="toast.type === 'warning'">⚠</span>
            <span v-else-if="toast.type === 'error'">✕</span>
            <span v-else>ℹ</span>
          </div>
          <div class="toast-text">{{ toast.message }}</div>
          <button class="toast-close">✕</button>
        </div>
      </transition-group>
    </div>
  </div>
</template>

<style scoped>
.app-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: #050608;
}

.main-content {
  flex: 1;
}

/* Page transition */
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}
.fade-enter-from {
  opacity: 0;
  transform: translateY(8px);
}
.fade-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

/* Toast styling */
.toast-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: rgba(15, 23, 42, 0.95);
  backdrop-filter: blur(14px);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-subtle);
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.6);
  cursor: pointer;
  transition: all 0.25s ease;
}

.toast-item.success {
  border-left: 4px solid #FFE600;
}
.toast-item.warning {
  border-left: 4px solid #f59e0b;
}
.toast-item.error {
  border-left: 4px solid #f43f5e;
}
.toast-item.info {
  border-left: 4px solid #38bdf8;
}

.toast-icon {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8rem;
  font-weight: 800;
  flex-shrink: 0;
}
.success .toast-icon { background: rgba(255, 230, 0, 0.2); color: #FFE600; }
.warning .toast-icon { background: rgba(245, 158, 11, 0.2); color: #fbbf24; }
.error .toast-icon { background: rgba(244, 63, 94, 0.2); color: #fb7185; }
.info .toast-icon { background: rgba(56, 189, 248, 0.2); color: #38bdf8; }

.toast-text {
  font-size: 0.875rem;
  font-weight: 500;
  color: #f8fafc;
  flex: 1;
}

.toast-close {
  background: transparent;
  border: none;
  color: var(--text-dim);
  font-size: 0.9rem;
  cursor: pointer;
}

/* Toast animation */
.toast-enter-active, .toast-leave-active {
  transition: all 0.3s ease;
}
.toast-enter-from {
  opacity: 0;
  transform: translateX(50px);
}
.toast-leave-to {
  opacity: 0;
  transform: translateX(50px);
}

/* Global Web App Footer (matching FacEthicLanding sx-footer) */
.app-footer {
  background-color: #000000;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  padding: 64px 24px 48px;
}

.app-footer-inner {
  max-width: 1240px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.app-footer-brand {
  margin-bottom: 12px;
  cursor: pointer;
}

.app-footer-subtitle {
  font-family: 'JetBrains Mono', 'Cascadia Code', monospace;
  font-size: 0.66rem;
  letter-spacing: 0.24em;
  color: #475569;
  margin-bottom: 30px;
}

.app-footer-links {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 28px;
  margin-bottom: 28px;
}

.app-footer-links a {
  color: #64748b;
  text-decoration: none;
  font-family: 'JetBrains Mono', 'Cascadia Code', monospace;
  font-size: 0.68rem;
  letter-spacing: 0.16em;
  transition: color 0.2s ease;
}

.app-footer-links a:hover {
  color: #ffffff;
}

.app-footer-copy {
  font-family: 'JetBrains Mono', 'Cascadia Code', monospace;
  font-size: 0.62rem;
  letter-spacing: 0.12em;
  color: #334155;
}
</style>

<script setup>
import { ref, onMounted } from 'vue'
import HeaderNav from './components/HeaderNav.vue'
import FacEthicLanding from './components/FacEthicLanding.vue'
import ScannerView from './components/ScannerView.vue'
import EnrollmentView from './components/EnrollmentView.vue'
import DashboardView from './components/DashboardView.vue'
import SettingsModal from './components/SettingsModal.vue'
import CustomCursor from './components/CustomCursor.vue'
import CookieBanner from './components/CookieBanner.vue'
import LoginView from './components/LoginView.vue'
import { storage } from './utils/storage'

// Start on 'landing' (The exact facEthic UI from screenshot)
const currentTab = ref('landing')
const showSettings = ref(false)
const notifications = ref([])
const globalStats = ref({ present: 0, total: 0 })

function handleTabChange(tab) {
  if (tab === 'settings') {
    showSettings.value = true
  } else {
    currentTab.value = tab
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
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

onMounted(() => {
  const students = storage.getStudents()
  const logs = storage.getAttendanceLogs('CS101')
  globalStats.value = {
    present: logs.length,
    total: students.filter(s => s.classId === 'CS101').length
  }
})
</script>

<template>
  <div class="app-layout">
    <!-- Custom Follower Ring Cursor matching facEthic -->
    <CustomCursor />

    <!-- Show Top Nav on app screens, or custom nav on Landing/Login -->
    <HeaderNav 
      v-if="currentTab !== 'landing' && currentTab !== 'login'"
      :current-tab="currentTab" 
      :stats="globalStats"
      @update:tab="handleTabChange" 
    />

    <!-- Main Content Stage -->
    <main class="main-content">
      <transition name="fade" mode="out-in">
        <!-- Exact facEthic Homepage from screenshot -->
        <FacEthicLanding 
          v-if="currentTab === 'landing'" 
          @navigate="handleTabChange" 
        />

        <!-- SpaceX 3D Papercut Login Page -->
        <LoginView 
          v-else-if="currentTab === 'login'" 
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
          @notify="addNotification"
        />

        <!-- Dashboard & Records -->
        <DashboardView 
          v-else-if="currentTab === 'dashboard'" 
          @notify="addNotification"
        />
      </transition>
    </main>

    <!-- Settings Modal -->
    <SettingsModal 
      v-if="showSettings" 
      @close="showSettings = false"
      @notify="addNotification"
    />

    <!-- Cookie Banner (hidden on login screen for clean look) -->
    <CookieBanner v-if="currentTab !== 'login'" />

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
</style>

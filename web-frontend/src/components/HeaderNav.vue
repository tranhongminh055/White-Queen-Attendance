<script setup>
import SpaceXLogo from './SpaceXLogo.vue'

defineProps({
  currentTab: {
    type: String,
    required: true
  },
  stats: {
    type: Object,
    default: () => ({ present: 0, total: 0 })
  }
})

const emit = defineEmits(['update:tab'])
</script>

<template>
  <header class="header">
    <div class="header-container">
      <!-- SpaceX Brand Logo -->
      <SpaceXLogo @click="emit('update:tab', 'landing')" title="Quay về Trang chủ SpaceX" />

      <!-- Navigation Tabs -->
      <nav class="nav-tabs">
        <button 
          class="tab-btn" 
          :class="{ active: currentTab === 'landing' }"
          @click="emit('update:tab', 'landing')"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
          <span>Trang chủ</span>
        </button>

        <button 
          class="tab-btn" 
          :class="{ active: currentTab === 'scanner' }"
          @click="emit('update:tab', 'scanner')"
          id="nav-scanner-tab"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 7V5a2 2 0 0 1 2-2h2"/>
            <path d="M17 3h2a2 2 0 0 1 2 2v2"/>
            <path d="M21 17v2a2 2 0 0 1-2 2h-2"/>
            <path d="M7 21H5a2 2 0 0 1-2-2v-2"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
          <span>Máy quét iPad</span>
          <span class="badge-live-yellow">Live</span>
        </button>

        <button 
          class="tab-btn" 
          :class="{ active: currentTab === 'enrollment' }"
          @click="emit('update:tab', 'enrollment')"
          id="nav-enrollment-tab"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <line x1="19" y1="8" x2="19" y2="14"/>
            <line x1="22" y1="11" x2="16" y2="11"/>
          </svg>
          <span>Đăng ký khuôn mặt</span>
        </button>

        <button 
          class="tab-btn" 
          :class="{ active: currentTab === 'dashboard' }"
          @click="emit('update:tab', 'dashboard')"
          id="nav-dashboard-tab"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="20" x2="18" y2="10"/>
            <line x1="12" y1="20" x2="12" y2="4"/>
            <line x1="6" y1="20" x2="6" y2="14"/>
          </svg>
          <span>Báo cáo</span>
        </button>
      </nav>

      <!-- Right controls -->
      <div class="header-right">
        <div class="quick-stat">
          <span class="quick-stat-label">Chuyên cần</span>
          <span class="quick-stat-val">{{ stats.present }} / {{ stats.total }}</span>
        </div>
        <button class="settings-btn" @click="emit('update:tab', 'settings')" title="Cài đặt kết nối backend">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </button>
      </div>
    </div>
  </header>
</template>

<style scoped>
.header {
  position: sticky;
  top: 0;
  z-index: 100;
  background: rgba(8, 10, 14, 0.9);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.header-container {
  max-width: 1400px;
  margin: 0 auto;
  padding: 12px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  user-select: none;
}

.brand-logo-wrap {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.brand-svg {
  width: 100%;
  height: 100%;
}

.brand-name {
  font-size: 1.25rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: #ffffff;
  display: flex;
  align-items: center;
  gap: 6px;
}

.ai-badge {
  font-size: 0.65rem;
  font-weight: 800;
  background: #FFE600;
  color: #000;
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  letter-spacing: 0.05em;
}

.brand-sub {
  font-size: 0.725rem;
  color: var(--text-dim);
  font-weight: 500;
}

.nav-tabs {
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(18, 24, 38, 0.6);
  padding: 4px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-subtle);
}

.tab-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  background: transparent;
  color: var(--text-muted);
  font-family: var(--font-sans);
  font-size: 0.875rem;
  font-weight: 600;
  padding: 8px 16px;
  border-radius: calc(var(--radius-md) - 3px);
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
}

.tab-btn:hover {
  color: #ffffff;
  background: rgba(255, 255, 255, 0.05);
}

.tab-btn.active {
  background: #FFE600;
  color: #000000;
  box-shadow: 0 4px 15px rgba(255, 230, 0, 0.35);
}

.badge-live-yellow {
  font-size: 0.65rem;
  font-weight: 800;
  padding: 2px 6px;
  border-radius: 9999px;
  background: #ef4444;
  color: #ffffff;
}
.tab-btn.active .badge-live-yellow {
  background: #000;
  color: #FFE600;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.quick-stat {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  padding: 4px 12px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-subtle);
}

.quick-stat-label {
  font-size: 0.7rem;
  color: var(--text-dim);
  text-transform: uppercase;
}

.quick-stat-val {
  font-family: var(--font-mono);
  font-size: 0.85rem;
  font-weight: 700;
  color: #FFE600;
}

.settings-btn {
  width: 38px;
  height: 38px;
  border-radius: var(--radius-md);
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--border-subtle);
  color: var(--text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
}

.settings-btn:hover {
  color: #FFE600;
  background: rgba(255, 255, 255, 0.1);
  transform: rotate(45deg);
}

@media (max-width: 900px) {
  .header-container {
    flex-wrap: wrap;
    padding: 10px 16px;
  }
  .nav-tabs {
    order: 3;
    width: 100%;
    justify-content: space-around;
  }
  .tab-btn {
    padding: 8px 10px;
    font-size: 0.8rem;
  }
}
</style>

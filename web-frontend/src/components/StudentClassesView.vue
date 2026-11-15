<script setup>
import { ref, computed, onMounted } from 'vue'
import SpaceXLogo from './SpaceXLogo.vue'
import { storage } from '../utils/storage'
import { sound } from '../utils/sound'

const emit = defineEmits(['navigate', 'back', 'notify'])

const currentProfile = storage.getCurrentProfile()
const joinCodeInput = ref('')
const classes = ref([])
const isLoading = ref(true)
const isJoining = ref(false)
const leavingId = ref(null)
const formError = ref('')

const profile = computed(() => ({
  id: currentProfile?.id || '',
  fullName: currentProfile?.fullName || 'Sinh viên',
  avatar: currentProfile?.avatar || null
}))

const initials = computed(() => {
  const words = (profile.value.fullName || 'SV').trim().split(/\s+/)
  return words
    .slice(-2)
    .map(w => w[0])
    .join('')
    .toUpperCase()
})

async function loadMyClasses() {
  if (!profile.value.id) return
  isLoading.value = true
  try {
    const data = await storage.getStudentClasses(profile.value.id)
    classes.value = Array.isArray(data) ? data : []
  } catch (err) {
    emit('notify', {
      type: 'error',
      message: `Không thể tải danh sách lớp học: ${err.message}`
    })
  } finally {
    isLoading.value = false
  }
}

async function handleJoinClass() {
  const code = joinCodeInput.value.trim().toUpperCase()
  formError.value = ''
  if (!code) {
    sound.playWarning()
    formError.value = 'Vui lòng nhập mã lớp do giảng viên cung cấp.'
    return
  }

  sound.playBeep()
  isJoining.value = true
  try {
    const joinedClass = await storage.joinClassByCode(profile.value.id, code)
    classes.value = [joinedClass, ...classes.value.filter(c => c.id !== joinedClass.id)]
    joinCodeInput.value = ''
    sound.playSuccess()
    emit('notify', {
      type: 'success',
      message: `Đã tham gia lớp ${joinedClass.className} (${joinedClass.joinCode})!`
    })
  } catch (err) {
    sound.playWarning()
    formError.value = err.message || 'Không thể tham gia lớp học.'
  } finally {
    isJoining.value = false
  }
}

async function handleLeaveClass(cls) {
  if (leavingId.value) return
  sound.playBeep()
  leavingId.value = cls.id
  try {
    await storage.leaveClass(profile.value.id, cls.id)
    classes.value = classes.value.filter(c => c.id !== cls.id)
    emit('notify', {
      type: 'info',
      message: `Đã rời khỏi lớp ${cls.className}.`
    })
  } catch (err) {
    sound.playWarning()
    emit('notify', {
      type: 'error',
      message: err.message || 'Không thể rời lớp học.'
    })
  } finally {
    leavingId.value = null
  }
}

onMounted(async () => {
  const verified = await storage.verifySessionFromDb()
  if (!verified) {
    sound.playWarning()
    emit('notify', {
      type: 'warning',
      message: 'Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.'
    })
    emit('navigate', 'login')
    return
  }
  await loadMyClasses()
})
</script>

<template>
  <div class="sx-classes-page">
    <div class="sx-bg-glow"></div>

    <!-- TOP BAR -->
    <header class="sx-cls-header">
      <div class="sx-ch-left">
        <SpaceXLogo @click="emit('navigate', 'face-intro')" title="Quay về Trang sinh viên" />
        <button type="button" class="sx-back-btn" @click="emit('back')">
          ← Quay lại
        </button>
      </div>

      <div class="sx-ch-right">
        <div class="sx-user-meta">
          <span class="sx-user-name">{{ profile.fullName }}</span>
          <span class="sx-user-id">MSSV: {{ profile.id }}</span>
        </div>
        <div class="sx-avatar-circle">
          <img v-if="profile.avatar" :src="profile.avatar" alt="Avatar" />
          <span v-else>{{ initials }}</span>
          <span class="sx-online-dot"></span>
        </div>
      </div>
    </header>

    <main class="sx-cls-main">
      <!-- HERO JOIN CARD -->
      <section class="sx-join-card">
        <div class="sx-join-sheen"></div>
        <div class="sx-join-pill">
          <span class="sx-pill-dot"></span>
          <span>ĐĂNG KÝ LỚP HỌC</span>
        </div>

        <h1 class="sx-join-title">Tham gia lớp học mới</h1>
        <p class="sx-join-subtitle">Nhập mã lớp do giảng viên cung cấp</p>

        <form class="sx-join-form" @submit.prevent="handleJoinClass">
          <div class="sx-input-wrap" :class="{ 'has-error': formError }">
            <svg class="sx-key-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="7.5" cy="15.5" r="4.5" />
              <path d="m21 2-9.6 9.6" />
              <path d="m15.5 7.5 3 3L22 7l-3-3" />
            </svg>
            <input
              v-model="joinCodeInput"
              type="text"
              class="sx-code-input"
              placeholder="W Q - K 2 1 A"
              maxlength="24"
              autocomplete="off"
              @input="formError = ''"
            />
          </div>

          <button type="submit" class="sx-join-btn" :disabled="isJoining">
            <span v-if="isJoining" class="sx-spinner"></span>
            <span>{{ isJoining ? 'Đang xử lý...' : 'Tham gia lớp' }}</span>
            <span v-if="!isJoining" class="sx-btn-arrow">→</span>
          </button>
        </form>

        <p v-if="formError" class="sx-form-error">{{ formError }}</p>
        <div v-else class="sx-join-hint">
          <span class="sx-hint-icon">ⓘ</span>
          <span>Ví dụ mã lớp:</span>
          <span class="sx-code-chip">WQ-K21A</span>
        </div>
      </section>

      <!-- MY CLASSES SECTION -->
      <section class="sx-list-section">
        <div class="sx-list-head">
          <div>
            <div class="sx-list-kicker">DANH SÁCH</div>
            <h2 class="sx-list-title">Lớp học của tôi</h2>
          </div>
          <div class="sx-count-pill">
            <span class="sx-pill-dot"></span>
            <span>{{ classes.length }} LỚP</span>
          </div>
        </div>

        <!-- LOADING SKELETON -->
        <div v-if="isLoading" class="sx-cards-grid">
          <div v-for="n in 3" :key="n" class="sx-class-card sx-skeleton"></div>
        </div>

        <!-- EMPTY REAL STATE (NO MOCK DATA) -->
        <div v-else-if="classes.length === 0" class="sx-empty-state">
          <div class="sx-empty-icon">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
            </svg>
          </div>
          <h3>Bạn chưa tham gia lớp học nào</h3>
          <p>Hãy xin mã lớp từ giảng viên (VD: <code>WQ-K21A</code>) và nhập vào ô phía trên để tham gia lớp học thật trên hệ thống.</p>
        </div>

        <!-- REAL CLASSES GRID -->
        <TransitionGroup v-else name="card-list" tag="div" class="sx-cards-grid">
          <article
            v-for="(cls, idx) in classes"
            :key="cls.id"
            class="sx-class-card"
            :style="{ '--stagger': `${idx * 65}ms` }"
          >
            <div class="sx-card-glow"></div>

            <div class="sx-card-badge">
              {{ cls.joinCode }} · {{ cls.semester }}
            </div>

            <h3 class="sx-card-name">{{ cls.className }}</h3>

            <div class="sx-card-meta">
              <div class="sx-meta-row">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                  <path d="M6 12v5c3 3 9 3 12 0v-5" />
                </svg>
                <span>{{ cls.lecturerName }}</span>
              </div>
              <div class="sx-meta-row">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="9" />
                  <polyline points="12 7 12 12 15 14" />
                </svg>
                <span>
                  {{ [cls.scheduleText, cls.roomText].filter(Boolean).join(' · ') || 'Chưa cập nhật lịch học' }}
                </span>
              </div>
            </div>

            <div class="sx-card-divider"></div>

            <div class="sx-card-footer">
              <button
                type="button"
                class="sx-leave-btn"
                :disabled="leavingId === cls.id"
                @click="handleLeaveClass(cls)"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                <span>{{ leavingId === cls.id ? 'Đang rời...' : 'Rời lớp' }}</span>
              </button>
              <span class="sx-member-count">{{ cls.totalStudents || 1 }} sinh viên</span>
            </div>
          </article>
        </TransitionGroup>
      </section>
    </main>
  </div>
</template>

<style scoped>
.sx-classes-page {
  position: relative;
  min-height: 100vh;
  background: #040608;
  color: #e2e8f0;
  overflow-x: hidden;
  padding-bottom: 64px;
}

.sx-bg-glow {
  position: fixed;
  inset: 0;
  pointer-events: none;
  background:
    radial-gradient(circle at 50% 14%, rgba(14, 165, 233, 0.14), transparent 46%),
    radial-gradient(circle at 80% 75%, rgba(6, 182, 212, 0.06), transparent 42%);
}

/* Header */
.sx-cls-header {
  position: relative;
  z-index: 2;
  max-width: 1280px;
  margin: 0 auto;
  padding: 20px 28px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.sx-ch-left {
  display: flex;
  align-items: center;
  gap: 18px;
}

.sx-back-btn {
  padding: 7px 14px;
  background: rgba(10, 18, 28, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 6px;
  color: #94a3b8;
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.sx-back-btn:hover {
  color: #38bdf8;
  border-color: rgba(56, 189, 248, 0.45);
  background: rgba(14, 165, 233, 0.08);
}

.sx-ch-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.sx-user-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  line-height: 1.25;
}

.sx-user-name {
  font-size: 0.86rem;
  font-weight: 700;
  color: #f8fafc;
}

.sx-user-id {
  font-family: var(--font-mono, monospace);
  font-size: 0.68rem;
  color: #64748b;
}

.sx-avatar-circle {
  position: relative;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: rgba(14, 165, 233, 0.14);
  border: 1px solid rgba(56, 189, 248, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 0.84rem;
  color: #38bdf8;
  overflow: visible;
}

.sx-avatar-circle img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
}

.sx-online-dot {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: #22c55e;
  border: 2px solid #040608;
}

/* Main */
.sx-cls-main {
  position: relative;
  z-index: 2;
  max-width: 1200px;
  margin: 0 auto;
  padding: 42px 24px 0;
}

/* Hero Join Card */
.sx-join-card {
  position: relative;
  max-width: 720px;
  margin: 0 auto 56px;
  padding: 36px 40px 30px;
  border-radius: 16px;
  background: linear-gradient(180deg, rgba(16, 46, 66, 0.72) 0%, rgba(11, 22, 34, 0.92) 100%);
  border: 1px solid rgba(56, 189, 248, 0.25);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.55), 0 0 42px rgba(14, 165, 233, 0.12);
  text-align: center;
  overflow: hidden;
  animation: fadeSlideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
}

.sx-join-sheen {
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at 50% 0%, rgba(56, 189, 248, 0.22), transparent 62%);
  pointer-events: none;
}

.sx-join-pill {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  border-radius: 999px;
  background: rgba(6, 20, 32, 0.75);
  border: 1px solid rgba(56, 189, 248, 0.3);
  font-family: var(--font-mono, monospace);
  font-size: 0.68rem;
  letter-spacing: 0.14em;
  color: #38bdf8;
  margin-bottom: 16px;
}

.sx-pill-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #38bdf8;
  box-shadow: 0 0 8px #38bdf8;
  animation: pulseDot 2s infinite;
}

.sx-join-title {
  position: relative;
  margin: 0 0 8px;
  font-size: 1.95rem;
  font-weight: 800;
  color: #f8fafc;
  letter-spacing: -0.02em;
}

.sx-join-subtitle {
  position: relative;
  margin: 0 0 26px;
  font-size: 0.9rem;
  color: #94a3b8;
}

.sx-join-form {
  position: relative;
  display: flex;
  gap: 12px;
  align-items: stretch;
}

.sx-input-wrap {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 18px;
  height: 52px;
  border-radius: 10px;
  background: rgba(5, 11, 18, 0.85);
  border: 1px solid rgba(56, 189, 248, 0.35);
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.sx-input-wrap:focus-within {
  border-color: #38bdf8;
  box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.16);
}

.sx-input-wrap.has-error {
  border-color: #f43f5e;
  box-shadow: 0 0 0 3px rgba(244, 63, 94, 0.14);
}

.sx-key-icon {
  color: #38bdf8;
  flex-shrink: 0;
}

.sx-code-input {
  width: 100%;
  background: transparent;
  border: none;
  outline: none;
  color: #f8fafc;
  font-family: var(--font-mono, monospace);
  font-size: 1.02rem;
  font-weight: 700;
  letter-spacing: 0.22em;
  text-transform: uppercase;
}

.sx-code-input::placeholder {
  color: #475569;
  font-weight: 600;
}

.sx-join-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 0 24px;
  height: 52px;
  border: none;
  border-radius: 10px;
  background: linear-gradient(135deg, #22d3ee, #0ea5e9);
  color: #031520;
  font-size: 0.9rem;
  font-weight: 800;
  cursor: pointer;
  box-shadow: 0 0 24px rgba(14, 165, 233, 0.42);
  transition: transform 0.2s ease, box-shadow 0.2s ease, filter 0.2s ease;
  white-space: nowrap;
}

.sx-join-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 0 32px rgba(56, 189, 248, 0.65);
  filter: brightness(1.06);
}

.sx-join-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.sx-spinner {
  width: 15px;
  height: 15px;
  border-radius: 50%;
  border: 2px solid rgba(3, 21, 32, 0.3);
  border-top-color: #031520;
  animation: spin 0.7s linear infinite;
}

.sx-join-hint {
  position: relative;
  margin-top: 16px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 0.78rem;
  color: #64748b;
}

.sx-code-chip {
  padding: 3px 9px;
  border-radius: 5px;
  background: rgba(15, 23, 42, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #cbd5e1;
  font-family: var(--font-mono, monospace);
  font-size: 0.72rem;
}

.sx-form-error {
  position: relative;
  margin: 14px 0 0;
  font-size: 0.82rem;
  color: #fb7185;
  font-weight: 600;
}

/* List Header */
.sx-list-section {
  animation: fadeSlideUp 0.55s 0.08s cubic-bezier(0.16, 1, 0.3, 1) both;
}

.sx-list-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin-bottom: 22px;
}

.sx-list-kicker {
  font-family: var(--font-mono, monospace);
  font-size: 0.68rem;
  letter-spacing: 0.16em;
  color: #38bdf8;
  margin-bottom: 4px;
}

.sx-list-title {
  margin: 0;
  font-size: 1.55rem;
  font-weight: 800;
  color: #f8fafc;
}

.sx-count-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 7px 14px;
  border-radius: 999px;
  background: rgba(10, 18, 28, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.1);
  font-family: var(--font-mono, monospace);
  font-size: 0.72rem;
  color: #cbd5e1;
}

/* Cards Grid */
.sx-cards-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 18px;
}

.sx-class-card {
  position: relative;
  display: flex;
  flex-direction: column;
  padding: 22px 22px 18px;
  border-radius: 14px;
  background: #070b10;
  border: 1px solid rgba(255, 255, 255, 0.08);
  overflow: hidden;
  transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.25s ease, box-shadow 0.25s ease;
  animation: fadeSlideUp 0.45s var(--stagger, 0ms) cubic-bezier(0.16, 1, 0.3, 1) both;
}

.sx-card-glow {
  position: absolute;
  inset: 0;
  opacity: 0;
  background: radial-gradient(circle at 50% 0%, rgba(14, 165, 233, 0.22), transparent 70%);
  transition: opacity 0.28s ease;
  pointer-events: none;
}

.sx-class-card:hover {
  transform: translateY(-4px);
  border-color: rgba(56, 189, 248, 0.55);
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.5), 0 0 28px rgba(14, 165, 233, 0.16);
}

.sx-class-card:hover .sx-card-glow {
  opacity: 1;
}

.sx-card-badge {
  position: relative;
  align-self: flex-start;
  padding: 5px 11px;
  border-radius: 999px;
  background: rgba(14, 165, 233, 0.1);
  border: 1px solid rgba(56, 189, 248, 0.28);
  font-family: var(--font-mono, monospace);
  font-size: 0.68rem;
  font-weight: 700;
  color: #38bdf8;
  margin-bottom: 16px;
}

.sx-card-name {
  position: relative;
  margin: 0 0 14px;
  font-size: 1.08rem;
  font-weight: 700;
  color: #f8fafc;
  line-height: 1.35;
}

.sx-card-meta {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 18px;
}

.sx-meta-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.8rem;
  color: #94a3b8;
}

.sx-meta-row svg {
  color: #38bdf8;
  flex-shrink: 0;
}

.sx-card-divider {
  position: relative;
  height: 1px;
  background: rgba(255, 255, 255, 0.06);
  margin: auto 0 14px;
}

.sx-card-footer {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.sx-leave-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 12px;
  border-radius: 7px;
  background: rgba(244, 63, 94, 0.08);
  border: 1px solid rgba(244, 63, 94, 0.25);
  color: #fda4af;
  font-size: 0.74rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.sx-leave-btn:hover:not(:disabled) {
  background: rgba(244, 63, 94, 0.18);
  border-color: rgba(244, 63, 94, 0.5);
  color: #ffffff;
}

.sx-leave-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.sx-member-count {
  font-family: var(--font-mono, monospace);
  font-size: 0.7rem;
  color: #64748b;
}

/* Empty & Skeleton */
.sx-empty-state {
  padding: 46px 24px;
  border-radius: 14px;
  border: 1px dashed rgba(56, 189, 248, 0.25);
  background: rgba(7, 11, 16, 0.75);
  text-align: center;
}

.sx-empty-icon {
  width: 52px;
  height: 52px;
  margin: 0 auto 14px;
  border-radius: 12px;
  background: rgba(14, 165, 233, 0.1);
  border: 1px solid rgba(56, 189, 248, 0.3);
  color: #38bdf8;
  display: flex;
  align-items: center;
  justify-content: center;
}

.sx-empty-state h3 {
  margin: 0 0 8px;
  font-size: 1.05rem;
  color: #f1f5f9;
}

.sx-empty-state p {
  margin: 0 auto;
  max-width: 480px;
  font-size: 0.84rem;
  color: #64748b;
  line-height: 1.55;
}

.sx-empty-state code {
  color: #38bdf8;
  background: rgba(14, 165, 233, 0.12);
  padding: 2px 6px;
  border-radius: 4px;
}

.sx-skeleton {
  height: 196px;
  background: linear-gradient(90deg, #070b10 25%, #0d1622 50%, #070b10 75%);
  background-size: 200% 100%;
  animation: shimmer 1.4s infinite linear;
}

/* Transitions */
.card-list-enter-active,
.card-list-leave-active {
  transition: all 0.32s cubic-bezier(0.16, 1, 0.3, 1);
}
.card-list-enter-from,
.card-list-leave-to {
  opacity: 0;
  transform: translateY(14px) scale(0.97);
}

@keyframes fadeSlideUp {
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes pulseDot {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.35; }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

@media (max-width: 960px) {
  .sx-cards-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 640px) {
  .sx-join-card { padding: 26px 20px; }
  .sx-join-form { flex-direction: column; }
  .sx-cards-grid { grid-template-columns: 1fr; }
}
</style>


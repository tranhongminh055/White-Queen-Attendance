<script setup>
import { ref, computed, onMounted } from 'vue'
import SpaceXLogo from './SpaceXLogo.vue'
import { storage } from '../utils/storage'
import { sound } from '../utils/sound'

const emit = defineEmits(['navigate', 'back', 'notify'])

const currentProfile = storage.getCurrentProfile()
const studentRecord = ref(null)

const profile = computed(() => ({
  id: currentProfile?.id || '',
  fullName: studentRecord.value?.name || currentProfile?.fullName || '',
  classId: studentRecord.value?.classId || currentProfile?.classId || 'CNTT-K21A',
  email: studentRecord.value?.email || currentProfile?.email || '',
  role: studentRecord.value?.role || currentProfile?.role || 'student',
  avatar: studentRecord.value?.avatar || currentProfile?.avatar || null,
  isEnrolled: Boolean(
    studentRecord.value
      ? studentRecord.value.embeddingCreated &&
          Array.isArray(studentRecord.value.descriptors) &&
          studentRecord.value.descriptors.length > 0
      : currentProfile?.embeddingCreated
  )
}))

const initials = computed(() => {
  const words = (profile.value.fullName || 'SV').trim().split(/\s+/)
  return words
    .slice(-2)
    .map(w => w[0])
    .join('')
    .toUpperCase()
})

function startFaceEnrollment() {
  if (profile.value.isEnrolled) {
    sound.playWarning()
    emit('notify', {
      type: 'warning',
      message: 'Khuôn mặt đã được đăng ký và khóa chống giả mạo, không thể cập nhật lại.'
    })
    return
  }
  sound.playBeep()
  emit('navigate', 'enrollment')
}

function openClassRegistration() {
  sound.playBeep()
  emit('navigate', 'classes')
}

function handleLogout() {
  sound.playBeep()
  storage.setCurrentProfile(null)
  emit('notify', { type: 'info', message: 'Đã đăng xuất khỏi tài khoản.' })
  emit('navigate', 'login')
}

onMounted(async () => {
  const verified = await storage.verifySessionFromDb()
  if (!verified) {
    sound.playWarning()
    emit('notify', {
      type: 'warning',
      message: 'Tài khoản chưa tồn tại trong SQL Server! Vui lòng đăng nhập hoặc đăng ký trước.'
    })
    emit('navigate', 'login')
    return
  }

  try {
    const fresh = await storage.getStudentById(verified.id)
    if (fresh) {
      studentRecord.value = fresh
      storage.setCurrentProfile({
        ...verified,
        fullName: fresh.name,
        classId: fresh.classId,
        email: fresh.email,
        avatar: fresh.avatar,
        embeddingCreated: Boolean(fresh.embeddingCreated)
      })
    }
  } catch {
    // Keep session profile if backend temporarily unreachable
  }
})
</script>

<template>
  <div class="sx-intro-page">
    <!-- TOP HEADER BAR -->
    <header class="sx-intro-nav">
      <div class="sx-in-left">
        <button type="button" class="sx-back-pill" @click="emit('back')" title="Quay lại">
          ← Quay lại
        </button>
        <SpaceXLogo @click="emit('navigate', 'landing')" title="Quay về Trang chủ SpaceX" />
        <div class="sx-in-subbrand">
          <span class="sb-line">ĐIỂM DANH KHUÔN MẶT</span>
        </div>
      </div>

      <nav class="sx-in-links">
        <button type="button" class="sx-nav-link active">TRANG CHỦ</button>
      </nav>

      <div class="sx-in-user">
        <div class="sx-user-meta">
          <span class="sx-user-name">{{ profile.fullName }}</span>
          <span class="sx-user-role">
            {{ profile.role === 'lecturer' ? 'GIẢNG VIÊN' : 'SINH VIÊN' }}
          </span>
        </div>
        <div class="sx-user-avatar">
          <img v-if="profile.avatar" :src="profile.avatar" alt="Ảnh đại diện" />
          <span v-else>{{ initials }}</span>
        </div>
        <button type="button" class="sx-logout-mini" @click="handleLogout" title="Đăng xuất">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
        </button>
      </div>
    </header>

    <!-- MAIN CONTENT -->
    <main class="sx-intro-main">
      <!-- HERO SECTION -->
      <section class="sx-intro-hero">
        <!-- Left Copy & Cyan CTA -->
        <div class="sx-hero-left">
          <div class="sx-eyebrow">
            <span class="sx-eyebrow-line"></span>
            <span>BƯỚC ĐẦU TIÊN</span>
          </div>

          <h1 class="sx-hero-title">
            Đăng ký khuôn mặt<br />
            để <span class="sx-cyan-accent">điểm danh</span>
          </h1>

          <p class="sx-hero-desc">
            Hệ thống sẽ ghi nhận khuôn mặt của bạn để tự động xác thực mỗi buổi học. Không cần thẻ, không cần chờ đợi — chỉ cần xuất hiện trước camera.
          </p>

          <div class="sx-hero-actions">
            <button v-if="!profile.isEnrolled" type="button" class="sx-cta-btn" @click="startFaceEnrollment">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/>
                <circle cx="12" cy="12" r="2.5"/>
              </svg>
              <span>Đăng ký gương mặt</span>
              <span class="cta-arrow">→</span>
            </button>

            <div v-else class="sx-cta-locked-badge" title="Dữ liệu sinh trắc học đã khóa để chống giả mạo">
              <span>✓ ĐÃ XÁC THỰC &amp; KHÓA SINH TRẮC HỌC</span>
            </div>

            <button type="button" class="sx-cta-secondary-btn" @click="openClassRegistration">
              <span>Đăng ký lớp học</span>
            </button>
          </div>

          <div class="sx-hero-meta">
            <span class="meta-item">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="9"/>
                <polyline points="12 7 12 12 15 14"/>
              </svg>
              Mất khoảng 30 giây
            </span>
            <span class="meta-sep">·</span>
            <span class="meta-item">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="11" width="18" height="11" rx="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              Dữ liệu được mã hóa E2E
            </span>
          </div>
        </div>

        <!-- Right Biometric Frame Preview -->
        <div class="sx-hero-right">
          <div class="sx-preview-frame">
            <span class="pf-corner tl"></span>
            <span class="pf-corner tr"></span>
            <span class="pf-corner bl"></span>
            <span class="pf-corner br"></span>

            <span class="pf-side-tick left"></span>
            <span class="pf-side-tick right"></span>

            <div class="pf-cam-tag">CAM 01 · 1080P</div>

            <div class="pf-reticle">
              <div class="pf-outer-ring" :class="{ enrolled: profile.isEnrolled }"></div>
              <div class="pf-inner-oval" :class="{ enrolled: profile.isEnrolled }"></div>

              <svg viewBox="0 0 180 220" class="pf-face-mesh" aria-hidden="true">
                <g
                  fill="none"
                  :stroke="profile.isEnrolled ? '#10b981' : '#00d8ff'"
                  stroke-width="0.9"
                  stroke-opacity="0.7"
                >
                  <path d="M90 22 C125 22 145 55 145 96 C145 138 128 176 90 194 C52 176 35 138 35 96 C35 55 55 22 90 22 Z"/>
                  <polyline points="90,22 52,58 35,96 46,138 66,176 90,194 114,176 134,138 145,96 128,58 90,22" stroke-opacity="0.45"/>
                  <line x1="90" y1="22" x2="90" y2="194" stroke-opacity="0.45"/>
                  <line x1="52" y1="58" x2="128" y2="58" stroke-opacity="0.45"/>
                  <polyline points="52,58 90,78 128,58" stroke-opacity="0.5"/>
                  <ellipse cx="66" cy="92" rx="11" ry="5.5"/>
                  <ellipse cx="114" cy="92" rx="11" ry="5.5"/>
                  <polyline points="90,82 86,122 90,126 94,122 90,82"/>
                  <path d="M72 150 Q90 144 108 150 Q90 158 72 150 Z"/>
                  <g :fill="profile.isEnrolled ? '#34d399' : '#38bdf8'">
                    <circle cx="90" cy="22" r="2"/>
                    <circle cx="52" cy="58" r="1.8"/>
                    <circle cx="128" cy="58" r="1.8"/>
                    <circle cx="66" cy="92" r="2"/>
                    <circle cx="114" cy="92" r="2"/>
                    <circle cx="90" cy="122" r="2.2"/>
                    <circle cx="72" cy="150" r="1.8"/>
                    <circle cx="108" cy="150" r="1.8"/>
                    <circle cx="90" cy="194" r="2"/>
                  </g>
                </g>
              </svg>

              <div class="pf-scan-line" :class="{ enrolled: profile.isEnrolled }"></div>
            </div>

            <div class="pf-status-badge" :class="{ enrolled: profile.isEnrolled }">
              <span class="status-dot"></span>
              <span>{{ profile.isEnrolled ? 'ĐÃ ĐĂNG KÝ' : 'CHƯA ĐĂNG KÝ' }}</span>
            </div>
          </div>
        </div>
      </section>

      <!-- BOTTOM TWO-CARD SECTION -->
      <section class="sx-intro-bottom">
        <!-- Left Card: Student Card -->
        <div class="sx-student-card">
          <div class="sx-card-eyebrow">
            {{ profile.role === 'lecturer' ? 'THẺ GIẢNG VIÊN' : 'THẺ SINH VIÊN' }}
          </div>
          <div class="sx-sc-body">
            <div class="sx-sc-avatar">
              <img v-if="profile.avatar" :src="profile.avatar" alt="Ảnh sinh viên" />
              <span v-else>{{ initials }}</span>
            </div>
            <div class="sx-sc-info">
              <div class="sx-sc-name">{{ profile.fullName }}</div>
              <div class="sx-sc-row">
                <span class="sc-key">MSSV</span>
                <span class="sc-val cyan">{{ profile.id }}</span>
              </div>
              <div class="sx-sc-row">
                <span class="sc-key">LỚP</span>
                <span class="sc-val">{{ profile.classId }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Right Card: 3-Step Guide -->
        <div class="sx-guide-card">
          <div class="sx-card-eyebrow">HƯỚNG DẪN · 3 BƯỚC</div>
          <div class="sx-steps-grid">
            <div class="sx-step-item active" @click="startFaceEnrollment">
              <div class="sx-step-head">
                <span class="sx-step-num">1</span>
                <span class="sx-step-title">Đăng ký khuôn mặt</span>
              </div>
              <p class="sx-step-desc">
                Bấm nút đăng ký và cho phép truy cập camera.
              </p>
            </div>

            <div class="sx-step-item">
              <div class="sx-step-head">
                <span class="sx-step-num">2</span>
                <span class="sx-step-title">Quét 5 góc</span>
              </div>
              <p class="sx-step-desc">
                Xoay mặt theo 5 góc nhìn để lấy mẫu từ nhiều hướng.
              </p>
            </div>

            <div class="sx-step-item">
              <div class="sx-step-head">
                <span class="sx-step-num">3</span>
                <span class="sx-step-title">Hoàn tất và sẵn sàng điểm danh</span>
              </div>
              <p class="sx-step-desc">
                Hệ thống lưu dữ liệu và tự nhận diện mỗi buổi học.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>

<style scoped>
.sx-intro-page {
  min-height: 100vh;
  background-color: #030508;
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.025) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.025) 1px, transparent 1px);
  background-size: 56px 56px;
  color: #f8fafc;
  display: flex;
  flex-direction: column;
  font-family: var(--font-sans);
}

/* Navbar */
.sx-intro-nav {
  height: 62px;
  padding: 0 32px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.07);
  background: rgba(3, 5, 8, 0.92);
  backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
}

.sx-in-left {
  display: flex;
  align-items: center;
  gap: 14px;
}

.sx-back-pill {
  padding: 6px 12px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 2px;
  background: rgba(8, 12, 18, 0.8);
  color: #cbd5e1;
  font-family: var(--font-mono);
  font-size: 0.64rem;
  letter-spacing: 0.1em;
  cursor: pointer;
  transition: all 0.2s ease;
}

.sx-back-pill:hover {
  border-color: rgba(0, 229, 255, 0.55);
  color: #ffffff;
}

.sx-in-subbrand {
  padding-left: 12px;
  border-left: 1px solid rgba(255, 255, 255, 0.14);
}

.sb-line {
  font-family: var(--font-mono);
  font-size: 0.58rem;
  letter-spacing: 0.18em;
  color: #00d8ff;
}

.sx-in-links {
  display: flex;
  align-items: center;
  gap: 28px;
}

.sx-nav-link {
  background: transparent;
  border: none;
  padding: 6px 2px;
  font-family: var(--font-mono);
  font-size: 0.7rem;
  letter-spacing: 0.16em;
  color: #64748b;
  cursor: pointer;
  transition: color 0.2s ease;
}

.sx-nav-link:hover {
  color: #e2e8f0;
}

.sx-nav-link.active {
  color: #00e5ff;
  border-bottom: 1.5px solid #00e5ff;
}

.sx-in-user {
  display: flex;
  align-items: center;
  gap: 12px;
}

.sx-user-meta {
  text-align: right;
  line-height: 1.25;
}

.sx-user-name {
  display: block;
  font-size: 0.8rem;
  font-weight: 600;
  color: #f8fafc;
}

.sx-user-role {
  display: block;
  font-family: var(--font-mono);
  font-size: 0.56rem;
  letter-spacing: 0.14em;
  color: #64748b;
}

.sx-user-avatar {
  width: 34px;
  height: 34px;
  border-radius: 3px;
  overflow: hidden;
  border: 1px solid rgba(0, 229, 255, 0.45);
  background: #082032;
  color: #00e5ff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-mono);
  font-size: 0.72rem;
  font-weight: 700;
}

.sx-user-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.sx-logout-mini {
  width: 30px;
  height: 30px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 2px;
  background: transparent;
  color: #64748b;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
}

.sx-logout-mini:hover {
  border-color: rgba(244, 63, 94, 0.5);
  color: #fb7185;
}

/* Main Content */
.sx-intro-main {
  flex: 1;
  max-width: 1240px;
  width: 100%;
  margin: 0 auto;
  padding: 36px 32px 28px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 32px;
}

/* Hero Split */
.sx-intro-hero {
  display: grid;
  grid-template-columns: 1.08fr 0.92fr;
  align-items: center;
  gap: 44px;
  margin-top: 8px;
}

.sx-eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-family: var(--font-mono);
  font-size: 0.66rem;
  letter-spacing: 0.2em;
  color: #00d8ff;
  margin-bottom: 14px;
}

.sx-eyebrow-line {
  width: 24px;
  height: 1.5px;
  background: #00d8ff;
}

.sx-hero-title {
  margin: 0;
  font-size: clamp(2.2rem, 4.1vw, 3.3rem);
  font-weight: 700;
  line-height: 1.1;
  letter-spacing: -0.025em;
  color: #ffffff;
}

.sx-cyan-accent {
  color: #00e5ff;
}

.sx-hero-desc {
  margin: 18px 0 28px;
  max-width: 470px;
  font-size: 0.9rem;
  line-height: 1.65;
  color: #94a3b8;
}

.sx-hero-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 14px;
}

.sx-cta-btn {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 13px 24px;
  background: #00e5ff;
  color: #03121a;
  border: none;
  border-radius: 3px;
  font-family: var(--font-sans);
  font-size: 0.88rem;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 0 26px rgba(0, 229, 255, 0.35);
  transition: transform 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease;
}

.sx-cta-btn:hover {
  background: #38efff;
  transform: translateY(-1px);
  box-shadow: 0 0 34px rgba(0, 229, 255, 0.55);
}

.cta-arrow {
  font-size: 1rem;
}

.sx-cta-secondary-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 13px 26px;
  background: rgba(2, 12, 20, 0.72);
  color: #38bdf8;
  border: 1px solid rgba(0, 229, 255, 0.48);
  border-radius: 3px;
  font-family: var(--font-sans);
  font-size: 0.88rem;
  font-weight: 700;
  cursor: pointer;
  transition: transform 0.2s ease, border-color 0.2s ease, background-color 0.2s ease, color 0.2s ease, box-shadow 0.2s ease;
}

.sx-cta-secondary-btn:hover {
  background: rgba(0, 229, 255, 0.12);
  border-color: #00e5ff;
  color: #e0f2fe;
  transform: translateY(-1px);
  box-shadow: 0 0 22px rgba(0, 229, 255, 0.22);
}

.sx-hero-meta {
  margin-top: 16px;
  display: flex;
  align-items: center;
  gap: 10px;
  font-family: var(--font-mono);
  font-size: 0.64rem;
  color: #64748b;
}

.meta-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

/* Right Preview Frame */
.sx-preview-frame {
  position: relative;
  height: 360px;
  max-width: 430px;
  margin-left: auto;
  width: 100%;
  background: radial-gradient(circle at 50% 48%, rgba(0, 216, 255, 0.08), rgba(4, 7, 12, 0.96) 72%);
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 3px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  padding: 18px;
}

.pf-corner {
  position: absolute;
  width: 18px;
  height: 18px;
  border-color: #00d8ff;
  border-style: solid;
}
.pf-corner.tl { top: 14px; left: 14px; border-width: 1.5px 0 0 1.5px; }
.pf-corner.tr { top: 14px; right: 14px; border-width: 1.5px 1.5px 0 0; }
.pf-corner.bl { bottom: 14px; left: 14px; border-width: 0 0 1.5px 1.5px; }
.pf-corner.br { bottom: 14px; right: 14px; border-width: 0 1.5px 1.5px 0; }

.pf-side-tick {
  position: absolute;
  top: 50%;
  width: 10px;
  height: 1px;
  background: rgba(148, 163, 184, 0.35);
}
.pf-side-tick.left { left: 22px; }
.pf-side-tick.right { right: 22px; }

.pf-cam-tag {
  font-family: var(--font-mono);
  font-size: 0.6rem;
  letter-spacing: 0.16em;
  color: #475569;
}

.pf-reticle {
  position: relative;
  width: 228px;
  height: 228px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.pf-outer-ring {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 1px solid rgba(0, 216, 255, 0.25);
  box-shadow: 0 0 24px rgba(0, 216, 255, 0.08);
}

.pf-outer-ring.enrolled {
  border-color: rgba(16, 185, 129, 0.35);
}

.pf-inner-oval {
  position: absolute;
  width: 160px;
  height: 204px;
  border-radius: 50%;
  border: 1px solid rgba(0, 216, 255, 0.48);
}

.pf-inner-oval.enrolled {
  border-color: rgba(16, 185, 129, 0.65);
}

.pf-face-mesh {
  width: 132px;
  height: 168px;
}

.pf-scan-line {
  position: absolute;
  left: 16px;
  right: 16px;
  height: 1.5px;
  background: linear-gradient(90deg, transparent, #00d8ff, transparent);
  box-shadow: 0 0 10px rgba(0, 216, 255, 0.6);
  animation: introLaser 2.8s ease-in-out infinite;
}

.pf-scan-line.enrolled {
  background: linear-gradient(90deg, transparent, #10b981, transparent);
}

@keyframes introLaser {
  0%, 100% { top: 28%; opacity: 0.4; }
  50% { top: 72%; opacity: 1; }
}

.pf-status-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 5px 14px;
  border: 1px solid rgba(0, 216, 255, 0.32);
  border-radius: 2px;
  background: rgba(5, 14, 22, 0.92);
  font-family: var(--font-mono);
  font-size: 0.6rem;
  letter-spacing: 0.16em;
  color: #cbd5e1;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #00d8ff;
  box-shadow: 0 0 8px #00d8ff;
}

.pf-status-badge.enrolled {
  border-color: rgba(16, 185, 129, 0.5);
  color: #a7f3d0;
}
.pf-status-badge.enrolled .status-dot {
  background: #10b981;
  box-shadow: 0 0 8px #10b981;
}

/* Bottom Two-Card Section */
.sx-intro-bottom {
  display: grid;
  grid-template-columns: 0.42fr 1fr;
  gap: 16px;
}

.sx-student-card,
.sx-guide-card {
  background: rgba(7, 10, 15, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 3px;
  padding: 16px 18px;
}

.sx-card-eyebrow {
  font-family: var(--font-mono);
  font-size: 0.58rem;
  letter-spacing: 0.16em;
  color: #64748b;
  margin-bottom: 12px;
}

.sx-sc-body {
  display: flex;
  align-items: center;
  gap: 14px;
}

.sx-sc-avatar {
  width: 58px;
  height: 58px;
  border-radius: 4px;
  overflow: hidden;
  flex-shrink: 0;
  border: 1px solid rgba(0, 216, 255, 0.35);
  background: #082032;
  color: #00e5ff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-mono);
  font-size: 1.1rem;
  font-weight: 700;
}

.sx-sc-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.sx-sc-name {
  font-size: 0.94rem;
  font-weight: 600;
  color: #ffffff;
  margin-bottom: 5px;
}

.sx-sc-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: var(--font-mono);
  font-size: 0.62rem;
  line-height: 1.6;
}

.sc-key {
  color: #64748b;
}

.sc-val {
  color: #cbd5e1;
}

.sc-val.cyan {
  color: #00d8ff;
}

/* 3-Step Guide */
.sx-steps-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.sx-step-item {
  padding: 12px 14px;
  background: #05080d;
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 3px;
  transition: border-color 0.2s ease;
}

.sx-step-item.active {
  border-color: rgba(0, 216, 255, 0.4);
  background: rgba(0, 216, 255, 0.03);
  cursor: pointer;
}

.sx-step-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.sx-step-num {
  width: 20px;
  height: 20px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.06);
  color: #94a3b8;
  font-family: var(--font-mono);
  font-size: 0.64rem;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.sx-step-item.active .sx-step-num {
  background: #00e5ff;
  color: #041016;
}

.sx-step-title {
  font-size: 0.78rem;
  font-weight: 600;
  color: #f8fafc;
}

.sx-step-desc {
  margin: 0;
  font-size: 0.7rem;
  line-height: 1.45;
  color: #64748b;
}

@media (max-width: 980px) {
  .sx-intro-hero {
    grid-template-columns: 1fr;
  }

  .sx-preview-frame {
    margin: 0 auto;
  }

  .sx-intro-bottom {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 680px) {
  .sx-in-links {
    display: none;
  }

  .sx-steps-grid {
    grid-template-columns: 1fr;
  }
}

.sx-cta-locked-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 13px 20px;
  border-radius: 10px;
  background: rgba(16, 185, 129, 0.12);
  border: 1px solid rgba(52, 211, 153, 0.45);
  color: #34d399;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  user-select: none;
}
</style>


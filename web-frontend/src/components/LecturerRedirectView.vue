<script setup>
import { computed } from 'vue'
import { storage } from '../utils/storage'
import { sound } from '../utils/sound'

const emit = defineEmits(['navigate', 'notify'])

const profile = computed(() => {
  const current = storage.getCurrentProfile()
  return {
    id: current?.id || 'GV-00123',
    fullName: current?.fullName || 'Giảng viên',
    email: current?.email || '',
    role: current?.role || 'lecturer'
  }
})

function handleLogout() {
  sound.playBeep()
  storage.clearCurrentProfile()
  emit('notify', {
    type: 'info',
    message: 'Đã đăng xuất tài khoản Giảng viên.'
  })
  emit('navigate', 'login')
}
</script>

<template>
  <section class="sx-lec-screen">
    <!-- Subtle SpaceX Particle & Vertical Grid Background -->
    <div class="sx-lec-bg-grid" aria-hidden="true"></div>
    <div class="sx-lec-particles" aria-hidden="true">
      <span class="sx-p sx-p1"></span>
      <span class="sx-p sx-p2"></span>
      <span class="sx-p sx-p3"></span>
      <span class="sx-p sx-p4"></span>
      <span class="sx-p sx-p5"></span>
      <span class="sx-p sx-p6"></span>
    </div>

    <!-- Top Bar -->
    <header class="sx-lec-topbar">
      <div class="sx-lec-brand">
        <span class="sx-lec-logo">SPACE <span class="sx-cyan">X</span></span>
        <span class="sx-lec-sub">BIOMETRIC AI</span>
      </div>

      <div class="sx-lec-status-pill">
        <span class="sx-green-dot"></span>
        <span>ĐĂNG NHẬP THÀNH CÔNG · GIẢNG VIÊN</span>
      </div>
    </header>

    <!-- Center Radar & Message -->
    <main class="sx-lec-center">
      <div class="sx-radar-stage">
        <div class="sx-scan-caption">SCANNING · 12,000 PTS</div>

        <div class="sx-reticle-box">
          <!-- 4 Corner Brackets -->
          <span class="sx-corner sx-tl"></span>
          <span class="sx-corner sx-tr"></span>
          <span class="sx-corner sx-bl"></span>
          <span class="sx-corner sx-br"></span>

          <!-- Left Callouts -->
          <div class="sx-callout sx-callout-tl">
            <span class="sx-callout-box">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
              VAI TRÒ: GIẢNG VIÊN
            </span>
            <span class="sx-callout-line"></span>
          </div>

          <div class="sx-callout sx-callout-bl">
            <span class="sx-callout-box">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="11" width="18" height="11" rx="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              SESSION: ENCRYPTED
            </span>
            <span class="sx-callout-line"></span>
          </div>

          <!-- Right Callouts -->
          <div class="sx-callout sx-callout-tr">
            <span class="sx-callout-line"></span>
            <span class="sx-callout-box">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
              LIVE VIEW: READY
            </span>
          </div>

          <div class="sx-callout sx-callout-br">
            <span class="sx-callout-line"></span>
            <span class="sx-callout-box">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              IDENTITY: VERIFIED
            </span>
          </div>

          <!-- Concentric Radar + Sweep -->
          <div class="sx-radar-rings">
            <div class="sx-ring sx-r1"></div>
            <div class="sx-ring sx-r2"></div>
            <div class="sx-ring sx-r3"></div>
            <div class="sx-ring sx-r4"></div>
            <div class="sx-radar-sweep"></div>

            <div class="sx-rocket-core">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
                <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/>
                <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/>
                <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/>
                <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>
              </svg>
            </div>
          </div>

          <div class="sx-id-badge">ID: {{ profile.id }}</div>
        </div>
      </div>

      <div class="sx-lec-copy">
        <div class="sx-role-kicker">ROLE · GIẢNG VIÊN · {{ profile.fullName.toUpperCase() }}</div>
        <h1 class="sx-lec-heading">
          Vui lòng truy cập phần mềm SpaceX<br />
          để tiếp tục
        </h1>
        <p class="sx-lec-desc">
          Tài khoản giảng viên được quản lý trên ứng dụng <strong>SpaceX Desktop</strong>.
          Mở phần mềm để xem điểm danh trực tiếp và quản lý lớp học.
        </p>

        <div class="sx-logout-wrap">
          <button type="button" class="sx-logout-btn" @click="handleLogout">
            ĐĂNG XUẤT
          </button>
          <div class="sx-logout-divider"></div>
          <div class="sx-dots-indicator">
            <span></span><span></span><span></span>
          </div>
        </div>
      </div>
    </main>

    <!-- Bottom Telemetry Footer -->
    <footer class="sx-lec-footer">
      <div class="sx-foot-left">v3.2 · FACE ATTENDANCE</div>
      <div class="sx-foot-center">
        <span class="sx-foot-chip">SYSTEM STATUS: <strong class="sx-green">NOMINAL</strong></span>
        <span class="sx-foot-chip">MODEL: <strong>FACENET-V3</strong></span>
      </div>
      <div class="sx-foot-right">
        <span class="sx-green-dot"></span>
        <span>DỮ LIỆU SINH TRẮC HỌC ĐƯỢC MÃ HÓA ĐẦU CUỐI</span>
      </div>
    </footer>
  </section>
</template>

<style scoped>
.sx-lec-screen {
  position: relative;
  min-height: 100vh;
  background: radial-gradient(circle at 50% 34%, rgba(14, 165, 233, 0.12), #020408 62%, #000000 100%);
  color: #f8fafc;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  overflow: hidden;
  padding: 22px 32px;
}

.sx-lec-bg-grid {
  position: absolute;
  inset: 0;
  background-image: linear-gradient(90deg, rgba(56, 189, 248, 0.05) 1px, transparent 1px);
  background-size: 160px 100%;
  pointer-events: none;
}

.sx-lec-particles {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.sx-p {
  position: absolute;
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: #38bdf8;
  opacity: 0.45;
  animation: floatParticle 6s ease-in-out infinite;
}
.sx-p1 { top: 28%; left: 12%; animation-delay: 0s; }
.sx-p2 { top: 18%; right: 16%; animation-delay: 1.2s; }
.sx-p3 { top: 62%; left: 8%; animation-delay: 2.4s; }
.sx-p4 { top: 55%; right: 10%; animation-delay: 0.8s; }
.sx-p5 { bottom: 22%; left: 26%; animation-delay: 1.9s; }
.sx-p6 { bottom: 26%; right: 24%; animation-delay: 3.1s; }

/* Top Bar */
.sx-lec-topbar {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.sx-lec-brand {
  display: flex;
  align-items: center;
  gap: 14px;
}

.sx-lec-logo {
  font-weight: 800;
  font-size: 0.98rem;
  letter-spacing: 0.28em;
}

.sx-cyan {
  color: #38bdf8;
}

.sx-lec-sub {
  font-family: var(--font-mono, monospace);
  font-size: 0.68rem;
  letter-spacing: 0.16em;
  color: #64748b;
}

.sx-lec-status-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 7px 14px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(6, 10, 16, 0.85);
  font-family: var(--font-mono, monospace);
  font-size: 0.68rem;
  letter-spacing: 0.12em;
  color: #cbd5e1;
}

.sx-green-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #22c55e;
  box-shadow: 0 0 8px #22c55e;
  display: inline-block;
  animation: pulseDot 1.8s infinite;
}

/* Center Radar Stage */
.sx-lec-center {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  margin: auto 0;
  padding: 16px 0;
}

.sx-radar-stage {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 24px;
}

.sx-scan-caption {
  font-family: var(--font-mono, monospace);
  font-size: 0.66rem;
  letter-spacing: 0.18em;
  color: #38bdf8;
  margin-bottom: 10px;
}

.sx-reticle-box {
  position: relative;
  width: 260px;
  height: 260px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.sx-corner {
  position: absolute;
  width: 16px;
  height: 16px;
  border-color: rgba(56, 189, 248, 0.7);
  border-style: solid;
}
.sx-tl { top: 0; left: 0; border-width: 1.5px 0 0 1.5px; }
.sx-tr { top: 0; right: 0; border-width: 1.5px 1.5px 0 0; }
.sx-bl { bottom: 0; left: 0; border-width: 0 0 1.5px 1.5px; }
.sx-br { bottom: 0; right: 0; border-width: 0 1.5px 1.5px 0; }

/* Radar Rings & Sweep */
.sx-radar-rings {
  position: relative;
  width: 214px;
  height: 214px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(circle, rgba(14, 165, 233, 0.12) 0%, rgba(2, 6, 12, 0.65) 70%);
  overflow: hidden;
}

.sx-ring {
  position: absolute;
  border-radius: 50%;
  border: 1px solid rgba(56, 189, 248, 0.2);
}
.sx-r1 { inset: 4px; }
.sx-r2 { inset: 26px; }
.sx-r3 { inset: 50px; }
.sx-r4 { inset: 74px; border-color: rgba(56, 189, 248, 0.36); }

.sx-radar-sweep {
  position: absolute;
  inset: 4px;
  border-radius: 50%;
  background: conic-gradient(from 0deg, rgba(56, 189, 248, 0.34) 0deg, rgba(56, 189, 248, 0.04) 70deg, transparent 110deg);
  animation: radarSpin 4s linear infinite;
}

.sx-rocket-core {
  position: relative;
  z-index: 2;
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(14, 165, 233, 0.28), rgba(6, 12, 22, 0.92));
  border: 1px solid rgba(56, 189, 248, 0.65);
  color: #38bdf8;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 24px rgba(56, 189, 248, 0.35);
  animation: corePulse 2.6s ease-in-out infinite;
}

/* HUD Callouts */
.sx-callout {
  position: absolute;
  display: flex;
  align-items: center;
  white-space: nowrap;
}

.sx-callout-box {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 6px 11px;
  background: rgba(6, 10, 16, 0.88);
  border: 1px solid rgba(255, 255, 255, 0.12);
  font-family: var(--font-mono, monospace);
  font-size: 0.65rem;
  letter-spacing: 0.1em;
  color: #cbd5e1;
}

.sx-callout-line {
  width: 34px;
  height: 1px;
  background: rgba(56, 189, 248, 0.35);
}

.sx-callout-tl { top: 44px; right: 100%; }
.sx-callout-bl { bottom: 44px; right: 100%; }
.sx-callout-tr { top: 44px; left: 100%; }
.sx-callout-br { bottom: 44px; left: 100%; }

.sx-id-badge {
  position: absolute;
  bottom: -10px;
  right: 0;
  padding: 3px 8px;
  background: #06090e;
  border: 1px solid rgba(56, 189, 248, 0.45);
  font-family: var(--font-mono, monospace);
  font-size: 0.64rem;
  letter-spacing: 0.1em;
  color: #38bdf8;
}

/* Copy */
.sx-role-kicker {
  font-family: var(--font-mono, monospace);
  font-size: 0.7rem;
  letter-spacing: 0.22em;
  color: #94a3b8;
  margin-bottom: 12px;
}

.sx-lec-heading {
  font-size: 2.35rem;
  line-height: 1.24;
  font-weight: 500;
  color: #ffffff;
  margin: 0 0 14px;
}

.sx-lec-desc {
  max-width: 480px;
  margin: 0 auto 28px;
  font-size: 0.84rem;
  line-height: 1.6;
  color: #64748b;
}

.sx-lec-desc strong {
  color: #cbd5e1;
  font-weight: 600;
}

.sx-logout-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.sx-logout-btn {
  background: transparent;
  border: none;
  color: #cbd5e1;
  font-family: var(--font-mono, monospace);
  font-size: 0.74rem;
  letter-spacing: 0.18em;
  padding: 6px 14px;
  cursor: pointer;
  border-bottom: 1px solid rgba(255, 255, 255, 0.28);
  transition: color 0.2s, border-color 0.2s;
}

.sx-logout-btn:hover {
  color: #38bdf8;
  border-bottom-color: #38bdf8;
}

.sx-logout-divider {
  width: 240px;
  height: 1px;
  background: rgba(255, 255, 255, 0.1);
  margin-top: 6px;
}

.sx-dots-indicator {
  display: flex;
  gap: 6px;
}

.sx-dots-indicator span {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: #475569;
  animation: dotWave 1.6s infinite ease-in-out;
}
.sx-dots-indicator span:nth-child(2) { animation-delay: 0.2s; }
.sx-dots-indicator span:nth-child(3) { animation-delay: 0.4s; }

/* Footer */
.sx-lec-footer {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  font-family: var(--font-mono, monospace);
  font-size: 0.66rem;
  letter-spacing: 0.12em;
  color: #64748b;
}

.sx-foot-center {
  display: flex;
  gap: 10px;
}

.sx-foot-chip {
  padding: 6px 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(6, 10, 16, 0.8);
}

.sx-foot-chip strong {
  color: #cbd5e1;
}

.sx-green {
  color: #22c55e !important;
}

.sx-foot-right {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

@keyframes radarSpin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes corePulse {
  0%, 100% { box-shadow: 0 0 18px rgba(56, 189, 248, 0.3); transform: scale(1); }
  50% { box-shadow: 0 0 30px rgba(56, 189, 248, 0.6); transform: scale(1.04); }
}

@keyframes pulseDot {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.35; }
}

@keyframes floatParticle {
  0%, 100% { transform: translateY(0); opacity: 0.25; }
  50% { transform: translateY(-10px); opacity: 0.75; }
}

@keyframes dotWave {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 1; background: #38bdf8; }
}

@media (max-width: 820px) {
  .sx-callout { display: none; }
  .sx-lec-heading { font-size: 1.65rem; }
  .sx-lec-footer { flex-direction: column; text-align: center; }
}
</style>


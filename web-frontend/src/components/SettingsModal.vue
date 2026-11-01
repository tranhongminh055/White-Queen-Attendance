<script setup>
import { ref, onMounted } from 'vue'
import { storage } from '../utils/storage'
import { sound } from '../utils/sound'

const emit = defineEmits(['close', 'notify'])

const settings = ref(storage.getSettings())

function save() {
  storage.saveSettings(settings.value)
  sound.playSuccess()
  emit('notify', { type: 'success', message: 'Đã lưu cấu hình kết nối thành công!' })
  emit('close')
}
</script>

<template>
  <div class="modal-backdrop" @click.self="emit('close')">
    <div class="modal-card glass-panel">
      <div class="modal-header">
        <div class="modal-title-wrap">
          <div class="modal-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </div>
          <div>
            <h2 class="modal-title">Cấu Hình Kết Nối Hệ Thống</h2>
            <p class="modal-sub">Thiết lập kết nối với Java Spring Boot & Python AI</p>
          </div>
        </div>
        <button class="close-btn" @click="emit('close')">✕</button>
      </div>

      <div class="modal-body">
        <!-- Architecture Diagram Card -->
        <div class="arch-box">
          <div class="arch-node active">
            <span class="arch-label">Frontend</span>
            <strong>Vue 3 (Vite)</strong>
          </div>
          <div class="arch-arrow">➔</div>
          <div class="arch-node" :class="{ active: !settings.useMock }">
            <span class="arch-label">Backend</span>
            <strong>Java Spring Boot</strong>
          </div>
          <div class="arch-arrow">➔</div>
          <div class="arch-node" :class="{ active: !settings.useMock }">
            <span class="arch-label">AI Engine</span>
            <strong>Python FastAPI</strong>
          </div>
        </div>

        <div class="input-group">
          <label class="input-label">Chế độ vận hành</label>
          <div class="radio-cards">
            <label class="radio-card" :class="{ checked: settings.useMock }">
              <input type="radio" v-model="settings.useMock" :value="true" name="mode" />
              <div>
                <strong>Chế độ Mô phỏng / Thử nghiệm nhanh</strong>
                <small>Dùng WebRTC camera thực tế + lưu trữ dữ liệu tại máy để thử nghiệm tính năng ngay.</small>
              </div>
            </label>

            <label class="radio-card" :class="{ checked: !settings.useMock }">
              <input type="radio" v-model="settings.useMock" :value="false" name="mode" />
              <div>
                <strong>Kết nối Backend Thực tế (Spring Boot + Python)</strong>
                <small>Gửi request thực tế tới REST API của Java Spring Boot.</small>
              </div>
            </label>
          </div>
        </div>

        <div class="input-group" v-if="!settings.useMock">
          <label class="input-label" for="api-url">Địa chỉ API Java Spring Boot</label>
          <input 
            id="api-url" 
            type="text" 
            v-model="settings.apiUrl" 
            placeholder="http://localhost:8080/api" 
            class="input-field" 
          />
        </div>

        <div class="input-group">
          <label class="input-label" for="scan-interval">Tần số quét tự động (ms)</label>
          <select id="scan-interval" v-model="settings.autoScanInterval" class="input-field">
            <option :value="1500">1.5 giây (Rất nhanh)</option>
            <option :value="2000">2.0 giây (Khuyên dùng)</option>
            <option :value="3000">3.0 giây (Tiết kiệm pin)</option>
          </select>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn btn-secondary" @click="emit('close')">Đóng</button>
        <button class="btn btn-primary" @click="save">Lưu cấu hình</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(8px);
  z-index: 999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.modal-card {
  width: 100%;
  max-width: 540px;
  background: rgba(15, 23, 42, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: 0 25px 60px rgba(0, 0, 0, 0.8);
}

.modal-header {
  padding: 20px 24px;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  border-bottom: 1px solid var(--border-subtle);
}

.modal-title-wrap {
  display: flex;
  align-items: center;
  gap: 12px;
}

.modal-icon {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-md);
  background: rgba(99, 102, 241, 0.15);
  color: var(--primary-light);
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-title {
  font-size: 1.15rem;
  font-weight: 700;
  color: #ffffff;
}

.modal-sub {
  font-size: 0.8rem;
  color: var(--text-muted);
}

.close-btn {
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-size: 1.2rem;
  cursor: pointer;
  padding: 4px;
}
.close-btn:hover {
  color: #fff;
}

.modal-body {
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

/* Architecture visualizer */
.arch-box {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(0, 0, 0, 0.35);
  padding: 14px 18px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-subtle);
}

.arch-node {
  display: flex;
  flex-direction: column;
  align-items: center;
  font-size: 0.8rem;
  color: var(--text-dim);
}
.arch-node strong {
  color: var(--text-muted);
  font-size: 0.85rem;
}
.arch-node.active {
  color: var(--cyan-neon);
}
.arch-node.active strong {
  color: #ffffff;
}

.arch-label {
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 2px;
}

.arch-arrow {
  color: var(--text-dim);
  font-size: 1.1rem;
}

/* Radio cards */
.radio-cards {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.radio-card {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 14px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.2s;
}

.radio-card:hover {
  background: rgba(255, 255, 255, 0.06);
}

.radio-card.checked {
  background: rgba(99, 102, 241, 0.12);
  border-color: var(--primary-light);
}

.radio-card input {
  margin-top: 3px;
}

.radio-card strong {
  display: block;
  font-size: 0.875rem;
  color: #fff;
}

.radio-card small {
  display: block;
  font-size: 0.775rem;
  color: var(--text-muted);
  margin-top: 2px;
}

.modal-footer {
  padding: 16px 24px;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  border-top: 1px solid var(--border-subtle);
  background: rgba(0, 0, 0, 0.2);
}
</style>

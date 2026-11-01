<script setup>
import { ref, computed } from 'vue'
import { storage } from '../utils/storage'
import { sound } from '../utils/sound'

const emit = defineEmits(['notify'])

const classes = ref(storage.getClasses())
const selectedClass = ref('ALL')
const searchQuery = ref('')
const activeSubTab = ref('logs') // 'logs' | 'students'

const students = ref(storage.getStudents())
const logs = ref(storage.getAttendanceLogs())

function reload() {
  students.value = storage.getStudents()
  logs.value = storage.getAttendanceLogs()
}

// Filtered Logs
const filteredLogs = computed(() => {
  return logs.value.filter(log => {
    const matchClass = selectedClass.value === 'ALL' || log.classId === selectedClass.value
    const query = searchQuery.value.toLowerCase().trim()
    const matchSearch = !query || 
      log.studentName.toLowerCase().includes(query) || 
      log.studentId.toLowerCase().includes(query)
    return matchClass && matchSearch
  })
})

// Filtered Students
const filteredStudents = computed(() => {
  return students.value.filter(st => {
    const matchClass = selectedClass.value === 'ALL' || st.classId === selectedClass.value
    const query = searchQuery.value.toLowerCase().trim()
    const matchSearch = !query || 
      st.name.toLowerCase().includes(query) || 
      st.id.toLowerCase().includes(query)
    return matchClass && matchSearch
  })
})

// Quick Stats
const stats = computed(() => {
  const totalStudents = students.value.length
  const totalAttended = logs.value.length
  const rate = totalStudents > 0 ? Math.round((totalAttended / totalStudents) * 100) : 0
  return { totalStudents, totalAttended, rate }
})

// Actions
function handleDeleteStudent(id, name) {
  if (confirm(`Bạn có chắc muốn xóa dữ liệu khuôn mặt của ${name} (${id})?`)) {
    storage.deleteStudent(id)
    reload()
    sound.playBeep()
    emit('notify', { type: 'success', message: `Đã xóa hồ sơ sinh viên ${name}` })
  }
}

function handleClearLogs() {
  if (confirm('Bạn có chắc muốn xóa toàn bộ lịch sử điểm danh hôm nay để quét lại từ đầu?')) {
    storage.clearAttendanceLogs()
    reload()
    sound.playBeep()
    emit('notify', { type: 'success', message: 'Đã xóa dữ liệu điểm danh.' })
  }
}

function exportCSV() {
  const header = ['STT', 'MSSV', 'Họ Tên', 'Lớp', 'Thời Gian', 'Độ Khớp', 'Thiết Bị']
  const rows = filteredLogs.value.map((l, index) => [
    index + 1,
    l.studentId,
    `"${l.studentName}"`,
    l.classId,
    `"${l.timestamp}"`,
    l.confidence,
    `"${l.device || 'iPad Pro'}"`
  ])

  const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + 
    [header.join(','), ...rows.map(e => e.join(','))].join('\n')

  const encodedUri = encodeURI(csvContent)
  const link = document.createElement('a')
  link.setAttribute('href', encodedUri)
  link.setAttribute('download', `DiemDanh_${selectedClass.value}_${new Date().toISOString().slice(0, 10)}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  emit('notify', { type: 'success', message: 'Đã xuất file báo cáo CSV thành công!' })
}
</script>

<template>
  <div class="dashboard-page">
    <div class="dashboard-header">
      <div>
        <h1 class="page-title">Báo Cáo & Quản Lý Hồ Sơ</h1>
        <p class="page-desc">Theo dõi tỷ lệ chuyên cần, lịch sử quét khuôn mặt và danh sách sinh viên.</p>
      </div>

      <div class="dashboard-actions">
        <button class="btn btn-secondary" @click="exportCSV" :disabled="filteredLogs.length === 0">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          <span>Xuất File CSV</span>
        </button>

        <button class="btn btn-danger" @click="handleClearLogs" :disabled="logs.length === 0">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
          <span>Làm mới điểm danh</span>
        </button>
      </div>
    </div>

    <!-- Metric Cards -->
    <div class="stats-row">
      <div class="stat-card glass-panel">
        <div class="stat-icon-wrap" style="color: #818cf8; background: rgba(99, 102, 241, 0.15);">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
        </div>
        <div class="stat-content">
          <div class="stat-num">{{ stats.totalStudents }}</div>
          <div class="stat-label">Hồ sơ đã đăng ký</div>
        </div>
      </div>

      <div class="stat-card glass-panel">
        <div class="stat-icon-wrap" style="color: #34d399; background: rgba(16, 185, 129, 0.15);">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
            <polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
        </div>
        <div class="stat-content">
          <div class="stat-num">{{ stats.totalAttended }}</div>
          <div class="stat-label">Đã điểm danh hôm nay</div>
        </div>
      </div>

      <div class="stat-card glass-panel">
        <div class="stat-icon-wrap" style="color: #38bdf8; background: rgba(56, 189, 248, 0.15);">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="20" x2="18" y2="10"/>
            <line x1="12" y1="20" x2="12" y2="4"/>
            <line x1="6" y1="20" x2="6" y2="14"/>
          </svg>
        </div>
        <div class="stat-content">
          <div class="stat-num">{{ stats.rate }}%</div>
          <div class="stat-label">Tỷ lệ chuyên cần</div>
        </div>
      </div>
    </div>

    <!-- Filters & Sub-Tabs -->
    <div class="filter-bar glass-panel">
      <div class="sub-tabs">
        <button 
          class="sub-tab-btn" 
          :class="{ active: activeSubTab === 'logs' }"
          @click="activeSubTab = 'logs'"
        >
          Lịch sử Điểm danh ({{ filteredLogs.length }})
        </button>
        <button 
          class="sub-tab-btn" 
          :class="{ active: activeSubTab === 'students' }"
          @click="activeSubTab = 'students'"
        >
          Hồ sơ Khuôn mặt ({{ filteredStudents.length }})
        </button>
      </div>

      <div class="filter-controls">
        <select v-model="selectedClass" class="filter-select">
          <option value="ALL">Tất cả lớp học</option>
          <option v-for="c in classes" :key="c.id" :value="c.id">
            {{ c.name }}
          </option>
        </select>

        <div class="search-box">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input 
            type="text" 
            v-model="searchQuery" 
            placeholder="Tìm theo MSSV hoặc tên..." 
            class="search-input"
          />
        </div>
      </div>
    </div>

    <!-- Content Table -->
    <div class="table-container glass-panel">
      <!-- Tab 1: Attendance Logs Table -->
      <table v-if="activeSubTab === 'logs'" class="data-table">
        <thead>
          <tr>
            <th>Sinh viên</th>
            <th>MSSV</th>
            <th>Lớp</th>
            <th>Thời gian điểm danh</th>
            <th>Độ tin cậy</th>
            <th>Trạng thái</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="filteredLogs.length === 0">
            <td colspan="6" class="empty-cell">Không tìm thấy dữ liệu điểm danh phù hợp.</td>
          </tr>
          <tr v-for="log in filteredLogs" :key="log.id">
            <td class="cell-student">
              <img :src="log.avatar" class="student-thumb" />
              <span class="student-name-text">{{ log.studentName }}</span>
            </td>
            <td class="cell-mono">{{ log.studentId }}</td>
            <td><span class="badge badge-primary">{{ log.classId }}</span></td>
            <td class="cell-mono">{{ log.timestamp }}</td>
            <td class="cell-mono text-emerald">{{ log.confidence }}</td>
            <td>
              <span class="badge badge-success">Có mặt</span>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Tab 2: Registered Students Table -->
      <table v-else class="data-table">
        <thead>
          <tr>
            <th>Khuôn mặt</th>
            <th>MSSV</th>
            <th>Họ và Tên</th>
            <th>Lớp</th>
            <th>Ngày đăng ký</th>
            <th>Vector 512D</th>
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="filteredStudents.length === 0">
            <td colspan="7" class="empty-cell">Chưa có sinh viên nào trong danh mục này.</td>
          </tr>
          <tr v-for="st in filteredStudents" :key="st.id">
            <td>
              <img :src="st.avatar" class="student-thumb" />
            </td>
            <td class="cell-mono">{{ st.id }}</td>
            <td class="student-name-text">{{ st.name }}</td>
            <td><span class="badge badge-primary">{{ st.classId }}</span></td>
            <td class="cell-mono">{{ st.registeredAt }}</td>
            <td>
              <span class="badge badge-success">Đã lập chỉ mục</span>
            </td>
            <td>
              <button 
                class="btn-icon-danger" 
                @click="handleDeleteStudent(st.id, st.name)"
                title="Xóa hồ sơ"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.dashboard-page {
  max-width: 1300px;
  margin: 0 auto;
  padding: 30px 24px 60px;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
  margin-bottom: 24px;
}

.page-title {
  font-size: 2rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: #ffffff;
}

.page-desc {
  color: var(--text-muted);
  font-size: 0.9rem;
  margin-top: 4px;
}

.dashboard-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

/* Stats Row */
.stats-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  margin-bottom: 24px;
}

.stat-card {
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 16px;
}

.stat-icon-wrap {
  width: 52px;
  height: 52px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.stat-num {
  font-size: 1.8rem;
  font-weight: 800;
  font-family: var(--font-mono);
  color: #ffffff;
  line-height: 1.1;
}

.stat-label {
  font-size: 0.85rem;
  color: var(--text-muted);
  margin-top: 4px;
}

/* Filter Bar */
.filter-bar {
  padding: 12px 18px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 14px;
  margin-bottom: 20px;
}

.sub-tabs {
  display: flex;
  gap: 6px;
}

.sub-tab-btn {
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-family: var(--font-sans);
  font-weight: 600;
  font-size: 0.875rem;
  padding: 8px 16px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.2s;
}
.sub-tab-btn.active {
  background: rgba(255, 255, 255, 0.08);
  color: #ffffff;
}

.filter-controls {
  display: flex;
  align-items: center;
  gap: 12px;
}

.filter-select {
  background: rgba(15, 23, 42, 0.8);
  border: 1px solid var(--border-subtle);
  color: var(--text-main);
  padding: 7px 12px;
  border-radius: var(--radius-sm);
  font-size: 0.85rem;
  outline: none;
}

.search-box {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(15, 23, 42, 0.8);
  border: 1px solid var(--border-subtle);
  padding: 6px 12px;
  border-radius: var(--radius-sm);
}

.search-input {
  background: transparent;
  border: none;
  color: var(--text-main);
  font-family: var(--font-sans);
  font-size: 0.85rem;
  outline: none;
  width: 180px;
}

/* Table */
.table-container {
  overflow-x: auto;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
}

.data-table th {
  padding: 14px 18px;
  font-size: 0.775rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-dim);
  border-bottom: 1px solid var(--border-subtle);
  background: rgba(0, 0, 0, 0.2);
}

.data-table td {
  padding: 14px 18px;
  font-size: 0.9rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}

.cell-student {
  display: flex;
  align-items: center;
  gap: 12px;
}

.student-thumb {
  width: 38px;
  height: 38px;
  border-radius: var(--radius-sm);
  object-fit: cover;
  border: 1px solid var(--border-subtle);
}

.student-name-text {
  font-weight: 600;
  color: #f1f5f9;
}

.cell-mono {
  font-family: var(--font-mono);
  font-size: 0.85rem;
  color: var(--text-muted);
}

.text-emerald {
  color: #34d399 !important;
  font-weight: 700;
}

.empty-cell {
  text-align: center;
  padding: 40px !important;
  color: var(--text-dim);
}

.btn-icon-danger {
  background: rgba(244, 63, 94, 0.1);
  border: 1px solid rgba(244, 63, 94, 0.2);
  color: #fb7185;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
}
.btn-icon-danger:hover {
  background: rgba(244, 63, 94, 0.25);
  border-color: rgba(244, 63, 94, 0.5);
}

@media (max-width: 900px) {
  .stats-row {
    grid-template-columns: 1fr;
  }
}
</style>

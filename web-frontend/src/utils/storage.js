// Real SQL Server Backend API Client (FastAPI + pyodbc -> localhost\SQLEXPRESS25)

const STORAGE_KEYS = {
  SETTINGS: 'facethic_settings',
  CURRENT_PROFILE: 'facethic_current_profile',
  LEGACY_STUDENTS: 'facethic_students',
  LEGACY_ATTENDANCE: 'facethic_attendance',
  LEGACY_ACCOUNTS: 'facethic_accounts'
}

// Ensure any pre-existing real browser records migrate into SQL Server once before clearing legacy keys
let migrationPromise = null

function readJsonArray(key) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function normalizeApiBase(raw) {
  const trimmed = (raw || '').trim().replace(/\/+$/, '')
  if (!trimmed) return ''
  if (trimmed === '/api' || trimmed.endsWith('/api')) return trimmed
  if (/^https?:\/\//i.test(trimmed)) return `${trimmed}/api`
  return trimmed
}

function getApiBase() {
  const settings = storage.getSettings()
  const configured = normalizeApiBase(settings.apiUrl || '')
  if (
    configured &&
    configured !== 'http://localhost:8000/api' &&
    configured !== 'http://localhost:8080/api'
  ) {
    return configured
  }
  const envUrl = normalizeApiBase(import.meta.env?.VITE_API_URL || '')
  return envUrl || '/api'
}

const COLD_START_STATUSES = new Set([502, 503, 504])

async function rawFetch(path, options = {}) {
  const base = getApiBase()
  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`
  const fetchOptions = {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    ...options
  }

  let res
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      res = await fetch(url, fetchOptions)
      if (!COLD_START_STATUSES.has(res.status) || attempt === 1 || options.signal?.aborted) {
        break
      }
    } catch (err) {
      if (attempt === 1 || options.signal?.aborted) {
        throw err
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 2500))
  }

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.detail || data.message || `HTTP ${res.status}`)
  }
  return data
}

async function migrateLegacyStorageOnce() {
  if (migrationPromise) return migrationPromise

  migrationPromise = (async () => {
    const accounts = readJsonArray(STORAGE_KEYS.LEGACY_ACCOUNTS)
    const students = readJsonArray(STORAGE_KEYS.LEGACY_STUDENTS)
    const attendanceLogs = readJsonArray(STORAGE_KEYS.LEGACY_ATTENDANCE)

    if (accounts.length === 0 && students.length === 0 && attendanceLogs.length === 0) {
      return { migrated: false }
    }

    try {
      const res = await rawFetch('/migrate-legacy', {
        method: 'POST',
        body: JSON.stringify({ accounts, students, attendanceLogs })
      })
      if (res?.success) {
        localStorage.removeItem(STORAGE_KEYS.LEGACY_ACCOUNTS)
        localStorage.removeItem(STORAGE_KEYS.LEGACY_STUDENTS)
        localStorage.removeItem(STORAGE_KEYS.LEGACY_ATTENDANCE)
      }
      return res
    } catch {
      migrationPromise = null
      return { migrated: false }
    }
  })()

  return migrationPromise
}

async function apiRequest(path, options = {}) {
  if (path !== '/migrate-legacy') {
    await migrateLegacyStorageOnce()
  }
  return rawFetch(path, options)
}

export const storage = {
  async migrateLegacyData() {
    return migrateLegacyStorageOnce()
  },

  async checkHealth() {
    return apiRequest('/health')
  },

  async getClasses() {
    return apiRequest('/classes')
  },

  async getStudents() {
    return apiRequest('/students')
  },

  async getStudentById(id) {
    return apiRequest(`/students/${encodeURIComponent(id)}`)
  },

  async saveStudent(student) {
    const res = await apiRequest('/students/enroll', {
      method: 'POST',
      body: JSON.stringify(student)
    })
    return res.student || student
  },

  async deleteStudent(id) {
    const res = await apiRequest(`/students/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    })
    return res.students || []
  },

  async getAttendanceLogs(classId = null) {
    const qs = classId && classId !== 'ALL' ? `?classId=${encodeURIComponent(classId)}` : ''
    return apiRequest(`/attendance${qs}`)
  },

  async recordAttendance(record) {
    return apiRequest('/attendance', {
      method: 'POST',
      body: JSON.stringify(record)
    })
  },

  async clearAttendanceLogs() {
    return apiRequest('/attendance', { method: 'DELETE' })
  },

  getSettings() {
    const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS)
    const defaults = {
      apiUrl: 'http://localhost:8000/api',
      useMock: false,
      autoScanInterval: 2000,
      confidenceThreshold: 80
    }
    if (!raw) return defaults
    try {
      const parsed = JSON.parse(raw)
      return {
        ...defaults,
        ...parsed,
        useMock: false
      }
    } catch {
      return defaults
    }
  },

  saveSettings(settings) {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify({ ...settings, useMock: false }))
  },

  setCurrentProfile(profile) {
    if (!profile) {
      localStorage.removeItem(STORAGE_KEYS.CURRENT_PROFILE)
      return
    }
    localStorage.setItem(STORAGE_KEYS.CURRENT_PROFILE, JSON.stringify(profile))
  },

  getCurrentProfile() {
    const raw = localStorage.getItem(STORAGE_KEYS.CURRENT_PROFILE)
    if (!raw) return null
    try {
      return JSON.parse(raw)
    } catch {
      return null
    }
  },

  async verifySessionFromDb() {
    await migrateLegacyStorageOnce()
    const current = this.getCurrentProfile()
    if (!current?.id) return null
    try {
      const res = await rawFetch(`/auth/session/${encodeURIComponent(current.id)}`)
      if (res?.valid && res?.profile) {
        this.setCurrentProfile(res.profile)
        return res.profile
      }
      this.setCurrentProfile(null)
      return null
    } catch (err) {
      if (String(err.message || '').includes('chưa tồn tại') || String(err.message || '').includes('404')) {
        this.setCurrentProfile(null)
        return null
      }
      return current
    }
  },

  async findRegisteredConflicts({ employeeId = '', email = '' }) {
    const params = new URLSearchParams()
    if (employeeId) params.set('employeeId', employeeId.trim())
    if (email) params.set('email', email.trim())
    try {
      return await apiRequest(`/accounts/conflicts?${params.toString()}`)
    } catch {
      return {}
    }
  },

  async registerAccount(payload) {
    try {
      return await apiRequest('/auth/register', {
        method: 'POST',
        body: JSON.stringify(payload)
      })
    } catch (err) {
      return {
        success: false,
        message: `Không thể kết nối SQL Server API: ${err.message}`
      }
    }
  },

  async authenticate(identifier, password) {
    try {
      return await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identifier, password })
      })
    } catch (err) {
      return {
        success: false,
        field: 'username',
        message: `Không thể kết nối SQL Server API: ${err.message}`
      }
    }
  },

  async authenticateWithFace(descriptor, maxDistance = 0.5) {
    return apiRequest('/auth/face-login', {
      method: 'POST',
      body: JSON.stringify({
        descriptor: Array.from(descriptor),
        maxDistance
      })
    })
  }
}

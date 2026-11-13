// Storage and Backend API client for Smart Face Attendance

const STORAGE_KEYS = {
  STUDENTS: 'facethic_students',
  ATTENDANCE: 'facethic_attendance',
  SETTINGS: 'facethic_settings',
  ACCOUNTS: 'facethic_accounts',
  CURRENT_PROFILE: 'facethic_current_profile'
};

const INITIAL_ACCOUNTS = [];

const DEFAULT_CLASSES = [
  { id: 'CNTT-K21A', name: 'CNTT-K21A - Công nghệ Thông tin K21A' },
  { id: 'CS101', name: 'CS101 - Nhập môn Trí tuệ Nhân tạo' },
  { id: 'IT202', name: 'IT202 - Lập trình Web Hiện đại' },
  { id: 'SE301', name: 'SE301 - Công nghệ Phần mềm Chuyên sâu' }
];

const INITIAL_STUDENTS = [];
const LEGACY_MOCK_IDS = new Set(['SV202601', 'SV202602', 'SV202603', 'SV202604', 'SV202605']);

export const storage = {
  getClasses() {
    const students = this.getStudents();
    return DEFAULT_CLASSES.map(c => ({
      ...c,
      totalStudents: students.filter(s => s.classId === c.id).length
    }));
  },

  getStudents() {
    const raw = localStorage.getItem(STORAGE_KEYS.STUDENTS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(INITIAL_STUDENTS));
      return INITIAL_STUDENTS;
    }
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      const cleaned = parsed.filter(
        s => !(LEGACY_MOCK_IDS.has(s.id) && typeof s.avatar === 'string' && s.avatar.includes('images.unsplash.com'))
      );
      if (cleaned.length !== parsed.length) {
        localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(cleaned));
      }
      return cleaned;
    } catch {
      return [];
    }
  },

  saveStudent(student) {
    const students = this.getStudents();
    const existingIndex = students.findIndex(s => s.id === student.id);
    if (existingIndex >= 0) {
      students[existingIndex] = { ...students[existingIndex], ...student };
    } else {
      students.unshift(student);
    }
    localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(students));
    return student;
  },

  deleteStudent(id) {
    let students = this.getStudents();
    students = students.filter(s => s.id !== id);
    localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(students));
    return students;
  },

  getAttendanceLogs(classId = null) {
    const raw = localStorage.getItem(STORAGE_KEYS.ATTENDANCE);
    let logs = [];
    if (raw) {
      try {
        logs = JSON.parse(raw);
      } catch {
        logs = [];
      }
    }
    if (classId) {
      return logs.filter(log => log.classId === classId);
    }
    return logs;
  },

  recordAttendance(record) {
    const logs = this.getAttendanceLogs();
    
    // Check if already checked in today for this student & class
    const todayStr = new Date().toISOString().slice(0, 10);
    const existing = logs.find(
      l => l.studentId === record.studentId && 
           l.classId === record.classId && 
           l.timestamp.startsWith(todayStr)
    );

    if (existing) {
      return { success: false, message: 'Sinh viên đã điểm danh hôm nay rồi!', record: existing };
    }

    const newRecord = {
      id: 'ATT_' + Date.now(),
      studentId: record.studentId,
      studentName: record.studentName,
      classId: record.classId,
      timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' ' + todayStr,
      confidence: record.confidence || '0%',
      avatar: record.avatar,
      device: record.device || 'Live Camera (FaceAPI ResNet-34)'
    };

    logs.unshift(newRecord);
    localStorage.setItem(STORAGE_KEYS.ATTENDANCE, JSON.stringify(logs));
    return { success: true, message: 'Điểm danh thành công!', record: newRecord };
  },

  clearAttendanceLogs() {
    localStorage.removeItem(STORAGE_KEYS.ATTENDANCE);
  },

  getSettings() {
    const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    const defaults = {
      apiUrl: 'http://localhost:8080/api',
      useMock: false,
      autoScanInterval: 2000,
      confidenceThreshold: 80
    };
    if (!raw) return defaults;
    try {
      return { ...defaults, ...JSON.parse(raw) };
    } catch {
      return defaults;
    }
  },

  saveSettings(settings) {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  },

  setCurrentProfile(profile) {
    if (!profile) {
      localStorage.removeItem(STORAGE_KEYS.CURRENT_PROFILE);
      return;
    }
    localStorage.setItem(STORAGE_KEYS.CURRENT_PROFILE, JSON.stringify(profile));
  },

  getCurrentProfile() {
    const raw = localStorage.getItem(STORAGE_KEYS.CURRENT_PROFILE);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },

  getAccounts() {
    const raw = localStorage.getItem(STORAGE_KEYS.ACCOUNTS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(INITIAL_ACCOUNTS));
      return INITIAL_ACCOUNTS;
    }
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return INITIAL_ACCOUNTS;
      return parsed.filter(a => a.employeeId !== 'SX-00001' || a.email !== 'admin@spacex.com');
    } catch {
      return INITIAL_ACCOUNTS;
    }
  },

  findRegisteredConflicts({ employeeId = '', email = '' }) {
    const accounts = this.getAccounts();
    const students = this.getStudents();
    const normId = (employeeId || '').trim().toUpperCase();
    const normEmail = (email || '').trim().toLowerCase();
    const conflicts = {};

    if (
      normId &&
      (accounts.some(a => (a.employeeId || '').trim().toUpperCase() === normId) ||
        students.some(s => (s.id || '').trim().toUpperCase() === normId))
    ) {
      conflicts.employeeId = `Mã nhân viên ${normId} đã được đăng ký trước đó.`;
    }

    if (
      normEmail &&
      (accounts.some(a => (a.email || '').trim().toLowerCase() === normEmail) ||
        students.some(s => (s.email || '').trim().toLowerCase() === normEmail))
    ) {
      conflicts.email = `Email ${normEmail} đã được đăng ký trước đó.`;
    }

    return conflicts;
  },

  registerAccount({ fullName, employeeId, email, role, password }) {
    const accounts = this.getAccounts();
    const normId = employeeId.trim().toUpperCase();
    const normEmail = email.trim().toLowerCase();
    const conflicts = this.findRegisteredConflicts({ employeeId: normId, email: normEmail });

    if (conflicts.employeeId || conflicts.email) {
      return {
        success: false,
        errors: conflicts,
        field: conflicts.employeeId ? 'employeeId' : 'email',
        message:
          conflicts.employeeId && conflicts.email
            ? 'Mã nhân viên và Email này đều đã được đăng ký trước đó!'
            : conflicts.employeeId || conflicts.email
      };
    }

    const newAccount = {
      employeeId: normId,
      fullName: fullName.trim(),
      email: normEmail,
      role: role || 'student',
      password,
      createdAt: new Date().toLocaleString('vi-VN')
    };

    accounts.unshift(newAccount);
    localStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(accounts));

    this.saveStudent({
      id: normId,
      name: fullName.trim(),
      classId: role === 'lecturer' ? 'FACULTY' : 'CNTT-K21A',
      email: normEmail,
      avatar: null,
      registeredAt: newAccount.createdAt,
      embeddingCreated: false,
      descriptors: []
    });

    return { success: true, account: newAccount };
  },

  authenticate(identifier, password) {
    const accounts = this.getAccounts();
    const q = (identifier || '').trim();
    const account = accounts.find(
      a => a.email.toLowerCase() === q.toLowerCase() || a.employeeId.toUpperCase() === q.toUpperCase()
    );

    if (!account) {
      return {
        success: false,
        field: 'username',
        message: 'Tài khoản hoặc mã nhân viên không tồn tại. Vui lòng đăng ký trước!'
      };
    }

    if (account.password !== password) {
      return {
        success: false,
        field: 'password',
        message: 'Mật khẩu không chính xác. Vui lòng thử lại!'
      };
    }

    return { success: true, account };
  }
};

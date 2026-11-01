// Storage and Backend API client for Smart Face Attendance

const STORAGE_KEYS = {
  STUDENTS: 'facethic_students',
  ATTENDANCE: 'facethic_attendance',
  SETTINGS: 'facethic_settings'
};

const DEFAULT_CLASSES = [
  { id: 'CS101', name: 'CS101 - Nhập môn Trí tuệ Nhân tạo', totalStudents: 40 },
  { id: 'IT202', name: 'IT202 - Lập trình Web Hiện đại', totalStudents: 45 },
  { id: 'SE301', name: 'SE301 - Công nghệ Phần mềm Chuyên sâu', totalStudents: 38 }
];

const INITIAL_STUDENTS = [
  {
    id: 'SV202601',
    name: 'Nguyễn Hoàng Long',
    classId: 'CS101',
    email: 'long.nh@facethic.edu.vn',
    registeredAt: '2026-11-01 08:00',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
    embeddingCreated: true
  },
  {
    id: 'SV202602',
    name: 'Trần Thị Mai Anh',
    classId: 'CS101',
    email: 'maianh.tt@facethic.edu.vn',
    registeredAt: '2026-11-01 08:15',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80',
    embeddingCreated: true
  },
  {
    id: 'SV202603',
    name: 'Lê Quốc Tuấn',
    classId: 'CS101',
    email: 'tuan.lq@facethic.edu.vn',
    registeredAt: '2026-11-01 08:30',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
    embeddingCreated: true
  },
  {
    id: 'SV202604',
    name: 'Phạm Minh Đức',
    classId: 'IT202',
    email: 'duc.pm@facethic.edu.vn',
    registeredAt: '2026-11-01 08:45',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80',
    embeddingCreated: true
  },
  {
    id: 'SV202605',
    name: 'Võ Thảo Vy',
    classId: 'IT202',
    email: 'thaovy.vo@facethic.edu.vn',
    registeredAt: '2026-11-01 09:00',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80',
    embeddingCreated: true
  }
];

export const storage = {
  getClasses() {
    return DEFAULT_CLASSES;
  },

  getStudents() {
    const raw = localStorage.getItem(STORAGE_KEYS.STUDENTS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(INITIAL_STUDENTS));
      return INITIAL_STUDENTS;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return INITIAL_STUDENTS;
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
      confidence: record.confidence || (95 + Math.random() * 4.5).toFixed(1) + '%',
      avatar: record.avatar,
      device: 'iPad Pro (Front Camera)'
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
      useMock: true,
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
  }
};

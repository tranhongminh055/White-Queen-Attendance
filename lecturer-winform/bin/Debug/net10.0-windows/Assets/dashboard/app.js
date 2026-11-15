(function () {
  const params = new URLSearchParams(window.location.search);
  const lecturerName = params.get('name') || 'Giảng viên';
  const lecturerId = params.get('id') || 'GV';

  const initials = lecturerName
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((w) => w[0] || '')
    .join('')
    .toUpperCase() || 'GV';

  document.getElementById('lecturerName').textContent = lecturerName;
  document.getElementById('lecturerId').textContent = `GV: ${lecturerId}`;
  document.getElementById('lecturerAvatar').textContent = initials;

  let allClasses = [];
  let attendanceLogs = [];
  let todaySessions = 0;

  // State for Dedicated Create Class Page
  let importedStudents = []; // [{ id, exists, fullName, email, embeddingCreated }]
  let activeImportFilter = 'all';

  const classesGrid = document.getElementById('classesGrid');
  const searchInput = document.getElementById('searchInput');
  const studentsModal = document.getElementById('studentsModal');

  function postMsg(payload) {
    if (window.chrome && window.chrome.webview) {
      window.chrome.webview.postMessage(payload);
    }
  }

  function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = message;
    container.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transition = 'opacity 0.25s ease';
      setTimeout(() => el.remove(), 260);
    }, 3200);
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function switchView(viewName) {
    if (viewName !== 'attendance' && typeof stopAttCamera === 'function') {
      stopAttCamera();
      if (typeof attState !== 'undefined' && attState.clockTimer) clearInterval(attState.clockTimer);
    }
    document.querySelectorAll('.view-section').forEach((sec) => sec.classList.remove('active'));
    const target = document.getElementById(`view-${viewName}`);
    if (target) target.classList.add('active');

    document.querySelectorAll('.nav-item').forEach((b) => {
      const v = b.getAttribute('data-view');
      b.classList.toggle('active', v === viewName || ((viewName === 'create-class' || viewName === 'attendance') && v === 'classes'));
    });
  }

  function animateValue(el, target) {
    const start = parseInt(el.textContent || '0', 10) || 0;
    const duration = 420;
    const startTime = performance.now();
    function tick(now) {
      const progress = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(start + (target - start) * eased);
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  function renderLoadingSkeleton() {
    classesGrid.innerHTML = Array.from({ length: 3 })
      .map(() => '<div class="skeleton-card"></div>')
      .join('');
  }

  function renderClasses() {
    const query = (searchInput.value || '').trim().toLowerCase();
    const filtered = allClasses.filter((c) => {
      if (!query) return true;
      return (
        (c.className || '').toLowerCase().includes(query) ||
        (c.joinCode || '').toLowerCase().includes(query)
      );
    });

    const cardsHtml = filtered
      .map((cls, idx) => {
        const scheduleLine = [cls.scheduleText, cls.roomText].filter(Boolean).join(' · ') || 'Chưa cập nhật lịch học';
        return `
          <article class="class-card" style="--stagger: ${idx * 60}ms">
            <div class="card-top">
              <span class="code-pill">${escapeHtml(cls.joinCode)} · ${escapeHtml(cls.semester)}</span>
              <button type="button" class="copy-btn" data-copy="${escapeHtml(cls.joinCode)}" title="Sao chép mã lớp">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="9" y="9" width="13" height="13" rx="2"/>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
              </button>
            </div>
            <h3 class="card-title">${escapeHtml(cls.className)}</h3>
            <div class="card-meta">
              <div class="meta-line">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="9"/>
                  <polyline points="12 7 12 12 15 14"/>
                </svg>
                <span>${escapeHtml(scheduleLine)}</span>
              </div>
              <div class="meta-line">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                </svg>
                <span>${cls.totalStudents || 0} sinh viên đã tham gia</span>
              </div>
            </div>
            <div class="card-actions">
              <button type="button" class="btn-card-primary" data-attend="${escapeHtml(cls.id)}">Mở điểm danh →</button>
              <button type="button" class="btn-card-secondary" data-students="${escapeHtml(cls.id)}">Xem sinh viên</button>
              <button type="button" class="btn-card-delete" data-delete="${escapeHtml(cls.id)}" title="Xóa lớp học">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                  <path d="M10 11v6M14 11v6"/>
                </svg>
              </button>
            </div>
          </article>
        `;
      })
      .join('');

    if (!filtered.length) {
      classesGrid.innerHTML = `<div style="grid-column:1/-1;padding:42px 24px;text-align:center;border:1px dashed rgba(255,255,255,0.12);border-radius:14px;color:#64748b;background:#070b10;">
        ${allClasses.length ? 'Không tìm thấy lớp học phù hợp với từ khóa.' : 'Chưa có lớp học nào. Bấm nút "+ Tạo lớp học mới" ở góc trên để tạo lớp đầu tiên.'}
      </div>`;
      return;
    }

    classesGrid.innerHTML = cardsHtml;

    classesGrid.querySelectorAll('[data-copy]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const code = btn.getAttribute('data-copy');
        try {
          await navigator.clipboard.writeText(code);
          showToast(`Đã sao chép mã lớp ${code}!`);
        } catch {
          showToast(`Mã lớp: ${code}`);
        }
      });
    });

    classesGrid.querySelectorAll('[data-attend]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-attend');
        openAttendancePage(id);
      });
    });

    classesGrid.querySelectorAll('[data-students]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-students');
        const cls = allClasses.find((c) => c.id === id);
        document.getElementById('studentsModalCode').textContent = `— ${cls ? cls.joinCode : id}`;
        document.getElementById('studentsModalTitle').textContent = cls ? cls.className : 'Danh sách sinh viên';
        document.getElementById('studentsModalBody').innerHTML = '<div style="color:#94a3b8;padding:18px 0">Đang tải dữ liệu sinh viên từ PostgreSQL...</div>';
        studentsModal.classList.add('open');
        postMsg({ action: 'class_students', classId: id });
      });
    });

    classesGrid.querySelectorAll('[data-delete]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-delete');
        const cls = allClasses.find((c) => c.id === id);
        if (confirm(`Bạn có chắc muốn xóa lớp "${cls ? cls.className : id}" (${id})?`)) {
          postMsg({ action: 'class_delete', classId: id });
        }
      });
    });
  }

  function renderHistory() {
    const tbody = document.getElementById('historyTableBody');
    if (!attendanceLogs.length) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#64748b;padding:28px">Chưa có lượt điểm danh nào được ghi nhận trên PostgreSQL.</td></tr>';
      return;
    }
    tbody.innerHTML = attendanceLogs
      .map(
        (log) => `
        <tr>
          <td style="font-family:var(--font-mono);color:#38bdf8">${escapeHtml(log.studentId)}</td>
          <td>${escapeHtml(log.studentName)}</td>
          <td>${escapeHtml(log.className || log.classId)}</td>
          <td>${escapeHtml(log.confidence)}</td>
          <td style="color:#94a3b8">${escapeHtml(log.timestamp)}</td>
        </tr>
      `
      )
      .join('');
  }

  // ===== DEDICATED CREATE CLASS PAGE =====
  function openCreateClassPage() {
    document.getElementById('createClassError').textContent = '';
    document.getElementById('createClassForm').reset();
    document.getElementById('inputSemester').value = 'HK1 2025-2026';
    document.getElementById('fileProgressBox').style.display = 'none';
    generateJoinCode();
    importedStudents = [];
    renderPreviewStudents();
    switchView('create-class');
    setTimeout(() => document.getElementById('inputClassName').focus(), 60);
  }

  function generateJoinCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let suffix = '';
    for (let i = 0; i < 4; i++) suffix += chars[Math.floor(Math.random() * chars.length)];
    document.getElementById('inputJoinCode').value = `WQ-${suffix}`;
  }

  function extractStudentIdsFromText(text) {
    const lines = String(text || '')
      .replace(/^\uFEFF/, '')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (!lines.length) return [];

    const splitCols = (line) => line.split(/[,;\t]/).map((c) => c.trim().replace(/^"|"$/g, ''));
    const firstCols = splitCols(lines[0]).map((c) => c.toUpperCase());
    let mssvCol = firstCols.findIndex((c) => ['MSSV', 'MA_SV', 'MASV', 'STUDENTID', 'STUDENT_ID', 'ID'].includes(c));
    const hasHeader = mssvCol !== -1 || firstCols.includes('STT');
    if (mssvCol === -1) {
      mssvCol = firstCols[0] === 'STT' && firstCols.length > 1 ? 1 : 0;
    }

    const startRow = hasHeader ? 1 : 0;
    const ids = [];
    for (let i = startRow; i < lines.length; i++) {
      const cols = splitCols(lines[i]);
      const val = (cols[mssvCol] || '').replace(/[\x00-\x1f\x7f]+/g, '').trim().toUpperCase();
      if (val && !['MSSV', 'MA_SV', 'MASV', 'STUDENTID', 'STUDENT_ID', 'ID'].includes(val)) {
        ids.push(val);
      }
    }
    return Array.from(new Set(ids));
  }

  function addIdsAndLookup(newIds) {
    if (!newIds.length) {
      showToast('Không tìm thấy MSSV hợp lệ để thêm.', 'error');
      return;
    }
    const existingSet = new Set(importedStudents.map((s) => s.id.toUpperCase()));
    const combined = [...importedStudents.map((s) => s.id)];
    newIds.forEach((id) => {
      if (!existingSet.has(id)) {
        existingSet.add(id);
        combined.push(id);
      }
    });
    postMsg({ action: 'students_lookup', studentIds: combined });
  }

  function renderPreviewStudents() {
    const validCount = importedStudents.filter((s) => s.exists).length;
    document.getElementById('validAssignCount').textContent = validCount;
  }

  function handleCsvFile(file) {
    if (!file) return;
    const box = document.getElementById('fileProgressBox');
    box.style.display = 'block';
    document.getElementById('fpFileName').textContent = `${file.name} (${Math.max(1, Math.round(file.size / 1024))} KB)`;

    if (file.name.toLowerCase().endsWith('.xls')) {
      box.style.display = 'none';
      showToast('Định dạng .xls cũ chưa được hỗ trợ, vui lòng lưu file dưới dạng .xlsx hoặc .csv.', 'error');
      return;
    }

    if (file.name.toLowerCase().endsWith('.xlsx')) {
      document.getElementById('fpStatus').textContent = 'ĐANG ĐỌC FILE EXCEL...';
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = String(ev.target?.result || '');
        const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
        postMsg({ action: 'parse_xlsx_students', base64 });
      };
      reader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result || '';
      const ids = extractStudentIdsFromText(content);
      document.getElementById('fpStatus').textContent = `100% · ĐÃ ĐỌC ${ids.length} MSSV`;
      addIdsAndLookup(ids);
    };
    reader.readAsText(file, 'utf-8');
  }

  // Navigation switching
  document.querySelectorAll('.nav-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      switchView(btn.getAttribute('data-view'));
    });
  });

  // Topbar & Create Class Page events
  searchInput.addEventListener('input', renderClasses);
  document.getElementById('btnOpenCreateTop').addEventListener('click', openCreateClassPage);
  document.getElementById('btnBackToClasses').addEventListener('click', () => switchView('classes'));
  document.getElementById('btnCancelCreate').addEventListener('click', () => switchView('classes'));
  document.getElementById('btnGenJoinCode').addEventListener('click', generateJoinCode);

  const dropZone = document.getElementById('csvDropZone');
  const csvFileInput = document.getElementById('csvFileInput');
  document.getElementById('btnPickCsv').addEventListener('click', () => csvFileInput.click());
  csvFileInput.addEventListener('change', (e) => handleCsvFile(e.target.files?.[0]));
  dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    handleCsvFile(e.dataTransfer?.files?.[0]);
  });

  document.getElementById('btnDownloadSampleCsv').addEventListener('click', () => {
    const sample = '\uFEFFMSSV\nSV-7142\n';
    const blob = new Blob([sample], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mau_danh_sach_sinhvien.csv';
    a.click();
    URL.revokeObjectURL(url);
  });

  document.getElementById('btnCloseStudentsModal').addEventListener('click', () => studentsModal.classList.remove('open'));
  document.getElementById('btnRefreshHistory').addEventListener('click', () => postMsg({ action: 'dashboard_load_data' }));
  document.getElementById('btnLogout').addEventListener('click', () => postMsg({ action: 'logout' }));
  document.getElementById('btnExit').addEventListener('click', () => postMsg({ action: 'exit_app' }));

  document.getElementById('createClassForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const className = document.getElementById('inputClassName').value.trim();
    const joinCode = document.getElementById('inputJoinCode').value.trim().toUpperCase();
    const semester = document.getElementById('inputSemester').value.trim();
    const scheduleText = document.getElementById('inputSchedule').value.trim();
    const roomText = document.getElementById('inputRoom').value.trim();
    if (!className) return;

    const btn = document.getElementById('btnSubmitCreate');
    btn.disabled = true;
    btn.textContent = 'Đang lưu lên PostgreSQL...';
    document.getElementById('createClassError').textContent = '';

    const validIds = importedStudents.filter((s) => s.exists).map((s) => s.id);
    postMsg({
      action: 'class_create',
      className,
      joinCode,
      semester,
      scheduleText,
      roomText,
      studentIds: validIds
    });
  });

  // CSV Export (UTF-8 BOM for Excel)
  function downloadCsv(filename, rows) {
    const csv = '\uFEFF' + rows.map((r) => r.map((v) => `"${String(v || '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  document.getElementById('btnExportAttendanceCsv').addEventListener('click', () => {
    const rows = [['MSSV', 'Ho ten', 'Ma lop', 'Ten lop', 'Do khop', 'Thoi gian']];
    attendanceLogs.forEach((l) => rows.push([l.studentId, l.studentName, l.classId, l.className, l.confidence, l.timestamp]));
    downloadCsv(`BaoCaoDiemDanh_${lecturerId}.csv`, rows);
    showToast('Đã xuất báo cáo điểm danh CSV!');
  });

  document.getElementById('btnExportClassesCsv').addEventListener('click', () => {
    const rows = [['Ma lop', 'Ten lop', 'Hoc ky', 'Lich hoc', 'Phong', 'Si so']];
    allClasses.forEach((c) => rows.push([c.joinCode, c.className, c.semester, c.scheduleText, c.roomText, c.totalStudents]));
    downloadCsv(`DanhSachLop_${lecturerId}.csv`, rows);
    showToast('Đã xuất danh sách lớp học CSV!');
  });

  // Callbacks from C# MainForm.cs
  window.onDashboardData = function (res) {
    allClasses = Array.isArray(res?.classes) ? res.classes : [];
    attendanceLogs = Array.isArray(res?.attendance?.logs) ? res.attendance.logs : [];
    todaySessions = Number(res?.attendance?.todaySessions || 0);

    const totalStudents = allClasses.reduce((sum, c) => sum + (Number(c.totalStudents) || 0), 0);
    animateValue(document.getElementById('kpiTotalClasses'), allClasses.length);
    animateValue(document.getElementById('kpiTotalStudents'), totalStudents);
    animateValue(document.getElementById('kpiTodaySessions'), todaySessions);

    renderClasses();
    renderHistory();
  };

  window.onStudentsLookup = function (res) {
    if (!res?.ok || !Array.isArray(res?.data)) {
      const detail = res?.data?.detail ? ` (${res.data.detail})` : '';
      showToast(`Không thể kiểm tra danh sách sinh viên từ máy chủ${detail}.`, 'error');
      return;
    }
    importedStudents = res.data;
    document.getElementById('fpStatus').textContent = `100% · ĐÃ ĐỌC ${importedStudents.length} MSSV`;
    renderPreviewStudents();
    showToast(`Đã kiểm tra ${importedStudents.length} sinh viên từ PostgreSQL.`);
  };

  window.onClassCreated = function (res) {
    const btn = document.getElementById('btnSubmitCreate');
    btn.disabled = false;
    btn.textContent = 'Tạo lớp học & Lưu danh sách SV →';

    if (!res?.ok) {
      document.getElementById('createClassError').textContent = res?.data?.detail || 'Không thể tạo lớp học.';
      return;
    }

    const created = res.data;
    allClasses = [created, ...allClasses];
    const totalStudents = allClasses.reduce((sum, c) => sum + (Number(c.totalStudents) || 0), 0);
    animateValue(document.getElementById('kpiTotalClasses'), allClasses.length);
    animateValue(document.getElementById('kpiTotalStudents'), totalStudents);
    renderClasses();
    switchView('classes');
    showToast(`Đã tạo lớp "${created.className}" (${created.joinCode}) với ${created.totalStudents || 0} sinh viên!`);
  };

  window.onClassDeleted = function (res) {
    if (!res?.ok) {
      showToast(res?.data?.detail || 'Không thể xóa lớp học.', 'error');
      return;
    }
    allClasses = allClasses.filter((c) => c.id !== res.classId);
    const totalStudents = allClasses.reduce((sum, c) => sum + (Number(c.totalStudents) || 0), 0);
    animateValue(document.getElementById('kpiTotalClasses'), allClasses.length);
    animateValue(document.getElementById('kpiTotalStudents'), totalStudents);
    renderClasses();
    showToast('Đã xóa lớp học khỏi PostgreSQL.');
  };

  window.onClassStudents = function (res) {
    const container = document.getElementById('studentsModalBody');
    const list = Array.isArray(res?.data) ? res.data : [];
    if (!list.length) {
      container.innerHTML = '<div style="color:#64748b;padding:24px;text-align:center">Chưa có sinh viên nào tham gia lớp này. Hãy gửi mã lớp cho sinh viên nhập trên Website!</div>';
      return;
    }
    container.innerHTML = list
      .map(
        (st) => `
        <div class="student-row">
          <div>
            <div style="font-weight:700;color:#f8fafc">${escapeHtml(st.fullName)}</div>
            <div style="font-family:var(--font-mono);font-size:0.74rem;color:#64748b">${escapeHtml(st.id)} · ${escapeHtml(st.email)}</div>
          </div>
          <span class="${st.embeddingCreated ? 'student-badge-ok' : 'student-badge-no'}">
            ${st.embeddingCreated ? '✓ Đã đăng ký khuôn mặt' : 'Chưa có khuôn mặt'}
          </span>
        </div>
      `
      )
      .join('');
  };

  // =========================================================
  // LIVE AI ATTENDANCE CONTROLLER (FIGMA 1:1 + FACE-API.JS)
  // =========================================================
  const attState = {
    classId: null,
    classObj: null,
    students: [],
    statusMap: new Map(), // UPPER(id) -> { status: 'present'|'late'|'absent', time: 'HH:MM:SS', confidence: 99.2 }
    justCheckedId: null,
    filter: 'all',
    mode: 'auto', // 'auto' | 'manual'
    scanning: false,
    paused: false,
    modelsLoaded: false,
    faceMatcher: null,
    descriptorMeta: new Map(), // UPPER(id) -> { fullName, avatar }
    stream: null,
    devices: [],
    deviceIndex: 0,
    clockTimer: null,
    scanTimer: null,
    inFlightIds: new Set(),
    popupTimer: null,
  };

  function todayIsoLocal() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function startAttClock() {
    if (attState.clockTimer) clearInterval(attState.clockTimer);
    const days = ['CHỦ NHẬT', 'THỨ HAI', 'THỨ BA', 'THỨ TƯ', 'THỨ NĂM', 'THỨ SÁU', 'THỨ BẢY'];
    const tick = () => {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      const ss = String(now.getSeconds()).padStart(2, '0');
      document.getElementById('attLiveClock').textContent = `${hh}:${mm}:${ss}`;
      const dd = String(now.getDate()).padStart(2, '0');
      const mo = String(now.getMonth() + 1).padStart(2, '0');
      document.getElementById('attLiveDate').textContent = `${days[now.getDay()]} · ${dd}/${mo}/${now.getFullYear()}`;
    };
    tick();
    attState.clockTimer = setInterval(tick, 1000);
  }

  function stopAttCamera() {
    if (attState.scanTimer) {
      clearInterval(attState.scanTimer);
      attState.scanTimer = null;
    }
    if (attState.stream) {
      attState.stream.getTracks().forEach((t) => t.stop());
      attState.stream = null;
    }
    const video = document.getElementById('attVideo');
    if (video) video.srcObject = null;
    const canvas = document.getElementById('attOverlayCanvas');
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx && ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    attState.scanning = false;
    document.getElementById('attCameraShell')?.classList.remove('scanning');
  }

  async function ensureFaceModels() {
    if (attState.modelsLoaded) return true;
    if (typeof faceapi === 'undefined') {
      document.getElementById('attCamPlaceholderText').textContent = 'Không tải được thư viện nhận diện khuôn mặt.';
      return false;
    }
    const modelUrl = 'https://app.whitequeen.local/models';
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(modelUrl),
      faceapi.nets.faceLandmark68Net.loadFromUri(modelUrl),
      faceapi.nets.faceRecognitionNet.loadFromUri(modelUrl),
    ]);
    attState.modelsLoaded = true;
    return true;
  }

  async function startAttCamera() {
    const ph = document.getElementById('attCamPlaceholder');
    const phText = document.getElementById('attCamPlaceholderText');
    ph.classList.remove('hidden');
    phText.textContent = 'Đang khởi tạo AI Camera & tải mô hình nhận diện...';

    try {
      await ensureFaceModels();
      if (navigator.mediaDevices?.enumerateDevices) {
        const all = await navigator.mediaDevices.enumerateDevices();
        attState.devices = all.filter((d) => d.kind === 'videoinput');
      }
      if (attState.stream) {
        attState.stream.getTracks().forEach((t) => t.stop());
      }
      const chosen = attState.devices[attState.deviceIndex];
      const videoConstraints = chosen?.deviceId
        ? { deviceId: { exact: chosen.deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
        : { width: { ideal: 1280 }, height: { ideal: 720 } };

      const stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints, audio: false });
      attState.stream = stream;
      const video = document.getElementById('attVideo');
      video.srcObject = stream;
      await video.play();
      ph.classList.add('hidden');
      document.getElementById('attRecText').textContent = `REC CAM_0${attState.deviceIndex + 1} · HD · 30FPS`;
      setAttScanning(true);
    } catch (err) {
      ph.classList.remove('hidden');
      phText.textContent = `Không mở được camera (${err?.message || 'Chưa cấp quyền'}). Bạn vẫn có thể điểm danh Thủ công.`;
      setAttScanning(false);
    }
  }

  function setAttScanning(active) {
    attState.scanning = active && !attState.paused;
    const shell = document.getElementById('attCameraShell');
    const pill = document.getElementById('attCamStatusPill');
    const pillText = document.getElementById('attCamStatusText');
    const btnMain = document.getElementById('btnAttStartStop');
    const btnPause = document.getElementById('btnAttPause');

    if (attState.scanning) {
      shell.classList.add('scanning');
      pill.classList.remove('paused');
      pillText.textContent = 'AI ĐANG QUÉT TRỰC TIẾP';
      btnMain.textContent = '⏹ Dừng quét';
      btnPause.textContent = '⏸ Tạm dừng';
      if (!attState.scanTimer) {
        attState.scanTimer = setInterval(runFaceScanTick, 240);
      }
    } else {
      shell.classList.remove('scanning');
      pill.classList.add('paused');
      pillText.textContent = attState.paused ? 'ĐÃ TẠM DỪNG' : 'CAMERA SẴN SÀNG';
      btnMain.textContent = '▶ Bắt đầu điểm danh';
      btnPause.textContent = attState.paused ? '▶ Tiếp tục' : '⏸ Tạm dừng';
      if (attState.scanTimer) {
        clearInterval(attState.scanTimer);
        attState.scanTimer = null;
      }
      const canvas = document.getElementById('attOverlayCanvas');
      const ctx = canvas?.getContext('2d');
      ctx && ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  function drawHudFaceBox(ctx, box, styleType, title, subtitle) {
    const colors = {
      matched: { stroke: '#22c55e', bg: 'rgba(16, 185, 129, 0.92)', text: '#052e16' },
      scanning: { stroke: '#22d3ee', bg: 'rgba(8, 145, 178, 0.88)', text: '#ecfeff' },
      unknown: { stroke: '#f59e0b', bg: 'rgba(180, 83, 9, 0.88)', text: '#fffbeb' },
    };
    const c = colors[styleType] || colors.scanning;
    const { x, y, width, height } = box;
    const len = Math.max(12, Math.min(24, width * 0.2));

    ctx.save();
    ctx.strokeStyle = c.stroke;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.45;
    ctx.strokeRect(x, y, width, height);

    ctx.globalAlpha = 1;
    ctx.lineWidth = 2.8;
    ctx.shadowColor = c.stroke;
    ctx.shadowBlur = 10;

    // 4 corners
    ctx.beginPath();
    ctx.moveTo(x, y + len); ctx.lineTo(x, y); ctx.lineTo(x + len, y);
    ctx.moveTo(x + width - len, y); ctx.lineTo(x + width, y); ctx.lineTo(x + width, y + len);
    ctx.moveTo(x, y + height - len); ctx.lineTo(x, y + height); ctx.lineTo(x + len, y + height);
    ctx.moveTo(x + width - len, y + height); ctx.lineTo(x + width, y + height); ctx.lineTo(x + width, y + height - len);
    ctx.stroke();

    // Floating tag above face
    ctx.shadowBlur = 0;
    ctx.font = '700 12px "Segoe UI", sans-serif';
    const w1 = ctx.measureText(title).width;
    ctx.font = '600 10px "JetBrains Mono", monospace';
    const w2 = ctx.measureText(subtitle).width;
    const tagW = Math.max(w1, w2) + 18;
    const tagH = 34;
    const tagX = Math.max(4, x);
    const tagY = Math.max(4, y - tagH - 6);

    ctx.fillStyle = c.bg;
    ctx.fillRect(tagX, tagY, tagW, tagH);
    ctx.fillStyle = c.text;
    ctx.font = '700 12px "Segoe UI", sans-serif';
    ctx.fillText(title, tagX + 9, tagY + 14);
    ctx.font = '600 10px "JetBrains Mono", monospace';
    ctx.fillText(subtitle, tagX + 9, tagY + 28);
    ctx.restore();
  }

  let isScanningFrame = false;
  async function runFaceScanTick() {
    if (!attState.scanning || isScanningFrame || !attState.modelsLoaded) return;
    const video = document.getElementById('attVideo');
    const canvas = document.getElementById('attOverlayCanvas');
    if (!video || !canvas || video.readyState < 2 || !video.videoWidth) return;

    isScanningFrame = true;
    const t0 = performance.now();
    try {
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }
      const detections = await faceapi
        .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.45 }))
        .withFaceLandmarks()
        .withFaceDescriptors();

      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const det of detections) {
        const box = det.detection.box;
        if (!attState.faceMatcher) {
          drawHudFaceBox(ctx, box, 'scanning', 'Đang quét...', 'CHƯA CÓ DỮ LIỆU KHUÔN MẶT');
          continue;
        }
        const match = attState.faceMatcher.findBestMatch(det.descriptor);
        if (match.label === 'unknown') {
          drawHudFaceBox(ctx, box, 'unknown', 'Chưa rõ', `ĐỘ KHỚP THẤP · ${Math.round((1 - match.distance) * 100)}%`);
        } else {
          const sid = match.label;
          const meta = attState.descriptorMeta.get(sid.toUpperCase());
          const conf = Math.min(99.9, Math.max(70, (1 - match.distance) * 100));
          const confStr = conf.toFixed(1);
          drawHudFaceBox(ctx, box, 'matched', meta?.fullName || sid, `${sid} · ${confStr}%`);

          if (attState.mode === 'auto') {
            const st = attState.statusMap.get(sid.toUpperCase());
            if ((!st || st.status === 'absent') && !attState.inFlightIds.has(sid.toUpperCase())) {
              triggerRecordAttendance(sid, meta?.fullName || sid, Number(confStr), 'Lecturer Desktop AI');
            }
          }
        }
      }

      const elapsed = Math.round(performance.now() - t0);
      document.getElementById('attLatencyVal').textContent = `${elapsed}ms`;
    } catch {
      // Skip transient frame error
    } finally {
      isScanningFrame = false;
    }
  }

  function triggerRecordAttendance(studentId, fullName, confidence, device) {
    const key = studentId.toUpperCase();
    if (attState.inFlightIds.has(key)) return;
    attState.inFlightIds.add(key);
    const meta = attState.descriptorMeta.get(key);
    postMsg({
      action: 'attendance_record',
      studentId,
      studentName: fullName,
      classId: attState.classId,
      confidence,
      avatar: meta?.avatar || null,
      device,
    });
  }

  function showCamMatchPopup(fullName, studentId, timeText) {
    const toast = document.getElementById('attMatchToast');
    document.getElementById('attMatchTitle').textContent = `${fullName} — Điểm danh thành công`;
    document.getElementById('attMatchSub').textContent = `MSSV ${studentId} · ${timeText}`;
    toast.classList.add('show');
    if (attState.popupTimer) clearTimeout(attState.popupTimer);
    attState.popupTimer = setTimeout(() => toast.classList.remove('show'), 3600);
  }

  function renderAttendanceUI() {
    const total = attState.students.length;
    let present = 0;
    let late = 0;
    attState.students.forEach((st) => {
      const rec = attState.statusMap.get(st.id.toUpperCase());
      if (rec?.status === 'present') present++;
      else if (rec?.status === 'late') late++;
    });
    const checked = present + late;
    const absent = Math.max(0, total - checked);
    const pct = total > 0 ? Math.round((checked / total) * 100) : 0;

    document.getElementById('attKpiTotal').textContent = total;
    document.getElementById('attKpiPresent').textContent = present;
    document.getElementById('attKpiAbsent').textContent = absent;
    document.getElementById('attKpiLate').textContent = late;

    document.getElementById('attScanProgressLabel').textContent = `${checked} / ${total} KHUÔN MẶT`;
    document.getElementById('attScanProgressFill').style.width = `${pct}%`;

    const circ = 201.06;
    document.getElementById('attDonutCircle').style.strokeDashoffset = circ - (circ * pct) / 100;
    document.getElementById('attDonutPct').textContent = `${pct}%`;
    document.getElementById('attLegPresent').textContent = present;
    document.getElementById('attLegLate').textContent = late;
    document.getElementById('attLegAbsent').textContent = absent;

    const q = (document.getElementById('attSearchInput')?.value || '').trim().toLowerCase();
    const listEl = document.getElementById('attStudentList');
    const filtered = attState.students.filter((st) => {
      const rec = attState.statusMap.get(st.id.toUpperCase()) || { status: 'absent' };
      if (attState.filter !== 'all' && rec.status !== attState.filter) return false;
      if (q) {
        return st.fullName.toLowerCase().includes(q) || st.id.toLowerCase().includes(q);
      }
      return true;
    });

    if (!filtered.length) {
      listEl.innerHTML = '<div style="color:#64748b;text-align:center;padding:24px 8px;font-size:0.82rem;">Không có sinh viên phù hợp bộ lọc.</div>';
      return;
    }

    listEl.innerHTML = filtered
      .map((st) => {
        const key = st.id.toUpperCase();
        const rec = attState.statusMap.get(key) || { status: 'absent', time: 'Chưa điểm danh' };
        const isPresent = rec.status === 'present' || rec.status === 'late';
        const badgeLabel = rec.status === 'present' ? 'CÓ MẶT' : rec.status === 'late' ? 'ĐI MUỘN' : 'VẮNG';
        const initials = (st.fullName || 'SV').trim().split(/\s+/).slice(-2).map((w) => w[0]?.toUpperCase() || '').join('');
        const avatarHtml = st.avatar
          ? `<img src="${escapeHtml(st.avatar)}" class="att-st-avatar" alt="" />`
          : `<div class="att-st-avatar">${escapeHtml(initials || 'SV')}</div>`;
        const flashClass = attState.justCheckedId === key ? 'just-checked' : '';
        const manualBtn = !isPresent
          ? `<button type="button" class="att-manual-btn" data-manual-checkin="${escapeHtml(st.id)}">✓ Điểm danh</button>`
          : '';
        return `
          <div class="att-student-row ${isPresent ? 'is-present' : ''} ${flashClass}">
            <div class="att-st-left">
              ${avatarHtml}
              <div class="att-st-info">
                <div class="att-st-name">${escapeHtml(st.fullName)}</div>
                <div class="att-st-sub">${escapeHtml(st.id)} · ${escapeHtml(rec.time)}</div>
              </div>
            </div>
            <div class="att-st-actions">
              ${manualBtn}
              <span class="att-status-pill ${rec.status}">${badgeLabel}</span>
            </div>
          </div>
        `;
      })
      .join('');

    listEl.querySelectorAll('[data-manual-checkin]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const sid = btn.getAttribute('data-manual-checkin');
        const st = attState.students.find((x) => x.id.toUpperCase() === sid.toUpperCase());
        triggerRecordAttendance(sid, st ? st.fullName : sid, 100.0, 'Manual (Lecturer)');
      });
    });
  }

  function openAttendancePage(classId) {
    const cls = allClasses.find((c) => c.id === classId);
    attState.classId = classId;
    attState.classObj = cls || null;
    attState.students = [];
    attState.statusMap.clear();
    attState.descriptorMeta.clear();
    attState.faceMatcher = null;
    attState.justCheckedId = null;
    attState.paused = false;

    document.getElementById('attClassName').textContent = cls ? cls.className : classId;
    document.getElementById('attClassCode').textContent = cls ? cls.joinCode : '';
    document.getElementById('attClassMeta').innerHTML = `
      <span>📍 ${escapeHtml(cls?.roomText || 'Phòng học')}</span>
      <span>·</span>
      <span>🕒 ${escapeHtml(cls?.scheduleText || 'Lịch học')}</span>
      <span>·</span>
      <span>${escapeHtml(cls?.semester || '')}</span>
    `;

    switchView('attendance');
    startAttClock();
    renderAttendanceUI();
    postMsg({ action: 'attendance_init', classId });
    startAttCamera();
  }

  window.onAttendanceInit = function (res) {
    if (res?.classId !== attState.classId) return;
    attState.students = Array.isArray(res?.students) ? res.students : [];
    const logs = Array.isArray(res?.logs) ? res.logs : [];
    const descriptors = Array.isArray(res?.descriptors) ? res.descriptors : [];
    const today = todayIsoLocal();

    attState.statusMap.clear();
    logs.forEach((log) => {
      const ts = String(log.timestamp || '');
      if (ts.includes(today)) {
        const timePart = ts.split(' ')[0] || ts;
        attState.statusMap.set(String(log.studentId).toUpperCase(), {
          status: 'present',
          time: timePart,
          confidence: log.confidence || 99,
        });
      }
    });

    attState.descriptorMeta.clear();
    if (typeof faceapi !== 'undefined' && descriptors.length > 0) {
      const labeled = [];
      descriptors.forEach((item) => {
        if (!Array.isArray(item.descriptors) || !item.descriptors.length) return;
        const floatList = item.descriptors.map((d) => new Float32Array(d));
        labeled.push(new faceapi.LabeledFaceDescriptors(item.studentId, floatList));
        attState.descriptorMeta.set(String(item.studentId).toUpperCase(), {
          fullName: item.fullName,
          avatar: item.avatar,
        });
      });
      attState.faceMatcher = labeled.length ? new faceapi.FaceMatcher(labeled, 0.52) : null;
    } else {
      attState.faceMatcher = null;
    }

    renderAttendanceUI();
  };

  window.onAttendanceRecorded = function (res) {
    const key = String(res?.studentId || '').toUpperCase();
    attState.inFlightIds.delete(key);
    if (!res?.ok) {
      showToast('Không thể lưu điểm danh lên máy chủ.', 'error');
      return;
    }
    const rec = res?.data?.record;
    const timePart = String(rec?.timestamp || '').split(' ')[0] || new Date().toTimeString().slice(0, 8);
    attState.statusMap.set(key, {
      status: 'present',
      time: timePart,
      confidence: rec?.confidence || 99,
    });
    attState.justCheckedId = key;
    renderAttendanceUI();
    if (res?.data?.success) {
      showCamMatchPopup(rec?.studentName || key, rec?.studentId || key, timePart);
    }
    postMsg({ action: 'dashboard_load_data' });
  };

  // Attendance View Controls
  document.getElementById('btnBackFromAttendance')?.addEventListener('click', () => {
    stopAttCamera();
    if (attState.clockTimer) clearInterval(attState.clockTimer);
    switchView('classes');
  });

  const togglePause = () => {
    attState.paused = !attState.paused;
    setAttScanning(!attState.paused);
  };
  document.getElementById('btnAttPause')?.addEventListener('click', togglePause);
  document.getElementById('btnAttPauseBottom')?.addEventListener('click', togglePause);

  document.getElementById('btnAttStartStop')?.addEventListener('click', () => {
    if (attState.scanning) {
      attState.paused = true;
      setAttScanning(false);
    } else {
      attState.paused = false;
      if (!attState.stream) startAttCamera();
      else setAttScanning(true);
    }
  });

  document.getElementById('btnAttSwitchCam')?.addEventListener('click', async () => {
    if (attState.devices.length <= 1) {
      showToast('Chỉ phát hiện 1 camera trên thiết bị.');
      return;
    }
    attState.deviceIndex = (attState.deviceIndex + 1) % attState.devices.length;
    await startAttCamera();
  });

  document.getElementById('btnAttFinish')?.addEventListener('click', () => {
    stopAttCamera();
    if (attState.clockTimer) clearInterval(attState.clockTimer);
    showToast('Đã kết thúc phiên điểm danh và đồng bộ PostgreSQL.');
    postMsg({ action: 'dashboard_load_data' });
    switchView('classes');
  });

  document.querySelectorAll('.att-mode-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.att-mode-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      attState.mode = btn.getAttribute('data-mode') || 'auto';
      showToast(attState.mode === 'auto' ? 'Đã chuyển sang chế độ AI Tự động.' : 'Đã chuyển sang chế độ Thủ công.');
    });
  });

  document.querySelectorAll('.att-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.att-tab').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      attState.filter = btn.getAttribute('data-filter') || 'all';
      renderAttendanceUI();
    });
  });

  document.getElementById('attSearchInput')?.addEventListener('input', renderAttendanceUI);

  renderLoadingSkeleton();
  postMsg({ action: 'dashboard_load_data' });
})();

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
    document.querySelectorAll('.view-section').forEach((sec) => sec.classList.remove('active'));
    const target = document.getElementById(`view-${viewName}`);
    if (target) target.classList.add('active');

    document.querySelectorAll('.nav-item').forEach((b) => {
      const v = b.getAttribute('data-view');
      b.classList.toggle('active', v === viewName || (viewName === 'create-class' && v === 'classes'));
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

    const newCardHtml = `
      <div class="new-class-card" id="cardCreateNew">
        <div class="plus-circle">+</div>
        <div class="new-class-title">+ Tạo lớp học mới</div>
        <div class="new-class-sub">NEW CLASS · IMPORT DANH SÁCH SV</div>
      </div>
    `;

    classesGrid.innerHTML = cardsHtml + newCardHtml;

    document.getElementById('cardCreateNew').addEventListener('click', openCreateClassPage);

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
        const cls = allClasses.find((c) => c.id === id);
        showToast(`Lớp ${cls ? cls.className : id} sẵn sàng mở điểm danh ở bước tiếp theo!`);
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
    importedStudents = [];
    activeImportFilter = 'all';
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
    const tokens = String(text || '')
      .split(/[\r\n,;\t ]+/)
      .map((s) => s.trim().toUpperCase())
      .filter((s) => s && !['MSSV', 'STUDENTID', 'STUDENT_ID', 'MA_SV', 'ID'].includes(s));
    return Array.from(new Set(tokens));
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
    const cntAll = importedStudents.length;
    const cntFaceOk = importedStudents.filter((s) => s.exists && s.embeddingCreated).length;
    const cntNoAcc = importedStudents.filter((s) => !s.exists).length;
    const cntNoFace = importedStudents.filter((s) => s.exists && !s.embeddingCreated).length;
    const validCount = importedStudents.filter((s) => s.exists).length;

    document.getElementById('previewTotalCount').textContent = cntAll;
    document.getElementById('cntAll').textContent = cntAll;
    document.getElementById('cntFaceOk').textContent = cntFaceOk;
    document.getElementById('cntNoAcc').textContent = cntNoAcc;
    document.getElementById('cntNoFace').textContent = cntNoFace;
    document.getElementById('validAssignCount').textContent = validCount;

    const q = (document.getElementById('previewSearchInput').value || '').trim().toLowerCase();
    const list = importedStudents.filter((st) => {
      if (activeImportFilter === 'face_ok' && !(st.exists && st.embeddingCreated)) return false;
      if (activeImportFilter === 'no_acc' && st.exists) return false;
      if (activeImportFilter === 'no_face' && !(st.exists && !st.embeddingCreated)) return false;
      if (q) {
        return st.id.toLowerCase().includes(q) || (st.fullName || '').toLowerCase().includes(q);
      }
      return true;
    });

    const tbody = document.getElementById('previewTableBody');
    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#64748b;padding:24px">Chưa có sinh viên nào trong danh sách import. Hãy tải file .CSV hoặc dán MSSV ở trên.</td></tr>';
      return;
    }

    tbody.innerHTML = list
      .map((st, idx) => {
        const accBadge = st.exists
          ? '<span class="pill-ok">● Đã có tài khoản</span>'
          : '<span class="pill-err">● Không tìm thấy DB</span>';
        const faceBadge = st.embeddingCreated
          ? '<span class="pill-ok">● Đã đăng ký khuôn mặt</span>'
          : '<span class="pill-warn">● Chưa có khuôn mặt</span>';
        return `
          <tr class="${st.exists ? '' : 'row-invalid'}">
            <td style="font-family:var(--font-mono);color:#64748b">${String(idx + 1).padStart(2, '0')}</td>
            <td style="font-weight:700;color:${st.exists ? '#f8fafc' : '#fb7185'}">${escapeHtml(st.fullName)}</td>
            <td style="font-family:var(--font-mono);color:#38bdf8">${escapeHtml(st.id)}</td>
            <td>${accBadge}</td>
            <td>${faceBadge}</td>
            <td style="text-align:right">
              <button type="button" class="btn-card-delete" data-remove-sv="${escapeHtml(st.id)}" title="Xóa khỏi danh sách" style="width:28px;height:28px">✕</button>
            </td>
          </tr>
        `;
      })
      .join('');

    tbody.querySelectorAll('[data-remove-sv]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const sid = btn.getAttribute('data-remove-sv');
        importedStudents = importedStudents.filter((s) => s.id !== sid);
        renderPreviewStudents();
      });
    });
  }

  function handleCsvFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result || '';
      const ids = extractStudentIdsFromText(content);
      const box = document.getElementById('fileProgressBox');
      box.style.display = 'block';
      document.getElementById('fpFileName').textContent = `${file.name} (${Math.max(1, Math.round(file.size / 1024))} KB)`;
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

  document.getElementById('btnQuickAdd').addEventListener('click', () => {
    const ta = document.getElementById('quickAddInput');
    const ids = extractStudentIdsFromText(ta.value);
    if (ids.length) {
      addIdsAndLookup(ids);
      ta.value = '';
    }
  });

  document.getElementById('btnReverifyList').addEventListener('click', () => {
    if (importedStudents.length) {
      postMsg({ action: 'students_lookup', studentIds: importedStudents.map((s) => s.id) });
    }
  });

  document.querySelectorAll('#importFilterTabs .ftab').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#importFilterTabs .ftab').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      activeImportFilter = btn.getAttribute('data-filter');
      renderPreviewStudents();
    });
  });

  document.getElementById('previewSearchInput').addEventListener('input', renderPreviewStudents);
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
      showToast('Không thể kiểm tra danh sách sinh viên từ máy chủ.', 'error');
      return;
    }
    importedStudents = res.data;
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

  renderLoadingSkeleton();
  postMsg({ action: 'dashboard_load_data' });
})();

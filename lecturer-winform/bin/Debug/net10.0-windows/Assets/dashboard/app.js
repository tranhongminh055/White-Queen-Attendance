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
  let attendanceSessions = [];
  let selectedHistoryClassId = null;
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
      b.classList.toggle(
        'active',
        v === viewName ||
          ((viewName === 'create-class' || viewName === 'attendance') && v === 'classes') ||
          ((viewName === 'history-sessions' || viewName === 'history-detail') && v === 'history')
      );
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
    const semSelect = document.getElementById('historySemesterFilter');
    const searchEl = document.getElementById('historySearchInput');
    const grid = document.getElementById('historyClassesGrid');
    if (!grid) return;

    // Populate real semester options from lecturer's classes
    if (semSelect) {
      const currentVal = semSelect.value || 'ALL';
      const semesters = Array.from(new Set(allClasses.map((c) => c.semester).filter(Boolean)));
      semSelect.innerHTML = '<option value="ALL">Tất cả học kỳ</option>' +
        semesters.map((s) => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');
      semSelect.value = semesters.includes(currentVal) ? currentVal : 'ALL';
    }

    const q = (searchEl?.value || '').trim().toLowerCase();
    const sem = semSelect?.value || 'ALL';

    const filteredClasses = allClasses.filter((cls) => {
      if (sem !== 'ALL' && cls.semester !== sem) return false;
      if (q) {
        return (
          (cls.className || '').toLowerCase().includes(q) ||
          (cls.joinCode || '').toLowerCase().includes(q) ||
          (cls.id || '').toLowerCase().includes(q)
        );
      }
      return true;
    });

    // Compute real KPIs from allClasses & attendanceSessions
    const totalClasses = allClasses.length;
    const totalSessionsCount = attendanceSessions.length;
    const avgRate = totalSessionsCount > 0
      ? Math.round((attendanceSessions.reduce((s, x) => s + Number(x.attendanceRate || 0), 0) / totalSessionsCount) * 10) / 10
      : 0;
    const absentRate = totalSessionsCount > 0 ? Math.max(0, Math.round((100 - avgRate) * 10) / 10) : 0;

    document.getElementById('histKpiClasses').textContent = totalClasses;
    document.getElementById('histKpiSessions').textContent = totalSessionsCount;
    document.getElementById('histKpiPresentRate').textContent = `${avgRate}%`;
    document.getElementById('histKpiPresentBar').style.width = `${Math.min(100, avgRate)}%`;
    document.getElementById('histKpiAbsentRate').textContent = `${absentRate}%`;

    if (!filteredClasses.length) {
      grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1;">Không có lớp học phù hợp bộ lọc.</div>';
      return;
    }

    const circ = 113.1; // 2 * pi * 18
    grid.innerHTML = filteredClasses
      .map((cls, idx) => {
        const clsSessions = attendanceSessions.filter((s) => String(s.classId).toUpperCase() === String(cls.id).toUpperCase());
        const sesCount = clsSessions.length;
        const clsAvg = sesCount > 0
          ? Math.round((clsSessions.reduce((s, x) => s + Number(x.attendanceRate || 0), 0) / sesCount) * 10) / 10
          : 0;
        const dashOffset = circ - (circ * Math.min(100, clsAvg)) / 100;

        // Build 12-slot mini bar chart (real sessions oldest -> newest on left)
        const recent = clsSessions.slice(0, 12).reverse();
        const barsHtml = Array.from({ length: 12 })
          .map((_, bIdx) => {
            const ses = recent[bIdx];
            if (!ses) {
              return '<div class="hist-bar-slot"><div class="hist-bar empty"></div></div>';
            }
            const hPct = Math.max(18, Math.min(100, Math.round(Number(ses.attendanceRate || 0))));
            return `<div class="hist-bar-slot"><div class="hist-bar" style="height:${hPct}%;animation-delay:${bIdx * 35}ms" title="${escapeHtml(ses.sessionDate)}: ${ses.attendanceRate}%"></div></div>`;
          })
          .join('');

        const isSel = selectedHistoryClassId === cls.id ? 'selected' : '';
        return `
          <article class="hist-class-card ${isSel}" data-hist-class="${escapeHtml(cls.id)}" style="animation-delay:${idx * 65}ms">
            <div class="hist-card-top">
              <div>
                <div class="hist-card-code">${escapeHtml(cls.joinCode)}</div>
                <h3 class="hist-card-name">${escapeHtml(cls.className)}</h3>
                <div class="hist-card-schedule">${escapeHtml(cls.scheduleText || 'Chưa xếp lịch')} · ${escapeHtml(cls.roomText || 'Phòng học')}</div>
              </div>
              <div class="hist-ring-wrap">
                <svg viewBox="0 0 44 44" class="hist-ring-svg">
                  <circle cx="22" cy="22" r="18" class="hist-ring-bg" />
                  <circle cx="22" cy="22" r="18" class="hist-ring-fg" stroke-dasharray="${circ}" stroke-dashoffset="${dashOffset}" />
                </svg>
                <div class="hist-ring-text">${sesCount > 0 ? `${clsAvg}%` : '0%'}</div>
              </div>
            </div>

            <div class="hist-card-stats">
              <span>👥 ${Number(cls.totalStudents || 0)} SV</span>
              <span>📅 ${sesCount} buổi</span>
            </div>

            <div class="hist-mini-bars">${barsHtml}</div>

            <div class="hist-card-footer">
              <span>XEM CÁC BUỔI</span>
              <span class="hist-card-arrow">→</span>
            </div>
          </article>
        `;
      })
      .join('');

    grid.querySelectorAll('[data-hist-class]').forEach((card) => {
      card.addEventListener('click', () => {
        const cid = card.getAttribute('data-hist-class');
        openHistorySessionsPage(cid);
      });
    });
  }

  let hsFilter = 'all';
  let hsSort = 'newest';
  let selectedSessionId = null;

  function formatDateVi(iso) {
    if (!iso) return '--';
    const parts = String(iso).split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return iso;
  }

  function openHistorySessionsPage(classId) {
    selectedHistoryClassId = classId;
    selectedSessionId = null;
    hsFilter = 'all';
    document.querySelectorAll('[data-hs-filter]').forEach((b) => b.classList.toggle('active', b.getAttribute('data-hs-filter') === 'all'));
    switchView('history-sessions');
    renderHistorySessions();
  }

  function renderHistorySessions() {
    const cls = allClasses.find((c) => c.id === selectedHistoryClassId);
    const grid = document.getElementById('historySessionsGrid');
    if (!grid || !selectedHistoryClassId) return;

    const code = cls ? cls.joinCode : selectedHistoryClassId;
    document.getElementById('hsBreadCode').textContent = code;
    document.getElementById('hsClassCode').textContent = code;
    document.getElementById('hsClassTitle').textContent = cls ? cls.className : selectedHistoryClassId;
    document.getElementById('hsClassMeta').innerHTML = `
      <span>📅 ${escapeHtml(cls?.scheduleText || 'Chưa xếp lịch')}</span>
      <span>·</span>
      <span>📍 ${escapeHtml(cls?.roomText || 'Phòng học')}</span>
      <span>·</span>
      <span>👥 ${Number(cls?.totalStudents || 0)} SINH VIÊN</span>
    `;
    document.getElementById('hsRatingSem').textContent = cls?.semester || '';

    const rawSessions = attendanceSessions
      .filter((s) => String(s.classId).toUpperCase() === String(selectedHistoryClassId).toUpperCase());
    const count = rawSessions.length;

    let avgPresent = 0;
    let avgLate = 0;
    let avgAbsent = 0;
    if (count > 0) {
      let sumTot = 0;
      let sumP = 0;
      let sumL = 0;
      let sumA = 0;
      rawSessions.forEach((s) => {
        const tot = Number(s.totalStudents || 0) || (Number(s.presentCount || 0) + Number(s.lateCount || 0) + Number(s.absentCount || 0));
        sumTot += tot;
        sumP += Number(s.presentCount || 0);
        sumL += Number(s.lateCount || 0);
        sumA += Number(s.absentCount || 0);
      });
      if (sumTot > 0) {
        avgPresent = Math.round((sumP / sumTot) * 1000) / 10;
        avgLate = Math.round((sumL / sumTot) * 1000) / 10;
        avgAbsent = Math.round((sumA / sumTot) * 1000) / 10;
      } else {
        avgPresent = Math.round((rawSessions.reduce((a, b) => a + Number(b.attendanceRate || 0), 0) / count) * 10) / 10;
        avgAbsent = Math.max(0, Math.round((100 - avgPresent) * 10) / 10);
      }
    }

    document.getElementById('hsKpiDone').textContent = count;
    document.getElementById('hsKpiPresent').textContent = `${avgPresent}%`;
    document.getElementById('hsKpiPresentBar').style.width = `${Math.min(100, avgPresent)}%`;
    document.getElementById('hsKpiLate').textContent = `${avgLate}%`;
    document.getElementById('hsKpiAbsent').textContent = `${avgAbsent}%`;

    const circ = 113.1;
    document.getElementById('hsRatingRing').style.strokeDashoffset = circ - (circ * Math.min(100, avgPresent)) / 100;
    document.getElementById('hsRatingPct').textContent = `${avgPresent}%`;
    document.getElementById('hsRatingLabel').textContent =
      count === 0 ? 'Chưa có buổi' : avgPresent >= 85 ? 'Rất tốt' : avgPresent >= 65 ? 'Khá ổn định' : 'Cần cải thiện';

    document.getElementById('hsTabAll').textContent = `TẤT CẢ · ${count}`;

    // Assign sequential session number (oldest = Buổi 01)
    const chronological = [...rawSessions].reverse().map((s, i) => ({
      ...s,
      seqNum: i + 1,
      isLatest: i === rawSessions.length - 1,
    }));

    let list = chronological.filter((s) => {
      if (hsFilter === 'high') return Number(s.attendanceRate || 0) >= 80;
      return true;
    });

    if (hsSort === 'newest') list.sort((a, b) => b.seqNum - a.seqNum);
    else if (hsSort === 'oldest') list.sort((a, b) => a.seqNum - b.seqNum);
    else if (hsSort === 'rate_desc') list.sort((a, b) => Number(b.attendanceRate || 0) - Number(a.attendanceRate || 0));
    else if (hsSort === 'rate_asc') list.sort((a, b) => Number(a.attendanceRate || 0) - Number(b.attendanceRate || 0));

    if (!list.length) {
      grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1;">Lớp này chưa có buổi điểm danh nào được lưu vào PostgreSQL. Hãy bấm "Mở điểm danh" và lưu buổi học đầu tiên!</div>';
      return;
    }

    grid.innerHTML = list
      .map((s, idx) => {
        const tot = Math.max(1, Number(s.totalStudents || 0) || (Number(s.presentCount || 0) + Number(s.lateCount || 0) + Number(s.absentCount || 0)));
        const pCnt = Number(s.presentCount || 0);
        const lCnt = Number(s.lateCount || 0);
        const aCnt = Number(s.absentCount || 0);
        const pPct = (pCnt / tot) * 100;
        const lPct = (lCnt / tot) * 100;
        const aPct = (aCnt / tot) * 100;
        const rate = Math.round(Number(s.attendanceRate || 0) * 10) / 10;
        const numStr = String(s.seqNum).padStart(2, '0');
        const isSel = selectedSessionId === s.id ? 'selected' : '';
        const latestTag = s.isLatest ? '<span class="hs-latest-badge">MỚI NHẤT</span>' : '';

        return `
          <article class="hs-session-card ${isSel}" data-hs-session="${escapeHtml(s.id)}" data-hs-seq="${s.seqNum}" style="animation-delay:${idx * 55}ms">
            <div class="hs-card-head">
              <div class="hs-session-num">
                <span>BUỔI ${numStr}</span>
                ${latestTag}
              </div>
              <div class="hs-session-time">${escapeHtml(formatDateVi(s.sessionDate))} · ${escapeHtml(s.startedAt || '')} - ${escapeHtml(s.endedAt || '')}</div>
            </div>

            <h3 class="hs-session-title">Buổi điểm danh #${numStr}</h3>

            <div class="hs-session-counts">
              <span class="hs-cnt-present">${pCnt} CÓ MẶT</span>
              <span class="hs-cnt-late">${lCnt} TRỄ</span>
              <span class="hs-cnt-absent">${aCnt} VẮNG</span>
            </div>

            <div class="hs-bar-row">
              <div class="hs-multi-bar">
                <div class="hs-seg-present" style="width:${pPct}%"></div>
                <div class="hs-seg-late" style="width:${lPct}%"></div>
                <div class="hs-seg-absent" style="width:${aPct}%"></div>
              </div>
              <span class="hs-bar-pct">${rate}%</span>
            </div>

            <div class="hs-card-cta">
              <span>XEM BẢNG ĐIỂM DANH</span>
              <span class="hist-card-arrow">→</span>
            </div>
          </article>
        `;
      })
      .join('');

    grid.querySelectorAll('[data-hs-session]').forEach((card) => {
      card.addEventListener('click', () => {
        const sid = card.getAttribute('data-hs-session');
        const seqNum = Number(card.getAttribute('data-hs-seq') || 1);
        selectedSessionId = sid;
        grid.querySelectorAll('.hs-session-card').forEach((c) => c.classList.remove('selected'));
        card.classList.add('selected');
        openHistoryDetailPage(sid, seqNum);
      });
    });
  }

  document.getElementById('btnBackToHistoryClasses')?.addEventListener('click', () => switchView('history'));
  document.getElementById('btnStep1Back')?.addEventListener('click', () => switchView('history'));
  document.querySelectorAll('[data-hs-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-hs-filter]').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      hsFilter = btn.getAttribute('data-hs-filter') || 'all';
      renderHistorySessions();
    });
  });
  document.getElementById('hsSortSelect')?.addEventListener('change', (e) => {
    hsSort = e.target.value || 'newest';
    renderHistorySessions();
  });

  // ── Lịch sử điểm danh — Bước 3: Bảng điểm danh chi tiết ──
  const hdState = {
    sessionId: null,
    seqNum: 1,
    detail: null,
    filter: 'all',
    search: '',
    sort: 'stt',
    page: 1,
    pageSize: 12,
  };

  function getHdInitials(name) {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return 'SV';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function parseConfidencePct(raw) {
    if (raw === null || raw === undefined || raw === '') return null;
    const str = String(raw).replace('%', '').trim();
    const num = parseFloat(str);
    if (Number.isNaN(num)) return null;
    return num <= 1 ? Math.round(num * 1000) / 10 : Math.round(num * 10) / 10;
  }

  function openHistoryDetailPage(sessionId, seqNum) {
    hdState.sessionId = sessionId;
    hdState.seqNum = seqNum || 1;
    hdState.detail = null;
    hdState.filter = 'all';
    hdState.search = '';
    hdState.sort = 'stt';
    hdState.page = 1;

    const searchInput = document.getElementById('hdSearchInput');
    if (searchInput) searchInput.value = '';
    const sortSel = document.getElementById('hdSortSelect');
    if (sortSel) sortSel.value = 'stt';
    document.querySelectorAll('[data-hd-filter]').forEach((b) => {
      b.classList.toggle('active', b.getAttribute('data-hd-filter') === 'all');
    });

    const cls = (allClasses || []).find((c) => c.id === selectedHistoryClassId);
    const sessSummary = (attendanceSessions || []).find((s) => s.id === sessionId);
    const seqStr = String(hdState.seqNum).padStart(2, '0');
    const classCode = cls?.id || sessSummary?.classId || '—';
    const className = cls?.name || sessSummary?.className || '';
    const dateTxt = sessSummary ? formatDateVi(sessSummary.sessionDate) : '—';
    const timeTxt = sessSummary ? `${sessSummary.startedAt || '—'} - ${sessSummary.endedAt || '—'}` : '—';
    const roomTxt = cls?.room || '—';
    const totTxt = sessSummary?.totalStudents ?? '—';

    const setTxt = (id, v) => {
      const el = document.getElementById(id);
      if (el) el.textContent = v;
    };
    setTxt('hdBreadCode', classCode);
    setTxt('hdBreadSession', `Buổi ${seqStr}`);
    setTxt('hdClassCode', classCode);
    setTxt('hdClassNameSub', className);
    setTxt('hdTitle', `Buổi ${seqStr} · ${className || classCode}`);
    setTxt('hdMeta', `${dateTxt} · ${timeTxt} · ${roomTxt} · ${totTxt} sinh viên`);

    const tbody = document.getElementById('hdTableBody');
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="8" class="hd-empty-cell">Đang tải dữ liệu điểm danh từ PostgreSQL...</td></tr>';
    }
    setTxt('hdPageInfo', 'Đang tải...');
    const pgBtns = document.getElementById('hdPageBtns');
    if (pgBtns) pgBtns.innerHTML = '';

    switchView('history-detail');
    postMsg({ action: 'history_session_detail', sessionId });
  }

  window.onHistorySessionDetail = function (res) {
    if (!res || !res.ok || !res.data) {
      showToast('Không thể tải chi tiết buổi điểm danh từ máy chủ.', 'error');
      const tbody = document.getElementById('hdTableBody');
      if (tbody) {
        tbody.innerHTML = '<tr><td colspan="8" class="hd-empty-cell">Không thể tải dữ liệu buổi điểm danh.</td></tr>';
      }
      return;
    }

    const d = res.data;
    hdState.detail = d;

    const seqStr = String(hdState.seqNum).padStart(2, '0');
    const cls = (allClasses || []).find((c) => c.id === (d.classId || selectedHistoryClassId));
    const roomTxt = cls?.room || '—';
    const setTxt = (id, v) => {
      const el = document.getElementById(id);
      if (el) el.textContent = v;
    };

    setTxt('hdBreadCode', d.classId || '—');
    setTxt('hdBreadSession', `Buổi ${seqStr}`);
    setTxt('hdClassCode', d.classId || '—');
    setTxt('hdClassNameSub', d.className || '');
    setTxt('hdTitle', `Buổi ${seqStr} · ${d.className || d.classId}`);
    setTxt(
      'hdMeta',
      `${formatDateVi(d.sessionDate)} · ${d.startedAt || '—'} - ${d.endedAt || '—'} · ${roomTxt} · ${d.totalStudents || 0} sinh viên`
    );

    const details = Array.isArray(d.details) ? d.details : [];
    const total = Number(d.totalStudents || details.length || 0);
    const present = Number(d.presentCount ?? details.filter((x) => x.status === 'present').length);
    const late = Number(d.lateCount ?? details.filter((x) => x.status === 'late').length);
    const absent = Number(d.absentCount ?? details.filter((x) => x.status === 'absent').length);
    const rate = total > 0 ? Math.round(((present + late) / total) * 1000) / 10 : Number(d.attendanceRate || 0);

    setTxt('hdKpiTotal', String(total));
    setTxt('hdKpiPresent', String(present));
    setTxt('hdKpiLate', String(late));
    setTxt('hdKpiAbsent', String(absent));
    setTxt('hdKpiRate', `${rate}%`);

    const presentPct = total > 0 ? Math.min(100, Math.round((present / total) * 1000) / 10) : 0;
    const presentBar = document.getElementById('hdKpiPresentBar');
    if (presentBar) presentBar.style.width = `${presentPct}%`;

    const ring = document.getElementById('hdRateRing');
    if (ring) {
      const circumference = 113.1;
      ring.style.strokeDashoffset = String(circumference * (1 - Math.min(100, Math.max(0, rate)) / 100));
    }

    setTxt('hdTabAll', `TẤT CẢ · ${details.length}`);
    setTxt('hdTabPresent', `CÓ MẶT · ${present}`);
    setTxt('hdTabLate', `ĐI TRỄ · ${late}`);
    setTxt('hdTabAbsent', `VẮNG · ${absent}`);

    hdState.page = 1;
    renderHistoryDetailTable();
  };

  function getFilteredSortedDetailRows() {
    const details = Array.isArray(hdState.detail?.details) ? [...hdState.detail.details] : [];
    const q = hdState.search.trim().toLowerCase();

    const filtered = details.filter((item) => {
      if (hdState.filter !== 'all' && item.status !== hdState.filter) return false;
      if (q) {
        const nameMatch = String(item.fullName || '').toLowerCase().includes(q);
        const idMatch = String(item.studentId || '').toLowerCase().includes(q);
        if (!nameMatch && !idMatch) return false;
      }
      return true;
    });

    if (hdState.sort === 'name') {
      filtered.sort((a, b) => String(a.fullName || '').localeCompare(String(b.fullName || ''), 'vi'));
    } else if (hdState.sort === 'time') {
      filtered.sort((a, b) => {
        const ta = a.time || '99:99:99';
        const tb = b.time || '99:99:99';
        return ta.localeCompare(tb);
      });
    } else {
      filtered.sort((a, b) => Number(a.stt || 0) - Number(b.stt || 0));
    }
    return filtered;
  }

  function renderHistoryDetailTable() {
    const tbody = document.getElementById('hdTableBody');
    const pageInfo = document.getElementById('hdPageInfo');
    const pageBtns = document.getElementById('hdPageBtns');
    if (!tbody) return;

    const rows = getFilteredSortedDetailRows();
    const totalRows = rows.length;
    const totalPages = Math.max(1, Math.ceil(totalRows / hdState.pageSize));
    if (hdState.page > totalPages) hdState.page = totalPages;
    if (hdState.page < 1) hdState.page = 1;

    if (!totalRows) {
      tbody.innerHTML = '<tr><td colspan="8" class="hd-empty-cell">Không tìm thấy sinh viên phù hợp.</td></tr>';
      if (pageInfo) pageInfo.textContent = 'HIỂN THỊ 0 / 0';
      if (pageBtns) pageBtns.innerHTML = '';
      return;
    }

    const startIdx = (hdState.page - 1) * hdState.pageSize;
    const pageRows = rows.slice(startIdx, startIdx + hdState.pageSize);
    const endIdx = startIdx + pageRows.length;

    tbody.innerHTML = pageRows
      .map((item, idx) => {
        const sttStr = String(item.stt || startIdx + idx + 1).padStart(2, '0');
        const avatarHtml = item.avatar
          ? `<img class="hd-avatar" src="${escapeHtml(item.avatar)}" alt="" />`
          : `<div class="hd-avatar-fallback">${escapeHtml(getHdInitials(item.fullName))}</div>`;

        const timeDisplay = item.time ? escapeHtml(item.time) : '—';
        const timeCls = item.status === 'late' ? 'hd-time late' : 'hd-time';

        const isManual = String(item.device || '').toLowerCase().includes('thủ công');
        const methodText = item.status === 'absent' ? 'Chưa điểm danh' : item.device || 'Nhận diện khuôn mặt';
        const methodDotCls = item.status === 'absent' ? 'absent' : isManual ? 'manual' : 'ai';

        const confPct = parseConfidencePct(item.confidence);
        const confHtml =
          confPct !== null
            ? `<div class="hd-conf-wrap">
                 <span class="hd-conf-val">${confPct.toFixed(1)}%</span>
                 <div class="hd-conf-bar"><div class="hd-conf-fill" style="width:${Math.min(100, confPct)}%"></div></div>
               </div>`
            : `<div class="hd-conf-wrap"><span class="hd-conf-val muted">—</span><div class="hd-conf-bar"></div></div>`;

        const statusMap = {
          present: { cls: 'present', label: 'CÓ MẶT' },
          late: { cls: 'late', label: 'ĐI TRỄ' },
          absent: { cls: 'absent', label: 'VẮNG' },
        };
        const stMeta = statusMap[item.status] || statusMap.absent;

        return `
          <tr class="hd-row" style="animation-delay:${idx * 28}ms">
            <td class="hd-stt">${sttStr}</td>
            <td>
              <div class="hd-student-cell">
                ${avatarHtml}
                <span class="hd-student-name">${escapeHtml(item.fullName || item.studentId)}</span>
              </div>
            </td>
            <td class="hd-mssv">${escapeHtml(item.studentId || '—')}</td>
            <td class="${timeCls}">${timeDisplay}</td>
            <td>
              <div class="hd-method">
                <span class="hd-method-dot ${methodDotCls}"></span>
                <span>${escapeHtml(methodText)}</span>
              </div>
            </td>
            <td>${confHtml}</td>
            <td><span class="hd-status-badge ${stMeta.cls}">${stMeta.label}</span></td>
            <td class="hd-more">···</td>
          </tr>
        `;
      })
      .join('');

    if (pageInfo) {
      pageInfo.textContent = `HIỂN THỊ ${startIdx + 1}-${endIdx} / ${totalRows}`;
    }

    if (pageBtns) {
      const btns = [];
      btns.push(`<button type="button" class="hd-page-btn" data-hd-page="${hdState.page - 1}" ${hdState.page <= 1 ? 'disabled' : ''}>‹</button>`);
      for (let p = 1; p <= totalPages; p++) {
        btns.push(`<button type="button" class="hd-page-btn ${p === hdState.page ? 'active' : ''}" data-hd-page="${p}">${p}</button>`);
      }
      btns.push(`<button type="button" class="hd-page-btn" data-hd-page="${hdState.page + 1}" ${hdState.page >= totalPages ? 'disabled' : ''}>›</button>`);
      pageBtns.innerHTML = btns.join('');
      pageBtns.querySelectorAll('[data-hd-page]').forEach((b) => {
        b.addEventListener('click', () => {
          const target = Number(b.getAttribute('data-hd-page'));
          if (!b.disabled && target >= 1 && target <= totalPages && target !== hdState.page) {
            hdState.page = target;
            renderHistoryDetailTable();
          }
        });
      });
    }
  }

  document.getElementById('btnBackToHistorySessions')?.addEventListener('click', () => switchView('history-sessions'));
  document.getElementById('btnHdStep1')?.addEventListener('click', () => switchView('history'));
  document.getElementById('btnHdStep2')?.addEventListener('click', () => switchView('history-sessions'));

  document.querySelectorAll('[data-hd-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-hd-filter]').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      hdState.filter = btn.getAttribute('data-hd-filter') || 'all';
      hdState.page = 1;
      renderHistoryDetailTable();
    });
  });

  document.getElementById('hdSearchInput')?.addEventListener('input', (e) => {
    hdState.search = e.target.value || '';
    hdState.page = 1;
    renderHistoryDetailTable();
  });

  document.getElementById('hdSortSelect')?.addEventListener('change', (e) => {
    hdState.sort = e.target.value || 'stt';
    hdState.page = 1;
    renderHistoryDetailTable();
  });

  document.getElementById('btnHdPrint')?.addEventListener('click', () => {
    window.print();
  });

  document.getElementById('btnHdExportCsv')?.addEventListener('click', () => {
    if (!hdState.detail || !Array.isArray(hdState.detail.details)) {
      showToast('Chưa có dữ liệu điểm danh để xuất.', 'error');
      return;
    }
    const headers = ['STT', 'MSSV', 'Họ và tên', 'Giờ vào', 'Phương thức', 'Độ tin cậy', 'Trạng thái'];
    const stLabel = { present: 'Có mặt', late: 'Đi trễ', absent: 'Vắng' };
    const escCsv = (val) => `"${String(val ?? '').replace(/"/g, '""')}"`;
    const lines = [headers.map(escCsv).join(',')];
    hdState.detail.details.forEach((item, idx) => {
      const conf = parseConfidencePct(item.confidence);
      lines.push(
        [
          item.stt || idx + 1,
          item.studentId || '',
          item.fullName || '',
          item.time || '',
          item.device || '',
          conf !== null ? `${conf.toFixed(1)}%` : '',
          stLabel[item.status] || item.status || '',
        ]
          .map(escCsv)
          .join(',')
      );
    });
    const csvContent = '\uFEFF' + lines.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `diem_danh_${hdState.detail.classId || 'lop'}_buoi_${String(hdState.seqNum).padStart(2, '0')}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast('Đã xuất file Excel (CSV) bảng điểm danh!');
  });

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
    attendanceSessions = Array.isArray(res?.sessions) ? res.sessions : [];
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

  function drawFacialWireframe(ctx, landmarks) {
    if (!landmarks) return;
    const pts = landmarks.positions;
    if (!pts || pts.length < 68) return;

    ctx.save();
    ctx.strokeStyle = 'rgba(34, 211, 238, 0.55)';
    ctx.lineWidth = 1.1;

    const connectRange = (start, end, close = false) => {
      ctx.beginPath();
      for (let i = start; i <= end; i++) {
        if (i === start) ctx.moveTo(pts[i].x, pts[i].y);
        else ctx.lineTo(pts[i].x, pts[i].y);
      }
      if (close) ctx.closePath();
      ctx.stroke();
    };

    connectRange(0, 16);        // Jawline
    connectRange(17, 21);       // Left eyebrow
    connectRange(22, 26);       // Right eyebrow
    connectRange(27, 30);       // Nose bridge
    connectRange(31, 35, true); // Nose base
    connectRange(36, 41, true); // Left eye
    connectRange(42, 47, true); // Right eye
    connectRange(48, 59, true); // Outer lips
    connectRange(60, 67, true); // Inner lips

    // Mesh lines from eyes/nose to jaw for Face-Login cyber look
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
    ctx.beginPath();
    [[36, 0], [39, 27], [42, 27], [45, 16], [30, 48], [30, 54], [48, 8], [54, 8]].forEach(([a, b]) => {
      ctx.moveTo(pts[a].x, pts[a].y);
      ctx.lineTo(pts[b].x, pts[b].y);
    });
    ctx.stroke();

    // Glowing landmark dots
    ctx.fillStyle = '#67e8f9';
    for (let i = 0; i < pts.length; i++) {
      ctx.beginPath();
      ctx.arc(pts[i].x, pts[i].y, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function updateBiometricHud(hasFace, bestConf, matchedName) {
    const s1 = document.getElementById('attStep1');
    const s2 = document.getElementById('attStep2');
    const s3 = document.getElementById('attStep3');
    const s4 = document.getElementById('attStep4');
    const confVal = document.getElementById('attHudConfVal');
    const confFill = document.getElementById('attHudConfFill');
    const confSub = document.getElementById('attHudConfSub');
    const callout = document.getElementById('attOvalCalloutText');

    if (hasFace) {
      s1?.classList.add('done');
      document.getElementById('attStep1Sub').textContent = 'HOÀN TẤT · 68 ĐIỂM';
      s2?.classList.add('done');
      document.getElementById('attStep2Sub').textContent = 'HOÀN TẤT · NGƯỜI THẬT';
      s3?.classList.add('active');
      callout.textContent = matchedName ? `ĐÃ KHỚP · ${matchedName.toUpperCase()}` : 'ĐANG QUÉT · 68 ĐIỂM';

      if (bestConf > 0) {
        const pct = Math.round(bestConf);
        confVal.textContent = `${pct}%`;
        confFill.style.width = `${pct}%`;
        confSub.textContent = pct >= 85 ? 'TIN CẬY: RẤT CAO' : 'ĐANG ĐỐI CHIẾU...';
        s4?.classList.toggle('done', Boolean(matchedName));
        document.getElementById('attStep4Sub').textContent = matchedName ? `ĐÃ ĐIỂM DANH · ${matchedName}` : 'ĐANG CHỜ KHỚP';
      } else {
        confVal.textContent = '--%';
        confFill.style.width = '30%';
        confSub.textContent = 'CHƯA KHỚP HỒ SƠ';
      }
    } else {
      s1?.classList.remove('done');
      document.getElementById('attStep1Sub').textContent = 'ĐANG CHỜ KHUÔN MẶT';
      s2?.classList.remove('done');
      document.getElementById('attStep2Sub').textContent = 'ĐANG CHỜ';
      s4?.classList.remove('done');
      document.getElementById('attStep4Sub').textContent = 'SẴN SÀNG';
      confVal.textContent = '--%';
      confFill.style.width = '0%';
      confSub.textContent = 'ĐANG CHỜ KHUÔN MẶT';
      callout.textContent = 'ĐANG QUÉT · 68 ĐIỂM';
    }
  }

  const attPrepCanvas = document.createElement('canvas');
  const attPrepCtx = attPrepCanvas.getContext('2d', { willReadFrequently: true });

  function prepareAttendanceFrame(video) {
    const vw = video.videoWidth || 640;
    const vh = video.videoHeight || 480;
    const tw = Math.min(640, vw);
    const th = Math.round((vh / vw) * tw);
    if (attPrepCanvas.width !== tw || attPrepCanvas.height !== th) {
      attPrepCanvas.width = tw;
      attPrepCanvas.height = th;
    }
    attPrepCtx.filter = 'none';
    attPrepCtx.drawImage(video, 0, 0, tw, th);

    const roiW = Math.floor(tw * 0.45);
    const roiH = Math.floor(th * 0.55);
    const roiX = Math.floor((tw - roiW) / 2);
    const roiY = Math.floor((th - roiH) / 2);
    const data = attPrepCtx.getImageData(roiX, roiY, roiW, roiH).data;
    let lumaSum = 0;
    let count = 0;
    for (let i = 0; i < data.length; i += 16) {
      lumaSum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      count++;
    }
    const avgLuma = lumaSum / Math.max(1, count);
    if (avgLuma < 120) {
      const boost = Math.min(2.2, Math.max(1.25, 135 / Math.max(35, avgLuma)));
      attPrepCtx.filter = `brightness(${boost.toFixed(2)}) contrast(1.28)`;
      attPrepCtx.drawImage(video, 0, 0, tw, th);
      attPrepCtx.filter = 'none';
    }
    return { tw, th };
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
      const { tw, th } = prepareAttendanceFrame(video);
      if (canvas.width !== tw || canvas.height !== th) {
        canvas.width = tw;
        canvas.height = th;
      }
      const detections = await faceapi
        .detectAllFaces(attPrepCanvas, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.2 }))
        .withFaceLandmarks()
        .withFaceDescriptors();

      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      let bestConf = 0;
      let bestName = null;

      for (const det of detections) {
        drawFacialWireframe(ctx, det.landmarks);
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
          if (conf > bestConf) {
            bestConf = conf;
            bestName = meta?.fullName || sid;
          }
          drawHudFaceBox(ctx, box, 'matched', meta?.fullName || sid, `${sid} · ${confStr}%`);

          if (attState.mode === 'auto') {
            const st = attState.statusMap.get(sid.toUpperCase());
            if ((!st || st.status === 'absent') && !attState.inFlightIds.has(sid.toUpperCase())) {
              triggerRecordAttendance(sid, meta?.fullName || sid, Number(confStr), 'Lecturer Desktop AI');
            }
          }
        }
      }

      updateBiometricHud(detections.length > 0, bestConf, bestName);
      const elapsed = Math.round(performance.now() - t0);
      document.getElementById('attLatencyVal').textContent = `${elapsed} ms`;
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
    document.getElementById('attKpiPresent').textContent = checked;
    document.getElementById('attKpiAbsent').textContent = absent;

    document.getElementById('attScanProgressLabel').textContent = `${pct}%`;
    document.getElementById('attScanProgressFill').style.width = `${pct}%`;
    document.getElementById('attPipelinePct').textContent = `${pct}%`;
    document.getElementById('attPipelineBar').style.width = `${pct}%`;

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
              <span class="att-status-pill ${rec.status}">${badgeLabel}</span>
            </div>
          </div>
        `;
      })
      .join('');
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
    attState.startedAt = new Date().toTimeString().slice(0, 8);
    startAttCamera();
  }

  function playChimeTone() {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.24);
    } catch {
      // Ignore audio context errors
    }
  }

  function speakVietnamese(text) {
    playChimeTone();
    postMsg({ action: 'speak_vi', text });
  }

  window.onSpeakVi = function (res) {
    if (res?.base64) {
      try {
        const audio = new Audio(`data:audio/mpeg;base64,${res.base64}`);
        audio.play().catch(() => {});
        return;
      } catch {
        // Fallback to speechSynthesis
      }
    }
    if ('speechSynthesis' in window && res?.text) {
      const utter = new SpeechSynthesisUtterance(res.text);
      utter.lang = 'vi-VN';
      utter.rate = 1.05;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utter);
    }
  };

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
      attState.faceMatcher = labeled.length ? new faceapi.FaceMatcher(labeled, 0.58) : null;
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
      const name = rec?.studentName || key;
      showCamMatchPopup(name, rec?.studentId || key, timePart);
      speakVietnamese(`Đã điểm danh sinh viên ${name}`);
    }
    postMsg({ action: 'dashboard_load_data' });
  };

  window.onAttendanceSessionSaved = function (res) {
    const btn = document.getElementById('btnAttFinish');
    if (btn) {
      btn.disabled = false;
      btn.textContent = '⏹ Kết thúc Điểm danh';
    }
    stopAttCamera();
    if (attState.clockTimer) clearInterval(attState.clockTimer);

    if (res?.ok && res?.data?.success) {
      showToast('Đã lưu kết quả buổi điểm danh vào cơ sở dữ liệu PostgreSQL!');
      speakVietnamese('Đã kết thúc và lưu buổi điểm danh');
    } else {
      const detail = res?.data?.detail ? ` (${res.data.detail})` : '';
      showToast(`Không thể lưu phiên điểm danh${detail}.`, 'error');
    }
    postMsg({ action: 'dashboard_load_data' });
    switchView('classes');
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
    const btn = document.getElementById('btnAttFinish');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Đang lưu kết quả buổi học...';
    }
    let presentCount = 0;
    let lateCount = 0;
    const details = attState.students.map((st) => {
      const rec = attState.statusMap.get(st.id.toUpperCase()) || { status: 'absent', time: '' };
      if (rec.status === 'present') presentCount++;
      else if (rec.status === 'late') lateCount++;
      return {
        studentId: st.id,
        fullName: st.fullName,
        status: rec.status,
        time: rec.time || '',
      };
    });
    const totalStudents = attState.students.length;
    const absentCount = Math.max(0, totalStudents - presentCount - lateCount);
    const attendanceRate = totalStudents > 0 ? Math.round(((presentCount + lateCount) / totalStudents) * 1000) / 10 : 0;

    postMsg({
      action: 'attendance_save_session',
      classId: attState.classId || '',
      className: attState.classObj?.className || '',
      lecturerId: lecturerId || '',
      startedAt: attState.startedAt || new Date().toTimeString().slice(0, 8),
      endedAt: new Date().toTimeString().slice(0, 8),
      totalStudents,
      presentCount,
      lateCount,
      absentCount,
      attendanceRate,
      details,
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
  document.getElementById('historySearchInput')?.addEventListener('input', renderHistory);
  document.getElementById('historySemesterFilter')?.addEventListener('change', renderHistory);

  renderLoadingSkeleton();
  postMsg({ action: 'dashboard_load_data' });
})();

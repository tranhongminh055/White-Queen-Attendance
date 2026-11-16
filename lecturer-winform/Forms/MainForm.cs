using System.Drawing;
using System.IO.Compression;
using System.Text.Json;
using System.Xml.Linq;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;
using WhiteQueenLecturer.Services;

namespace WhiteQueenLecturer.Forms;

public sealed class MainForm : Form
{
    private readonly WebView2 _webView;
    private readonly ApiClient _apiClient = new();
    private LecturerAccount? _currentLecturer;

    public MainForm()
    {
        Text = "SPACE X · White Queen Lecturer Desktop (.NET 10)";
        FormBorderStyle = FormBorderStyle.None;
        WindowState = FormWindowState.Maximized;
        Width = 1360;
        Height = 840;
        MinimumSize = new Size(1100, 700);
        StartPosition = FormStartPosition.CenterScreen;
        BackColor = Color.Black;

        _webView = new WebView2
        {
            Dock = DockStyle.Fill,
            DefaultBackgroundColor = Color.Black
        };
        Controls.Add(_webView);

        Load += async (_, _) =>
        {
            _ = _apiClient.WarmUpAsync();
            await InitializeWebViewAsync();
        };
    }

    private async Task InitializeWebViewAsync()
    {
        try
        {
            var userDataFolder = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "WhiteQueenLecturer",
                "WebView2"
            );
            var env = await CoreWebView2Environment.CreateAsync(null, userDataFolder);
            await _webView.EnsureCoreWebView2Async(env);

            var assetsPath = Path.Combine(AppContext.BaseDirectory, "Assets");
            _webView.CoreWebView2.SetVirtualHostNameToFolderMapping(
                "app.whitequeen.local",
                assetsPath,
                CoreWebView2HostResourceAccessKind.Allow
            );

            _webView.CoreWebView2.Settings.AreDefaultContextMenusEnabled = false;
            _webView.CoreWebView2.Settings.IsStatusBarEnabled = false;
            _webView.CoreWebView2.PermissionRequested += (_, e) =>
            {
                if (e.PermissionKind == CoreWebView2PermissionKind.Camera)
                {
                    e.State = CoreWebView2PermissionState.Allow;
                }
            };
            _webView.CoreWebView2.WebMessageReceived += OnWebMessageReceived;

            NavigateTo("landing/index.html");
        }
        catch (Exception ex)
        {
            MessageBox.Show(
                $"Không thể khởi tạo WebView2:\n{ex.Message}\n\nVui lòng kiểm tra Microsoft Edge WebView2 Runtime.",
                "White Queen Lecturer",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error
            );
        }
    }

    private void NavigateTo(string relativePath)
    {
        _webView.Source = new Uri($"https://app.whitequeen.local/{relativePath}");
    }

    private async void OnWebMessageReceived(object? sender, CoreWebView2WebMessageReceivedEventArgs args)
    {
        try
        {
            using var doc = JsonDocument.Parse(args.WebMessageAsJson);
            if (!doc.RootElement.TryGetProperty("action", out var actionEl))
            {
                return;
            }

            var action = actionEl.GetString();
            switch (action)
            {
                case "open_landing":
                    NavigateTo("landing/index.html");
                    break;

                case "open_login":
                case "start_attendance":
                    NavigateTo("login/index.html");
                    break;

                case "open_face_login":
                    NavigateTo("face-login/index.html");
                    break;

                case "face_login_submit":
                    var desc = Array.Empty<double>();
                    if (doc.RootElement.TryGetProperty("descriptor", out var descEl) && descEl.ValueKind == JsonValueKind.Array)
                    {
                        desc = descEl.EnumerateArray().Select(x => x.GetDouble()).ToArray();
                    }

                    var faceResult = await _apiClient.FaceLoginLecturerAsync(desc, 0.62);
                    if (faceResult.Matched && faceResult.Account is not null)
                    {
                        _currentLecturer = faceResult.Account;
                    }

                    var faceJson = JsonSerializer.Serialize(new
                    {
                        matched = faceResult.Matched,
                        hasEnrolled = faceResult.HasEnrolled,
                        distance = faceResult.Distance,
                        confidence = faceResult.Confidence,
                        message = faceResult.Message,
                        account = faceResult.Account
                    });
                    await _webView.CoreWebView2.ExecuteScriptAsync($"window.onFaceLoginResult && window.onFaceLoginResult({faceJson})");
                    break;

                case "open_dashboard":
                    var nameParam = Uri.EscapeDataString(_currentLecturer?.FullName ?? "Giảng viên");
                    var idParam = Uri.EscapeDataString(_currentLecturer?.EmployeeId ?? string.Empty);
                    NavigateTo($"dashboard/index.html?name={nameParam}&id={idParam}");
                    break;

                case "login_submit":
                    var identifier = doc.RootElement.TryGetProperty("identifier", out var idEl)
                        ? idEl.GetString() ?? string.Empty
                        : string.Empty;
                    var password = doc.RootElement.TryGetProperty("password", out var pwEl)
                        ? pwEl.GetString() ?? string.Empty
                        : string.Empty;

                    var result = await _apiClient.LoginLecturerAsync(identifier, password);
                    if (result.Success && result.Account is not null)
                    {
                        _currentLecturer = result.Account;
                    }

                    var resultJson = JsonSerializer.Serialize(new
                    {
                        success = result.Success,
                        message = result.Message,
                        fullName = result.Account?.FullName,
                        employeeId = result.Account?.EmployeeId
                    });
                    await _webView.CoreWebView2.ExecuteScriptAsync($"window.onLoginResult && window.onLoginResult({resultJson})");
                    break;

                case "dashboard_load_data":
                    {
                        var lecturerId = _currentLecturer?.EmployeeId ?? string.Empty;
                        if (string.IsNullOrWhiteSpace(lecturerId))
                        {
                            await _webView.CoreWebView2.ExecuteScriptAsync("window.onDashboardData && window.onDashboardData({ok:false,classes:[],todaySessions:0,logs:[]})");
                            break;
                        }

                        var classesTask = _apiClient.GetLecturerClassesRawAsync(lecturerId);
                        var attTask = _apiClient.GetLecturerAttendanceRawAsync(lecturerId);
                        var sessionsTask = _apiClient.GetLecturerAttendanceSessionsRawAsync(lecturerId);
                        await Task.WhenAll(classesTask, attTask, sessionsTask);

                        var (clsOk, clsJson) = classesTask.Result;
                        var (_, attJson) = attTask.Result;
                        var (_, sesJson) = sessionsTask.Result;
                        var payload = $"{{\"ok\":{(clsOk ? "true" : "false")},\"classes\":{(clsOk ? clsJson : "[]")},\"attendance\":{attJson},\"sessions\":{sesJson}}}";
                        await _webView.CoreWebView2.ExecuteScriptAsync($"window.onDashboardData && window.onDashboardData({payload})");
                        break;
                    }

                case "class_create":
                    {
                        var lecturerId = _currentLecturer?.EmployeeId ?? string.Empty;
                        string Str(string key) => doc.RootElement.TryGetProperty(key, out var p) ? p.GetString() ?? string.Empty : string.Empty;
                        var studentIds = doc.RootElement.TryGetProperty("studentIds", out var sEl) && sEl.ValueKind == JsonValueKind.Array
                            ? sEl.EnumerateArray().Select(x => x.GetString() ?? string.Empty).Where(x => !string.IsNullOrWhiteSpace(x)).ToArray()
                            : Array.Empty<string>();
                        var expectedTotal = doc.RootElement.TryGetProperty("expectedTotal", out var expEl) && expEl.TryGetInt32(out var expVal)
                            ? expVal
                            : studentIds.Length;
                        var (ok, respJson) = await _apiClient.CreateClassRawAsync(
                            lecturerId,
                            Str("className"),
                            Str("joinCode"),
                            Str("semester"),
                            Str("scheduleText"),
                            Str("roomText"),
                            studentIds,
                            expectedTotal
                        );
                        var payload = $"{{\"ok\":{(ok ? "true" : "false")},\"data\":{respJson}}}";
                        await _webView.CoreWebView2.ExecuteScriptAsync($"window.onClassCreated && window.onClassCreated({payload})");
                        break;
                    }

                case "students_lookup":
                    {
                        var studentIds = doc.RootElement.TryGetProperty("studentIds", out var sEl) && sEl.ValueKind == JsonValueKind.Array
                            ? sEl.EnumerateArray().Select(x => x.GetString() ?? string.Empty).Where(x => !string.IsNullOrWhiteSpace(x)).ToArray()
                            : Array.Empty<string>();
                        var (ok, respJson) = await _apiClient.LookupStudentsRawAsync(studentIds);
                        var payload = $"{{\"ok\":{(ok ? "true" : "false")},\"data\":{respJson}}}";
                        await _webView.CoreWebView2.ExecuteScriptAsync($"window.onStudentsLookup && window.onStudentsLookup({payload})");
                        break;
                    }

                case "parse_xlsx_students":
                    {
                        try
                        {
                            var b64 = doc.RootElement.TryGetProperty("base64", out var bEl) ? bEl.GetString() ?? string.Empty : string.Empty;
                            var ids = ExtractStudentIdsFromXlsx(Convert.FromBase64String(b64));
                            var (ok, respJson) = await _apiClient.LookupStudentsRawAsync(ids);
                            var payload = $"{{\"ok\":{(ok ? "true" : "false")},\"data\":{respJson}}}";
                            await _webView.CoreWebView2.ExecuteScriptAsync($"window.onStudentsLookup && window.onStudentsLookup({payload})");
                        }
                        catch (Exception ex)
                        {
                            var errJson = JsonSerializer.Serialize(new { detail = $"Lỗi đọc file Excel: {ex.Message}" });
                            await _webView.CoreWebView2.ExecuteScriptAsync($"window.onStudentsLookup && window.onStudentsLookup({{\"ok\":false,\"data\":{errJson}}})");
                        }
                        break;
                    }

                case "class_delete":
                    {
                        var classId = doc.RootElement.TryGetProperty("classId", out var cEl) ? cEl.GetString() ?? string.Empty : string.Empty;
                        var (ok, respJson) = await _apiClient.DeleteClassAsync(classId);
                        var payload = $"{{\"ok\":{(ok ? "true" : "false")},\"classId\":{JsonSerializer.Serialize(classId)},\"data\":{respJson}}}";
                        await _webView.CoreWebView2.ExecuteScriptAsync($"window.onClassDeleted && window.onClassDeleted({payload})");
                        break;
                    }

                case "class_students":
                    {
                        var classId = doc.RootElement.TryGetProperty("classId", out var cEl) ? cEl.GetString() ?? string.Empty : string.Empty;
                        var (ok, respJson) = await _apiClient.GetClassStudentsRawAsync(classId);
                        var payload = $"{{\"ok\":{(ok ? "true" : "false")},\"classId\":{JsonSerializer.Serialize(classId)},\"data\":{respJson}}}";
                        await _webView.CoreWebView2.ExecuteScriptAsync($"window.onClassStudents && window.onClassStudents({payload})");
                        break;
                    }

                case "attendance_init":
                    {
                        var classId = doc.RootElement.TryGetProperty("classId", out var cEl) ? cEl.GetString() ?? string.Empty : string.Empty;
                        var studentsTask = _apiClient.GetClassStudentsRawAsync(classId);
                        var logsTask = _apiClient.GetClassAttendanceLogsRawAsync(classId);
                        var descTask = _apiClient.GetClassFaceDescriptorsRawAsync(classId);
                        await Task.WhenAll(studentsTask, logsTask, descTask);
                        var (sOk, sJson) = await studentsTask;
                        var (_, lJson) = await logsTask;
                        var (_, dJson) = await descTask;
                        var payload = $"{{\"ok\":{(sOk ? "true" : "false")},\"classId\":{JsonSerializer.Serialize(classId)},\"students\":{sJson},\"logs\":{lJson},\"descriptors\":{dJson}}}";
                        await _webView.CoreWebView2.ExecuteScriptAsync($"window.onAttendanceInit && window.onAttendanceInit({payload})");
                        break;
                    }

                case "attendance_record":
                    {
                        var el = doc.RootElement;
                        var studentId = el.TryGetProperty("studentId", out var sEl) ? sEl.GetString() ?? string.Empty : string.Empty;
                        var studentName = el.TryGetProperty("studentName", out var nEl) ? nEl.GetString() ?? string.Empty : string.Empty;
                        var classId = el.TryGetProperty("classId", out var cEl) ? cEl.GetString() ?? string.Empty : string.Empty;
                        var confidence = el.TryGetProperty("confidence", out var cfEl)
                            ? (cfEl.ValueKind == JsonValueKind.String ? cfEl.GetString() ?? "99.0%" : $"{cfEl.GetDouble():0.1}%")
                            : "99.0%";
                        var avatar = el.TryGetProperty("avatar", out var aEl) && aEl.ValueKind == JsonValueKind.String ? aEl.GetString() : null;
                        var device = el.TryGetProperty("device", out var dvEl) ? dvEl.GetString() ?? "Lecturer Desktop AI" : "Lecturer Desktop AI";
                        var (ok, respJson) = await _apiClient.RecordAttendanceRawAsync(studentId, studentName, classId, confidence, avatar, device);
                        var payload = $"{{\"ok\":{(ok ? "true" : "false")},\"studentId\":{JsonSerializer.Serialize(studentId)},\"data\":{respJson}}}";
                        await _webView.CoreWebView2.ExecuteScriptAsync($"window.onAttendanceRecorded && window.onAttendanceRecorded({payload})");
                        break;
                    }

                case "attendance_save_session":
                    {
                        var el = doc.RootElement;
                        var (ok, respJson) = await _apiClient.SaveAttendanceSessionRawAsync(el);
                        var payload = $"{{\"ok\":{(ok ? "true" : "false")},\"data\":{respJson}}}";
                        await _webView.CoreWebView2.ExecuteScriptAsync($"window.onAttendanceSessionSaved && window.onAttendanceSessionSaved({payload})");
                        break;
                    }

                case "history_session_detail":
                    {
                        var sessionId = doc.RootElement.TryGetProperty("sessionId", out var sEl) ? sEl.GetString() ?? string.Empty : string.Empty;
                        var (ok, respJson) = await _apiClient.GetAttendanceSessionDetailRawAsync(sessionId);
                        var payload = $"{{\"ok\":{(ok ? "true" : "false")},\"sessionId\":{JsonSerializer.Serialize(sessionId)},\"data\":{respJson}}}";
                        await _webView.CoreWebView2.ExecuteScriptAsync($"window.onHistorySessionDetail && window.onHistorySessionDetail({payload})");
                        break;
                    }

                case "speak_vi":
                    {
                        var text = doc.RootElement.TryGetProperty("text", out var tEl) ? tEl.GetString() ?? string.Empty : string.Empty;
                        if (!string.IsNullOrWhiteSpace(text))
                        {
                            var b64 = await _apiClient.FetchVietnameseTtsBase64Async(text);
                            var payload = $"{{\"base64\":{JsonSerializer.Serialize(b64)},\"text\":{JsonSerializer.Serialize(text)}}}";
                            await _webView.CoreWebView2.ExecuteScriptAsync($"window.onSpeakVi && window.onSpeakVi({payload})");
                        }
                        break;
                    }

                case "logout":
                    _currentLecturer = null;
                    NavigateTo("login/index.html");
                    break;

                case "exit_app":
                    Application.Exit();
                    break;
            }
        }
        catch
        {
            // Ignore malformed messages from WebView2
        }
    }

    private static string[] ExtractStudentIdsFromXlsx(byte[] xlsxBytes)
    {
        using var ms = new MemoryStream(xlsxBytes);
        using var zip = new ZipArchive(ms, ZipArchiveMode.Read);

        var sharedStrings = new List<string>();
        var ssEntry = zip.GetEntry("xl/sharedStrings.xml");
        if (ssEntry is not null)
        {
            using var ssStream = ssEntry.Open();
            var ssDoc = XDocument.Load(ssStream);
            XNamespace ns = ssDoc.Root?.Name.Namespace ?? XNamespace.None;
            foreach (var si in ssDoc.Descendants(ns + "si"))
            {
                sharedStrings.Add(string.Concat(si.Descendants(ns + "t").Select(t => t.Value)));
            }
        }

        var sheetEntry = zip.GetEntry("xl/worksheets/sheet1.xml")
            ?? zip.Entries.FirstOrDefault(e => e.FullName.StartsWith("xl/worksheets/sheet", StringComparison.OrdinalIgnoreCase));
        if (sheetEntry is null) return Array.Empty<string>();

        using var sheetStream = sheetEntry.Open();
        var sheetDoc = XDocument.Load(sheetStream);
        XNamespace sNs = sheetDoc.Root?.Name.Namespace ?? XNamespace.None;

        var rows = new List<Dictionary<int, string>>();
        foreach (var rowEl in sheetDoc.Descendants(sNs + "row"))
        {
            var rowMap = new Dictionary<int, string>();
            var fallbackCol = 0;
            foreach (var cEl in rowEl.Elements(sNs + "c"))
            {
                var cellRef = cEl.Attribute("r")?.Value;
                var colIdx = ParseExcelColumnIndex(cellRef, fallbackCol);
                fallbackCol = colIdx + 1;

                var tAttr = cEl.Attribute("t")?.Value;
                var val = cEl.Element(sNs + "v")?.Value ?? string.Empty;
                if (tAttr == "s" && int.TryParse(val, out var idx) && idx >= 0 && idx < sharedStrings.Count)
                    val = sharedStrings[idx];
                else if (tAttr == "inlineStr")
                    val = string.Concat(cEl.Descendants(sNs + "t").Select(t => t.Value));

                var trimmed = val.Trim();
                if (!string.IsNullOrWhiteSpace(trimmed))
                    rowMap[colIdx] = trimmed;
            }
            if (rowMap.Count > 0)
                rows.Add(rowMap);
        }

        if (rows.Count == 0)
            throw new InvalidDataException("AI phát hiện file Excel trống, không có dữ liệu thông tin sinh viên.");

        // AI Semantic Document Classifier: quét toàn bộ tiêu đề & nội dung mẫu để nhận diện loại tài liệu
        var allSampleText = string.Join(" ", rows.Take(20).SelectMany(r => r.Values)).ToLowerInvariant();
        var headerCandidateText = string.Join(" ", rows.Take(8).SelectMany(r => r.Values)).ToLowerInvariant();

        string[] studentSignals = { "mssv", "mã sv", "ma sv", "ma_sv", "masv", "studentid", "student_id", "mã sinh viên", "ma sinh vien", "họ tên", "ho ten", "họ và tên", "sinh viên", "sinh vien", "student name", "lớp", "ngày sinh" };
        string[] sprintSignals = { "sprint", "backlog", "story point", "assignee", "jira", "epic", "scrum", "user story", "task id", "task name", "estimate", "burn down", "in progress", "feature" };
        string[] financeSignals = { "hóa đơn", "hoa don", "doanh thu", "chi phí", "chi phi", "đơn giá", "don gia", "thành tiền", "thanh tien", "invoice", "vat", "thuế", "lương", "ngân sách" };
        string[] scheduleSignals = { "thời khóa biểu", "thoi khoa bieu", "lịch thi", "lich thi", "phòng thi", "ca thi", "giám thị" };

        var studentScore = studentSignals.Count(k => headerCandidateText.Contains(k));
        var sprintScore = sprintSignals.Count(k => allSampleText.Contains(k));
        var financeScore = financeSignals.Count(k => allSampleText.Contains(k));
        var scheduleScore = scheduleSignals.Count(k => allSampleText.Contains(k));

        if (sprintScore >= 2 && studentScore == 0)
            throw new InvalidDataException("AI nhận diện đây là file Quản lý Sprint / Công việc dự án (Agile), KHÔNG phải dữ liệu thông tin sinh viên!");
        if (financeScore >= 2 && studentScore == 0)
            throw new InvalidDataException("AI nhận diện đây là file Tài chính / Hóa đơn, KHÔNG phải dữ liệu thông tin sinh viên!");
        if (scheduleScore >= 2 && studentScore == 0)
            throw new InvalidDataException("AI nhận diện đây là file Thời khóa biểu / Lịch thi, KHÔNG phải danh sách sinh viên!");

        var headerRowIdx = -1;
        var mssvCol = -1;
        var scanLimit = Math.Min(rows.Count, 10);
        for (var r = 0; r < scanLimit; r++)
        {
            foreach (var kv in rows[r])
            {
                var h = kv.Value.Trim().ToUpperInvariant();
                if (h is "MSSV" or "MA_SV" or "MASV" or "STUDENTID" or "STUDENT_ID" or "MÃ SV" or "MA SV" or "MÃ SINH VIÊN" or "MA SINH VIEN")
                {
                    headerRowIdx = r;
                    mssvCol = kv.Key;
                    break;
                }
            }
            if (headerRowIdx >= 0) break;
        }

        var hasExplicitHeader = headerRowIdx >= 0;
        if (!hasExplicitHeader)
        {
            for (var r = 0; r < scanLimit; r++)
            {
                var sttEntry = rows[r].FirstOrDefault(kv => kv.Value.Trim().Equals("STT", StringComparison.OrdinalIgnoreCase));
                if (rows[r].Values.Any(v => v.Trim().Equals("STT", StringComparison.OrdinalIgnoreCase)))
                {
                    headerRowIdx = r;
                    mssvCol = sttEntry.Key + 1;
                    break;
                }
            }
        }

        if (mssvCol < 0) mssvCol = 0;
        var startIdx = headerRowIdx >= 0 ? headerRowIdx + 1 : 0;
        var result = new List<string>();
        var invalidCount = 0;
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        for (var i = startIdx; i < rows.Count; i++)
        {
            if (!rows[i].TryGetValue(mssvCol, out var rawId)) continue;
            var id = rawId.Trim().ToUpperInvariant();
            if (string.IsNullOrWhiteSpace(id)) continue;
            if (IsValidStudentId(id))
            {
                if (seen.Add(id)) result.Add(id);
            }
            else
            {
                invalidCount++;
            }
        }

        if (result.Count == 0 || (!hasExplicitHeader && invalidCount > result.Count) || (studentScore == 0 && !hasExplicitHeader && result.Count < 1))
        {
            throw new InvalidDataException("AI phân tích cấu trúc file thấy đây KHÔNG phải dữ liệu thông tin sinh viên (thiếu cột MSSV / Họ tên hoặc mã sinh viên hợp lệ như SV-7142).");
        }
        return result.ToArray();
    }

    private static bool IsValidStudentId(string id)
    {
        if (string.IsNullOrWhiteSpace(id) || id.Length < 4 || id.Length > 16) return false;
        var digits = 0;
        foreach (var ch in id)
        {
            if (ch is >= '0' and <= '9') digits++;
            else if (ch is not ((>= 'A' and <= 'Z') or '-')) return false;
        }
        return digits >= 3;
    }

    private static int ParseExcelColumnIndex(string? cellRef, int fallbackCol)
    {
        if (string.IsNullOrWhiteSpace(cellRef)) return fallbackCol;
        var col = 0;
        var foundLetter = false;
        foreach (var ch in cellRef)
        {
            if (ch is >= 'A' and <= 'Z')
            {
                col = col * 26 + (ch - 'A' + 1);
                foundLetter = true;
            }
            else if (ch is >= 'a' and <= 'z')
            {
                col = col * 26 + (ch - 'a' + 1);
                foundLetter = true;
            }
            else
            {
                break;
            }
        }
        return foundLetter ? col - 1 : fallbackCol;
    }
}

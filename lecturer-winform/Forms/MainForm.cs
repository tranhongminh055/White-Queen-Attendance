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
                    await Task.WhenAll(classesTask, attTask);

                    var (clsOk, clsJson) = classesTask.Result;
                    var (_, attJson) = attTask.Result;
                    var payload = $"{{\"ok\":{(clsOk ? "true" : "false")},\"classes\":{(clsOk ? clsJson : "[]")},\"attendance\":{attJson}}}";
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
                    var (ok, respJson) = await _apiClient.CreateClassRawAsync(
                        lecturerId,
                        Str("className"),
                        Str("joinCode"),
                        Str("semester"),
                        Str("scheduleText"),
                        Str("roomText"),
                        studentIds
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
                    var confidence = el.TryGetProperty("confidence", out var cfEl) ? cfEl.GetDouble() : 99.0;
                    var avatar = el.TryGetProperty("avatar", out var aEl) && aEl.ValueKind == JsonValueKind.String ? aEl.GetString() : null;
                    var device = el.TryGetProperty("device", out var dvEl) ? dvEl.GetString() ?? "Lecturer Desktop AI" : "Lecturer Desktop AI";
                    var (ok, respJson) = await _apiClient.RecordAttendanceRawAsync(studentId, studentName, classId, confidence, avatar, device);
                    var payload = $"{{\"ok\":{(ok ? "true" : "false")},\"studentId\":{JsonSerializer.Serialize(studentId)},\"data\":{respJson}}}";
                    await _webView.CoreWebView2.ExecuteScriptAsync($"window.onAttendanceRecorded && window.onAttendanceRecorded({payload})");
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

        if (rows.Count == 0) return Array.Empty<string>();

        var headerRowIdx = -1;
        var mssvCol = -1;
        var scanLimit = Math.Min(rows.Count, 10);
        for (var r = 0; r < scanLimit; r++)
        {
            foreach (var kv in rows[r])
            {
                var h = kv.Value.Trim().ToUpperInvariant();
                if (h is "MSSV" or "MA_SV" or "MASV" or "STUDENTID" or "STUDENT_ID" or "MÃ SV" or "MA SV" or "ID")
                {
                    headerRowIdx = r;
                    mssvCol = kv.Key;
                    break;
                }
            }
            if (headerRowIdx >= 0) break;
        }

        if (headerRowIdx < 0)
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
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        for (var i = startIdx; i < rows.Count; i++)
        {
            if (!rows[i].TryGetValue(mssvCol, out var rawId)) continue;
            var id = rawId.Trim().ToUpperInvariant();
            if (!string.IsNullOrWhiteSpace(id) && seen.Add(id))
                result.Add(id);
        }
        return result.ToArray();
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

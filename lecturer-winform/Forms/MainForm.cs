using System.Drawing;
using System.Text.Json;
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
                    var (ok, respJson) = await _apiClient.CreateClassRawAsync(
                        lecturerId,
                        Str("className"),
                        Str("joinCode"),
                        Str("semester"),
                        Str("scheduleText"),
                        Str("roomText")
                    );
                    var payload = $"{{\"ok\":{(ok ? "true" : "false")},\"data\":{respJson}}}";
                    await _webView.CoreWebView2.ExecuteScriptAsync($"window.onClassCreated && window.onClassCreated({payload})");
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
}

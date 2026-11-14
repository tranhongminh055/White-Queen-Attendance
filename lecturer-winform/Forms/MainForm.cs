using System.Drawing;
using System.Text.Json;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace WhiteQueenLecturer.Forms;

public sealed class MainForm : Form
{
    private readonly WebView2 _webView;

    public MainForm()
    {
        Text = "SPACE X · White Queen Lecturer Desktop (.NET 10)";
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

        Load += async (_, _) => await InitializeWebViewAsync();
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
            _webView.CoreWebView2.WebMessageReceived += OnWebMessageReceived;

            _webView.Source = new Uri("https://app.whitequeen.local/landing/index.html");
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

    private void OnWebMessageReceived(object? sender, CoreWebView2WebMessageReceivedEventArgs args)
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
                case "open_login":
                case "start_attendance":
                    MessageBox.Show(
                        "Landing Page đã kết nối thành công với C# WinForms (.NET 10)!\n\nBước tiếp theo: Xây dựng Backend API Giảng viên (/api/lecturer/*) & Form Đăng nhập + Camera Điểm danh.",
                        "White Queen Lecturer Desktop",
                        MessageBoxButtons.OK,
                        MessageBoxIcon.Information
                    );
                    break;
            }
        }
        catch
        {
            // Ignore malformed messages from WebView2
        }
    }
}


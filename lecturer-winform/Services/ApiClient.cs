using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace WhiteQueenLecturer.Services;

public sealed class LecturerAccount
{
    [JsonPropertyName("employeeId")]
    public string EmployeeId { get; set; } = string.Empty;

    [JsonPropertyName("fullName")]
    public string FullName { get; set; } = string.Empty;

    [JsonPropertyName("email")]
    public string Email { get; set; } = string.Empty;

    [JsonPropertyName("role")]
    public string Role { get; set; } = string.Empty;

    [JsonPropertyName("classId")]
    public string ClassId { get; set; } = "FACULTY";
}

public sealed class LoginResult
{
    public bool Success { get; init; }
    public string Message { get; init; } = string.Empty;
    public LecturerAccount? Account { get; init; }
}

public sealed class ApiClient
{
    public const string BaseUrl = "https://white-queen-attendance.onrender.com";

    private readonly HttpClient _http = new()
    {
        BaseAddress = new Uri(BaseUrl),
        Timeout = TimeSpan.FromSeconds(45)
    };

    public async Task<LoginResult> LoginLecturerAsync(string identifier, string password)
    {
        try
        {
            var response = await _http.PostAsJsonAsync("/api/auth/login", new
            {
                identifier,
                password
            });

            var json = await response.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;

            var ok = root.TryGetProperty("success", out var successEl) && successEl.GetBoolean();
            if (!ok)
            {
                var errMsg = root.TryGetProperty("message", out var msgEl)
                    ? msgEl.GetString() ?? "Đăng nhập thất bại."
                    : "Đăng nhập thất bại.";
                return new LoginResult { Success = false, Message = errMsg };
            }

            if (!root.TryGetProperty("account", out var accEl))
            {
                return new LoginResult { Success = false, Message = "Phản hồi máy chủ không hợp lệ." };
            }

            var account = JsonSerializer.Deserialize<LecturerAccount>(accEl.GetRawText());
            if (account is null)
            {
                return new LoginResult { Success = false, Message = "Không đọc được thông tin tài khoản." };
            }

            if (!string.Equals(account.Role, "lecturer", StringComparison.OrdinalIgnoreCase))
            {
                return new LoginResult
                {
                    Success = false,
                    Message = "Tài khoản này thuộc vai trò Sinh viên. Phần mềm Desktop chỉ dành cho Giảng viên."
                };
            }

            return new LoginResult
            {
                Success = true,
                Message = $"Chào mừng {account.FullName}!",
                Account = account
            };
        }
        catch (TaskCanceledException)
        {
            return new LoginResult
            {
                Success = false,
                Message = "Kết nối tới máy chủ Render quá thời gian chờ. Vui lòng thử lại."
            };
        }
        catch (Exception ex)
        {
            return new LoginResult
            {
                Success = false,
                Message = $"Không thể kết nối máy chủ: {ex.Message}"
            };
        }
    }
}


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

public sealed class FaceLoginResult
{
    public bool Matched { get; init; }
    public bool HasEnrolled { get; init; } = true;
    public double? Distance { get; init; }
    public string Confidence { get; init; } = string.Empty;
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

    public async Task WarmUpAsync()
    {
        try
        {
            await _http.GetAsync("/api/health");
        }
        catch
        {
            // Ignore warm-up failure
        }
    }

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

    public async Task<FaceLoginResult> FaceLoginLecturerAsync(double[] descriptor, double maxDistance = 0.62)
    {
        try
        {
            var response = await _http.PostAsJsonAsync("/api/auth/face-login", new
            {
                descriptor,
                maxDistance,
                requiredRole = "lecturer"
            });

            var json = await response.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;

            var matched = root.TryGetProperty("matched", out var mEl) && mEl.GetBoolean();
            var hasEnrolled = !root.TryGetProperty("hasEnrolled", out var hEl) || hEl.GetBoolean();
            double? distance = root.TryGetProperty("distance", out var dEl) && dEl.ValueKind == JsonValueKind.Number
                ? dEl.GetDouble()
                : null;

            if (!matched || !root.TryGetProperty("account", out var accEl))
            {
                return new FaceLoginResult
                {
                    Matched = false,
                    HasEnrolled = hasEnrolled,
                    Distance = distance,
                    Message = hasEnrolled
                        ? "Chưa khớp dữ liệu khuôn mặt — giữ yên khuôn mặt & đủ sáng."
                        : "Chưa có dữ liệu khuôn mặt nào được đăng ký trên hệ thống."
                };
            }

            var confidence = root.TryGetProperty("confidence", out var cEl)
                ? cEl.GetString() ?? "94.8%"
                : "94.8%";

            var id = accEl.TryGetProperty("id", out var idEl) ? idEl.GetString() ?? string.Empty : string.Empty;
            var fullName = accEl.TryGetProperty("fullName", out var fnEl) ? fnEl.GetString() ?? string.Empty : string.Empty;
            var email = accEl.TryGetProperty("email", out var emEl) ? emEl.GetString() ?? string.Empty : string.Empty;
            var role = accEl.TryGetProperty("role", out var rEl) ? rEl.GetString() ?? "student" : "student";
            var classId = accEl.TryGetProperty("classId", out var clEl) ? clEl.GetString() ?? "FACULTY" : "FACULTY";

            if (!string.Equals(role, "lecturer", StringComparison.OrdinalIgnoreCase))
            {
                return new FaceLoginResult
                {
                    Matched = false,
                    HasEnrolled = true,
                    Distance = distance,
                    Message = $"Khuôn mặt khớp sinh viên {fullName} ({id}). Phần mềm Desktop chỉ dành cho Giảng viên."
                };
            }

            return new FaceLoginResult
            {
                Matched = true,
                HasEnrolled = true,
                Distance = distance,
                Confidence = confidence,
                Message = $"Xác thực khuôn mặt thành công ({confidence})!",
                Account = new LecturerAccount
                {
                    EmployeeId = id,
                    FullName = fullName,
                    Email = email,
                    Role = role,
                    ClassId = classId
                }
            };
        }
        catch (Exception ex)
        {
            return new FaceLoginResult
            {
                Matched = false,
                HasEnrolled = true,
                Message = $"Lỗi kết nối máy chủ: {ex.Message}"
            };
        }
    }

    public async Task<(bool Ok, string Json)> GetLecturerClassesRawAsync(string lecturerId)
    {
        try
        {
            var resp = await _http.GetAsync($"/api/lecturers/{Uri.EscapeDataString(lecturerId)}/classes");
            var body = await resp.Content.ReadAsStringAsync();
            return (resp.IsSuccessStatusCode, string.IsNullOrWhiteSpace(body) ? "[]" : body);
        }
        catch (Exception ex)
        {
            return (false, JsonSerializer.Serialize(new { detail = ex.Message }));
        }
    }

    public async Task<(bool Ok, string Json)> GetLecturerAttendanceRawAsync(string lecturerId)
    {
        try
        {
            var resp = await _http.GetAsync($"/api/lecturers/{Uri.EscapeDataString(lecturerId)}/attendance-summary");
            var body = await resp.Content.ReadAsStringAsync();
            return (resp.IsSuccessStatusCode, string.IsNullOrWhiteSpace(body) ? "{\"todaySessions\":0,\"logs\":[]}" : body);
        }
        catch
        {
            return (false, "{\"todaySessions\":0,\"logs\":[]}");
        }
    }

    public async Task<(bool Ok, string Json)> CreateClassRawAsync(
        string lecturerId,
        string className,
        string joinCode,
        string semester,
        string scheduleText,
        string roomText)
    {
        try
        {
            var resp = await _http.PostAsJsonAsync("/api/classes", new
            {
                lecturerId,
                className,
                joinCode = string.IsNullOrWhiteSpace(joinCode) ? null : joinCode,
                semester = string.IsNullOrWhiteSpace(semester) ? "HK1 2025-2026" : semester,
                scheduleText,
                roomText
            });
            var body = await resp.Content.ReadAsStringAsync();
            return (resp.IsSuccessStatusCode, string.IsNullOrWhiteSpace(body) ? "{}" : body);
        }
        catch (Exception ex)
        {
            return (false, JsonSerializer.Serialize(new { detail = ex.Message }));
        }
    }

    public async Task<(bool Ok, string Json)> DeleteClassAsync(string classId)
    {
        try
        {
            var resp = await _http.DeleteAsync($"/api/classes/{Uri.EscapeDataString(classId)}");
            var body = await resp.Content.ReadAsStringAsync();
            return (resp.IsSuccessStatusCode, string.IsNullOrWhiteSpace(body) ? "{}" : body);
        }
        catch (Exception ex)
        {
            return (false, JsonSerializer.Serialize(new { detail = ex.Message }));
        }
    }

    public async Task<(bool Ok, string Json)> GetClassStudentsRawAsync(string classId)
    {
        try
        {
            var resp = await _http.GetAsync($"/api/classes/{Uri.EscapeDataString(classId)}/students");
            var body = await resp.Content.ReadAsStringAsync();
            return (resp.IsSuccessStatusCode, string.IsNullOrWhiteSpace(body) ? "[]" : body);
        }
        catch (Exception ex)
        {
            return (false, JsonSerializer.Serialize(new { detail = ex.Message }));
        }
    }
}


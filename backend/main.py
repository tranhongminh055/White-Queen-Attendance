import html
import json
import math
import os
import re
import secrets
import smtplib
import threading
import time
import urllib.request
from collections import defaultdict, deque
from contextlib import asynccontextmanager
from datetime import date, datetime, timedelta, timezone
from email.message import EmailMessage
from typing import Any

from fastapi import BackgroundTasks, FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse
from pydantic import BaseModel, Field

from db import (
    DB_DISPLAY_HOST,
    DB_DISPLAY_NAME,
    DB_ENGINE,
    IntegrityError,
    get_connection,
    init_database,
)
from security import hash_password, verify_password

EMAIL_REGEX = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]{2,}$")
EMPLOYEE_ID_REGEX = re.compile(r"^[A-Za-z]{2,5}-?\d{3,6}$")
ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv("ALLOWED_ORIGINS", "*").split(",")
    if origin.strip()
]
AUTH_RATE_LIMIT_PER_MIN = max(30, int(os.getenv("AUTH_RATE_LIMIT_PER_MIN", "180")))
MAX_SNAPSHOT_LEN = 750_000
APPROVAL_ADMIN_EMAIL = os.getenv("APPROVAL_ADMIN_EMAIL", "mt1479233@gmail.com").strip()
EMAIL_WEBHOOK_URL = os.getenv("EMAIL_WEBHOOK_URL", "").strip()
SMTP_USER = os.getenv("SMTP_USER", "").strip()
SMTP_PASS = os.getenv("SMTP_PASS", "").strip()
PUBLIC_API_BASE_URL = os.getenv(
    "PUBLIC_API_BASE_URL", "https://white-queen-attendance.onrender.com"
).rstrip("/")

_rate_buckets: dict[str, deque[float]] = defaultdict(deque)
_rate_lock = threading.Lock()

DEFAULT_CLASSES = [
    {"id": "CNTT-K21A", "name": "CNTT-K21A - Công nghệ Thông tin K21A"},
    {"id": "CS101", "name": "CS101 - Nhập môn Trí tuệ Nhân tạo"},
    {"id": "IT202", "name": "IT202 - Lập trình Web Hiện đại"},
    {"id": "SE301", "name": "SE301 - Công nghệ Phần mềm Chuyên sâu"},
]

ANGLE_ORDER = ["straight", "left", "right", "up", "down"]


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_database()
    yield


app = FastAPI(
    title="SpaceX Biometric SQL Server API",
    version="1.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=r"https://.*\.netlify\.app",
    allow_credentials="*" not in ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def auth_rate_limit_middleware(request: Request, call_next):
    if request.url.path.startswith("/api/auth/") and request.method == "POST":
        client_ip = (request.headers.get("x-forwarded-for") or "").split(",")[0].strip() or (
            request.client.host if request.client else "unknown"
        )
        now = time.monotonic()
        cutoff = now - 60.0
        with _rate_lock:
            bucket = _rate_buckets[client_ip]
            while bucket and bucket[0] < cutoff:
                bucket.popleft()
            if len(bucket) >= AUTH_RATE_LIMIT_PER_MIN:
                return JSONResponse(
                    status_code=429,
                    content={"detail": "Quá nhiều yêu cầu xác thực. Vui lòng thử lại sau 1 phút."},
                )
            bucket.append(now)
    return await call_next(request)


@app.exception_handler(Exception)
async def unhandled_exception_handler(_request: Request, _exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"detail": "Lỗi hệ thống nội bộ hoặc kết nối cơ sở dữ liệu. Vui lòng thử lại."},
    )


class RegisterRequest(BaseModel):
    fullName: str = Field(..., min_length=4, max_length=120)
    employeeId: str = Field(..., min_length=4, max_length=32)
    email: str = Field(..., min_length=5, max_length=160)
    role: str = Field(default="student", max_length=32)
    password: str = Field(..., min_length=8, max_length=128)


class LoginRequest(BaseModel):
    identifier: str = Field(..., min_length=1, max_length=160)
    password: str = Field(..., min_length=1, max_length=128)


class FaceLoginRequest(BaseModel):
    descriptor: list[float]
    maxDistance: float = Field(default=0.5, ge=0.2, le=0.9)
    requiredRole: str | None = None


class EnrollFaceRequest(BaseModel):
    id: str = Field(..., min_length=3, max_length=32)
    name: str | None = None
    classId: str | None = None
    email: str | None = None
    avatar: str | None = None
    registeredAt: str | None = None
    descriptors: dict[str, list[float]] | list[list[float]]
    angleSnapshots: dict[str, str] | None = None


class AttendanceRequest(BaseModel):
    studentId: str = Field(..., min_length=3, max_length=32)
    studentName: str = Field(..., min_length=1, max_length=120)
    classId: str = Field(..., min_length=1, max_length=40)
    confidence: str = Field(default="0%", max_length=24)
    avatar: str | None = None
    device: str = Field(default="Live Camera · MediaPipe 468pt · 128D", max_length=120)


class LegacyMigrateRequest(BaseModel):
    accounts: list[dict[str, Any]] = Field(default_factory=list)
    students: list[dict[str, Any]] = Field(default_factory=list)
    attendanceLogs: list[dict[str, Any]] = Field(default_factory=list)


class RosterEntry(BaseModel):
    studentId: str = Field(..., min_length=2, max_length=32)
    fullName: str = Field(default="", max_length=120)
    email: str = Field(default="", max_length=120)


class CreateClassRequest(BaseModel):
    className: str = Field(..., min_length=2, max_length=160)
    joinCode: str | None = Field(default=None, max_length=24)
    semester: str = Field(default="HK1 2025-2026", max_length=64)
    lecturerId: str = Field(..., min_length=2, max_length=32)
    scheduleText: str = Field(default="", max_length=160)
    roomText: str = Field(default="", max_length=80)
    studentIds: list[str] = Field(default_factory=list)
    rosterEntries: list[RosterEntry] = Field(default_factory=list)
    expectedTotal: int = Field(default=0, ge=0, le=5000)


class LookupStudentsRequest(BaseModel):
    studentIds: list[str] = Field(default_factory=list)


class JoinClassRequest(BaseModel):
    joinCode: str = Field(..., min_length=2, max_length=24)


class SaveAttendanceSessionRequest(BaseModel):
    classId: str = Field(..., min_length=2, max_length=40)
    className: str = Field(default="", max_length=160)
    lecturerId: str = Field(..., min_length=2, max_length=32)
    startedAt: str = Field(default="", max_length=32)
    endedAt: str = Field(default="", max_length=32)
    totalStudents: int = 0
    presentCount: int = 0
    lateCount: int = 0
    absentCount: int = 0
    attendanceRate: float = 0.0
    details: list[dict[str, Any]] = Field(default_factory=list)


def validate_strong_password(password: str) -> str | None:
    if len(password) < 8:
        return "Mật khẩu phải có ít nhất 8 ký tự."
    if not re.search(r"[a-z]", password) or not re.search(r"[A-Z]", password):
        return "Mật khẩu phải gồm cả chữ hoa và chữ thường."
    if not re.search(r"\d", password):
        return "Mật khẩu phải có ít nhất 1 chữ số."
    if not re.search(r"[^A-Za-z0-9]", password):
        return "Mật khẩu phải có ít nhất 1 ký tự đặc biệt (@, #, !...)."
    return None


def normalize_descriptor_map(
    descriptors: dict[str, list[float]] | list[list[float]],
) -> dict[str, list[float]]:
    normalized: dict[str, list[float]] = {}
    if isinstance(descriptors, dict):
        items = list(descriptors.items())
    else:
        items = [
            (ANGLE_ORDER[idx] if idx < len(ANGLE_ORDER) else f"angle_{idx + 1}", vec)
            for idx, vec in enumerate(descriptors)
        ]

    for angle_key, vec in items:
        if not isinstance(vec, list) or len(vec) != 128:
            raise HTTPException(
                status_code=400,
                detail=f"Vector khuôn mặt cho góc '{angle_key}' phải đủ đúng 128 chiều.",
            )
        clean_vec: list[float] = []
        for v in vec:
            fv = float(v)
            if not math.isfinite(fv):
                raise HTTPException(status_code=400, detail="Vector sinh trắc học chứa giá trị không hợp lệ.")
            clean_vec.append(fv)
        normalized[angle_key] = clean_vec

    if not normalized:
        raise HTTPException(status_code=400, detail="Không có vector khuôn mặt nào để lưu.")
    return normalized


def find_account_conflicts(cur: Any, norm_id: str, norm_email: str) -> dict[str, str]:
    conflicts: dict[str, str] = {}
    if norm_id:
        cur.execute(
            """
            SELECT EmployeeId FROM Accounts WHERE UPPER(EmployeeId) = ?
            UNION ALL
            SELECT StudentId FROM StudentProfiles WHERE UPPER(StudentId) = ?
            """,
            (norm_id, norm_id),
        )
        if cur.fetchone():
            conflicts["employeeId"] = f"Mã nhân viên {norm_id} đã được đăng ký trước đó."

    if norm_email:
        cur.execute(
            """
            SELECT Email FROM Accounts WHERE LOWER(Email) = ?
            UNION ALL
            SELECT Email FROM StudentProfiles WHERE LOWER(Email) = ?
            """,
            (norm_email, norm_email),
        )
        if cur.fetchone():
            conflicts["email"] = f"Email {norm_email} đã được đăng ký trước đó."

    return conflicts


def build_student_payloads(
    cur: Any,
    student_id: str | None = None,
    include_snapshots: bool = False,
) -> list[dict[str, Any]]:
    if student_id:
        cur.execute(
            """
            SELECT s.StudentId, s.FullName, s.ClassId, s.Email, s.AvatarDataUrl,
                   s.EmbeddingCreated, s.RegisteredAt, a.Role
            FROM StudentProfiles s
            LEFT JOIN Accounts a ON a.EmployeeId = s.StudentId
            WHERE UPPER(s.StudentId) = ?
            ORDER BY s.UpdatedAt DESC
            """,
            (student_id.strip().upper(),),
        )
    else:
        cur.execute(
            """
            SELECT s.StudentId, s.FullName, s.ClassId, s.Email, s.AvatarDataUrl,
                   s.EmbeddingCreated, s.RegisteredAt, a.Role
            FROM StudentProfiles s
            LEFT JOIN Accounts a ON a.EmployeeId = s.StudentId
            ORDER BY s.UpdatedAt DESC
            """
        )
    student_rows = cur.fetchall()
    if not student_rows:
        return []

    snap_col = "SnapshotDataUrl" if include_snapshots else "NULL"
    if student_id:
        cur.execute(
            f"""
            SELECT StudentId, AngleKey, DescriptorJson, {snap_col}
            FROM FaceEmbeddings
            WHERE UPPER(StudentId) = ?
            ORDER BY Id ASC
            """,
            (student_id.strip().upper(),),
        )
    else:
        cur.execute(
            f"""
            SELECT StudentId, AngleKey, DescriptorJson, {snap_col}
            FROM FaceEmbeddings
            ORDER BY Id ASC
            """
        )
    emb_rows = cur.fetchall()

    emb_by_student: dict[str, list[list[float]]] = {}
    snapshots_by_student: dict[str, dict[str, str]] = {}
    for sid, angle_key, desc_json, snap_url in emb_rows:
        key = sid.upper()
        try:
            vec = json.loads(desc_json)
        except Exception:
            continue
        emb_by_student.setdefault(key, []).append(vec)
        if snap_url:
            snapshots_by_student.setdefault(key, {})[angle_key] = snap_url

    students: list[dict[str, Any]] = []
    for row in student_rows:
        sid = row[0]
        key = sid.upper()
        descriptors = emb_by_student.get(key, [])
        snapshots = snapshots_by_student.get(key, {})
        students.append(
            {
                "id": sid,
                "name": row[1],
                "classId": row[2],
                "email": row[3],
                "avatar": row[4] or snapshots.get("straight") or next(iter(snapshots.values()), None),
                "embeddingCreated": bool(row[5]) and len(descriptors) > 0,
                "registeredAt": row[6],
                "role": row[7] or "student",
                "descriptors": descriptors,
                "angleSnapshots": snapshots,
            }
        )
    return students


@app.get("/api/health")
def health_check():
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT
                (SELECT COUNT(*) FROM Accounts) AS AccountCount,
                (SELECT COUNT(*) FROM StudentProfiles) AS StudentCount,
                (SELECT COUNT(*) FROM FaceEmbeddings) AS FaceEmbeddingCount,
                (SELECT COUNT(*) FROM AttendanceLogs) AS AttendanceCount
            """
        )
        row = cur.fetchone()
        return {
            "status": "ok",
            "engine": DB_ENGINE,
            "server": DB_DISPLAY_HOST,
            "database": DB_DISPLAY_NAME,
            "counts": {
                "accounts": row[0],
                "students": row[1],
                "faceEmbeddings": row[2],
                "attendanceLogs": row[3],
            },
        }
    finally:
        conn.close()


@app.get("/api/accounts/conflicts")
def check_conflicts(
    employeeId: str = Query(default=""),
    email: str = Query(default=""),
):
    norm_id = employeeId.strip().upper()
    norm_email = email.strip().lower()
    conn = get_connection()
    try:
        cur = conn.cursor()
        return find_account_conflicts(cur, norm_id, norm_email)
    finally:
        conn.close()


def send_lecturer_approval_email(
    employee_id: str,
    full_name: str,
    email: str,
    registered_at: str,
    token: str,
) -> None:
    approve_url = f"{PUBLIC_API_BASE_URL}/api/auth/lecturer-review?token={token}&decision=approve"
    reject_url = f"{PUBLIC_API_BASE_URL}/api/auth/lecturer-review?token={token}&decision=reject"

    safe_name = html.escape(full_name)
    safe_id = html.escape(employee_id)
    safe_email = html.escape(email)
    safe_time = html.escape(registered_at)
    subject = f"[White Queen] Xét duyệt tài khoản Giảng viên: {full_name} ({employee_id})"
    html_body = f"""
        <div style="font-family:Segoe UI,Arial,sans-serif;background:#06090e;color:#f8fafc;padding:28px;border:1px solid #1e293b;max-width:560px;margin:auto;">
          <div style="font-size:12px;letter-spacing:2px;color:#38bdf8;margin-bottom:8px;">SPACE X · WHITE QUEEN BIOMETRIC</div>
          <h2 style="margin:0 0 16px;font-size:20px;color:#ffffff;">Yêu cầu đăng ký tài khoản Giảng viên</h2>
          <table style="width:100%;border-collapse:collapse;margin-bottom:22px;font-size:14px;">
            <tr><td style="padding:8px 0;color:#94a3b8;width:130px;">Họ và tên:</td><td style="padding:8px 0;color:#fff;font-weight:600;">{safe_name}</td></tr>
            <tr><td style="padding:8px 0;color:#94a3b8;">Mã giảng viên:</td><td style="padding:8px 0;color:#38bdf8;font-weight:600;">{safe_id}</td></tr>
            <tr><td style="padding:8px 0;color:#94a3b8;">Email:</td><td style="padding:8px 0;color:#fff;">{safe_email}</td></tr>
            <tr><td style="padding:8px 0;color:#94a3b8;">Thời gian:</td><td style="padding:8px 0;color:#cbd5e1;">{safe_time}</td></tr>
          </table>
          <div style="display:flex;gap:12px;">
            <a href="{approve_url}" style="display:inline-block;background:#22c55e;color:#052e16;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:4px;margin-right:10px;">✅ APPROVE (CHẤP NHẬN)</a>
            <a href="{reject_url}" style="display:inline-block;background:#ef4444;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:4px;">❌ REJECT (TỪ CHỐI)</a>
          </div>
          <p style="margin-top:20px;font-size:12px;color:#64748b;">Liên kết chỉ có hiệu lực 1 lần trong vòng 48 giờ. Tài khoản chưa thể đăng nhập phần mềm Desktop cho tới khi bạn bấm APPROVE.</p>
        </div>
        """

    if EMAIL_WEBHOOK_URL:
        try:
            payload_bytes = json.dumps({"subject": subject, "html": html_body}).encode("utf-8")
            req = urllib.request.Request(
                EMAIL_WEBHOOK_URL,
                data=payload_bytes,
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=15) as resp:
                print(f"[APPROVAL] Đã gửi email qua HTTPS webhook cho {employee_id} (status {resp.status})")
            return
        except Exception as exc:
            print(f"[APPROVAL] Lỗi gửi email qua HTTPS webhook cho {employee_id}: {exc}")
            return

    if not SMTP_USER or not SMTP_PASS or not APPROVAL_ADMIN_EMAIL:
        print(
            f"[APPROVAL] Chưa cấu hình EMAIL_WEBHOOK_URL hoặc SMTP. "
            f"Yêu cầu giảng viên {employee_id} ({email}) đang ở trạng thái pending."
        )
        return

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = SMTP_USER
    msg["To"] = APPROVAL_ADMIN_EMAIL
    msg.set_content(
        f"Có yêu cầu đăng ký tài khoản Giảng viên mới:\n"
        f"- Họ tên: {full_name}\n"
        f"- Mã GV: {employee_id}\n"
        f"- Email: {email}\n"
        f"- Thời gian: {registered_at}\n\n"
        f"APPROVE: {approve_url}\n"
        f"REJECT: {reject_url}\n"
    )
    msg.add_alternative(html_body, subtype="html")

    try:
        with smtplib.SMTP("smtp.gmail.com", 587, timeout=15) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(SMTP_USER, SMTP_PASS)
            server.send_message(msg)
    except Exception as exc:
        print(f"[APPROVAL] Lỗi gửi email xét duyệt cho {employee_id}: {exc}")


@app.post("/api/auth/register")
def register_account(payload: RegisterRequest, background_tasks: BackgroundTasks):
    full_name = payload.fullName.strip()
    norm_id = payload.employeeId.strip().upper()
    norm_email = payload.email.strip().lower()
    role = (payload.role or "student").strip().lower()
    if role not in ("student", "lecturer"):
        role = "student"

    if not EMPLOYEE_ID_REGEX.match(norm_id):
        return {
            "success": False,
            "field": "employeeId",
            "message": "Mã nhân viên / sinh viên sai định dạng (vd: SX-00123 hoặc SV202601).",
        }
    if not EMAIL_REGEX.match(norm_email):
        return {
            "success": False,
            "field": "email",
            "message": "Email không đúng định dạng.",
        }
    pw_err = validate_strong_password(payload.password)
    if pw_err:
        return {"success": False, "field": "password", "message": pw_err}

    class_id = "FACULTY" if role == "lecturer" else "CNTT-K21A"
    registered_at = datetime.now().strftime("%d/%m/%Y, %H:%M:%S")
    pw_hash = hash_password(payload.password)

    conn = get_connection()
    try:
        cur = conn.cursor()
        conflicts = find_account_conflicts(cur, norm_id, norm_email)
        if conflicts:
            msg = (
                "Mã nhân viên và Email này đều đã được đăng ký trước đó!"
                if ("employeeId" in conflicts and "email" in conflicts)
                else conflicts.get("employeeId") or conflicts.get("email")
            )
            return {
                "success": False,
                "errors": conflicts,
                "field": "employeeId" if "employeeId" in conflicts else "email",
                "message": msg,
            }

        approval_status = "pending" if role == "lecturer" else "approved"
        approval_token = secrets.token_urlsafe(32) if role == "lecturer" else None
        approval_expires_at = (
            datetime.now(timezone.utc) + timedelta(hours=48)
            if role == "lecturer"
            else None
        )

        cur.execute(
            """
            INSERT INTO Accounts (
                EmployeeId, FullName, Email, Role, ClassId, PasswordHash,
                ApprovalStatus, ApprovalToken, ApprovalExpiresAt
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                norm_id,
                full_name,
                norm_email,
                role,
                class_id,
                pw_hash,
                approval_status,
                approval_token,
                approval_expires_at,
            ),
        )
        if role == "student":
            cur.execute(
                """
                INSERT INTO StudentProfiles (StudentId, FullName, ClassId, Email, AvatarDataUrl, EmbeddingCreated, RegisteredAt)
                VALUES (?, ?, ?, ?, NULL, 0, ?)
                """,
                (norm_id, full_name, class_id, norm_email, registered_at),
            )
        conn.commit()

        if role == "lecturer" and approval_token:
            background_tasks.add_task(
                send_lecturer_approval_email,
                norm_id,
                full_name,
                norm_email,
                registered_at,
                approval_token,
            )

        return {
            "success": True,
            "account": {
                "employeeId": norm_id,
                "fullName": full_name,
                "email": norm_email,
                "role": role,
                "classId": class_id,
                "approvalStatus": approval_status,
                "createdAt": registered_at,
            },
        }
    except IntegrityError:
        conn.rollback()
        conflicts = find_account_conflicts(cur, norm_id, norm_email)
        msg = (
            "Mã nhân viên và Email này đều đã được đăng ký trước đó!"
            if ("employeeId" in conflicts and "email" in conflicts)
            else conflicts.get("employeeId") or conflicts.get("email") or "Thông tin tài khoản đã tồn tại trong SQL Server!"
        )
        return {
            "success": False,
            "errors": conflicts,
            "field": "employeeId" if "employeeId" in conflicts else "email",
            "message": msg,
        }
    except Exception as exc:
        conn.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Save session error ({type(exc).__name__}): {exc}",
        )
    finally:
        conn.close()


def _render_review_html(title: str, subtitle: str, accent: str = "#38bdf8") -> str:
    return f"""<!DOCTYPE html>
<html lang="vi">
<head><meta charset="utf-8" /><title>{html.escape(title)}</title></head>
<body style="margin:0;background:#000;color:#f8fafc;font-family:Segoe UI,Arial,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;">
  <div style="background:#070b11;border:1px solid rgba(255,255,255,0.12);padding:34px 36px;max-width:480px;text-align:center;">
    <div style="font-size:11px;letter-spacing:2.5px;color:#38bdf8;margin-bottom:10px;">SPACE X · WHITE QUEEN</div>
    <h1 style="margin:0 0 12px;font-size:22px;color:{accent};">{html.escape(title)}</h1>
    <p style="margin:0;color:#cbd5e1;font-size:14px;line-height:1.6;">{html.escape(subtitle)}</p>
  </div>
</body>
</html>"""


@app.get("/api/auth/lecturer-review", response_class=HTMLResponse)
def review_lecturer_registration(
    token: str = Query(min_length=16),
    decision: str = Query(...),
):
    norm_decision = decision.strip().lower()
    if norm_decision not in ("approve", "reject"):
        return HTMLResponse(
            _render_review_html("Yêu cầu không hợp lệ", "Tham số decision phải là approve hoặc reject.", "#ef4444"),
            status_code=400,
        )

    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT EmployeeId, FullName, Email, ApprovalStatus, ApprovalExpiresAt
            FROM Accounts
            WHERE ApprovalToken = ? AND Role = 'lecturer'
            """,
            (token.strip(),),
        )
        row = cur.fetchone()
        if not row:
            return HTMLResponse(
                _render_review_html(
                    "Liên kết đã được dùng hoặc không tồn tại",
                    "Yêu cầu này đã được xử lý trước đó hoặc token không hợp lệ.",
                    "#f59e0b",
                ),
                status_code=404,
            )

        emp_id, full_name, email, status_val, expires_at = row
        if expires_at is not None:
            exp_dt = expires_at
            if isinstance(exp_dt, str):
                exp_dt = datetime.fromisoformat(exp_dt)
            if exp_dt.tzinfo is None:
                exp_dt = exp_dt.replace(tzinfo=timezone.utc)
            if datetime.now(timezone.utc) > exp_dt:
                return HTMLResponse(
                    _render_review_html(
                        "Liên kết đã hết hạn",
                        f"Yêu cầu của {full_name} ({emp_id}) đã quá 48 giờ.",
                        "#ef4444",
                    ),
                    status_code=410,
                )

        new_status = "approved" if norm_decision == "approve" else "rejected"
        cur.execute(
            """
            UPDATE Accounts
            SET ApprovalStatus = ?, ApprovalToken = NULL, ApprovalExpiresAt = NULL
            WHERE EmployeeId = ?
            """,
            (new_status, emp_id),
        )
        conn.commit()

        if new_status == "approved":
            return HTMLResponse(
                _render_review_html(
                    "✅ Đã phê duyệt Giảng viên",
                    f"Tài khoản {full_name} ({emp_id} · {email}) đã được kích hoạt và có thể đăng nhập Phần mềm Desktop.",
                    "#22c55e",
                )
            )
        return HTMLResponse(
            _render_review_html(
                "❌ Đã từ chối yêu cầu",
                f"Tài khoản {full_name} ({emp_id} · {email}) đã bị từ chối và không thể đăng nhập.",
                "#ef4444",
            )
        )
    finally:
        conn.close()


@app.get("/api/auth/session/{employee_id}")
def verify_session(employee_id: str):
    norm_id = employee_id.strip().upper()
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT a.EmployeeId, a.FullName, a.Email, a.Role, a.ClassId,
                   s.AvatarDataUrl, s.EmbeddingCreated,
                   (SELECT COUNT(*) FROM FaceEmbeddings f WHERE f.StudentId = a.EmployeeId) AS FaceCount
            FROM Accounts a
            LEFT JOIN StudentProfiles s ON s.StudentId = a.EmployeeId
            WHERE UPPER(a.EmployeeId) = ?
            """,
            (norm_id,),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Tài khoản chưa tồn tại trong SQL Server.")
        has_face = bool(row[6]) and (row[7] or 0) > 0
        return {
            "valid": True,
            "profile": {
                "id": row[0],
                "fullName": row[1],
                "email": row[2],
                "role": row[3],
                "classId": row[4] or ("FACULTY" if row[3] == "lecturer" else "CNTT-K21A"),
                "avatar": row[5],
                "embeddingCreated": has_face,
            },
        }
    finally:
        conn.close()


@app.post("/api/auth/login")
def login_account(payload: LoginRequest):
    query = payload.identifier.strip()
    if not query:
        return {
            "success": False,
            "field": "username",
            "message": "Vui lòng nhập email hoặc mã sinh viên!",
        }

    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT a.EmployeeId, a.FullName, a.Email, a.Role, a.ClassId, a.PasswordHash,
                   s.AvatarDataUrl, s.EmbeddingCreated,
                   (SELECT COUNT(*) FROM FaceEmbeddings f WHERE f.StudentId = a.EmployeeId) AS FaceCount,
                   COALESCE(a.ApprovalStatus, 'approved') AS ApprovalStatus
            FROM Accounts a
            LEFT JOIN StudentProfiles s ON s.StudentId = a.EmployeeId
            WHERE LOWER(a.Email) = ? OR UPPER(a.EmployeeId) = ?
            """,
            (query.lower(), query.upper()),
        )
        row = cur.fetchone()
        if not row:
            return {
                "success": False,
                "field": "username",
                "message": "Tài khoản hoặc mã nhân viên không tồn tại. Vui lòng đăng ký trước!",
            }

        if not verify_password(payload.password, row[5]):
            return {
                "success": False,
                "field": "password",
                "message": "Mật khẩu không chính xác. Vui lòng thử lại!",
            }

        approval_status = (row[9] or "approved").lower()
        if approval_status == "pending":
            return {
                "success": False,
                "field": "username",
                "message": "Tài khoản giảng viên đang chờ Admin phê duyệt qua email.",
            }
        if approval_status == "rejected":
            return {
                "success": False,
                "field": "username",
                "message": "Yêu cầu đăng ký tài khoản giảng viên đã bị từ chối.",
            }

        has_face = bool(row[7]) and (row[8] or 0) > 0
        return {
            "success": True,
            "account": {
                "employeeId": row[0],
                "fullName": row[1],
                "email": row[2],
                "role": row[3],
                "classId": row[4] or ("FACULTY" if row[3] == "lecturer" else "CNTT-K21A"),
                "avatar": row[6],
                "embeddingCreated": has_face,
            },
        }
    finally:
        conn.close()


@app.post("/api/auth/face-login")
def face_login(payload: FaceLoginRequest):
    if len(payload.descriptor) != 128:
        raise HTTPException(status_code=400, detail="Vector khuôn mặt phải có đúng 128 chiều.")

    live_vec = [float(x) for x in payload.descriptor]
    conn = get_connection()
    try:
        cur = conn.cursor()
        base_sql = """
            SELECT f.StudentId, f.DescriptorJson, s.FullName, s.ClassId, s.Email, s.AvatarDataUrl, a.Role
            FROM FaceEmbeddings f
            INNER JOIN StudentProfiles s ON s.StudentId = f.StudentId
            LEFT JOIN Accounts a ON a.EmployeeId = f.StudentId
            """
        if payload.requiredRole:
            cur.execute(
                base_sql + " WHERE LOWER(COALESCE(a.Role, 'student')) = LOWER(?)",
                (payload.requiredRole.strip(),),
            )
        else:
            cur.execute(base_sql)
        rows = cur.fetchall()
        if not rows:
            return {"matched": False, "distance": None, "hasEnrolled": False}

        best_row = None
        min_dist = float("inf")
        for row in rows:
            try:
                stored = json.loads(row[1])
                if not isinstance(stored, list) or len(stored) != 128:
                    continue
                dist = math.sqrt(sum((a - b) ** 2 for a, b in zip(live_vec, stored)))
                if dist < min_dist:
                    min_dist = dist
                    best_row = row
            except Exception:
                continue

        if not best_row or min_dist > payload.maxDistance:
            return {
                "matched": False,
                "hasEnrolled": True,
                "distance": min_dist if math.isfinite(min_dist) else None,
            }

        confidence_pct = f"{min(99.9, max(50.0, (1.0 - min_dist * 0.65) * 100.0)):.1f}%"
        return {
            "matched": True,
            "hasEnrolled": True,
            "distance": min_dist,
            "confidence": confidence_pct,
            "account": {
                "id": best_row[0],
                "fullName": best_row[2],
                "classId": best_row[3] or "CNTT-K21A",
                "email": best_row[4],
                "avatar": best_row[5],
                "role": best_row[6] or "student",
                "embeddingCreated": True,
            },
        }
    finally:
        conn.close()


def _format_class_row(row: tuple[Any, ...], total_students: int = 0, expected_total: int = 0) -> dict[str, Any]:
    exp = expected_total if expected_total > 0 else total_students
    return {
        "id": row[0],
        "className": row[1],
        "joinCode": row[2],
        "semester": row[3],
        "lecturerId": row[4],
        "lecturerName": row[5],
        "scheduleText": row[6] or "",
        "roomText": row[7] or "",
        "totalStudents": total_students,
        "expectedTotal": max(exp, total_students),
    }


@app.get("/api/classes")
def get_classes():
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT c.Id, c.ClassName, c.JoinCode, c.Semester, c.LecturerId, c.LecturerName,
                   c.ScheduleText, c.RoomText, COUNT(m.Id) AS TotalStudents
            FROM Classes c
            LEFT JOIN ClassMembers m ON m.ClassId = c.Id
            GROUP BY c.Id, c.ClassName, c.JoinCode, c.Semester, c.LecturerId, c.LecturerName, c.ScheduleText, c.RoomText, c.CreatedAt
            ORDER BY c.CreatedAt DESC
            """
        )
        return [_format_class_row(row, int(row[8] or 0)) for row in cur.fetchall()]
    finally:
        conn.close()


@app.post("/api/classes")
def create_class(payload: CreateClassRequest):
    lecturer_id = payload.lecturerId.strip().upper()
    raw_code = (payload.joinCode or "").strip().upper()
    join_code = raw_code if raw_code else f"WQ-{secrets.token_hex(2).upper()}"
    class_id = join_code

    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT EmployeeId, FullName, Role FROM Accounts WHERE UPPER(EmployeeId) = ?",
            (lecturer_id,),
        )
        lecturer = cur.fetchone()
        if not lecturer:
            raise HTTPException(status_code=404, detail=f"Không tìm thấy tài khoản giảng viên {lecturer_id}.")
        if str(lecturer[2] or "").lower() != "lecturer":
            raise HTTPException(status_code=403, detail="Chỉ tài khoản Giảng viên mới có quyền tạo lớp học.")

        cur.execute("SELECT Id FROM Classes WHERE UPPER(JoinCode) = ? OR UPPER(Id) = ?", (join_code, class_id))
        if cur.fetchone():
            raise HTTPException(status_code=409, detail=f"Mã lớp {join_code} đã tồn tại. Vui lòng chọn mã khác.")

        roster_map: dict[str, tuple[str, str]] = {}
        for entry in payload.rosterEntries or []:
            rsid = re.sub(r"[\x00-\x1f\x7f]+", "", str(entry.studentId or "")).strip().upper()
            if rsid and rsid not in roster_map:
                roster_map[rsid] = (str(entry.fullName or "").strip(), str(entry.email or "").strip().lower())
        for raw_sid in payload.studentIds or []:
            rsid = re.sub(r"[\x00-\x1f\x7f]+", "", str(raw_sid or "")).strip().upper()
            if rsid and rsid not in roster_map:
                roster_map[rsid] = ("", "")

        expected_total = max(int(payload.expectedTotal or 0), len(roster_map), len(payload.studentIds or []))
        cur.execute(
            """
            INSERT INTO Classes (Id, ClassName, JoinCode, Semester, LecturerId, LecturerName, ScheduleText, RoomText, ExpectedTotal)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                class_id,
                payload.className.strip(),
                join_code,
                payload.semester.strip() or "HK1 2025-2026",
                lecturer[0],
                lecturer[1],
                payload.scheduleText.strip(),
                payload.roomText.strip(),
                expected_total,
            ),
        )

        for rsid, (rname, remail) in roster_map.items():
            cur.execute(
                """
                INSERT INTO ClassRoster (ClassId, StudentId, FullName, Email)
                VALUES (?, ?, ?, ?)
                ON CONFLICT (ClassId, StudentId) DO UPDATE
                SET FullName = EXCLUDED.FullName, Email = EXCLUDED.Email
                """,
                (class_id, rsid, rname, remail),
            )

        conn.commit()
        return {
            "id": class_id,
            "className": payload.className.strip(),
            "joinCode": join_code,
            "semester": payload.semester.strip() or "HK1 2025-2026",
            "lecturerId": lecturer[0],
            "lecturerName": lecturer[1],
            "scheduleText": payload.scheduleText.strip(),
            "roomText": payload.roomText.strip(),
            "totalStudents": 0,
            "expectedTotal": expected_total,
        }
    finally:
        conn.close()


@app.get("/api/lecturers/{lecturer_id}/classes")
def get_lecturer_classes(lecturer_id: str):
    lid = lecturer_id.strip().upper()
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT c.Id, c.ClassName, c.JoinCode, c.Semester, c.LecturerId, c.LecturerName,
                   c.ScheduleText, c.RoomText, COUNT(m.Id) AS TotalStudents, c.ExpectedTotal
            FROM Classes c
            LEFT JOIN ClassMembers m ON m.ClassId = c.Id
            WHERE UPPER(c.LecturerId) = ?
            GROUP BY c.Id, c.ClassName, c.JoinCode, c.Semester, c.LecturerId, c.LecturerName, c.ScheduleText, c.RoomText, c.ExpectedTotal, c.CreatedAt
            ORDER BY c.CreatedAt DESC
            """,
            (lid,),
        )
        return [_format_class_row(row, int(row[8] or 0), int(row[9] or 0)) for row in cur.fetchall()]
    finally:
        conn.close()


@app.delete("/api/classes/{class_id}")
def delete_class(class_id: str):
    cid = class_id.strip().upper()
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute("DELETE FROM Classes WHERE UPPER(Id) = ?", (cid,))
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Không tìm thấy lớp học để xóa.")
        conn.commit()
        return {"deleted": True, "id": cid}
    finally:
        conn.close()


@app.get("/api/students/{student_id}/classes")
def get_student_classes(student_id: str):
    sid = student_id.strip().upper()
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT c.Id, c.ClassName, c.JoinCode, c.Semester, c.LecturerId, c.LecturerName,
                   c.ScheduleText, c.RoomText,
                   (SELECT COUNT(*) FROM ClassMembers cm WHERE cm.ClassId = c.Id) AS TotalStudents
            FROM ClassMembers m
            INNER JOIN Classes c ON c.Id = m.ClassId
            WHERE UPPER(m.StudentId) = ?
            ORDER BY m.JoinedAt DESC
            """,
            (sid,),
        )
        return [_format_class_row(row, int(row[8] or 0)) for row in cur.fetchall()]
    finally:
        conn.close()


def _norm_vi_name(name: str) -> str:
    return re.sub(r"\s+", " ", (name or "").strip()).lower()


@app.post("/api/students/{student_id}/classes/join")
def join_class_by_code(student_id: str, payload: JoinClassRequest):
    sid = student_id.strip().upper()
    code = payload.joinCode.strip().upper()
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT EmployeeId, FullName, Email FROM Accounts WHERE UPPER(EmployeeId) = ?", (sid,))
        acc = cur.fetchone()
        if not acc:
            raise HTTPException(status_code=404, detail=f"Không tìm thấy tài khoản sinh viên {sid}.")

        cur.execute(
            """
            SELECT Id, ClassName, JoinCode, Semester, LecturerId, LecturerName, ScheduleText, RoomText, ExpectedTotal
            FROM Classes
            WHERE UPPER(JoinCode) = ? OR UPPER(Id) = ?
            """,
            (code, code),
        )
        cls_row = cur.fetchone()
        if not cls_row:
            raise HTTPException(
                status_code=404,
                detail=f"Không tìm thấy lớp học với mã '{code}'. Vui lòng kiểm tra lại mã từ giảng viên.",
            )

        cur.execute(
            "SELECT Id FROM ClassMembers WHERE UPPER(ClassId) = ? AND UPPER(StudentId) = ?",
            (cls_row[0].upper(), acc[0].upper()),
        )
        if cur.fetchone():
            raise HTTPException(status_code=409, detail=f"Bạn đã tham gia lớp {cls_row[1]} ({cls_row[2]}) rồi.")

        # Kiểm tra danh sách Excel (ClassRoster) nếu giảng viên đã import danh sách khi tạo lớp
        cur.execute("SELECT COUNT(*) FROM ClassRoster WHERE UPPER(ClassId) = ?", (cls_row[0].upper(),))
        roster_total = int((cur.fetchone() or [0])[0] or 0)
        if roster_total > 0:
            cur.execute(
                "SELECT StudentId, FullName, Email FROM ClassRoster WHERE UPPER(ClassId) = ? AND UPPER(StudentId) = ?",
                (cls_row[0].upper(), acc[0].upper()),
            )
            r_row = cur.fetchone()
            if not r_row:
                raise HTTPException(
                    status_code=403,
                    detail=f"MSSV {acc[0]} không có trong danh sách sinh viên của lớp {cls_row[1]}. Không được phép tham gia lớp!",
                )
            roster_name = str(r_row[1] or "").strip()
            acc_name = str(acc[1] or "").strip()
            if roster_name and _norm_vi_name(acc_name) != _norm_vi_name(roster_name):
                raise HTTPException(
                    status_code=403,
                    detail=f"Thông tin họ tên tài khoản ({acc_name}) không khớp với danh sách lớp ({roster_name}). Không thể tham gia lớp!",
                )
            roster_email = str(r_row[2] or "").strip().lower()
            acc_email = str(acc[2] or "").strip().lower()
            if roster_email and acc_email and acc_email != roster_email:
                raise HTTPException(
                    status_code=403,
                    detail=f"Email tài khoản ({acc_email}) không khớp với danh sách lớp ({roster_email}). Không thể tham gia lớp!",
                )

        cur.execute("SELECT COUNT(*) FROM ClassMembers WHERE ClassId = ?", (cls_row[0],))
        current_count = int((cur.fetchone() or [0])[0] or 0)
        expected_cap = int(cls_row[8] or 0)
        if expected_cap > 0 and current_count >= expected_cap:
            raise HTTPException(
                status_code=403,
                detail=f"Lớp {cls_row[1]} đã đủ sĩ số tối đa ({current_count}/{expected_cap}).",
            )

        cur.execute(
            "INSERT INTO ClassMembers (ClassId, StudentId) VALUES (?, ?)",
            (cls_row[0], acc[0]),
        )
        total = current_count + 1
        conn.commit()
        return _format_class_row(cls_row, total, expected_cap)
    finally:
        conn.close()


@app.delete("/api/students/{student_id}/classes/{class_id}")
def leave_class(student_id: str, class_id: str):
    sid = student_id.strip().upper()
    cid = class_id.strip().upper()
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            "DELETE FROM ClassMembers WHERE UPPER(StudentId) = ? AND UPPER(ClassId) = ?",
            (sid, cid),
        )
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Bạn chưa tham gia lớp học này.")
        conn.commit()
        return {"left": True, "classId": cid}
    finally:
        conn.close()


@app.post("/api/students/lookup")
def lookup_students(payload: LookupStudentsRequest):
    cleaned: list[str] = []
    seen: set[str] = set()
    for raw in payload.studentIds:
        sid = re.sub(r"[\x00-\x1f\x7f]+", "", str(raw or "")).strip().upper()
        if sid and sid not in seen:
            seen.add(sid)
            cleaned.append(sid)

    if not cleaned:
        return []

    last_exc: Exception | None = None
    for attempt in range(2):
        conn = get_connection()
        try:
            cur = conn.cursor()
            if DB_ENGINE == "postgresql":
                cur.execute(
                    """
                    SELECT a.EmployeeId, a.FullName, a.Email, a.Role,
                           COALESCE(s.EmbeddingCreated, 0) AS EmbeddingCreated
                    FROM Accounts a
                    LEFT JOIN StudentProfiles s ON UPPER(s.StudentId) = UPPER(a.EmployeeId)
                    WHERE UPPER(a.EmployeeId) = ANY(?)
                    """,
                    (cleaned,),
                )
            else:
                placeholders = ",".join("?" for _ in cleaned)
                cur.execute(
                    f"""
                    SELECT a.EmployeeId, a.FullName, a.Email, a.Role,
                           COALESCE(s.EmbeddingCreated, 0) AS EmbeddingCreated
                    FROM Accounts a
                    LEFT JOIN StudentProfiles s ON UPPER(s.StudentId) = UPPER(a.EmployeeId)
                    WHERE UPPER(a.EmployeeId) IN ({placeholders})
                    """,
                    tuple(cleaned),
                )
            found = {}
            for row in cur.fetchall():
                found[str(row[0]).upper()] = {
                    "id": row[0],
                    "exists": True,
                    "fullName": row[1],
                    "email": row[2],
                    "role": row[3] or "student",
                    "embeddingCreated": bool(row[4]),
                }

            return [
                found.get(
                    sid,
                    {
                        "id": sid,
                        "exists": False,
                        "fullName": "Không xác định",
                        "email": "",
                        "role": "",
                        "embeddingCreated": False,
                    },
                )
                for sid in cleaned
            ]
        except Exception as exc:
            last_exc = exc
            if hasattr(conn, "mark_broken"):
                conn.mark_broken()
            if attempt == 0:
                continue
        finally:
            conn.close()

    raise HTTPException(
        status_code=500,
        detail=f"Lookup error ({type(last_exc).__name__}): {last_exc}",
    )


@app.get("/api/classes/{class_id}/students")
def get_class_students(class_id: str):
    cid = class_id.strip().upper()
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT a.EmployeeId, a.FullName, a.Email,
                   COALESCE(s.EmbeddingCreated, 0) AS EmbeddingCreated,
                   s.AvatarDataUrl, m.JoinedAt
            FROM ClassMembers m
            INNER JOIN Accounts a ON UPPER(a.EmployeeId) = UPPER(m.StudentId)
            LEFT JOIN StudentProfiles s ON UPPER(s.StudentId) = UPPER(m.StudentId)
            WHERE UPPER(m.ClassId) = ?
            ORDER BY m.JoinedAt DESC
            """,
            (cid,),
        )
        return [
            {
                "id": row[0],
                "fullName": row[1],
                "email": row[2],
                "embeddingCreated": bool(row[3]),
                "avatar": row[4],
                "joinedAt": row[5].isoformat() if hasattr(row[5], "isoformat") else str(row[5] or ""),
            }
            for row in cur.fetchall()
        ]
    finally:
        conn.close()


@app.get("/api/classes/{class_id}/face-descriptors")
def get_class_face_descriptors(class_id: str):
    cid = class_id.strip().upper()
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT a.EmployeeId, a.FullName, s.AvatarDataUrl, f.DescriptorJson
            FROM ClassMembers m
            INNER JOIN Accounts a ON UPPER(a.EmployeeId) = UPPER(m.StudentId)
            INNER JOIN FaceEmbeddings f ON UPPER(f.StudentId) = UPPER(m.StudentId)
            LEFT JOIN StudentProfiles s ON UPPER(s.StudentId) = UPPER(m.StudentId)
            WHERE UPPER(m.ClassId) = ?
            ORDER BY a.EmployeeId ASC
            """,
            (cid,),
        )
        grouped: dict[str, dict[str, Any]] = {}
        for row in cur.fetchall():
            sid = str(row[0])
            key = sid.upper()
            try:
                desc = json.loads(row[3]) if row[3] else None
            except Exception:
                desc = None
            if not isinstance(desc, list) or len(desc) != 128:
                continue
            if key not in grouped:
                grouped[key] = {
                    "studentId": sid,
                    "fullName": row[1] or sid,
                    "avatar": row[2],
                    "descriptors": [],
                }
            grouped[key]["descriptors"].append([float(v) for v in desc])
        return list(grouped.values())
    finally:
        conn.close()


@app.get("/api/lecturers/{lecturer_id}/attendance-summary")
def get_lecturer_attendance_summary(lecturer_id: str):
    lid = lecturer_id.strip().upper()
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT COUNT(DISTINCT al.ClassId)
            FROM AttendanceLogs al
            INNER JOIN Classes c ON UPPER(c.Id) = UPPER(al.ClassId)
            WHERE UPPER(c.LecturerId) = ? AND al.ScannedDate = CURRENT_DATE
            """,
            (lid,),
        )
        today_sessions = int((cur.fetchone() or [0])[0])

        cur.execute(
            """
            SELECT al.Id, al.StudentId, al.StudentName, al.ClassId, c.ClassName,
                   al.Confidence, al.Device, al.TimestampText
            FROM AttendanceLogs al
            INNER JOIN Classes c ON UPPER(c.Id) = UPPER(al.ClassId)
            WHERE UPPER(c.LecturerId) = ?
            ORDER BY al.CreatedAt DESC
            LIMIT 100
            """,
            (lid,),
        )
        logs = [
            {
                "id": row[0],
                "studentId": row[1],
                "studentName": row[2],
                "classId": row[3],
                "className": row[4],
                "confidence": row[5],
                "device": row[6],
                "timestamp": row[7],
            }
            for row in cur.fetchall()
        ]
        return {"todaySessions": today_sessions, "logs": logs}
    finally:
        conn.close()


@app.get("/api/students")
def list_students(includeSnapshots: bool = Query(default=False)):
    conn = get_connection()
    try:
        cur = conn.cursor()
        return build_student_payloads(cur, include_snapshots=includeSnapshots)
    finally:
        conn.close()


@app.get("/api/students/{student_id}")
def get_student(student_id: str):
    conn = get_connection()
    try:
        cur = conn.cursor()
        rows = build_student_payloads(cur, student_id, include_snapshots=True)
        if not rows:
            raise HTTPException(status_code=404, detail="Không tìm thấy hồ sơ sinh viên.")
        return rows[0]
    finally:
        conn.close()


@app.post("/api/students/enroll")
def enroll_student_face(payload: EnrollFaceRequest):
    student_id = payload.id.strip().upper()
    desc_map = normalize_descriptor_map(payload.descriptors)
    snapshots = payload.angleSnapshots or {}
    if payload.avatar and len(payload.avatar) > MAX_SNAPSHOT_LEN:
        raise HTTPException(status_code=413, detail="Ảnh đại diện vượt quá dung lượng cho phép.")
    for angle_key, snap in snapshots.items():
        if snap and len(snap) > MAX_SNAPSHOT_LEN:
            raise HTTPException(status_code=413, detail=f"Ảnh góc '{angle_key}' vượt quá dung lượng cho phép.")
    avatar = payload.avatar or snapshots.get("straight") or next(iter(snapshots.values()), None)
    registered_at = payload.registeredAt or datetime.now().strftime("%d/%m/%Y, %H:%M:%S")

    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT StudentId, FullName, ClassId, Email, EmbeddingCreated FROM StudentProfiles WHERE UPPER(StudentId) = ?",
            (student_id,),
        )
        existing = cur.fetchone()
        if not existing:
            cur.execute(
                "SELECT EmployeeId, FullName, ClassId, Email FROM Accounts WHERE UPPER(EmployeeId) = ?",
                (student_id,),
            )
            acc = cur.fetchone()
            if not acc:
                raise HTTPException(
                    status_code=404,
                    detail=f"Tài khoản {student_id} chưa tồn tại. Vui lòng đăng ký tài khoản trước.",
                )
            cur.execute(
                "INSERT INTO StudentProfiles (StudentId, FullName, ClassId, Email, EmbeddingCreated) VALUES (?, ?, ?, ?, 0)",
                (acc[0], acc[1], acc[2] or "LECTURER", acc[3] or ""),
            )
            existing = (acc[0], acc[1], acc[2] or "LECTURER", acc[3] or "", 0)

        # 1) Khóa chống fake: đã đăng ký khuôn mặt rồi thì không cho cập nhật/ghi đè lại
        cur.execute("SELECT COUNT(*) FROM FaceEmbeddings WHERE UPPER(StudentId) = ?", (student_id,))
        face_count = int((cur.fetchone() or [0])[0] or 0)
        if bool(existing[4]) or face_count > 0:
            raise HTTPException(
                status_code=409,
                detail="Tài khoản này đã đăng ký khuôn mặt và được khóa chống giả mạo, không thể cập nhật lại gương mặt.",
            )

        # 2) Kiểm tra 5 góc phải thuộc cùng 1 người (tránh tráo mặt giữa các góc)
        primary_vec = desc_map.get("straight") or next(iter(desc_map.values()), None)
        if primary_vec:
            for angle_key, vec in desc_map.items():
                if len(vec) == len(primary_vec):
                    angle_dist = math.sqrt(sum((a - b) ** 2 for a, b in zip(primary_vec, vec)))
                    if angle_dist > 0.62:
                        raise HTTPException(
                            status_code=400,
                            detail=f"Dữ liệu khuôn mặt ở góc '{angle_key}' không khớp với khuôn mặt chính. Vui lòng quét lại bằng cùng một người.",
                        )

        # 3) Chống dùng 1 gương mặt đăng ký cho nhiều sinh viên / nhiều tài khoản
        if primary_vec:
            cur.execute(
                """
                SELECT f.StudentId, COALESCE(s.FullName, f.StudentId), f.DescriptorJson
                FROM FaceEmbeddings f
                LEFT JOIN StudentProfiles s ON UPPER(s.StudentId) = UPPER(f.StudentId)
                WHERE UPPER(f.StudentId) <> ?
                """,
                (student_id,),
            )
            for other_id, other_name, other_json in cur.fetchall():
                try:
                    other_vec = json.loads(other_json or "[]")
                except Exception:
                    continue
                if not isinstance(other_vec, list) or len(other_vec) != len(primary_vec):
                    continue
                dist = math.sqrt(sum((a - float(b)) ** 2 for a, b in zip(primary_vec, other_vec)))
                if dist < 0.50:
                    raise HTTPException(
                        status_code=409,
                        detail=f"Khuôn mặt này đã được đăng ký cho sinh viên/tài khoản khác ({other_name} - {other_id}). Mỗi gương mặt chỉ được đăng ký cho 1 sinh viên duy nhất!",
                    )

        full_name = (payload.name or existing[1]).strip()
        class_id = (payload.classId or existing[2] or "CNTT-K21A").strip()
        email = (payload.email or existing[3]).strip().lower()

        cur.execute(
            """
            UPDATE StudentProfiles
            SET FullName = ?,
                ClassId = ?,
                Email = ?,
                AvatarDataUrl = COALESCE(?, AvatarDataUrl),
                EmbeddingCreated = 1,
                RegisteredAt = ?,
                UpdatedAt = CURRENT_TIMESTAMP
            WHERE UPPER(StudentId) = ?
            """,
            (full_name, class_id, email, avatar, registered_at, student_id),
        )

        cur.execute("DELETE FROM FaceEmbeddings WHERE UPPER(StudentId) = ?", (student_id,))
        for angle_key, vec in desc_map.items():
            cur.execute(
                """
                INSERT INTO FaceEmbeddings (StudentId, AngleKey, DescriptorJson, SnapshotDataUrl)
                VALUES (?, ?, ?, ?)
                """,
                (
                    existing[0],
                    angle_key,
                    json.dumps(vec),
                    snapshots.get(angle_key),
                ),
            )

        conn.commit()
        rows = build_student_payloads(cur, existing[0])
        return {"success": True, "student": rows[0]}
    except HTTPException:
        conn.rollback()
        raise
    except Exception as exc:
        conn.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Save session error ({type(exc).__name__}): {exc}",
        )
    finally:
        conn.close()


@app.delete("/api/students/{student_id}")
def delete_student(student_id: str):
    norm_id = student_id.strip().upper()
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute("DELETE FROM Accounts WHERE UPPER(EmployeeId) = ?", (norm_id,))
        conn.commit()
        return {"success": True, "students": build_student_payloads(cur)}
    except Exception as exc:
        conn.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Save session error ({type(exc).__name__}): {exc}",
        )
    finally:
        conn.close()


@app.get("/api/attendance")
def list_attendance(classId: str | None = Query(default=None)):
    conn = get_connection()
    try:
        cur = conn.cursor()
        if classId and classId != "ALL":
            cur.execute(
                """
                SELECT Id, StudentId, StudentName, ClassId, TimestampText, Confidence, AvatarDataUrl, Device
                FROM AttendanceLogs
                WHERE ClassId = ?
                ORDER BY CreatedAt DESC
                """,
                (classId,),
            )
        else:
            cur.execute(
                """
                SELECT Id, StudentId, StudentName, ClassId, TimestampText, Confidence, AvatarDataUrl, Device
                FROM AttendanceLogs
                ORDER BY CreatedAt DESC
                """
            )
        return [
            {
                "id": r[0],
                "studentId": r[1],
                "studentName": r[2],
                "classId": r[3],
                "timestamp": r[4],
                "confidence": r[5],
                "avatar": r[6],
                "device": r[7],
            }
            for r in cur.fetchall()
        ]
    finally:
        conn.close()


@app.post("/api/attendance")
def record_attendance(payload: AttendanceRequest):
    student_id = payload.studentId.strip().upper()
    today = date.today()
    today_str = today.isoformat()
    now_time = datetime.now().strftime("%H:%M:%S")
    ts_text = f"{now_time} {today_str}"
    att_id = f"ATT_{int(time.time() * 1000)}"

    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT Id, StudentId, StudentName, ClassId, TimestampText, Confidence, AvatarDataUrl, Device
            FROM AttendanceLogs
            WHERE UPPER(StudentId) = ? AND ClassId = ? AND ScannedDate = ?
            """,
            (student_id, payload.classId, today),
        )
        existing = cur.fetchone()
        if existing:
            return {
                "success": False,
                "message": "Sinh viên đã điểm danh hôm nay rồi!",
                "record": {
                    "id": existing[0],
                    "studentId": existing[1],
                    "studentName": existing[2],
                    "classId": existing[3],
                    "timestamp": existing[4],
                    "confidence": existing[5],
                    "avatar": existing[6],
                    "device": existing[7],
                },
            }

        cur.execute(
            """
            INSERT INTO AttendanceLogs
                (Id, StudentId, StudentName, ClassId, Confidence, AvatarDataUrl, Device, ScannedDate, TimestampText)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                att_id,
                student_id,
                payload.studentName,
                payload.classId,
                payload.confidence,
                payload.avatar,
                payload.device,
                today,
                ts_text,
            ),
        )
        conn.commit()
        return {
            "success": True,
            "message": "Điểm danh thành công!",
            "record": {
                "id": att_id,
                "studentId": student_id,
                "studentName": payload.studentName,
                "classId": payload.classId,
                "timestamp": ts_text,
                "confidence": payload.confidence,
                "avatar": payload.avatar,
                "device": payload.device,
            },
        }
    except Exception as exc:
        conn.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Save session error ({type(exc).__name__}): {exc}",
        )
    finally:
        conn.close()


@app.post("/api/attendance/sessions")
def save_attendance_session(payload: SaveAttendanceSessionRequest):
    session_id = f"SES_{int(time.time() * 1000)}_{secrets.token_hex(2).upper()}"
    today = date.today()
    ended_at = payload.endedAt.strip() or datetime.now().strftime("%H:%M:%S")
    started_at = payload.startedAt.strip() or ended_at
    details_json = json.dumps(payload.details, ensure_ascii=False)

    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO AttendanceSessions
                (Id, ClassId, ClassName, LecturerId, SessionDate, StartedAt, EndedAt,
                 TotalStudents, PresentCount, LateCount, AbsentCount, AttendanceRate, DetailsJson)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                session_id,
                payload.classId.strip().upper(),
                payload.className.strip(),
                payload.lecturerId.strip().upper(),
                today,
                started_at,
                ended_at,
                payload.totalStudents,
                payload.presentCount,
                payload.lateCount,
                payload.absentCount,
                payload.attendanceRate,
                details_json,
            ),
        )
        conn.commit()
        return {
            "success": True,
            "sessionId": session_id,
            "sessionDate": today.isoformat(),
            "startedAt": started_at,
            "endedAt": ended_at,
        }
    except Exception as exc:
        conn.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Save session error ({type(exc).__name__}): {exc}",
        )
    finally:
        conn.close()


@app.get("/api/lecturers/{lecturer_id}/attendance-sessions")
def get_lecturer_attendance_sessions(lecturer_id: str):
    lid = lecturer_id.strip().upper()
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT Id, ClassId, ClassName, SessionDate, StartedAt, EndedAt,
                   TotalStudents, PresentCount, LateCount, AbsentCount, AttendanceRate
            FROM AttendanceSessions
            WHERE UPPER(LecturerId) = ?
            ORDER BY CreatedAt DESC
            LIMIT 100
            """,
            (lid,),
        )
        return [
            {
                "id": r[0],
                "classId": r[1],
                "className": r[2],
                "sessionDate": r[3].isoformat() if hasattr(r[3], "isoformat") else str(r[3]),
                "startedAt": r[4],
                "endedAt": r[5],
                "totalStudents": r[6],
                "presentCount": r[7],
                "lateCount": r[8],
                "absentCount": r[9],
                "attendanceRate": r[10],
            }
            for r in cur.fetchall()
        ]
    finally:
        conn.close()


@app.get("/api/attendance/sessions/{session_id}")
def get_attendance_session_detail(session_id: str):
    sid = session_id.strip()
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT Id, ClassId, ClassName, SessionDate, StartedAt, EndedAt,
                   TotalStudents, PresentCount, LateCount, AbsentCount, AttendanceRate, DetailsJson
            FROM AttendanceSessions
            WHERE Id = ?
            """,
            (sid,),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Không tìm thấy buổi điểm danh.")

        class_id = row[1]
        session_date = row[3]
        details = json.loads(row[11] or "[]")

        # Enrich with Confidence, Device, AvatarDataUrl from AttendanceLogs & StudentProfiles
        cur.execute(
            """
            SELECT UPPER(l.StudentId), l.Confidence, l.Device, COALESCE(l.AvatarDataUrl, s.AvatarDataUrl)
            FROM AttendanceLogs l
            LEFT JOIN StudentProfiles s ON UPPER(s.StudentId) = UPPER(l.StudentId)
            WHERE UPPER(l.ClassId) = UPPER(?) AND l.ScannedDate = ?
            """,
            (class_id, session_date),
        )
        log_map = {}
        for lr in cur.fetchall():
            log_map[str(lr[0]).upper()] = {
                "confidence": lr[1] or "",
                "device": lr[2] or "Nhận diện khuôn mặt",
                "avatar": lr[3] or None,
            }

        enriched = []
        for idx, item in enumerate(details):
            st_id = str(item.get("studentId") or "").strip()
            meta = log_map.get(st_id.upper(), {})
            enriched.append(
                {
                    "stt": idx + 1,
                    "studentId": st_id,
                    "fullName": item.get("fullName") or st_id,
                    "status": item.get("status") or "absent",
                    "time": item.get("time") or "",
                    "confidence": item.get("confidence") or meta.get("confidence") or "",
                    "device": item.get("device") or meta.get("device") or ("Nhận diện khuôn mặt" if item.get("status") != "absent" else "—"),
                    "avatar": meta.get("avatar"),
                }
            )

        return {
            "id": row[0],
            "classId": class_id,
            "className": row[2],
            "sessionDate": session_date.isoformat() if hasattr(session_date, "isoformat") else str(session_date),
            "startedAt": row[4],
            "endedAt": row[5],
            "totalStudents": row[6],
            "presentCount": row[7],
            "lateCount": row[8],
            "absentCount": row[9],
            "attendanceRate": row[10],
            "details": enriched,
        }
    finally:
        conn.close()


@app.delete("/api/attendance")
def clear_attendance():
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute("DELETE FROM AttendanceLogs")
        conn.commit()
        return {"success": True}
    except Exception as exc:
        conn.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Save session error ({type(exc).__name__}): {exc}",
        )
    finally:
        conn.close()


@app.post("/api/migrate-legacy")
def migrate_legacy_data(payload: LegacyMigrateRequest):
    """Imports real existing accounts, 128-D face embeddings, and attendance logs from browser storage."""
    conn = get_connection()
    migrated = {"accounts": 0, "students": 0, "embeddings": 0, "attendance": 0}
    try:
        cur = conn.cursor()
        for acc in payload.accounts:
            emp_id = str(acc.get("employeeId") or "").strip().upper()
            email = str(acc.get("email") or "").strip().lower()
            full_name = str(acc.get("fullName") or "").strip()
            raw_pw = str(acc.get("password") or "")
            role = str(acc.get("role") or "student").strip().lower()
            if role not in ("student", "lecturer"):
                role = "student"
            class_id = "FACULTY" if role == "lecturer" else "CNTT-K21A"
            created_at = str(acc.get("createdAt") or datetime.now().strftime("%d/%m/%Y, %H:%M:%S"))
            if not emp_id or not email or not full_name or not raw_pw:
                continue

            cur.execute("SELECT 1 FROM Accounts WHERE UPPER(EmployeeId) = ? OR LOWER(Email) = ?", (emp_id, email))
            if not cur.fetchone():
                cur.execute(
                    """
                    INSERT INTO Accounts (EmployeeId, FullName, Email, Role, ClassId, PasswordHash)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (emp_id, full_name, email, role, class_id, hash_password(raw_pw)),
                )
                migrated["accounts"] += 1

            cur.execute("SELECT 1 FROM StudentProfiles WHERE UPPER(StudentId) = ?", (emp_id,))
            if not cur.fetchone():
                cur.execute(
                    """
                    INSERT INTO StudentProfiles (StudentId, FullName, ClassId, Email, AvatarDataUrl, EmbeddingCreated, RegisteredAt)
                    VALUES (?, ?, ?, ?, NULL, 0, ?)
                    """,
                    (emp_id, full_name, class_id, email, created_at),
                )

        for stu in payload.students:
            sid = str(stu.get("id") or "").strip().upper()
            if not sid:
                continue
            cur.execute("SELECT StudentId FROM StudentProfiles WHERE UPPER(StudentId) = ?", (sid,))
            if not cur.fetchone():
                continue

            descriptors = stu.get("descriptors") or []
            avatar = stu.get("avatar")
            class_id = str(stu.get("classId") or "CNTT-K21A").strip()
            reg_at = str(stu.get("registeredAt") or datetime.now().strftime("%d/%m/%Y, %H:%M:%S"))
            valid_vecs = [
                v for v in (descriptors.values() if isinstance(descriptors, dict) else descriptors)
                if isinstance(v, list) and len(v) == 128
            ]
            has_emb = bool(stu.get("embeddingCreated")) and len(valid_vecs) > 0

            cur.execute(
                """
                UPDATE StudentProfiles
                SET ClassId = ?,
                    AvatarDataUrl = COALESCE(?, AvatarDataUrl),
                    EmbeddingCreated = CASE WHEN ? = 1 THEN 1 ELSE EmbeddingCreated END,
                    RegisteredAt = COALESCE(?, RegisteredAt),
                    UpdatedAt = CURRENT_TIMESTAMP
                WHERE UPPER(StudentId) = ?
                """,
                (class_id, avatar, 1 if has_emb else 0, reg_at, sid),
            )
            migrated["students"] += 1

            if has_emb:
                cur.execute("SELECT COUNT(*) FROM FaceEmbeddings WHERE UPPER(StudentId) = ?", (sid,))
                if (cur.fetchone()[0] or 0) == 0:
                    items = (
                        list(descriptors.items())
                        if isinstance(descriptors, dict)
                        else [
                            (ANGLE_ORDER[idx] if idx < len(ANGLE_ORDER) else f"angle_{idx + 1}", vec)
                            for idx, vec in enumerate(descriptors)
                        ]
                    )
                    for angle_key, vec in items:
                        if not isinstance(vec, list) or len(vec) != 128:
                            continue
                        cur.execute(
                            """
                            INSERT INTO FaceEmbeddings (StudentId, AngleKey, DescriptorJson, SnapshotDataUrl)
                            VALUES (?, ?, ?, ?)
                            """,
                            (sid, angle_key, json.dumps([float(x) for x in vec]), avatar if angle_key == "straight" else None),
                        )
                        migrated["embeddings"] += 1

        conn.commit()
        return {"success": True, "migrated": migrated}
    except Exception as exc:
        conn.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Save session error ({type(exc).__name__}): {exc}",
        )
    finally:
        conn.close()


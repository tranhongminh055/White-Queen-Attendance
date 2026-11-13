import json
import math
import re
import time
from contextlib import asynccontextmanager
from datetime import date, datetime
from typing import Any

import pyodbc
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from db import SQLSERVER_DB, SQLSERVER_HOST, get_connection, init_database
from security import hash_password, verify_password

EMAIL_REGEX = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]{2,}$")
EMPLOYEE_ID_REGEX = re.compile(r"^[A-Za-z]{2,5}-?\d{3,6}$")

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
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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


def find_account_conflicts(cur: pyodbc.Cursor, norm_id: str, norm_email: str) -> dict[str, str]:
    conflicts: dict[str, str] = {}
    if norm_id:
        cur.execute(
            """
            SELECT TOP 1 EmployeeId FROM dbo.Accounts WHERE UPPER(EmployeeId) = ?
            UNION ALL
            SELECT TOP 1 StudentId FROM dbo.StudentProfiles WHERE UPPER(StudentId) = ?
            """,
            (norm_id, norm_id),
        )
        if cur.fetchone():
            conflicts["employeeId"] = f"Mã nhân viên {norm_id} đã được đăng ký trước đó."

    if norm_email:
        cur.execute(
            """
            SELECT TOP 1 Email FROM dbo.Accounts WHERE LOWER(Email) = ?
            UNION ALL
            SELECT TOP 1 Email FROM dbo.StudentProfiles WHERE LOWER(Email) = ?
            """,
            (norm_email, norm_email),
        )
        if cur.fetchone():
            conflicts["email"] = f"Email {norm_email} đã được đăng ký trước đó."

    return conflicts


def build_student_payloads(cur: pyodbc.Cursor, student_id: str | None = None) -> list[dict[str, Any]]:
    if student_id:
        cur.execute(
            """
            SELECT s.StudentId, s.FullName, s.ClassId, s.Email, s.AvatarDataUrl,
                   s.EmbeddingCreated, s.RegisteredAt, a.Role
            FROM dbo.StudentProfiles s
            LEFT JOIN dbo.Accounts a ON a.EmployeeId = s.StudentId
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
            FROM dbo.StudentProfiles s
            LEFT JOIN dbo.Accounts a ON a.EmployeeId = s.StudentId
            ORDER BY s.UpdatedAt DESC
            """
        )
    student_rows = cur.fetchall()
    if not student_rows:
        return []

    if student_id:
        cur.execute(
            """
            SELECT StudentId, AngleKey, DescriptorJson, SnapshotDataUrl
            FROM dbo.FaceEmbeddings
            WHERE UPPER(StudentId) = ?
            ORDER BY Id ASC
            """,
            (student_id.strip().upper(),),
        )
    else:
        cur.execute(
            """
            SELECT StudentId, AngleKey, DescriptorJson, SnapshotDataUrl
            FROM dbo.FaceEmbeddings
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
                (SELECT COUNT(*) FROM dbo.Accounts) AS AccountCount,
                (SELECT COUNT(*) FROM dbo.StudentProfiles) AS StudentCount,
                (SELECT COUNT(*) FROM dbo.FaceEmbeddings) AS FaceEmbeddingCount,
                (SELECT COUNT(*) FROM dbo.AttendanceLogs) AS AttendanceCount
            """
        )
        row = cur.fetchone()
        return {
            "status": "ok",
            "server": SQLSERVER_HOST,
            "database": SQLSERVER_DB,
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


@app.post("/api/auth/register")
def register_account(payload: RegisterRequest):
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

        cur.execute(
            """
            INSERT INTO dbo.Accounts (EmployeeId, FullName, Email, Role, ClassId, PasswordHash)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (norm_id, full_name, norm_email, role, class_id, pw_hash),
        )
        cur.execute(
            """
            INSERT INTO dbo.StudentProfiles (StudentId, FullName, ClassId, Email, AvatarDataUrl, EmbeddingCreated, RegisteredAt)
            VALUES (?, ?, ?, ?, NULL, 0, ?)
            """,
            (norm_id, full_name, class_id, norm_email, registered_at),
        )
        conn.commit()
        return {
            "success": True,
            "account": {
                "employeeId": norm_id,
                "fullName": full_name,
                "email": norm_email,
                "role": role,
                "classId": class_id,
                "createdAt": registered_at,
            },
        }
    except pyodbc.IntegrityError:
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
    except Exception:
        conn.rollback()
        raise
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
                   (SELECT COUNT(*) FROM dbo.FaceEmbeddings f WHERE f.StudentId = a.EmployeeId) AS FaceCount
            FROM dbo.Accounts a
            LEFT JOIN dbo.StudentProfiles s ON s.StudentId = a.EmployeeId
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
                   (SELECT COUNT(*) FROM dbo.FaceEmbeddings f WHERE f.StudentId = a.EmployeeId) AS FaceCount
            FROM dbo.Accounts a
            LEFT JOIN dbo.StudentProfiles s ON s.StudentId = a.EmployeeId
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
        cur.execute(
            """
            SELECT f.StudentId, f.DescriptorJson, s.FullName, s.ClassId, s.Email, s.AvatarDataUrl, a.Role
            FROM dbo.FaceEmbeddings f
            INNER JOIN dbo.StudentProfiles s ON s.StudentId = f.StudentId
            LEFT JOIN dbo.Accounts a ON a.EmployeeId = f.StudentId
            """
        )
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


@app.get("/api/classes")
def get_classes():
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT ClassId, COUNT(*) FROM dbo.StudentProfiles GROUP BY ClassId")
        counts = {row[0]: row[1] for row in cur.fetchall()}
        return [
            {**cls, "totalStudents": counts.get(cls["id"], 0)}
            for cls in DEFAULT_CLASSES
        ]
    finally:
        conn.close()


@app.get("/api/students")
def list_students():
    conn = get_connection()
    try:
        cur = conn.cursor()
        return build_student_payloads(cur)
    finally:
        conn.close()


@app.get("/api/students/{student_id}")
def get_student(student_id: str):
    conn = get_connection()
    try:
        cur = conn.cursor()
        rows = build_student_payloads(cur, student_id)
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
    avatar = payload.avatar or snapshots.get("straight") or next(iter(snapshots.values()), None)
    registered_at = payload.registeredAt or datetime.now().strftime("%d/%m/%Y, %H:%M:%S")

    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT StudentId, FullName, ClassId, Email FROM dbo.StudentProfiles WHERE UPPER(StudentId) = ?",
            (student_id,),
        )
        existing = cur.fetchone()
        if not existing:
            raise HTTPException(
                status_code=404,
                detail=f"Tài khoản {student_id} chưa tồn tại trong SQL Server. Vui lòng đăng ký tài khoản trước.",
            )

        full_name = (payload.name or existing[1]).strip()
        class_id = (payload.classId or existing[2] or "CNTT-K21A").strip()
        email = (payload.email or existing[3]).strip().lower()

        cur.execute(
            """
            UPDATE dbo.StudentProfiles
            SET FullName = ?,
                ClassId = ?,
                Email = ?,
                AvatarDataUrl = COALESCE(?, AvatarDataUrl),
                EmbeddingCreated = 1,
                RegisteredAt = ?,
                UpdatedAt = SYSUTCDATETIME()
            WHERE UPPER(StudentId) = ?
            """,
            (full_name, class_id, email, avatar, registered_at, student_id),
        )

        cur.execute("DELETE FROM dbo.FaceEmbeddings WHERE UPPER(StudentId) = ?", (student_id,))
        for angle_key, vec in desc_map.items():
            cur.execute(
                """
                INSERT INTO dbo.FaceEmbeddings (StudentId, AngleKey, DescriptorJson, SnapshotDataUrl)
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
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


@app.delete("/api/students/{student_id}")
def delete_student(student_id: str):
    norm_id = student_id.strip().upper()
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute("DELETE FROM dbo.Accounts WHERE UPPER(EmployeeId) = ?", (norm_id,))
        conn.commit()
        return {"success": True, "students": build_student_payloads(cur)}
    except Exception:
        conn.rollback()
        raise
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
                FROM dbo.AttendanceLogs
                WHERE ClassId = ?
                ORDER BY CreatedAt DESC
                """,
                (classId,),
            )
        else:
            cur.execute(
                """
                SELECT Id, StudentId, StudentName, ClassId, TimestampText, Confidence, AvatarDataUrl, Device
                FROM dbo.AttendanceLogs
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
            FROM dbo.AttendanceLogs
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
            INSERT INTO dbo.AttendanceLogs
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
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


@app.delete("/api/attendance")
def clear_attendance():
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute("DELETE FROM dbo.AttendanceLogs")
        conn.commit()
        return {"success": True}
    except Exception:
        conn.rollback()
        raise
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

            cur.execute("SELECT 1 FROM dbo.Accounts WHERE UPPER(EmployeeId) = ? OR LOWER(Email) = ?", (emp_id, email))
            if not cur.fetchone():
                cur.execute(
                    """
                    INSERT INTO dbo.Accounts (EmployeeId, FullName, Email, Role, ClassId, PasswordHash)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (emp_id, full_name, email, role, class_id, hash_password(raw_pw)),
                )
                migrated["accounts"] += 1

            cur.execute("SELECT 1 FROM dbo.StudentProfiles WHERE UPPER(StudentId) = ?", (emp_id,))
            if not cur.fetchone():
                cur.execute(
                    """
                    INSERT INTO dbo.StudentProfiles (StudentId, FullName, ClassId, Email, AvatarDataUrl, EmbeddingCreated, RegisteredAt)
                    VALUES (?, ?, ?, ?, NULL, 0, ?)
                    """,
                    (emp_id, full_name, class_id, email, created_at),
                )

        for stu in payload.students:
            sid = str(stu.get("id") or "").strip().upper()
            if not sid:
                continue
            cur.execute("SELECT StudentId FROM dbo.StudentProfiles WHERE UPPER(StudentId) = ?", (sid,))
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
                UPDATE dbo.StudentProfiles
                SET ClassId = ?,
                    AvatarDataUrl = COALESCE(?, AvatarDataUrl),
                    EmbeddingCreated = CASE WHEN ? = 1 THEN 1 ELSE EmbeddingCreated END,
                    RegisteredAt = COALESCE(?, RegisteredAt),
                    UpdatedAt = SYSUTCDATETIME()
                WHERE UPPER(StudentId) = ?
                """,
                (class_id, avatar, 1 if has_emb else 0, reg_at, sid),
            )
            migrated["students"] += 1

            if has_emb:
                cur.execute("SELECT COUNT(*) FROM dbo.FaceEmbeddings WHERE UPPER(StudentId) = ?", (sid,))
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
                            INSERT INTO dbo.FaceEmbeddings (StudentId, AngleKey, DescriptorJson, SnapshotDataUrl)
                            VALUES (?, ?, ?, ?)
                            """,
                            (sid, angle_key, json.dumps([float(x) for x in vec]), avatar if angle_key == "straight" else None),
                        )
                        migrated["embeddings"] += 1

        conn.commit()
        return {"success": True, "migrated": migrated}
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


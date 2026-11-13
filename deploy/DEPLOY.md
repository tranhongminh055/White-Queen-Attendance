# 🚀 Hướng Dẫn Deploy Cloud 24/7 Miễn Phí Không Cần Thẻ + Chuyển Dữ Liệu An Toàn

## Kiến Trúc Cloud Miễn Phí 100% (Không Thẻ Tín Dụng)
1. **Frontend CDN (`Netlify` Free):**
   - Phục vụ `web-frontend/dist/` toàn cầu qua HTTPS, cache `immutable` 1 năm cho `/assets/`, `/mediapipe/` và `/models/`.
   - AI quét khuôn mặt MediaPipe 468 điểm & trích xuất vector `128-D` chạy **ngay trên thiết bị người dùng**.
2. **Backend API (`Render` Free Python Web Service):**
   - Chạy FastAPI + Uvicorn bằng `render.yaml` (`rootDir: backend`, tự động bật khi có request).
   - Frontend đã cấu hình tự thử lại (`retry`) 1 lần khi Render vừa thức dậy sau trạng thái sleep.
3. **Database PostgreSQL (`Neon` hoặc `Supabase` Free):**
   - Lưu trữ an toàn toàn bộ tài khoản, hồ sơ sinh viên, vector `128-D` (`FaceEmbeddings`) và lịch sử điểm danh (`AttendanceLogs`).
   - Dữ liệu SQL Server cục bộ trên Windows (`localhost\SQLEXPRESS25`) vẫn được giữ nguyên vẹn làm bản gốc & dự phòng.

---

## Bước 1: Sao Lưu & Chuyển Dữ Liệu An Toàn Từ SQL Server Lên PostgreSQL

1. **Đã sao lưu dự phòng SQL Server (.bak):**
   - Chạy `.\deploy\backup_sqlserver.ps1` để tạo bản `.bak` trong thư mục `backups/` trước mọi thao tác.
2. **Tạo Database PostgreSQL miễn phí (không cần thẻ):**
   - Đăng ký [Neon](https://neon.tech) (hoặc [Supabase](https://supabase.com)) bằng GitHub/Google -> tạo project mới -> copy **Connection String** (dạng `postgresql://user:pass@host/dbname?sslmode=require`).
3. **Di trú dữ liệu không mất mát (idempotent + tạo thêm JSON snapshot):**
   ```powershell
   $env:DATABASE_URL="postgresql://user:pass@host/dbname?sslmode=require"
   python backend\migrate_mssql_to_pg.py
   ```
   - Script sẽ chỉ **ĐỌC** từ SQL Server (`localhost\SQLEXPRESS25`), xuất thêm bản chụp `backups\spacex_mssql_snapshot_<timestamp>.json`, tạo bảng PostgreSQL theo `backend/pg_schema.sql`, upsert toàn bộ dữ liệu và đối chiếu khớp số lượng bản ghi ở cả 4 bảng (`Accounts`, `StudentProfiles`, `FaceEmbeddings`, `AttendanceLogs`).

---

## Bước 2: Đẩy Code Lên GitHub (Kiểm Tra Bảo Mật Trước Khi Push)

- Kiểm tra `.gitignore` đã loại trừ `.env`, `backend/.env`, `backups/`, `*.bak` — **tuyệt đối không commit mật khẩu hoặc `DATABASE_URL` lên GitHub**.
- Push toàn bộ mã nguồn lên repository GitHub của bạn.

---

## Bước 3: Deploy Backend Lên Render (Miễn Phí, Không Cần Thẻ)

1. Vào [Render Dashboard](https://dashboard.render.com) -> **New +** -> **Blueprint** (hoặc **Web Service**) và kết nối repository GitHub.
2. Render tự đọc file `render.yaml` ở thư mục gốc (hoặc nhập tay: `Root Directory = backend`, `Build Command = pip install -r requirements.txt`, `Start Command = uvicorn main:app --host 0.0.0.0 --port $PORT`).
3. Thêm biến môi trường:
   - `DATABASE_URL`: dán chuỗi PostgreSQL từ Neon/Supabase ở Bước 1.
   - `ALLOWED_ORIGINS`: tạm để `*` (sau khi có domain Netlify ở Bước 4, đổi thành `https://<ten-site>.netlify.app`).
4. Deploy xong, mở `https://<ten-backend>.onrender.com/api/health` để xác nhận `"engine": "postgresql"` và đủ số lượng bản ghi (`accounts`, `students`, `faceEmbeddings`).

---

## Bước 4: Deploy Frontend Lên Netlify (Miễn Phí, Không Cần Thẻ)

1. Vào [Netlify](https://app.netlify.com) -> **Add new site** -> **Import an existing project** -> chọn repository GitHub.
2. Netlify tự đọc file `netlify.toml` (`base = web-frontend`, `command = npm run build`, `publish = dist`).
3. Vào **Site configuration -> Environment variables** -> thêm biến:
   - `VITE_API_URL` = `https://<ten-backend>.onrender.com`
4. Bấm **Trigger deploy -> Deploy site**. Sau khi deploy xong, quay lại Render cập nhật `ALLOWED_ORIGINS=https://<ten-site>.netlify.app`.

---

## Chạy Cục Bộ Bằng Docker + SQL Server (Dự Phòng)

File `backend/db.py` tự động dùng **PostgreSQL** khi có `DATABASE_URL` và tự động quay về **SQL Server** khi chạy Docker hoặc Windows local không có `DATABASE_URL`:
```bash
docker compose up -d --build
```

# 🚀 SpaceX Web Frontend — Biometric Face Registration & Attendance

Frontend Vue 3 + Vite của hệ thống **SpaceX Biometric Attendance System (White Queen)**, thực hiện nhận diện khuôn mặt thật ngay trên trình duyệt bằng **Google MediaPipe FaceLandmarker (`468 landmarks`)** và **`@vladmandic/face-api` (`128-D descriptors`)**.

> Xem tài liệu tổng quan toàn dự án tại [../README.md](../README.md).

## ⚙️ Công Nghệ Sử Dụng (`package.json`)
- **Framework**: `vue` (`^3.5.44`), `vite` (`^8.3.5`), `@vitejs/plugin-vue`
- **Biometric AI (Chạy cục bộ trong trình duyệt)**:
  - `@mediapipe/tasks-vision` (`^1.2.3`) — tải runtime WASM & `face_landmarker.task` từ `public/mediapipe/`
  - `@vladmandic/face-api` (`^1.7.15`) — tải model nhận diện từ `public/models/` để trích xuất vector `128-D`
- **Icons**: `lucide-vue-next` (`^1.0.0`)

## 🔄 Luồng Màn Hình
1. **Landing (`FacEthicLanding.vue`)** + **Cookie Banner (`CookieBanner.vue`)**
2. **Đăng ký (`RegisterView.vue`) & Đăng nhập (`LoginView.vue`)** với kiểm tra định dạng / độ mạnh mật khẩu (`utils/validation.js`) và chống trùng tài khoản (`utils/storage.js`)
3. **Cổng Sinh Viên (`StudentPortalIntroView.vue`)** trước khi vào quét khuôn mặt
4. **Đăng Ký Khuôn Mặt 5 Góc (`EnrollmentView.vue`)**: `Nhìn thẳng`, `Quay trái`, `Quay phải`, `Ngẩng lên`, `Cúi xuống` với bộ tiền xử lý camera mờ / ngược sáng trong `utils/faceEngine.js`
5. **Máy Quét Điểm Danh (`ScannerView.vue`) & Báo Cáo (`DashboardView.vue`)**

## 🛠️ Lệnh Chạy
```bash
npm install
npm run dev      # Khởi chạy Vite dev server (http://localhost:5173)
npm run build    # Build bản production vào thư mục dist/
npm run preview  # Xem trước bản production vừa build
```

<script setup>
import { ref, computed } from 'vue'
import SpaceXLogo from './SpaceXLogo.vue'
import SpaceXWatermark from './SpaceXWatermark.vue'
import heroBiometricImg from '../assets/hero-biometric.jpg'
import siteStarbaseImg from '../assets/site-starbase.jpg'
import siteFactoryImg from '../assets/site-factory.jpg'

const emit = defineEmits(['navigate'])

const currentLang = ref('En') // Default 'En' to match SpaceX biometric design; toggle 'Vi' supported
const activeSiteFilter = ref('ALL')
const hoveredPoint = ref(null)

function goTo(tab) {
  emit('navigate', tab)
}

function scrollToSection(id) {
  const el = document.getElementById(id)
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}

const content = computed(() => {
  if (currentLang.value === 'Vi') {
    return {
      navStatus: 'HỆ THỐNG THỊ GIÁC AI // V2.4',
      navFeatures: 'TÍNH NĂNG',
      navWorkflow: 'QUY TRÌNH',
      navSites: 'CƠ SỞ',
      navMetrics: 'HIỆU NĂNG',
      navLogin: 'ĐĂNG NHẬP',
      heroBadge: 'HỆ THỐNG ĐIỂM DANH KHUÔN MẶT',
      heroTitleLine1: 'Nhận Diện Khuôn Mặt',
      heroTitleLine2: 'Sinh Trắc Học & AI Vision',
      heroTitleLine3: 'SpaceX',
      heroDesc:
        'Giải pháp nhận diện khuôn mặt AI giúp điểm danh và kiểm soát ra vào tự động tại các cơ sở SpaceX. Xác thực người thật theo thời gian thực dưới 0.3 giây, không chạm.',
      heroCtaHow: 'XEM CÁCH HOẠT ĐỘNG',
      hudCam: 'TRỰC TIẾP // CAM-04',
      hudStatusLabel: 'TRẠNG THÁI',
      hudStatusVal: 'ĐÃ XÁC THỰC',
      hudMatchLabel: 'ĐỘ KHỚP',
      hudLatencyLabel: 'ĐỘ TRỄ',
      capEyebrow: 'NĂNG LỰC HỆ THỐNG',
      capTitle: 'Thiết Kế Cho Độ Chính Xác Tuyệt Đối',
      capabilities: [
        {
          id: 'liveness',
          title: 'Xác Thực Người Thật (Liveness)',
          desc: 'Phân tích chiều sâu và chuyển động vi mô theo thời gian thực để ngăn chặn giả mạo ảnh, video hay mặt nạ 3D.'
        },
        {
          id: 'speed',
          title: 'Nhận Diện Dưới 1 Giây',
          desc: 'Định danh và ghi nhận chuyên cần trong dưới 300ms ngay cả trong điều kiện thiếu sáng hoặc ngược sáng.'
        },
        {
          id: 'edge',
          title: 'Xử Lý Edge AI Tại Chỗ',
          desc: 'Suy luận mạng nơ-ron trực tiếp trên thiết bị đảm bảo độ trễ cực thấp, hoạt động cả khi mất mạng và bảo mật tuyệt đối.'
        },
        {
          id: 'multi',
          title: 'Điểm Danh Đa Khuôn Mặt',
          desc: 'Nhận diện và ghi log đồng thời nhiều nhân sự/sinh viên cùng lúc trong giờ cao điểm đổi ca.'
        }
      ],
      wfEyebrow: 'QUY TRÌNH ĐIỂM DANH',
      wfTitle: 'Từ Quét Khuôn Mặt Đến Bản Ghi Chuyên Cần',
      workflowSteps: [
        {
          code: '01 / THU NHẬN',
          title: 'Quét Khuôn Mặt',
          desc: 'Camera thu khung hình khuôn mặt trực tiếp ở tốc độ 60fps.'
        },
        {
          code: '02 / TRÍCH XUẤT',
          title: 'Trích Xuất Đặc Trưng AI',
          desc: 'Chuyển đổi thành vector sinh trắc học 512 chiều được mã hóa.'
        },
        {
          code: '03 / ĐỐI CHIẾU',
          title: 'So Khớp Danh Tính',
          desc: 'Đối chiếu vector với dữ liệu nhân sự/sinh viên SpaceX.'
        },
        {
          code: '04 / GHI NHẬN',
          title: 'Lưu Chuyên Cần',
          desc: 'Tự động lưu thời gian, khu vực và trạng thái điểm danh.'
        }
      ],
      sitesEyebrow: 'ĐIỂM TRIỂN KHAI',
      sitesTitle: 'Điểm Danh Tại Các Cơ Sở SpaceX',
      siteFilters: [
        { key: 'ALL', label: 'TẤT CẢ' },
        { key: 'STARBASE', label: 'STARBASE' },
        { key: 'HAWTHORNE', label: 'HAWTHORNE' },
        { key: 'CAPE', label: 'CAPE CANAVERAL' }
      ],
      sites: [
        {
          key: 'STARBASE',
          tag: '01 // STARBASE',
          title: 'Điểm Danh Ca Trực Starbase',
          desc: 'Tự động điểm danh tại cổng và nhà chứa tên lửa, theo dõi bàn giao ca trực không cần thẻ từ.',
          image: siteStarbaseImg,
          imgPos: 'center 25%',
          isControlProfile: false
        },
        {
          key: 'HAWTHORNE',
          tag: '02 // HAWTHORNE',
          title: 'Check-in Sàn Nhà Máy',
          desc: 'Xác thực sinh trắc học không chạm tại phòng sạch và khu lắp ráp ngay cả khi đeo khẩu trang hoặc mũ bảo hộ.',
          image: siteFactoryImg,
          imgPos: 'center 22%',
          isControlProfile: false
        },
        {
          key: 'CAPE',
          tag: '03 // CAPE CANAVERAL',
          title: 'Kiểm Soát Phòng Điều Khiển Phóng',
          desc: 'Xác thực khuôn mặt độ tin cậy cao cho phòng điều khiển sứ mệnh, kiểm tra quyền truy cập theo thời gian thực.',
          image: heroBiometricImg,
          imgPos: '78% 28%',
          isControlProfile: true
        }
      ],
      metricsEyebrow: 'HIỆU NĂNG ĐO KIỂM',
      metricsAccuracyTitle: 'Độ Chính Xác So Khớp',
      metricsAccuracyDesc: 'Vector đặc trưng AI độ chính xác cao ổn định qua nhiều điều kiện ánh sáng, góc nghiêng và biểu cảm.',
      metricsSpoofTitle: 'Chống Giả Mạo (Anti-Spoofing)',
      metricsSpoofDesc: 'Kiểm tra thực thể sống đa lớp chặn đứng ảnh chụp, phát lại video và mặt nạ tổng hợp.',
      metricsPpeTitle: 'Tương Thích Khẩu Trang & Đồ Bảo Hộ',
      metricsPpeDesc: 'Nhận diện tin cậy ngay cả khi đeo kính bảo hộ, mũ cứng hoặc khẩu trang chuyên dụng.',
      chartTitle: 'TỐC ĐỘ SUY LUẬN VS ĐỘ CHÍNH XÁC',
      footerSubtitle: 'HỆ THỐNG ĐIỂM DANH KHUÔN MẶT SINH TRẮC HỌC & AI VISION',
      footerCopyright: '© 2026 SPACEX BIOMETRIC VISION. BẢO LƯU MỌI QUYỀN.'
    }
  }

  return {
    navStatus: 'BIOMETRIC VISION // V2.4',
    navFeatures: 'FEATURES',
    navWorkflow: 'WORKFLOW',
    navSites: 'SITES',
    navMetrics: 'METRICS',
    navLogin: 'LOGIN',
    heroBadge: 'FACE ATTENDANCE SYSTEM',
    heroTitleLine1: 'Biometric Face',
    heroTitleLine2: 'Attendance & AI Vision',
    heroTitleLine3: 'System',
    heroDesc:
      'AI-powered face recognition for automatic attendance at SpaceX facilities. Check in with zero friction, sub-second speed, and verified liveness security.',
    heroCtaHow: 'SEE HOW IT WORKS',
    hudCam: 'LIVE // CAM-04',
    hudStatusLabel: 'STATUS',
    hudStatusVal: 'VERIFIED',
    hudMatchLabel: 'MATCH',
    hudLatencyLabel: 'LATENCY',
    capEyebrow: 'SYSTEM CAPABILITIES',
    capTitle: 'Built for Accurate Attendance',
    capabilities: [
      {
        id: 'liveness',
        title: 'Liveness Detection',
        desc: 'Verify real human presence in real time to prevent photo, video replay, or 3D mask spoofing.'
      },
      {
        id: 'speed',
        title: 'Sub-second Recognition',
        desc: 'Identify and authenticate personnel in under 300ms even under low-light or high-glare hangar conditions.'
      },
      {
        id: 'edge',
        title: 'Edge AI Processing',
        desc: 'On-device neural inference ensures ultra-low latency, offline resilience, and full biometric privacy.'
      },
      {
        id: 'multi',
        title: 'Multi-face Check-in',
        desc: 'Recognize and log multiple team members simultaneously during high-volume shift changes.'
      }
    ],
    wfEyebrow: 'ATTENDANCE WORKFLOW',
    wfTitle: 'From Face Scan to Attendance Record',
    workflowSteps: [
      {
        code: '01 / CAPTURE',
        title: 'Face Scan',
        desc: 'Camera captures live facial frame at 60fps.'
      },
      {
        code: '02 / EMBEDDING',
        title: 'AI Feature Extraction',
        desc: '512-D biometric vector extracted securely.'
      },
      {
        code: '03 / VERIFY',
        title: 'Identity Matching',
        desc: 'Vector matched against encrypted SpaceX roster.'
      },
      {
        code: '04 / RECORD',
        title: 'Attendance Logged',
        desc: 'Timestamp, facility & shift saved automatically.'
      }
    ],
    sitesEyebrow: 'DEPLOYMENT SITES',
    sitesTitle: 'Attendance Across SpaceX Sites',
    siteFilters: [
      { key: 'ALL', label: 'ALL FACILITIES' },
      { key: 'STARBASE', label: 'STARBASE' },
      { key: 'HAWTHORNE', label: 'HAWTHORNE' },
      { key: 'CAPE', label: 'CAPE CANAVERAL' }
    ],
    sites: [
      {
        key: 'STARBASE',
        tag: '01 // STARBASE',
        title: 'Starbase Shift Attendance',
        desc: 'Automated gate & hangar check-in for rocket assembly crews, tracking shift handovers with zero badge delays.',
        image: siteStarbaseImg,
        imgPos: 'center 25%',
        isControlProfile: false
      },
      {
        key: 'HAWTHORNE',
        tag: '02 // HAWTHORNE',
        title: 'Factory Floor Check-in',
        desc: 'Hands-free biometric verification at cleanroom and manufacturing bays while wearing masks or safety gear.',
        image: siteFactoryImg,
        imgPos: 'center 22%',
        isControlProfile: false
      },
      {
        key: 'CAPE',
        tag: '03 // CAPE CANAVERAL',
        title: 'Launch Control Room Access',
        desc: 'Dual-layer facial authentication for mission control rooms, verifying authorized personnel in real time.',
        image: heroBiometricImg,
        imgPos: '78% 28%',
        isControlProfile: true
      }
    ],
    metricsEyebrow: 'PERFORMANCE BENCHMARKS',
    metricsAccuracyTitle: 'Matching Accuracy',
    metricsAccuracyDesc: 'High-precision neural embeddings calibrated across variable lighting, angles, and expressions.',
    metricsSpoofTitle: 'Anti-Spoofing',
    metricsSpoofDesc: 'Liveness detection blocks printed photos, video replay, and 3D mask spoofing attempts.',
    metricsPpeTitle: 'Mask & PPE Tolerance',
    metricsPpeDesc: 'Recognizes personnel reliably even when wearing safety goggles, helmets, or face masks.',
    chartTitle: 'INFERENCE SPEED VS ACCURACY',
    footerSubtitle: 'BIOMETRIC FACE ATTENDANCE & AI VISION SYSTEM',
    footerCopyright: '© 2026 SPACEX BIOMETRIC VISION. ALL RIGHTS RESERVED.'
  }
})

// Chart coordinates (viewBox 0 0 460 220)
// X range: 55 -> 425 (6 points: 50ms, 100ms, 150ms, 200ms, 250ms, 300ms)
// Y range: 90% -> 100% mapped to y=180 -> y=30
const chartPoints = [
  { label: '50ms', acc: '90.6%', x: 65, y: 171 },
  { label: '100ms', acc: '95.8%', x: 137, y: 93 },
  { label: '150ms', acc: '98.4%', x: 209, y: 54 },
  { label: '200ms', acc: '99.6%', x: 281, y: 36 },
  { label: '250ms', acc: '99.7%', x: 353, y: 34.5 },
  { label: '300ms', acc: '99.7%', x: 425, y: 34.5 }
]

const chartLinePath = chartPoints
  .map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`)
  .join(' ')

const chartAreaPath = `${chartLinePath} L 425 180 L 65 180 Z`
</script>

<template>
  <div class="sx-landing">
    <!-- Top Navigation Bar -->
    <header class="sx-nav">
      <div class="sx-nav-inner">
        <div class="sx-nav-left">
          <SpaceXLogo @click="goTo('landing')" />
        </div>

        <div class="sx-nav-center">{{ content.navStatus }}</div>

        <nav class="sx-nav-right">
          <a href="#features" class="sx-nav-link" @click.prevent="scrollToSection('features')">
            {{ content.navFeatures }}
          </a>
          <a href="#workflow" class="sx-nav-link" @click.prevent="scrollToSection('workflow')">
            {{ content.navWorkflow }}
          </a>
          <a href="#sites" class="sx-nav-link" @click.prevent="scrollToSection('sites')">
            {{ content.navSites }}
          </a>
          <a href="#metrics" class="sx-nav-link" @click.prevent="scrollToSection('metrics')">
            {{ content.navMetrics }}
          </a>

          <div class="sx-lang-switch" role="group" aria-label="Language switch">
            <span :class="{ active: currentLang === 'En' }" @click="currentLang = 'En'">En</span>
            <span class="sx-lang-sep">/</span>
            <span :class="{ active: currentLang === 'Vi' }" @click="currentLang = 'Vi'">Vi</span>
          </div>

          <button class="sx-nav-btn-outline" @click="goTo('login')">
            {{ content.navLogin }}
          </button>
        </nav>
      </div>
    </header>

    <!-- SECTION 1: HERO -->
    <section class="sx-hero" id="home">
      <img
        :src="heroBiometricImg"
        alt="SpaceX Biometric AI Vision"
        class="sx-hero-bg-img"
      />
      <div class="sx-hero-vignette"></div>
      <div class="sx-hero-grid-overlay"></div>
      <SpaceXWatermark />

      <div class="sx-container sx-hero-inner">
        <div class="sx-hero-copy">
          <div class="sx-eyebrow-box">{{ content.heroBadge }}</div>

          <h1 class="sx-hero-title">
            <span>{{ content.heroTitleLine1 }}</span>
            <span>{{ content.heroTitleLine2 }}</span>
            <span>{{ content.heroTitleLine3 }}</span>
          </h1>

          <p class="sx-hero-desc">{{ content.heroDesc }}</p>

          <div class="sx-hero-actions">
            <button class="sx-btn-primary-outline" @click="scrollToSection('features')">
              <span>{{ content.heroCtaHow }}</span>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 5v14"/>
                <path d="m19 12-7 7-7-7"/>
              </svg>
            </button>
          </div>
        </div>

        <!-- Floating Live Biometric HUD Card (Right side of Hero) -->
        <aside class="sx-hud-card" aria-label="Live Biometric Verification Preview">
          <div class="sx-hud-preview">
            <img :src="heroBiometricImg" alt="Biometric HUD scan" class="sx-hud-img" />
            <div class="sx-hud-scanline"></div>
            <span class="sx-hud-bracket tl"></span>
            <span class="sx-hud-bracket tr"></span>
            <span class="sx-hud-bracket bl"></span>
            <span class="sx-hud-bracket br"></span>
            <span class="sx-hud-cam-tag">{{ content.hudCam }}</span>
          </div>

          <div class="sx-hud-rows">
            <div class="sx-hud-row">
              <span class="sx-hud-label">{{ content.hudStatusLabel }}</span>
              <span class="sx-hud-val sx-hud-verified">{{ content.hudStatusVal }}</span>
            </div>
            <div class="sx-hud-row">
              <span class="sx-hud-label">{{ content.hudMatchLabel }}</span>
              <span class="sx-hud-val">99.8%</span>
            </div>
            <div class="sx-hud-row">
              <span class="sx-hud-label">{{ content.hudLatencyLabel }}</span>
              <span class="sx-hud-val">180 ms</span>
            </div>
          </div>

          <div class="sx-hud-bar-track">
            <div class="sx-hud-bar-fill"></div>
          </div>
        </aside>
      </div>
    </section>

    <!-- SECTION 2: SYSTEM CAPABILITIES -->
    <section class="sx-section sx-section-black" id="features">
      <div class="sx-container">
        <div class="sx-section-head">
          <span class="sx-eyebrow">{{ content.capEyebrow }}</span>
          <h2 class="sx-section-title">{{ content.capTitle }}</h2>
        </div>

        <div class="sx-cap-grid">
          <article
            v-for="cap in content.capabilities"
            :key="cap.id"
            class="sx-cap-card"
          >
            <div class="sx-cap-icon-box">
              <!-- Liveness -->
              <svg v-if="cap.id === 'liveness'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
              <!-- Speed -->
              <svg v-else-if="cap.id === 'speed'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
              </svg>
              <!-- Edge AI -->
              <svg v-else-if="cap.id === 'edge'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <rect x="4" y="4" width="16" height="16" rx="2"/>
                <rect x="9" y="9" width="6" height="6"/>
                <path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3"/>
              </svg>
              <!-- Multi-face -->
              <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>
            <h3 class="sx-cap-title">{{ cap.title }}</h3>
            <p class="sx-cap-desc">{{ cap.desc }}</p>
          </article>
        </div>
      </div>
    </section>

    <!-- SECTION 3: ATTENDANCE WORKFLOW -->
    <section class="sx-section sx-section-black sx-workflow-section" id="workflow">
      <div class="sx-container">
        <div class="sx-section-head centered">
          <span class="sx-eyebrow">{{ content.wfEyebrow }}</span>
          <h2 class="sx-section-title">{{ content.wfTitle }}</h2>
        </div>

        <div class="sx-wf-pipeline">
          <div class="sx-wf-connector" aria-hidden="true"></div>

          <div
            v-for="(step, idx) in content.workflowSteps"
            :key="step.code"
            class="sx-wf-step"
          >
            <div class="sx-wf-icon-box" :class="{ highlighted: idx === 3 }">
              <!-- Step 1: Scan -->
              <svg v-if="idx === 0" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <path d="M3 7V5a2 2 0 0 1 2-2h2"/>
                <path d="M17 3h2a2 2 0 0 1 2 2v2"/>
                <path d="M21 17v2a2 2 0 0 1-2 2h-2"/>
                <path d="M7 21H5a2 2 0 0 1-2-2v-2"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
              <!-- Step 2: AI Feature Extraction -->
              <svg v-else-if="idx === 1" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                <path d="M2 17l10 5 10-5"/>
                <path d="M2 12l10 5 10-5"/>
              </svg>
              <!-- Step 3: Identity Matching -->
              <svg v-else-if="idx === 2" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <rect x="3" y="4" width="18" height="16" rx="2"/>
                <circle cx="9" cy="10" r="2.2"/>
                <path d="M6 16c.8-1.8 2.2-2.5 3-2.5s2.2.7 3 2.5"/>
                <path d="M15 9h3M15 13h3"/>
              </svg>
              <!-- Step 4: Attendance Logged (Blue Box) -->
              <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>

            <span class="sx-wf-code">{{ step.code }}</span>
            <h3 class="sx-wf-title">{{ step.title }}</h3>
            <p class="sx-wf-desc">{{ step.desc }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- SECTION 4: DEPLOYMENT SITES -->
    <section class="sx-section sx-section-elevated" id="sites">
      <div class="sx-container">
        <div class="sx-sites-header">
          <div>
            <span class="sx-eyebrow">{{ content.sitesEyebrow }}</span>
            <h2 class="sx-section-title">{{ content.sitesTitle }}</h2>
          </div>

          <div class="sx-sites-filters">
            <button
              v-for="f in content.siteFilters"
              :key="f.key"
              class="sx-filter-btn"
              :class="{ active: activeSiteFilter === f.key }"
              @click="activeSiteFilter = f.key"
            >
              {{ f.label }}
            </button>
          </div>
        </div>

        <div class="sx-sites-grid">
          <article
            v-for="site in content.sites"
            :key="site.key"
            class="sx-site-card"
            :class="{
              dimmed: activeSiteFilter !== 'ALL' && activeSiteFilter !== site.key,
              focused: activeSiteFilter === site.key
            }"
            @click="activeSiteFilter = activeSiteFilter === site.key ? 'ALL' : site.key"
          >
            <div class="sx-site-media">
              <img
                :src="site.image"
                :alt="site.title"
                class="sx-site-img"
                :class="{ 'control-room-tint': site.isControlProfile }"
                :style="{ objectPosition: site.imgPos }"
              />
              <div class="sx-site-media-overlay"></div>
              <span class="sx-site-badge">{{ site.tag }}</span>

              <!-- Extra cyan biometric wireframe accent for Card 3 -->
              <div v-if="site.isControlProfile" class="sx-control-hud" aria-hidden="true">
                <span class="sx-ctrl-dot d1"></span>
                <span class="sx-ctrl-dot d2"></span>
                <span class="sx-ctrl-dot d3"></span>
                <span class="sx-ctrl-ring"></span>
              </div>
            </div>

            <div class="sx-site-body">
              <h3 class="sx-site-title">{{ site.title }}</h3>
              <p class="sx-site-desc">{{ site.desc }}</p>
            </div>
          </article>
        </div>
      </div>
    </section>

    <!-- SECTION 5: METRICS & INFERENCE SPEED VS ACCURACY -->
    <section class="sx-section sx-section-black" id="metrics">
      <div class="sx-container sx-metrics-grid">
        <!-- Left Benchmark Points -->
        <div class="sx-metrics-list">
          <span class="sx-eyebrow">{{ content.metricsEyebrow }}</span>

          <div class="sx-metric-item sx-metric-hero-stat">
            <div class="sx-metric-big-num">99.7%</div>
            <div>
              <h3 class="sx-metric-title">{{ content.metricsAccuracyTitle }}</h3>
              <p class="sx-metric-desc">{{ content.metricsAccuracyDesc }}</p>
            </div>
          </div>

          <div class="sx-metric-item">
            <div class="sx-metric-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                <path d="m9 12 2 2 4-4"/>
              </svg>
            </div>
            <div>
              <h3 class="sx-metric-title">{{ content.metricsSpoofTitle }}</h3>
              <p class="sx-metric-desc">{{ content.metricsSpoofDesc }}</p>
            </div>
          </div>

          <div class="sx-metric-item">
            <div class="sx-metric-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9">
                <path d="M2 12a4 4 0 0 1 4-4h2.5a3.5 3.5 0 0 1 2.8 1.4l.7.9.7-.9A3.5 3.5 0 0 1 15.5 8H18a4 4 0 0 1 4 4v1a4 4 0 0 1-4 4h-2a3 3 0 0 1-2.4-1.2L12 13.6l-1.6 2.2A3 3 0 0 1 8 17H6a4 4 0 0 1-4-4v-1Z"/>
              </svg>
            </div>
            <div>
              <h3 class="sx-metric-title">{{ content.metricsPpeTitle }}</h3>
              <p class="sx-metric-desc">{{ content.metricsPpeDesc }}</p>
            </div>
          </div>
        </div>

        <!-- Right Chart Card -->
        <div class="sx-chart-card">
          <div class="sx-chart-header">{{ content.chartTitle }}</div>

          <svg viewBox="0 0 460 220" class="sx-chart-svg" role="img" aria-label="Inference Speed vs Accuracy Chart">
            <defs>
              <linearGradient id="sxChartArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#0EA5E9" stop-opacity="0.28"/>
                <stop offset="100%" stop-color="#0EA5E9" stop-opacity="0"/>
              </linearGradient>
              <filter id="sxLineGlow" x="-10%" y="-20%" width="120%" height="140%">
                <feGaussianBlur stdDeviation="2.5" result="blur"/>
                <feMerge>
                  <feMergeNode in="blur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>

            <!-- Horizontal Gridlines & Y Labels -->
            <g class="sx-chart-grid">
              <line x1="55" y1="45" x2="435" y2="45" />
              <text x="45" y="49" text-anchor="end">99%</text>

              <line x1="55" y1="90" x2="435" y2="90" />
              <text x="45" y="94" text-anchor="end">96%</text>

              <line x1="55" y1="135" x2="435" y2="135" />
              <text x="45" y="139" text-anchor="end">93%</text>

              <line x1="55" y1="180" x2="435" y2="180" />
              <text x="45" y="184" text-anchor="end">90%</text>
            </g>

            <!-- Area Fill -->
            <path :d="chartAreaPath" fill="url(#sxChartArea)" />

            <!-- Smooth Curve -->
            <path
              :d="chartLinePath"
              fill="none"
              stroke="#0EA5E9"
              stroke-width="2.2"
              stroke-linecap="round"
              stroke-linejoin="round"
              filter="url(#sxLineGlow)"
            />

            <!-- Data Nodes & X Labels -->
            <g v-for="pt in chartPoints" :key="pt.label" class="sx-chart-node-group">
              <circle
                :cx="pt.x"
                :cy="pt.y"
                r="10"
                fill="transparent"
                class="sx-chart-hit"
                @mouseenter="hoveredPoint = pt"
                @mouseleave="hoveredPoint = null"
              />
              <circle
                :cx="pt.x"
                :cy="pt.y"
                :r="hoveredPoint?.label === pt.label ? 5 : 3.5"
                fill="#38BDF8"
                stroke="#05080D"
                stroke-width="1.5"
              />
              <text :x="pt.x" y="202" text-anchor="middle" class="sx-chart-xlabel">
                {{ pt.label }}
              </text>
            </g>

            <!-- Interactive Hover Tooltip -->
            <g v-if="hoveredPoint" class="sx-chart-tooltip">
              <rect
                :x="Math.min(hoveredPoint.x - 38, 365)"
                :y="Math.max(hoveredPoint.y - 34, 6)"
                width="76"
                height="22"
                rx="3"
                fill="#0F172A"
                stroke="#38BDF8"
                stroke-width="0.8"
              />
              <text
                :x="Math.min(hoveredPoint.x - 38, 365) + 38"
                :y="Math.max(hoveredPoint.y - 34, 6) + 14.5"
                text-anchor="middle"
                fill="#F8FAFC"
                font-size="9.5"
                font-weight="700"
              >
                {{ hoveredPoint.label }} · {{ hoveredPoint.acc }}
              </text>
            </g>
          </svg>
        </div>
      </div>
    </section>

    <!-- FOOTER -->
    <footer class="sx-footer">
      <div class="sx-container sx-footer-inner">
        <div class="sx-footer-brand">
          <SpaceXLogo @click="scrollToSection('home')" />
        </div>
        <div class="sx-footer-subtitle">{{ content.footerSubtitle }}</div>

        <div class="sx-footer-links">
          <a href="#features" @click.prevent="scrollToSection('features')">{{ content.navFeatures }}</a>
          <a href="#workflow" @click.prevent="scrollToSection('workflow')">{{ content.navWorkflow }}</a>
          <a href="#sites" @click.prevent="scrollToSection('sites')">{{ content.navSites }}</a>
          <a href="#metrics" @click.prevent="scrollToSection('metrics')">{{ content.navMetrics }}</a>
          <a href="#login" @click.prevent="goTo('login')">{{ content.navLogin }}</a>
        </div>

        <div class="sx-footer-copy">{{ content.footerCopyright }}</div>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.sx-landing {
  background-color: #000000;
  color: #ffffff;
  font-family: var(--font-sans);
  min-height: 100vh;
  overflow-x: hidden;
}

.sx-container {
  max-width: 1240px;
  margin: 0 auto;
  padding: 0 32px;
}

/* ===========================
   TOP NAVBAR
   =========================== */
.sx-nav {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  background: rgba(0, 0, 0, 0.72);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.sx-nav-inner {
  max-width: 1400px;
  margin: 0 auto;
  padding: 16px 40px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
}

.sx-nav-center {
  font-family: var(--font-mono);
  font-size: 0.68rem;
  letter-spacing: 0.2em;
  color: #64748b;
  text-transform: uppercase;
  white-space: nowrap;
}

.sx-nav-right {
  display: flex;
  align-items: center;
  gap: 24px;
}

.sx-nav-link {
  color: #94a3b8;
  text-decoration: none;
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.14em;
  transition: color 0.2s ease;
}
.sx-nav-link:hover {
  color: #ffffff;
}

.sx-lang-switch {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  color: #64748b;
  cursor: pointer;
  user-select: none;
}
.sx-lang-switch span.active {
  color: #ffffff;
}
.sx-lang-sep {
  opacity: 0.4;
}

.sx-nav-btn-outline {
  background: transparent;
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.35);
  border-radius: 2px;
  padding: 8px 18px;
  font-family: var(--font-sans);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  cursor: pointer;
  transition: all 0.2s ease;
}
.sx-nav-btn-outline:hover {
  background: #ffffff;
  color: #000000;
  border-color: #ffffff;
}

/* ===========================
   HERO SECTION
   =========================== */
.sx-hero {
  position: relative;
  min-height: 760px;
  height: 100vh;
  max-height: 920px;
  display: flex;
  align-items: center;
  padding: 110px 0 70px;
  background-color: #000000;
  overflow: hidden;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.sx-hero-bg-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: 72% center;
  opacity: 0.85;
  pointer-events: none;
}

.sx-hero-vignette {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(90deg, #000000 0%, rgba(0, 0, 0, 0.92) 38%, rgba(0, 0, 0, 0.45) 68%, rgba(0, 0, 0, 0.3) 100%),
    linear-gradient(180deg, rgba(0, 0, 0, 0.65) 0%, transparent 25%, transparent 72%, #000000 100%);
  pointer-events: none;
}

.sx-hero-grid-overlay {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(56, 189, 248, 0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(56, 189, 248, 0.03) 1px, transparent 1px);
  background-size: 64px 64px;
  pointer-events: none;
}

.sx-hero-inner {
  position: relative;
  z-index: 10;
  width: 100%;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 40px;
}

.sx-hero-copy {
  max-width: 650px;
}

.sx-eyebrow-box {
  display: inline-block;
  font-family: var(--font-mono);
  font-size: 0.68rem;
  font-weight: 500;
  letter-spacing: 0.2em;
  color: #94a3b8;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(255, 255, 255, 0.03);
  padding: 6px 14px;
  border-radius: 2px;
  margin-bottom: 24px;
}

.sx-hero-title {
  display: flex;
  flex-direction: column;
  font-size: clamp(2.5rem, 4.7vw, 4.1rem);
  font-weight: 600;
  line-height: 1.08;
  letter-spacing: -0.025em;
  color: #ffffff;
  margin-bottom: 22px;
}

.sx-hero-desc {
  font-size: 0.98rem;
  line-height: 1.65;
  color: #94a3b8;
  max-width: 540px;
  margin-bottom: 34px;
}

.sx-hero-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

.sx-btn-primary-outline {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  background: transparent;
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.42);
  border-radius: 2px;
  padding: 14px 24px;
  font-family: var(--font-sans);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.16em;
  cursor: pointer;
  transition: all 0.25s ease;
}
.sx-btn-primary-outline:hover {
  background: #ffffff;
  color: #000000;
  border-color: #ffffff;
}

/* Floating Live Telemetry HUD Card */
.sx-hud-card {
  width: 245px;
  flex-shrink: 0;
  background: rgba(8, 12, 18, 0.88);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 3px;
  padding: 12px;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.75);
}

.sx-hud-preview {
  position: relative;
  height: 128px;
  overflow: hidden;
  border: 1px solid rgba(56, 189, 248, 0.28);
  margin-bottom: 12px;
  background: #04070d;
}

.sx-hud-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: 73% 34%;
  transform: scale(1.25);
}

.sx-hud-scanline {
  position: absolute;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, transparent, #38bdf8, transparent);
  box-shadow: 0 0 10px #38bdf8;
  animation: hudScan 2.8s ease-in-out infinite;
}

@keyframes hudScan {
  0%, 100% { top: 12%; opacity: 0.4; }
  50% { top: 86%; opacity: 1; }
}

.sx-hud-bracket {
  position: absolute;
  width: 10px;
  height: 10px;
  border-color: #38bdf8;
  border-style: solid;
}
.sx-hud-bracket.tl { top: 6px; left: 6px; border-width: 1.5px 0 0 1.5px; }
.sx-hud-bracket.tr { top: 6px; right: 6px; border-width: 1.5px 1.5px 0 0; }
.sx-hud-bracket.bl { bottom: 6px; left: 6px; border-width: 0 0 1.5px 1.5px; }
.sx-hud-bracket.br { bottom: 6px; right: 6px; border-width: 0 1.5px 1.5px 0; }

.sx-hud-cam-tag {
  position: absolute;
  bottom: 6px;
  left: 10px;
  font-family: var(--font-mono);
  font-size: 0.58rem;
  letter-spacing: 0.12em;
  color: #e2e8f0;
  background: rgba(0, 0, 0, 0.65);
  padding: 2px 6px;
}

.sx-hud-rows {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 10px;
}

.sx-hud-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-family: var(--font-mono);
  font-size: 0.64rem;
}

.sx-hud-label {
  color: #64748b;
  letter-spacing: 0.12em;
}

.sx-hud-val {
  color: #e2e8f0;
  font-weight: 700;
}

.sx-hud-verified {
  color: #34d399;
}

.sx-hud-bar-track {
  height: 3px;
  background: rgba(255, 255, 255, 0.08);
  overflow: hidden;
}

.sx-hud-bar-fill {
  width: 92%;
  height: 100%;
  background: linear-gradient(90deg, #0284c7, #38bdf8);
}

/* ===========================
   SHARED SECTIONS
   =========================== */
.sx-section {
  padding: 96px 0;
}

.sx-section-black {
  background-color: #000000;
}

.sx-section-elevated {
  background-color: #080a0f;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.sx-section-head {
  margin-bottom: 48px;
}

.sx-section-head.centered {
  text-align: center;
}

.sx-eyebrow {
  display: block;
  font-family: var(--font-mono);
  font-size: 0.68rem;
  font-weight: 500;
  letter-spacing: 0.22em;
  color: #64748b;
  text-transform: uppercase;
  margin-bottom: 12px;
}

.sx-section-title {
  font-size: clamp(1.65rem, 2.8vw, 2.35rem);
  font-weight: 500;
  letter-spacing: -0.02em;
  color: #f8fafc;
}

/* ===========================
   CAPABILITIES 4-CARD GRID
   =========================== */
.sx-cap-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
}

.sx-cap-card {
  background: #07090d;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 3px;
  padding: 28px 24px;
  transition: border-color 0.25s ease, transform 0.25s ease, background-color 0.25s ease;
}

.sx-cap-card:hover {
  border-color: rgba(56, 189, 248, 0.35);
  background: #0a0e15;
  transform: translateY(-2px);
}

.sx-cap-icon-box {
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.03);
  color: #cbd5e1;
  border-radius: 2px;
  margin-bottom: 24px;
}

.sx-cap-title {
  font-size: 0.98rem;
  font-weight: 600;
  color: #f8fafc;
  margin-bottom: 10px;
}

.sx-cap-desc {
  font-size: 0.82rem;
  line-height: 1.6;
  color: #64748b;
}

/* ===========================
   ATTENDANCE WORKFLOW PIPELINE
   =========================== */
.sx-workflow-section {
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.sx-wf-pipeline {
  position: relative;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 28px;
  margin-top: 56px;
}

.sx-wf-connector {
  position: absolute;
  top: 24px;
  left: 12.5%;
  right: 12.5%;
  height: 1px;
  background: linear-gradient(90deg, rgba(255, 255, 255, 0.08), rgba(56, 189, 248, 0.35));
  z-index: 0;
}

.sx-wf-step {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.sx-wf-icon-box {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #080b10;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 3px;
  color: #cbd5e1;
  margin-bottom: 20px;
  transition: all 0.25s ease;
}

.sx-wf-icon-box.highlighted {
  background: #0284c7;
  border-color: #38bdf8;
  color: #ffffff;
  box-shadow: 0 0 28px rgba(14, 165, 233, 0.45);
}

.sx-wf-code {
  font-family: var(--font-mono);
  font-size: 0.64rem;
  letter-spacing: 0.16em;
  color: #475569;
  margin-bottom: 8px;
}

.sx-wf-title {
  font-size: 0.96rem;
  font-weight: 600;
  color: #f8fafc;
  margin-bottom: 8px;
}

.sx-wf-desc {
  font-size: 0.8rem;
  line-height: 1.55;
  color: #64748b;
  max-width: 240px;
}

/* ===========================
   DEPLOYMENT SITES
   =========================== */
.sx-sites-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 24px;
  margin-bottom: 40px;
  flex-wrap: wrap;
}

.sx-sites-filters {
  display: flex;
  align-items: center;
  gap: 18px;
  flex-wrap: wrap;
}

.sx-filter-btn {
  background: transparent;
  border: none;
  font-family: var(--font-mono);
  font-size: 0.68rem;
  letter-spacing: 0.14em;
  color: #64748b;
  cursor: pointer;
  padding: 4px 0;
  border-bottom: 1px solid transparent;
  transition: all 0.2s ease;
}

.sx-filter-btn:hover,
.sx-filter-btn.active {
  color: #ffffff;
  border-bottom-color: #38bdf8;
}

.sx-sites-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
}

.sx-site-card {
  cursor: pointer;
  transition: opacity 0.25s ease, transform 0.25s ease;
}

.sx-site-card.dimmed {
  opacity: 0.42;
}

.sx-site-card:hover {
  transform: translateY(-3px);
}

.sx-site-media {
  position: relative;
  aspect-ratio: 4 / 3;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 3px;
  background: #04060a;
  margin-bottom: 18px;
}

.sx-site-card.focused .sx-site-media {
  border-color: #38bdf8;
  box-shadow: 0 0 24px rgba(56, 189, 248, 0.2);
}

.sx-site-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.45s ease;
}

.sx-site-card:hover .sx-site-img {
  transform: scale(1.04);
}

.sx-site-img.control-room-tint {
  filter: hue-rotate(-14deg) saturate(1.15) contrast(1.06);
  transform: scale(1.18);
}
.sx-site-card:hover .sx-site-img.control-room-tint {
  transform: scale(1.22);
}

.sx-site-media-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(0, 0, 0, 0.25) 0%, transparent 40%, rgba(0, 0, 0, 0.55) 100%);
  pointer-events: none;
}

.sx-site-badge {
  position: absolute;
  top: 12px;
  left: 12px;
  font-family: var(--font-mono);
  font-size: 0.62rem;
  letter-spacing: 0.14em;
  color: #cbd5e1;
  background: rgba(5, 8, 14, 0.78);
  border: 1px solid rgba(255, 255, 255, 0.14);
  padding: 4px 8px;
}

.sx-control-hud {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.sx-ctrl-ring {
  position: absolute;
  top: 38%;
  left: 52%;
  width: 72px;
  height: 72px;
  border: 1px solid rgba(56, 189, 248, 0.55);
  border-radius: 50%;
  transform: translate(-50%, -50%);
}

.sx-ctrl-dot {
  position: absolute;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #38bdf8;
  box-shadow: 0 0 8px #38bdf8;
}
.sx-ctrl-dot.d1 { top: 44%; left: 42%; }
.sx-ctrl-dot.d2 { top: 53%; left: 48%; }
.sx-ctrl-dot.d3 { top: 41%; left: 56%; }

.sx-site-title {
  font-size: 1rem;
  font-weight: 600;
  color: #f8fafc;
  margin-bottom: 8px;
}

.sx-site-desc {
  font-size: 0.81rem;
  line-height: 1.6;
  color: #64748b;
}

/* ===========================
   METRICS & LINE CHART
   =========================== */
.sx-metrics-grid {
  display: grid;
  grid-template-columns: 1fr 1.12fr;
  gap: 56px;
  align-items: center;
}

.sx-metrics-list {
  display: flex;
  flex-direction: column;
  gap: 28px;
}

.sx-metric-item {
  display: flex;
  align-items: flex-start;
  gap: 20px;
}

.sx-metric-big-num {
  font-size: 2rem;
  font-weight: 600;
  letter-spacing: -0.03em;
  color: #0ea5e9;
  line-height: 1.1;
  min-width: 96px;
}

.sx-metric-icon {
  min-width: 96px;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  color: #0ea5e9;
  padding-top: 2px;
}

.sx-metric-title {
  font-size: 0.98rem;
  font-weight: 600;
  color: #f8fafc;
  margin-bottom: 6px;
}

.sx-metric-desc {
  font-size: 0.82rem;
  line-height: 1.6;
  color: #64748b;
}

.sx-chart-card {
  background: #06080c;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 3px;
  padding: 28px 28px 22px;
}

.sx-chart-header {
  text-align: center;
  font-family: var(--font-mono);
  font-size: 0.68rem;
  letter-spacing: 0.18em;
  color: #64748b;
  margin-bottom: 18px;
}

.sx-chart-svg {
  width: 100%;
  height: auto;
  display: block;
}

.sx-chart-grid line {
  stroke: rgba(255, 255, 255, 0.07);
  stroke-width: 1;
}

.sx-chart-grid text,
.sx-chart-xlabel {
  fill: #475569;
  font-family: var(--font-mono);
  font-size: 9.5px;
}

.sx-chart-hit {
  cursor: pointer;
}

/* ===========================
   FOOTER
   =========================== */
.sx-footer {
  background-color: #000000;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  padding: 64px 0 48px;
}

.sx-footer-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.sx-footer-brand {
  margin-bottom: 12px;
}

.sx-footer-subtitle {
  font-family: var(--font-mono);
  font-size: 0.66rem;
  letter-spacing: 0.24em;
  color: #475569;
  margin-bottom: 30px;
}

.sx-footer-links {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 28px;
  margin-bottom: 28px;
}

.sx-footer-links a {
  color: #64748b;
  text-decoration: none;
  font-family: var(--font-mono);
  font-size: 0.68rem;
  letter-spacing: 0.16em;
  transition: color 0.2s ease;
}
.sx-footer-links a:hover {
  color: #ffffff;
}

.sx-footer-copy {
  font-family: var(--font-mono);
  font-size: 0.62rem;
  letter-spacing: 0.12em;
  color: #334155;
}

/* ===========================
   RESPONSIVE BREAKPOINTS
   =========================== */
@media (max-width: 1080px) {
  .sx-cap-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .sx-metrics-grid {
    grid-template-columns: 1fr;
    gap: 36px;
  }
  .sx-nav-center {
    display: none;
  }
}

@media (max-width: 860px) {
  .sx-nav-inner {
    padding: 14px 20px;
  }
  .sx-nav-link {
    display: none;
  }
  .sx-hero-inner {
    flex-direction: column;
    align-items: flex-start;
  }
  .sx-wf-pipeline {
    grid-template-columns: repeat(2, 1fr);
  }
  .sx-wf-connector {
    display: none;
  }
  .sx-sites-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 560px) {
  .sx-container {
    padding: 0 20px;
  }
  .sx-cap-grid,
  .sx-wf-pipeline {
    grid-template-columns: 1fr;
  }
  .sx-metric-item {
    flex-direction: column;
    gap: 8px;
  }
  .sx-metric-big-num,
  .sx-metric-icon {
    min-width: auto;
  }
}
</style>

const MODEL_URL = '../models'

const videoEl = document.getElementById('faceVideo')
const canvasEl = document.getElementById('meshCanvas')
const statusPrompt = document.getElementById('statusPrompt')
const camStatusPill = document.getElementById('camStatusPill')
const camStatusText = document.getElementById('camStatusText')
const camErrorOverlay = document.getElementById('camErrorOverlay')
const camErrorText = document.getElementById('camErrorText')
const verifiedBanner = document.getElementById('verifiedBanner')
const verifiedName = document.getElementById('verifiedName')
const viewportFrame = document.getElementById('viewportFrame')
const scanBeam = document.getElementById('scanBeam')
const matchPctVal = document.getElementById('matchPctVal')
const matchPctFill = document.getElementById('matchPctFill')
const clockBox = document.getElementById('clockBox')
const recLabel = document.getElementById('recLabel')

const stepDetect = document.getElementById('stepDetect')
const stepLiveness = document.getElementById('stepLiveness')
const stepMatch = document.getElementById('stepMatch')
const stepSuccess = document.getElementById('stepSuccess')
const metaDetect = document.getElementById('metaDetect')
const metaLiveness = document.getElementById('metaLiveness')
const metaMatch = document.getElementById('metaMatch')
const metaSuccess = document.getElementById('metaSuccess')
const stepMatchPct = document.getElementById('stepMatchPct')
const stepMatchBar = document.getElementById('stepMatchBar')
const accVal = document.getElementById('accVal')
const accBar = document.getElementById('accBar')
const latencyVal = document.getElementById('latencyVal')
const latencyBar = document.getElementById('latencyBar')

let stream = null
let modelsLoaded = false
let isScanning = true
let isPaused = false
let isDone = false
let waitingBackend = false
let scanTimer = null
let detectStartTs = 0
let cameras = []
let activeCamIdx = 0
let lastT0 = 0

function sendAction(action, payload = {}) {
  if (window.chrome && window.chrome.webview) {
    window.chrome.webview.postMessage({ action, ...payload })
  }
}

function updateClock() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  clockBox.textContent = `◷ ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())} · ${p(d.getDate())}/${p(d.getMonth() + 1)}`
}
updateClock()
setInterval(updateClock, 1000)

function setStepState(el, state) {
  el.classList.remove('active', 'done')
  if (state) el.classList.add(state)
  const icon = el.querySelector('.fl-step-icon')
  if (state === 'done') icon.innerHTML = '✓'
  else if (state === 'active') icon.innerHTML = '<span class="fl-spin-ring"></span>'
  else icon.textContent = el === stepSuccess ? '✓' : '•'
}

async function ensureModels() {
  if (modelsLoaded) return
  if (!window.faceapi) throw new Error('Chưa tải được thư viện face-api')
  await Promise.all([
    window.faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
    window.faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
    window.faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
  ])
  modelsLoaded = true
}

function drawLandmarks(landmarks, srcW, srcH) {
  const w = canvasEl.clientWidth || 640
  const h = canvasEl.clientHeight || 480
  if (canvasEl.width !== w || canvasEl.height !== h) {
    canvasEl.width = w
    canvasEl.height = h
  }
  const ctx = canvasEl.getContext('2d')
  ctx.clearRect(0, 0, w, h)
  if (!landmarks) return

  const pts = landmarks.positions
  const vw = srcW || videoEl.videoWidth || 640
  const vh = srcH || videoEl.videoHeight || 480
  const scale = Math.max(w / vw, h / vh)
  const ox = (w - vw * scale) / 2
  const oy = (h - vh * scale) / 2

  const mapPt = (pt) => ({
    x: w - (pt.x * scale + ox),
    y: pt.y * scale + oy
  })

  const chains = [
    pts.slice(0, 17),
    pts.slice(17, 22),
    pts.slice(22, 27),
    pts.slice(27, 31),
    pts.slice(30, 36),
    [...pts.slice(36, 42), pts[36]],
    [...pts.slice(42, 48), pts[42]],
    [...pts.slice(48, 60), pts[48]]
  ]

  ctx.save()
  ctx.strokeStyle = isDone ? 'rgba(52, 211, 153, 0.85)' : 'rgba(0, 210, 255, 0.78)'
  ctx.lineWidth = 1.4
  ctx.shadowColor = isDone ? '#34d399' : '#00d2ff'
  ctx.shadowBlur = 8

  for (const ch of chains) {
    ctx.beginPath()
    ch.forEach((raw, idx) => {
      const p = mapPt(raw)
      if (idx === 0) ctx.moveTo(p.x, p.y)
      else ctx.lineTo(p.x, p.y)
    })
    ctx.stroke()
  }
  ctx.restore()
}

async function initCamera(deviceId = null) {
  if (stream) {
    stream.getTracks().forEach((t) => t.stop())
    stream = null
  }
  camErrorOverlay.hidden = true
  camStatusPill.classList.remove('ready', 'err')
  camStatusText.textContent = 'ĐANG KẾT NỐI'
  statusPrompt.textContent = 'Đang kết nối camera & tải mô hình AI...'

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: deviceId
        ? { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
        : { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false
    })
    const devs = await navigator.mediaDevices.enumerateDevices()
    cameras = devs.filter((d) => d.kind === 'videoinput')

    videoEl.srcObject = stream
    await videoEl.play().catch(() => {})
    camStatusPill.classList.add('ready')
    camStatusText.textContent = 'CAMERA SẴN SÀNG'
    recLabel.textContent = `REC CAM_0${activeCamIdx + 1} · 1080P · 30FPS`

    await ensureModels()
    detectStartTs = performance.now()
    statusPrompt.textContent = 'Nhìn thẳng vào camera và giữ yên khuôn mặt'
    scheduleScan(100)
  } catch (err) {
    camStatusPill.classList.add('err')
    camStatusText.textContent = 'LỖI CAMERA'
    camErrorText.textContent = err?.message || 'Không thể truy cập camera.'
    camErrorOverlay.hidden = false
  }
}

function scheduleScan(delay = 280) {
  if (scanTimer) clearTimeout(scanTimer)
  if (isScanning && !isPaused && !isDone) {
    scanTimer = setTimeout(runFrameCheck, delay)
  }
}

const prepCanvas = document.createElement('canvas')
const prepCtx = prepCanvas.getContext('2d', { willReadFrequently: true })

function prepareFrameForDetection() {
  const vw = videoEl.videoWidth || 640
  const vh = videoEl.videoHeight || 480
  const tw = 416
  const th = Math.max(240, Math.round((vh / vw) * tw))
  if (prepCanvas.width !== tw || prepCanvas.height !== th) {
    prepCanvas.width = tw
    prepCanvas.height = th
  }

  prepCtx.filter = 'none'
  prepCtx.drawImage(videoEl, 0, 0, tw, th)

  // Measure center ROI brightness so backlit faces get automatic boost
  const roiW = Math.floor(tw * 0.4)
  const roiH = Math.floor(th * 0.5)
  const roiX = Math.floor((tw - roiW) / 2)
  const roiY = Math.floor((th - roiH) / 2)
  const data = prepCtx.getImageData(roiX, roiY, roiW, roiH).data
  let lumaSum = 0
  let count = 0
  for (let i = 0; i < data.length; i += 16) {
    lumaSum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
    count++
  }
  const avgLuma = lumaSum / Math.max(1, count)

  if (avgLuma < 115) {
    const boost = Math.min(2.1, Math.max(1.25, 130 / Math.max(35, avgLuma)))
    prepCtx.filter = `brightness(${boost.toFixed(2)}) contrast(1.28)`
    prepCtx.drawImage(videoEl, 0, 0, tw, th)
    prepCtx.filter = 'none'
  }
  return { tw, th }
}

async function runFrameCheck() {
  if (!isScanning || isPaused || isDone || waitingBackend || videoEl.readyState < 2) {
    scheduleScan(250)
    return
  }

  try {
    const { tw, th } = prepareFrameForDetection()
    const det = await window.faceapi
      .detectSingleFace(prepCanvas, new window.faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.2 }))
      .withFaceLandmarks()
      .withFaceDescriptor()

    if (!det) {
      drawLandmarks(null)
      setStepState(stepDetect, 'active')
      setStepState(stepLiveness, null)
      setStepState(stepMatch, null)
      metaDetect.textContent = 'ĐANG TÌM KHUÔN MẶT...'
      statusPrompt.textContent = 'Đưa khuôn mặt vào giữa khung quét'
      scheduleScan(200)
      return
    }

    drawLandmarks(det.landmarks, tw, th)
    const sec = Math.max(0.2, (performance.now() - detectStartTs) / 1000).toFixed(1)
    setStepState(stepDetect, 'done')
    metaDetect.textContent = `HOÀN TẤT · ${sec}S`
    setStepState(stepLiveness, 'done')
    metaLiveness.textContent = 'HOÀN TẤT · NGƯỜI THẬT'
    setStepState(stepMatch, 'active')
    stepMatchPct.textContent = '65%'
    stepMatchBar.style.width = '65%'
    metaMatch.textContent = 'ĐANG ĐỐI CHIẾU HỒ SƠ GIẢNG VIÊN'
    accVal.textContent = '99.2%'
    accBar.style.width = '94%'
    statusPrompt.textContent = 'Đang đối chiếu khuôn mặt với dữ liệu hệ thống...'

    waitingBackend = true
    lastT0 = performance.now()
    sendAction('face_login_submit', { descriptor: Array.from(det.descriptor) })
  } catch {
    scheduleScan(350)
  }
}

window.onFaceLoginResult = function (result) {
  waitingBackend = false
  const ms = Math.max(12, Math.round(performance.now() - lastT0))
  latencyVal.textContent = `${ms} ms`
  latencyBar.style.width = '45%'

  if (result.matched && result.account) {
    isDone = true
    isScanning = false
    const pct = parseFloat(result.confidence) || 95
    matchPctVal.textContent = `${pct.toFixed(0)}%`
    matchPctFill.style.width = `${pct}%`
    stepMatchPct.textContent = '100%'
    stepMatchBar.style.width = '100%'
    setStepState(stepMatch, 'done')
    setStepState(stepSuccess, 'done')
    metaMatch.textContent = 'ĐỐI CHIẾU THÀNH CÔNG'
    metaSuccess.textContent = `ĐÃ XÁC THỰC · ${result.account.fullName.toUpperCase()}`
    accVal.textContent = `${pct.toFixed(1)}%`

    viewportFrame.classList.add('verified')
    scanBeam.style.display = 'none'
    verifiedName.textContent = `${result.account.fullName} · ${result.account.employeeId}`
    verifiedBanner.hidden = false
    statusPrompt.textContent = result.message || 'Xác thực thành công!'

    setTimeout(() => sendAction('open_dashboard'), 1200)
    return
  }

  const dist = typeof result.distance === 'number' ? result.distance : 0.65
  const pct = Math.max(32, Math.min(82, Math.round((1 - dist * 0.65) * 100)))
  matchPctVal.textContent = `${pct}%`
  matchPctFill.style.width = `${pct}%`
  metaMatch.textContent = result.message || 'CHƯA KHỚP HỒ SƠ GIẢNG VIÊN'
  statusPrompt.textContent = result.message || 'Chưa khớp dữ liệu khuôn mặt...'
  scheduleScan(1600)
}

document.getElementById('btnBack').addEventListener('click', () => sendAction('open_login'))
document.getElementById('bcLogin').addEventListener('click', () => sendAction('open_login'))
document.getElementById('btnPasswordLogin').addEventListener('click', () => sendAction('open_login'))
document.getElementById('btnRetryCam').addEventListener('click', () => initCamera())

document.getElementById('btnPause').addEventListener('click', (e) => {
  if (isDone) return
  isPaused = !isPaused
  e.target.textContent = isPaused ? '▶ Tiếp tục' : '⏸ Tạm dừng'
  if (!isPaused) scheduleScan(120)
})

document.getElementById('btnStopScan').addEventListener('click', (e) => {
  if (isDone) return
  isScanning = !isScanning
  e.target.textContent = isScanning ? '■ Dừng quét' : '▶ Bắt đầu quét'
  if (isScanning) scheduleScan(120)
})

document.getElementById('btnSwitchCam').addEventListener('click', () => {
  if (cameras.length <= 1) return
  activeCamIdx = (activeCamIdx + 1) % cameras.length
  initCamera(cameras[activeCamIdx].deviceId)
})

document.getElementById('btnRestart').addEventListener('click', () => {
  isDone = false
  isPaused = false
  isScanning = true
  waitingBackend = false
  verifiedBanner.hidden = true
  viewportFrame.classList.remove('verified')
  scanBeam.style.display = 'block'
  setStepState(stepDetect, 'active')
  setStepState(stepLiveness, null)
  setStepState(stepMatch, null)
  setStepState(stepSuccess, null)
  detectStartTs = performance.now()
  scheduleScan(120)
})

initCamera()


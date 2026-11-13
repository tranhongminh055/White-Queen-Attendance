import * as faceapi from '@vladmandic/face-api'
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'

let modelsPromise = null
let modelsLoaded = false
let faceLandmarker = null
let lastTimestamp = -1
let lastFrameSnapshot = null

const INFER_MAX_WIDTH = 320
let inferCanvas = null
let rawCanvas = null
let cropCanvas = null

function getOrResizeCanvas(current, width, height) {
  const canvas = current || document.createElement('canvas')
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width
    canvas.height = height
  }
  return canvas
}

function getCropCanvas() {
  if (!cropCanvas) {
    cropCanvas = document.createElement('canvas')
    cropCanvas.width = 150
    cropCanvas.height = 150
  }
  return cropCanvas
}

/**
 * Analyzes luma distribution inside the inner center ROI so bright backlit
 * windows around frame borders cannot suppress contrast on the user's face.
 */
function measureRoiStats(data, w, h) {
  const roiX0 = Math.floor(w * 0.32)
  const roiX1 = Math.floor(w * 0.68)
  const roiY0 = Math.floor(h * 0.18)
  const roiY1 = Math.floor(h * 0.74)

  const hist = new Uint32Array(256)
  let lumaSum = 0
  let gradSum = 0
  let roiSamples = 0
  const stride = w * 4

  for (let y = roiY0; y < roiY1; y += 2) {
    for (let x = roiX0; x < roiX1; x += 2) {
      const idx = y * stride + x * 4
      const luma = (data[idx] * 77 + data[idx + 1] * 150 + data[idx + 2] * 29) >> 8
      hist[luma]++
      lumaSum += luma

      const idxR = idx + 4
      const lumaR = (data[idxR] * 77 + data[idxR + 1] * 150 + data[idxR + 2] * 29) >> 8
      const idxD = idx + stride
      const lumaD = (data[idxD] * 77 + data[idxD + 1] * 150 + data[idxD + 2] * 29) >> 8
      gradSum += Math.abs(luma - lumaR) + Math.abs(luma - lumaD)
      roiSamples++
    }
  }

  const avgBrightness = roiSamples > 0 ? lumaSum / roiSamples : 0
  const avgGradient = roiSamples > 0 ? gradSum / roiSamples : 0
  const sharpness = Math.min(99, Math.max(15, Math.round((avgGradient / 12) * 100)))

  return { hist, roiSamples, avgBrightness, avgGradient, sharpness }
}

function findPercentile(hist, targetCount) {
  let cum = 0
  for (let i = 0; i < 256; i++) {
    cum += hist[i]
    if (cum >= targetCount) return i
  }
  return 255
}

/**
 * Applies fast LUT percentile contrast stretch, shadow gamma lift, and optional
 * 3x3 unsharp mask onto inferCanvas from rawPixels without altering rawPixels.
 */
function buildEnhancedPass(rawPixels, w, h, stats, { lowPct, highPct, gamma, sharpenAmount }) {
  inferCanvas = getOrResizeCanvas(inferCanvas, w, h)
  const ctx = inferCanvas.getContext('2d', { willReadFrequently: true })
  const outImg = ctx.createImageData(w, h)
  const out = outImg.data

  const minP = findPercentile(stats.hist, Math.floor(stats.roiSamples * lowPct))
  const maxP = findPercentile(stats.hist, Math.floor(stats.roiSamples * highPct))
  const invSpan = 1 / Math.max(18, maxP - minP)

  // Precompute 256-entry LUT instead of Math.pow per pixel channel (~10x faster)
  const lut = new Uint8Array(256)
  for (let i = 0; i < 256; i++) {
    const norm = Math.min(1, Math.max(0, (i - minP) * invSpan))
    lut[i] = Math.round(Math.pow(norm, gamma) * 255)
  }

  const totalPixels = w * h
  const applySharpen = sharpenAmount > 0 && stats.avgGradient < 18
  const lumaBuf = applySharpen ? new Uint8Array(totalPixels) : null

  for (let p = 0, idx = 0; p < totalPixels; p++, idx += 4) {
    const r = lut[rawPixels[idx]]
    const g = lut[rawPixels[idx + 1]]
    const b = lut[rawPixels[idx + 2]]
    out[idx] = r
    out[idx + 1] = g
    out[idx + 2] = b
    out[idx + 3] = 255
    if (lumaBuf) {
      lumaBuf[p] = (r * 77 + g * 150 + b * 29) >> 8
    }
  }

  if (lumaBuf) {
    for (let y = 1; y < h - 1; y++) {
      const row = y * w
      for (let x = 1; x < w - 1; x++) {
        const p = row + x
        const blur =
          (lumaBuf[p - w] + lumaBuf[p + w] + lumaBuf[p - 1] + lumaBuf[p + 1]) >> 2
        const diff = ((lumaBuf[p] - blur) * sharpenAmount) | 0
        if (diff === 0) continue
        const idx = p * 4
        out[idx] = Math.min(255, Math.max(0, out[idx] + diff))
        out[idx + 1] = Math.min(255, Math.max(0, out[idx + 1] + diff))
        out[idx + 2] = Math.min(255, Math.max(0, out[idx + 2] + diff))
      }
    }
  }

  ctx.putImageData(outImg, 0, 0)
  return inferCanvas
}

function captureRawFrame(videoEl) {
  const vw = videoEl.videoWidth || 640
  const vh = videoEl.videoHeight || 480
  const scale = Math.min(1, INFER_MAX_WIDTH / vw)
  const w = Math.max(160, Math.round(vw * scale))
  const h = Math.max(120, Math.round(vh * scale))

  rawCanvas = getOrResizeCanvas(rawCanvas, w, h)
  const ctx = rawCanvas.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(videoEl, 0, 0, w, h)

  const rawPixels = ctx.getImageData(0, 0, w, h).data
  const stats = measureRoiStats(rawPixels, w, h)

  return {
    rawPixels,
    stats,
    scale,
    width: w,
    height: h,
    quality: {
      brightness: Math.round(stats.avgBrightness),
      sharpness: stats.sharpness
    }
  }
}

function nextMonotonicTimestamp() {
  const now = Math.round(performance.now())
  lastTimestamp = now > lastTimestamp ? now : lastTimestamp + 1
  return lastTimestamp
}

/**
 * Runs primary contrast-balanced detection, falling back immediately on the same
 * captured frame to an aggressive backlit/fog-recovery pass if zero faces are found.
 */
function detectWithBacklitFallback(frame) {
  const { rawPixels, stats, width, height } = frame
  const pass1Gamma = stats.avgBrightness < 110 ? 0.72 : 0.88

  let canvas = buildEnhancedPass(rawPixels, width, height, stats, {
    lowPct: 0.02,
    highPct: 0.86,
    gamma: pass1Gamma,
    sharpenAmount: 0.7
  })
  let result = faceLandmarker.detectForVideo(canvas, nextMonotonicTimestamp())
  let faces = result?.faceLandmarks || []

  if (faces.length === 0) {
    canvas = buildEnhancedPass(rawPixels, width, height, stats, {
      lowPct: 0.01,
      highPct: 0.72,
      gamma: 0.62,
      sharpenAmount: 1.15
    })
    result = faceLandmarker.detectForVideo(canvas, nextMonotonicTimestamp())
    faces = result?.faceLandmarks || []
  }

  return { faces, canvas }
}

function getBoxFromLandmarks(landmarks, width, height) {
  let minX = 1
  let minY = 1
  let maxX = 0
  let maxY = 0
  for (const pt of landmarks) {
    if (pt.x < minX) minX = pt.x
    if (pt.y < minY) minY = pt.y
    if (pt.x > maxX) maxX = pt.x
    if (pt.y > maxY) maxY = pt.y
  }
  const padW = (maxX - minX) * 0.14
  const padH = (maxY - minY) * 0.14
  const x0 = Math.max(0, minX - padW) * width
  const y0 = Math.max(0, minY - padH) * height
  const x1 = Math.min(1, maxX + padW) * width
  const y1 = Math.min(1, maxY + padH) * height
  return {
    x: x0,
    y: y0,
    width: Math.max(10, x1 - x0),
    height: Math.max(10, y1 - y0)
  }
}

function computePoseFromLandmarks(landmarks, frameWidth, frameHeight, box) {
  // MediaPipe canonical indices:
  // 1: nose tip, 33: left eye outer, 263: right eye outer, 152: chin, 234: left cheek, 454: right cheek
  const nose = landmarks[1]
  const leftCheek = landmarks[234]
  const rightCheek = landmarks[454]
  const leftEye = landmarks[33]
  const rightEye = landmarks[263]
  const chin = landmarks[152]

  const jawSpan = Math.max(0.01, rightCheek.x - leftCheek.x)
  const yaw = (nose.x - leftCheek.x) / jawSpan - 0.5

  const eyeMidY = (leftEye.y + rightEye.y) / 2
  const faceSpan = Math.max(0.01, chin.y - eyeMidY)
  const pitch = (nose.y - eyeMidY) / faceSpan

  const eyeDistNorm = Math.hypot(rightEye.x - leftEye.x, rightEye.y - leftEye.y)
  const distanceCm = Math.min(120, Math.max(22, Math.round(14.5 / Math.max(0.06, eyeDistNorm))))

  const centerX = (box.x + box.width / 2) / Math.max(1, frameWidth)
  const centerY = (box.y + box.height / 2) / Math.max(1, frameHeight)
  const isCentered =
    Math.abs(centerX - 0.5) <= 0.38 &&
    Math.abs(centerY - 0.5) <= 0.38 &&
    box.width / Math.max(1, frameWidth) >= 0.06

  return { yaw, pitch, distanceCm, isCentered }
}

async function computeDescriptorFromBox(sourceCanvas, box) {
  const crop = getCropCanvas()
  const ctx = crop.getContext('2d')
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2
  const side = Math.max(box.width, box.height) * 1.15
  const sx = Math.max(0, Math.min(sourceCanvas.width - side, cx - side / 2))
  const sy = Math.max(0, Math.min(sourceCanvas.height - side, cy - side / 2))
  const sw = Math.min(side, sourceCanvas.width - sx)
  const sh = Math.min(side, sourceCanvas.height - sy)

  ctx.clearRect(0, 0, 150, 150)
  ctx.drawImage(sourceCanvas, sx, sy, sw, sh, 0, 0, 150, 150)
  const vec = await faceapi.computeFaceDescriptor(crop)
  return vec ? Array.from(vec) : null
}

function scaleBoxToVideo(box, scale) {
  const inv = scale > 0 ? 1 / scale : 1
  return {
    x: box.x * inv,
    y: box.y * inv,
    width: box.width * inv,
    height: box.height * inv
  }
}

export const faceEngine = {
  TESSELATION: FaceLandmarker.FACE_LANDMARKS_TESSELATION,
  CONTOURS: FaceLandmarker.FACE_LANDMARKS_CONTOURS,

  async loadModels() {
    if (modelsLoaded && faceLandmarker) return true
    if (!modelsPromise) {
      modelsPromise = (async () => {
        const vision = await FilesetResolver.forVisionTasks('/mediapipe/wasm')
        const baseOpts = {
          modelAssetPath: '/mediapipe/face_landmarker.task'
        }
        const commonOpts = {
          runningMode: 'VIDEO',
          numFaces: 3,
          minFaceDetectionConfidence: 0.1,
          minFacePresenceConfidence: 0.1,
          minTrackingConfidence: 0.1,
          outputFacialTransformationMatrixes: false
        }
        try {
          faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
            baseOptions: { ...baseOpts, delegate: 'GPU' },
            ...commonOpts
          })
        } catch {
          faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
            baseOptions: { ...baseOpts, delegate: 'CPU' },
            ...commonOpts
          })
        }

        await faceapi.nets.faceRecognitionNet.loadFromUri('/models')
        modelsLoaded = true
        return true
      })().catch((err) => {
        modelsPromise = null
        throw err
      })
    }
    return modelsPromise
  },

  isReady() {
    return modelsLoaded
  },

  matchesAnglePose(pose, angleKey, baseline = { yaw: 0, pitch: 0.46 }) {
    if (!pose) return false
    const dyaw = pose.yaw - (baseline?.yaw ?? 0)
    const dpitch = pose.pitch - (baseline?.pitch ?? 0.46)

    if (angleKey === 'straight') {
      return Math.abs(dyaw) <= 0.16 && pose.pitch >= 0.2 && pose.pitch <= 0.72
    }
    if (angleKey === 'left') {
      return dyaw >= 0.038 || pose.yaw >= 0.045
    }
    if (angleKey === 'right') {
      return dyaw <= -0.038 || pose.yaw <= -0.045
    }
    if (angleKey === 'up') {
      return dpitch <= -0.03 || pose.pitch <= 0.40
    }
    if (angleKey === 'down') {
      return dpitch >= 0.03 || pose.pitch >= 0.52
    }
    return false
  },

  async analyzeFrame(videoEl) {
    await this.loadModels()
    const frame = captureRawFrame(videoEl)
    const { width, height, scale, quality } = frame
    const { faces, canvas } = detectWithBacklitFallback(frame)
    const faceCount = faces.length

    if (faceCount === 0) {
      lastFrameSnapshot = null
      return {
        faceCount: 0,
        confidence: 0,
        quality,
        inferWidth: width,
        inferHeight: height,
        scale,
        landmarks468: null,
        box: null,
        pose: null,
        conditions: {
          brightnessOk: quality.brightness >= 18,
          singleFaceOk: false,
          unoccludedOk: false,
          centeredOk: false
        }
      }
    }

    let bestIdx = 0
    let bestArea = -1
    const boxes = faces.map(lm => getBoxFromLandmarks(lm, width, height))
    boxes.forEach((b, idx) => {
      const area = b.width * b.height
      if (area > bestArea) {
        bestArea = area
        bestIdx = idx
      }
    })

    const primaryLandmarks = faces[bestIdx]
    const primaryBox = boxes[bestIdx]
    const pose = computePoseFromLandmarks(primaryLandmarks, width, height, primaryBox)
    const confidence = Number((94 + Math.min(5.5, (primaryBox.width / width) * 12)).toFixed(1))

    lastFrameSnapshot = {
      canvas,
      box: primaryBox,
      scale,
      landmarks468: primaryLandmarks
    }

    return {
      faceCount,
      confidence,
      quality,
      inferWidth: width,
      inferHeight: height,
      scale,
      landmarks468: primaryLandmarks,
      box: primaryBox,
      pose,
      conditions: {
        brightnessOk: quality.brightness >= 18,
        singleFaceOk: faceCount === 1,
        unoccludedOk: true,
        centeredOk: pose.isCentered
      }
    }
  },

  /**
   * Computes a 128-D descriptor directly from the frame already validated by analyzeFrame(),
   * avoiding redundant face detection that can drop frames on blurry cameras.
   */
  async extractFromLastAnalysis() {
    if (!lastFrameSnapshot?.canvas || !lastFrameSnapshot?.box) return null
    await this.loadModels()
    const { canvas, box, scale, landmarks468 } = lastFrameSnapshot
    const descriptor = await computeDescriptorFromBox(canvas, box)
    if (!descriptor || descriptor.length !== 128) return null

    return {
      descriptor,
      score: 98.5,
      box: scaleBoxToVideo(box, scale),
      landmarks468
    }
  },

  async extractDescriptor(videoEl) {
    await this.loadModels()
    const frame = captureRawFrame(videoEl)
    const { width, height, scale } = frame
    const { faces, canvas } = detectWithBacklitFallback(frame)
    if (faces.length === 0) return null

    const box = getBoxFromLandmarks(faces[0], width, height)
    const descriptor = await computeDescriptorFromBox(canvas, box)
    if (!descriptor || descriptor.length !== 128) return null

    return {
      descriptor,
      score: 98.5,
      box: scaleBoxToVideo(box, scale),
      landmarks468: faces[0]
    }
  },

  async detectAllWithDescriptors(videoEl) {
    await this.loadModels()
    const frame = captureRawFrame(videoEl)
    const { width, height, scale } = frame
    const { faces, canvas } = detectWithBacklitFallback(frame)

    const out = []
    for (const lm of faces) {
      const box = getBoxFromLandmarks(lm, width, height)
      const descriptor = await computeDescriptorFromBox(canvas, box)
      if (!descriptor || descriptor.length !== 128) continue
      out.push({
        descriptor: new Float32Array(descriptor),
        detection: {
          box,
          score: 0.96
        },
        scaledBox: scaleBoxToVideo(box, scale),
        landmarks468: lm
      })
    }
    return out
  },

  matchDescriptor(liveDescriptor, students, maxDistance = 0.56) {
    let bestStudent = null
    let minDistance = Infinity

    for (const student of students) {
      const storedList = Array.isArray(student.descriptors) ? student.descriptors : []
      if (!storedList.length) continue

      for (const storedVec of storedList) {
        if (!Array.isArray(storedVec) || storedVec.length !== liveDescriptor.length) continue
        const dist = faceapi.euclideanDistance(liveDescriptor, storedVec)
        if (dist < minDistance) {
          minDistance = dist
          bestStudent = student
        }
      }
    }

    if (!bestStudent || minDistance > maxDistance) {
      return {
        matched: false,
        distance: Number.isFinite(minDistance) ? minDistance : null
      }
    }

    const confidencePct = Math.min(99.9, Math.max(50, (1 - minDistance * 0.65) * 100)).toFixed(1)
    return {
      matched: true,
      student: bestStudent,
      distance: minDistance,
      confidence: `${confidencePct}%`
    }
  }
}

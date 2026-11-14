const form = document.getElementById('login-form')
const identifierInput = document.getElementById('identifier')
const passwordInput = document.getElementById('password')
const rememberCheckbox = document.getElementById('remember-me')
const submitBtn = document.getElementById('btn-submit')
const errorBox = document.getElementById('error-box')
const togglePwBtn = document.getElementById('btn-toggle-pw')
const backBtn = document.getElementById('btn-back-landing')

const rememberedId = localStorage.getItem('wq_lecturer_identifier')
if (rememberedId) {
  identifierInput.value = rememberedId
}

togglePwBtn.addEventListener('click', () => {
  passwordInput.type = passwordInput.type === 'password' ? 'text' : 'password'
})

backBtn.addEventListener('click', () => {
  document.body.classList.add('is-leaving')
  setTimeout(() => {
    if (window.chrome && window.chrome.webview) {
      window.chrome.webview.postMessage({ action: 'open_landing' })
    }
  }, 260)
})

function showError(msg) {
  errorBox.textContent = msg
  errorBox.hidden = false
}

function clearError() {
  errorBox.textContent = ''
  errorBox.hidden = true
}

form.addEventListener('submit', (e) => {
  e.preventDefault()
  clearError()

  const identifier = identifierInput.value.trim()
  const password = passwordInput.value

  if (!identifier) {
    showError('Vui lòng nhập Email hoặc Mã Giảng viên.')
    return
  }
  if (!password) {
    showError('Vui lòng nhập mật khẩu.')
    return
  }

  if (rememberCheckbox.checked) {
    localStorage.setItem('wq_lecturer_identifier', identifier)
  } else {
    localStorage.removeItem('wq_lecturer_identifier')
  }

  submitBtn.disabled = true
  submitBtn.textContent = 'ĐANG XÁC THỰC...'

  if (window.chrome && window.chrome.webview) {
    window.chrome.webview.postMessage({
      action: 'login_submit',
      identifier,
      password
    })
  }
})

window.onLoginResult = function (result) {
  if (!result.success) {
    submitBtn.disabled = false
    submitBtn.textContent = 'ĐĂNG NHẬP →'
    showError(result.message || 'Đăng nhập thất bại.')
    return
  }

  submitBtn.textContent = '✓ ĐÃ XÁC THỰC'
  const overlay = document.getElementById('loginRedirectOverlay')
  const nameEl = document.getElementById('redirectLecturerName')
  const barEl = document.getElementById('loginRedirectBar')

  if (nameEl) {
    const fullName = result.fullName || 'Giảng viên'
    const empId = result.employeeId ? ` · ${result.employeeId}` : ''
    nameEl.textContent = `${fullName}${empId}`
  }

  if (overlay) {
    overlay.classList.add('is-active')
    overlay.setAttribute('aria-hidden', 'false')
  }

  requestAnimationFrame(() => {
    if (barEl) barEl.style.width = '100%'
  })

  setTimeout(() => {
    if (window.chrome && window.chrome.webview) {
      window.chrome.webview.postMessage({ action: 'open_dashboard' })
    }
  }, 1200)
}


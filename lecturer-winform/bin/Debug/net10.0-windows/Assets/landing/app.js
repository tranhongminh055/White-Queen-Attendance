let isRedirecting = false

function sendToWinForms(action, payload = {}) {
  if (window.chrome && window.chrome.webview) {
    window.chrome.webview.postMessage({ action, ...payload })
  }
}

function triggerRedirectAnimation(action) {
  if (isRedirecting) return
  isRedirecting = true

  const overlay = document.getElementById('redirectOverlay')
  const statusEl = document.getElementById('redirectStatus')
  const barEl = document.getElementById('redirectBar')

  document.body.classList.add('is-redirecting')
  if (overlay) {
    overlay.classList.add('is-active')
    overlay.setAttribute('aria-hidden', 'false')
  }

  requestAnimationFrame(() => {
    if (barEl) barEl.style.width = '100%'
  })

  setTimeout(() => {
    if (statusEl) statusEl.textContent = 'ĐANG CHUYỂN HƯỚNG ĐẾN CỔNG ĐĂNG NHẬP...'
  }, 320)

  setTimeout(() => {
    sendToWinForms(action)
  }, 820)
}

document.querySelectorAll('[data-action]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const action = btn.getAttribute('data-action')
    if (action === 'start_attendance') {
      triggerRedirectAnimation(action)
    } else {
      sendToWinForms(action)
    }
  })
})

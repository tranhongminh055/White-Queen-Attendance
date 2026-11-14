function sendToWinForms(action, payload = {}) {
  if (window.chrome && window.chrome.webview) {
    window.chrome.webview.postMessage({ action, ...payload })
  }
}

document.querySelectorAll('[data-action]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const action = btn.getAttribute('data-action')
    sendToWinForms(action)
  })
})

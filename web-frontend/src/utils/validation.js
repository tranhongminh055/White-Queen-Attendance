// Shared validation helpers for SpaceX Biometric Auth Forms

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const EMPLOYEE_ID_REGEX = /^[A-Za-z]{2,5}-?\d{3,6}$/
const LOGIN_ID_REGEX = /^[A-Za-z0-9_-]{4,20}$/
const FULL_NAME_REGEX = /^[\p{L}\s'.-]{4,60}$/u

export function validateEmail(value) {
  const v = (value || '').trim()
  if (!v) return 'Vui lòng nhập email!'
  if (!EMAIL_REGEX.test(v)) return 'Email không đúng định dạng (vd: nhanvien@spacex.com)!'
  return ''
}

export function validateLoginIdentifier(value) {
  const v = (value || '').trim()
  if (!v) return 'Vui lòng nhập email hoặc mã nhân viên!'
  if (v.includes('@')) {
    if (!EMAIL_REGEX.test(v)) return 'Email không đúng định dạng (vd: nhanvien@spacex.com)!'
    return ''
  }
  if (v.length < 4) return 'Mã nhân viên phải có ít nhất 4 ký tự!'
  if (!LOGIN_ID_REGEX.test(v)) return 'Mã nhân viên không hợp lệ (chỉ gồm chữ, số, dấu - hoặc _)!'
  return ''
}

export function validateFullName(value) {
  const v = (value || '').trim()
  if (!v) return 'Vui lòng nhập họ và tên!'
  if (v.length < 4) return 'Họ và tên phải có ít nhất 4 ký tự!'
  if (!FULL_NAME_REGEX.test(v)) return 'Họ và tên chỉ được chứa chữ cái và khoảng trắng!'
  return ''
}

export function validateEmployeeId(value) {
  const v = (value || '').trim()
  if (!v) return 'Vui lòng nhập mã nhân viên!'
  if (v.length < 5) return 'Mã nhân viên quá ngắn (vd: SX-00123)!'
  if (!EMPLOYEE_ID_REGEX.test(v)) return 'Mã nhân viên sai định dạng (vd: SX-00123 hoặc SV202601)!'
  return ''
}

export function evaluatePasswordStrength(value) {
  const v = value || ''
  if (!v) return { level: 0, label: '', color: '#475569', missing: ['Tối thiểu 8 ký tự'] }

  const checks = {
    length: v.length >= 8,
    caseMix: /[a-z]/.test(v) && /[A-Z]/.test(v),
    digit: /\d/.test(v),
    special: /[^A-Za-z0-9]/.test(v)
  }

  const missing = []
  if (!checks.length) missing.push('ít nhất 8 ký tự')
  if (!checks.caseMix) missing.push('chữ hoa & chữ thường')
  if (!checks.digit) missing.push('chữ số')
  if (!checks.special) missing.push('ký tự đặc biệt (@, #, !...)')

  const score = Object.values(checks).filter(Boolean).length

  if (!checks.length || score <= 1) {
    return { level: 1, label: 'QUÁ YẾU', color: '#f43f5e', missing }
  }
  if (score === 2) {
    return { level: 2, label: 'YẾU', color: '#f59e0b', missing }
  }
  if (score === 3) {
    return { level: 3, label: 'KHÁ', color: '#38bdf8', missing }
  }
  return { level: 4, label: 'MẠNH', color: '#10b981', missing: [] }
}

export function validateRegistrationPassword(value) {
  const v = value || ''
  if (!v) return 'Vui lòng nhập mật khẩu!'
  if (v.length < 8) return 'Mật khẩu phải có ít nhất 8 ký tự!'
  const strength = evaluatePasswordStrength(v)
  if (strength.level < 3) {
    return `Mật khẩu quá yếu! Cần thêm: ${strength.missing.join(', ')}.`
  }
  return ''
}

export function validateLoginPassword(value) {
  const v = value || ''
  if (!v) return 'Vui lòng nhập mật khẩu!'
  if (v.length < 6) return 'Mật khẩu phải có ít nhất 6 ký tự!'
  return ''
}


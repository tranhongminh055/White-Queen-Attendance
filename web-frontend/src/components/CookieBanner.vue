<script setup>
defineProps({
  visible: {
    type: Boolean,
    default: true
  },
  attention: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['accept', 'reject'])

function accept() {
  localStorage.setItem('facethic_cookies', 'accepted')
  emit('accept')
}

function reject() {
  localStorage.setItem('facethic_cookies', 'rejected')
  emit('reject')
}
</script>

<template>
  <transition name="slide-up">
    <div v-if="visible" class="cookie-banner-wrapper" :class="{ attention }">
      <div class="cookie-container">
        <!-- Left: Text info -->
        <div class="cookie-text-col">
          <div class="cookie-headline">We use Cookies</div>
          <p class="cookie-description">
            We use cookies and similar technologies to improve your experience. Learn more about our
            <a href="#cookie-policy" class="cookie-link" @click.prevent>Cookie Policy</a>
          </p>
        </div>

        <!-- Right: Action buttons matching exact screenshot -->
        <div class="cookie-btn-col">
          <button class="btn-cookie-reject" @click="reject">
            Reject
          </button>
          <button class="btn-cookie-accept" @click="accept">
            Accept
          </button>
        </div>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.cookie-banner-wrapper {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 99999;
  background: rgba(0, 0, 0, 0.96);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 -10px 30px rgba(0, 0, 0, 0.8);
  padding: 18px 48px;
  transition: border-color 0.25s ease, box-shadow 0.25s ease;
}

.cookie-banner-wrapper.attention {
  border-top-color: #FFE600;
  box-shadow: 0 -10px 40px rgba(255, 230, 0, 0.28);
  animation: cookieShake 0.42s ease;
}

@keyframes cookieShake {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-6px); }
  40% { transform: translateX(6px); }
  60% { transform: translateX(-4px); }
  80% { transform: translateX(4px); }
}

.cookie-container {
  max-width: 1440px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
}

.cookie-text-col {
  flex: 1;
  max-width: 900px;
}

.cookie-headline {
  font-family: var(--font-sans);
  font-size: 1.05rem;
  font-weight: 800;
  color: #FFE600;
  margin-bottom: 4px;
  letter-spacing: -0.01em;
}

.cookie-description {
  font-family: var(--font-sans);
  font-size: 0.875rem;
  color: #cbd5e1;
  line-height: 1.5;
  margin: 0;
}

.cookie-link {
  color: #FFE600;
  text-decoration: underline;
  font-weight: 600;
  transition: opacity 0.2s;
}
.cookie-link:hover {
  opacity: 0.8;
}

.cookie-btn-col {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

/* Exact button styles from user's screenshot */
.btn-cookie-reject {
  background: transparent;
  color: #FFE600;
  border: 1.5px solid #FFE600;
  padding: 9px 24px;
  border-radius: 8px;
  font-family: var(--font-sans);
  font-weight: 700;
  font-size: 0.925rem;
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
}

.btn-cookie-reject:hover {
  background: rgba(255, 230, 0, 0.12);
  transform: translateY(-1px);
}

.btn-cookie-accept {
  background: #FFE600;
  color: #000000;
  border: 1.5px solid #FFE600;
  padding: 9px 24px;
  border-radius: 8px;
  font-family: var(--font-sans);
  font-weight: 700;
  font-size: 0.925rem;
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
  box-shadow: 0 4px 15px rgba(255, 230, 0, 0.25);
}

.btn-cookie-accept:hover {
  background: #FFF033;
  border-color: #FFF033;
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(255, 230, 0, 0.4);
}

/* Slide up animation */
.slide-up-enter-active,
.slide-up-leave-active {
  transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease;
}

.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(100%);
  opacity: 0;
}

@media (max-width: 768px) {
  .cookie-banner-wrapper {
    padding: 16px 20px;
  }
  .cookie-container {
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
  }
  .cookie-btn-col {
    width: 100%;
    justify-content: flex-end;
  }
}
</style>

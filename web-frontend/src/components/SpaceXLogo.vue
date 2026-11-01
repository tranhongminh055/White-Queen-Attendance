<template>
  <div class="spacex-brand-box">
    <!-- SpaceX Iconic Orbital Icon -->
    <div class="spacex-icon-emblem">
      <svg viewBox="0 0 24 24" fill="currentColor" class="spacex-icon-svg">
        <path d="M24 7.417C8.882 8.287 1.89 14.75.321 16.28L0 16.583h2.797C10.356 9.005 21.222 7.663 24 7.417zm-17.046 6.35c-.472.321-.945.68-1.398 1.02l2.457 1.796h2.778zM2.948 10.8H.189l3.25 2.381c.473-.321 1.02-.661 1.512-.945Z"/>
      </svg>
    </div>

    <!-- Official Style SPACEX Logotype -->
    <div class="spacex-typography">
      <span class="letter">S</span>
      <span class="letter">P</span>
      <span class="letter">A</span>
      <span class="letter">C</span>
      <span class="letter">E</span>
      <span class="letter letter-x">
        X
        <span class="x-swoosh"></span>
      </span>
    </div>
  </div>
</template>

<style scoped>
.spacex-brand-box {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  user-select: none;
}

.spacex-icon-emblem {
  width: 32px;
  height: 32px;
  color: #FFE600; /* Signature yellow accent matching the site */
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: transform 0.3s ease;
}

.spacex-brand-box:hover .spacex-icon-emblem {
  transform: rotate(-15deg) scale(1.1);
}

.spacex-icon-svg {
  width: 100%;
  height: 100%;
}

.spacex-typography {
  display: flex;
  align-items: center;
  gap: 5px;
  font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
  font-weight: 900;
  font-size: 1.5rem;
  letter-spacing: 0.18em;
  color: #ffffff;
  line-height: 1;
}

.letter {
  display: inline-block;
  transition: color 0.2s ease;
}

.spacex-brand-box:hover .letter {
  color: #f8fafc;
}

.letter-x {
  position: relative;
  color: #ffffff;
}

.x-swoosh {
  position: absolute;
  top: -3px;
  right: -5px;
  width: 18px;
  height: 2px;
  background: #FFE600;
  border-radius: 9999px;
  transform: rotate(-35deg);
  box-shadow: 0 0 8px #FFE600;
}
</style>

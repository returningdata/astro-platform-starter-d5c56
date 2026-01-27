console.log("KruigerLabs Loaded Successfully");

// Starfield Canvas Animation
(function() {
  const canvas = document.getElementById('starfield');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const section = canvas.parentElement;

  // Configuration
  const PARTICLE_COUNT = 150;
  const particles = [];
  let mouseX = 0;
  let mouseY = 0;
  let targetMouseX = 0;
  let targetMouseY = 0;

  // Resize handler
  function resizeCanvas() {
    canvas.width = section.offsetWidth;
    canvas.height = section.offsetHeight;
  }

  // Initialize particles
  function initParticles() {
    particles.length = 0;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        radius: Math.random() * 1.4 + 0.8,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        alpha: Math.random() * 0.6 + 0.2,
        targetAlpha: Math.random() * 0.6 + 0.2,
        twinkleSpeed: Math.random() * 0.02 + 0.005,
        // Color variation: mostly cyan/blue with some purple
        hue: Math.random() < 0.7 ? 185 + Math.random() * 20 : 260 + Math.random() * 30,
        sat: 80 + Math.random() * 20
      });
    }
  }

  // Draw and update particles
  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Smooth mouse tracking for parallax
    mouseX += (targetMouseX - mouseX) * 0.05;
    mouseY += (targetMouseY - mouseY) * 0.05;

    particles.forEach(p => {
      // Twinkle effect
      if (Math.random() < 0.01) {
        p.targetAlpha = Math.random() * 0.7 + 0.15;
      }
      p.alpha += (p.targetAlpha - p.alpha) * p.twinkleSpeed;

      // Parallax offset based on mouse
      const parallaxX = mouseX * (p.radius * 0.8);
      const parallaxY = mouseY * (p.radius * 0.8);

      // Update position
      p.x += p.vx;
      p.y += p.vy;

      // Wrap around edges
      if (p.x < 0) p.x = canvas.width;
      if (p.x > canvas.width) p.x = 0;
      if (p.y < 0) p.y = canvas.height;
      if (p.y > canvas.height) p.y = 0;

      // Draw particle with glow
      const drawX = p.x + parallaxX;
      const drawY = p.y + parallaxY;

      // Outer glow
      const gradient = ctx.createRadialGradient(drawX, drawY, 0, drawX, drawY, p.radius * 3);
      gradient.addColorStop(0, `hsla(${p.hue}, ${p.sat}%, 70%, ${p.alpha * 0.5})`);
      gradient.addColorStop(1, `hsla(${p.hue}, ${p.sat}%, 70%, 0)`);
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(drawX, drawY, p.radius * 3, 0, Math.PI * 2);
      ctx.fill();

      // Core
      ctx.fillStyle = `hsla(${p.hue}, ${p.sat}%, 85%, ${p.alpha})`;
      ctx.beginPath();
      ctx.arc(drawX, drawY, p.radius, 0, Math.PI * 2);
      ctx.fill();
    });

    requestAnimationFrame(animate);
  }

  // Mouse move handler for parallax
  function handleMouseMove(e) {
    const rect = section.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    targetMouseX = (e.clientX - rect.left - centerX) / centerX * 15;
    targetMouseY = (e.clientY - rect.top - centerY) / centerY * 15;
  }

  // Initialize
  resizeCanvas();
  initParticles();
  animate();

  // Event listeners
  window.addEventListener('resize', () => {
    resizeCanvas();
    initParticles();
  });
  section.addEventListener('mousemove', handleMouseMove);
  section.addEventListener('mouseleave', () => {
    targetMouseX = 0;
    targetMouseY = 0;
  });
})();

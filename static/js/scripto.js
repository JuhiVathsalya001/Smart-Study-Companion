(function(){
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');

  const config = {
    count: 85, maxDist: 160, speed: 0.45,
    dotMin: 1.6, dotMax: 3.0,
    lineAlphaBase: 0.18, dotAlpha: 0.95
  };

  let particles = [];

  function resize(){
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    regenerate();
  }

  function regenerate(){
    particles = [];
    for (let i=0; i<config.count; i++){
      particles.push({
        x: Math.random()*canvas.width,
        y: Math.random()*canvas.height,
        vx: (Math.random()-0.5)*config.speed,
        vy: (Math.random()-0.5)*config.speed,
        r: config.dotMin + Math.random()*(config.dotMax - config.dotMin)
      });
    }
  }

  function draw(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle = '#0d0d0f';
    ctx.fillRect(0,0,canvas.width,canvas.height);

    ctx.lineWidth = 0.8;
    for (let i=0;i<particles.length;i++){
      for (let j=i+1;j<particles.length;j++){
        const a = particles[i], b = particles[j];
        const dx = a.x - b.x, dy = a.y - b.y;
        const d2 = dx*dx + dy*dy;
        const maxD = config.maxDist;
        if (d2 < maxD*maxD){
          const alpha = (1 - Math.sqrt(d2)/(maxD)) * config.lineAlphaBase;
          ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }

    for (let p of particles){
      ctx.beginPath();
      ctx.fillStyle = `rgba(255,255,255,${config.dotAlpha})`;
      ctx.shadowColor = 'rgba(255,255,255,0.06)';
      ctx.shadowBlur = 4;
      ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    for (let p of particles){
      p.x += p.vx; p.y += p.vy;
      p.vx += (Math.random()-0.5)*0.02;
      p.vy += (Math.random()-0.5)*0.02;
      p.vx = Math.max(-1.3, Math.min(1.3, p.vx));
      p.vy = Math.max(-1.1, Math.min(1.1, p.vy));
      if (p.x < -10) p.x = canvas.width + 10;
      if (p.x > canvas.width + 10) p.x = -10;
      if (p.y < -10) p.y = canvas.height + 10;
      if (p.y > canvas.height + 10) p.y = -10;
    }

    requestAnimationFrame(draw);
  }

  window.addEventListener('resize', resize);
  resize();
  draw();

  document.querySelectorAll('.glass-btn[href^="#"]').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      document.querySelector(link.getAttribute('href')).scrollIntoView({
        behavior: 'smooth'
      });
    });
  });

  const arrow = document.querySelector('.scroll-down');
  if (arrow) {
    arrow.addEventListener('click', () => {
      document.querySelector('#features').scrollIntoView({ behavior: 'smooth' });
    });
  }

})();

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
      }
    });
  }, { threshold: 0.2 });

  document.querySelectorAll('.content-section').forEach(section => {
    observer.observe(section);
  });

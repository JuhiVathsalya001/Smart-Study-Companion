/* ----------------------------------------------------
   BACKGROUND PARTICLE ANIMATION
---------------------------------------------------- */
(function () {
  const canvas = document.getElementById("bgCanvas");
  const ctx = canvas.getContext("2d");

  const config = {
    count: 85,
    maxDist: 160,
    speed: 0.45,
    dotMin: 1.6,
    dotMax: 3.0,
    lineAlphaBase: 0.18,
    dotAlpha: 0.95,
  };

  let particles = [];

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    regen();
  }

  function regen() {
    particles = [];
    for (let i = 0; i < config.count; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * config.speed,
        vy: (Math.random() - 0.5) * config.speed,
        r: config.dotMin + Math.random() * (config.dotMax - config.dotMin),
      });
    }
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#0f1720";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.lineWidth = 0.8;
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const a = particles[i],
          b = particles[j];
        const dx = a.x - b.x,
          dy = a.y - b.y;
        const d2 = dx * dx + dy * dy;
        const maxD = config.maxDist;

        if (d2 < maxD * maxD) {
          const alpha = (1 - Math.sqrt(d2) / maxD) * config.lineAlphaBase;
          ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }

    for (let p of particles) {
      ctx.beginPath();
      ctx.fillStyle = `rgba(255,255,255,${config.dotAlpha})`;
      ctx.shadowColor = "rgba(255,255,255,0.06)";
      ctx.shadowBlur = 4;
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    for (let p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vx += (Math.random() - 0.5) * 0.02;
      p.vy += (Math.random() - 0.5) * 0.02;
      p.vx = Math.max(-1.3, Math.min(1.3, p.vx));
      p.vy = Math.max(-1.1, Math.min(1.1, p.vy));

      if (p.x < -10) p.x = canvas.width + 10;
      if (p.x > canvas.width + 10) p.x = -10;
      if (p.y < -10) p.y = canvas.height + 10;
      if (p.y > canvas.height + 10) p.y = -10;
    }

    requestAnimationFrame(draw);
  }

  window.addEventListener("resize", resize);
  resize();
  draw();
})();

/* ----------------------------------------------------
   SESSION + CAMERA + REPORT LOGIC
---------------------------------------------------- */
(function () {
  const video = document.getElementById("video");
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  const startBtn = document.getElementById("startBtn");
  const stopBtn = document.getElementById("stopBtn");
  const timerInput = document.getElementById("timerInput");
  const timeLeftEl = document.getElementById("timeLeft");
  const statusEl = document.getElementById("status");
  const reportPreview = document.getElementById("reportPreview");

  let sessionId = null,
    sendInterval = null,
    countdownInterval = null,
    remainingSec = 0,
    sessionStartTime = null;

  window.totalSessionTime = 0; // used by feedback

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });
      video.srcObject = stream;
      await video.play();
    } catch (e) {
      console.error("Camera error:", e);
      alert("Unable to access camera: " + (e.message || e));
    }
  }

  function formatTime(s) {
    const mm = String(Math.floor(s / 60)).padStart(2, "0");
    const ss = String(s % 60).padStart(2, "0");
    return `${mm}:${ss}`;
  }

  async function startSession() {
    const timerMinutes = parseInt(timerInput.value) || 0;
    startBtn.disabled = true;

    statusEl.innerText = "Starting...";
    statusEl.style.color = "#4facfe";

    try {
      const res = await fetch("/start_session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timer_minutes: timerMinutes }),
      });

      const data = await res.json();
      if (!data.session_id) throw new Error("Invalid session response");

      sessionId = data.session_id;
      sessionStartTime = Date.now();

      statusEl.innerText = "Running";
      statusEl.style.color = "#8fff9a";
      stopBtn.disabled = false;

      sendInterval = setInterval(sendFrame, 1500);

      if (timerMinutes > 0) {
        remainingSec = timerMinutes * 60;
        timeLeftEl.innerText = formatTime(remainingSec);
        countdownInterval = setInterval(() => {
          remainingSec--;
          timeLeftEl.innerText = formatTime(Math.max(0, remainingSec));
          if (remainingSec <= 0) {
            clearInterval(countdownInterval);
            endSession();
          }
        }, 1000);
      } else {
        timeLeftEl.innerText = "Manual";
      }
    } catch (e) {
      console.error(e);
      alert("Failed to start session.");
      startBtn.disabled = false;
      statusEl.innerText = "Idle";
    }
  }

  async function sendFrame() {
    if (!sessionId || !video.videoWidth) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const img = canvas.toDataURL("image/jpeg", 0.7);

    try {
      const res = await fetch("/analyze_frame", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, image: img }),
      });

      const json = await res.json();
      if (json.frame_result) {
        const fr = json.frame_result;
        document.getElementById("frames").innerText = fr.frames_total || 0;
        document.getElementById("engage").innerText =
          fr.engagement_label || "-";
        document.getElementById("conf").innerText =
          fr.engagement_prob !== undefined ? fr.engagement_prob : "-";
        document.getElementById("phone").innerText = fr.phone_detected
          ? "📱 Detected"
          : "No Phone";
      }
    } catch (e) {
      console.warn("Frame send error:", e);
    }
  }

  // async function endSession() {
  //   if (!sessionId) return;

  //   if (sendInterval) clearInterval(sendInterval);
  //   if (countdownInterval) clearInterval(countdownInterval);

  //   statusEl.innerText = "Stopping...";
  //   statusEl.style.color = "#ffbb55";

  //   try {
  //     const res = await fetch("/end_session", {
  //       method: "POST",
  //       headers: { "Content-Type": "application/json" },
  //       body: JSON.stringify({ session_id: sessionId }),
  //     });

  //     const data = await res.json();

  //     if (data.report) {
  //       const r = data.report;

  //       reportPreview.innerHTML = `
  //         <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
  //           <strong>Session Report</strong>
  //           <a class="download-link" href="${r.csv_path.replace(
  //             /^\/?/,
  //             "/"
  //           )}">Download CSV</a>
  //         </div>
  //         <div class="muted">Duration: <strong>${r.duration_seconds}s</strong></div>
  //         <div class="muted">Frames: <strong>${r.frames}</strong></div>
  //         <div class="muted">Engaged: <strong>${r.engaged_pct}%</strong></div>
  //         <div class="muted">Not Engaged: <strong>${r.not_engaged_pct}%</strong></div>
  //         <div class="muted">Phone: <strong>${r.phone_pct}%</strong></div>
  //         <div class="muted">Blinks: <strong>${r.blinks}</strong></div>
  //         <div class="muted">Yawns: <strong>${r.yawns}</strong></div>
  //       `;

  //       reportPreview.style.opacity = 0;
  //       setTimeout(() => {
  //         reportPreview.style.transition = "opacity .36s";
  //         reportPreview.style.opacity = 1;
  //       }, 30);
  //     }

  //     // store total session time for feedback
  //     window.totalSessionTime = Math.floor((Date.now() - sessionStartTime) / 1000);

  //     // ⭐ SHOW FEEDBACK POPUP
  //     showFeedbackPopup();

  //     statusEl.innerText = "Stopped";
  //     statusEl.style.color = "#ff6f61";
  //   } catch (e) {
  //     console.error(e);
  //     alert("Error ending session.");
  //     statusEl.innerText = "Idle";
  //   }

  //   sessionId = null;
  //   startBtn.disabled = false;
  //   stopBtn.disabled = true;
  // }

  async function endSession(){
  if (!sessionId) return;
  if (sendInterval) clearInterval(sendInterval);
  if (countdownInterval) clearInterval(countdownInterval);
  sendInterval = countdownInterval = null;

  statusEl.innerText = "Stopping...";
  statusEl.style.color = "#ffbb55";

  try {
    const res = await fetch("/end_session", {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ session_id: sessionId })
    });


    const data = await res.json().catch(() => null);

    if (!res.ok) {
      console.error("End session failed:", data);
      alert("Error ending session.");
      statusEl.innerText = "Idle";
      sessionId = null;
      startBtn.disabled = false;
      stopBtn.disabled = true;
      return;
    }

    if (data && data.report) {
      const r = data.report;
    
      const html = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <strong>Session Report</strong>
        </div>
        <div class="muted">Duration: <strong>${r.duration_seconds}s</strong></div>
        <div class="muted">Frames: <strong>${r.frames}</strong></div>
        <div class="muted">Engaged: <strong>${r.engaged_pct}%</strong></div>
        <div class="muted">Not Engaged: <strong>${r.not_engaged_pct}%</strong></div>
        <div class="muted">Phone: <strong>${r.phone_pct}%</strong></div>
        <div class="muted">Blinks: <strong>${r.blinks}</strong></div>
        <div class="muted">Yawns: <strong>${r.yawns}</strong></div>
      `;
      reportPreview.innerHTML = html;
      reportPreview.style.opacity = 0;
      setTimeout(()=>{ reportPreview.style.transition = "opacity .36s"; reportPreview.style.opacity = 1; }, 30);

     
      window.totalSessionTime = r.duration_seconds;

      showFeedbackPopup();

      statusEl.innerText = "Stopped";
      statusEl.style.color = "#ff6f61";
    } else {
      alert("Failed to get report from server.");
      statusEl.innerText = "Idle";
    }
  } catch (e) {
    console.error("End session error:", e);
    alert("Error ending session.");
    statusEl.innerText = "Idle";
  }

  sessionId = null;
  startBtn.disabled = false;
  stopBtn.disabled = true;
}


  startBtn.addEventListener("click", startSession);
  stopBtn.addEventListener("click", endSession);

  startCamera();
})();


(function () {
  const state = {
    notEngagedStart: null,
    phoneStart: null,
    lastSpoken: 0,
  };

  function speak(text) {
    const now = Date.now();
    if (now - state.lastSpoken < 10000) return;

    const msg = new SpeechSynthesisUtterance(text);
    msg.lang = "en-IN";
    msg.rate = 1;
    msg.pitch = 1;
    window.speechSynthesis.speak(msg);

    state.lastSpoken = now;
  }

  const NOT_ENGAGED_LIMIT = 300 * 1000;
  const PHONE_LIMIT = 180 * 1000;

  setInterval(() => {
    const engageEl = document.getElementById("engage");
    const phoneEl = document.getElementById("phone");

    if (!engageEl || !phoneEl) return;

    const engageLabel = engageEl.innerText.toLowerCase();
    const phoneDetected = phoneEl.innerText.includes("📱");

    const now = Date.now();

    if (engageLabel.includes("not")) {
      if (!state.notEngagedStart) state.notEngagedStart = now;
      if (now - state.notEngagedStart >= NOT_ENGAGED_LIMIT) {
        speak("Please focus on your work.");
        state.notEngagedStart = null;
      }
    } else {
      state.notEngagedStart = null;
    }

    if (phoneDetected) {
      if (!state.phoneStart) state.phoneStart = now;
      if (now - state.phoneStart >= PHONE_LIMIT) {
        speak("Please put your phone away.");
        state.phoneStart = null;
      }
    } else {
      state.phoneStart = null;
    }
  }, 2000);
})();


function showFeedbackPopup() {
  document.getElementById("feedbackModal").style.display = "flex";
}

function sendFeedback() {
  const rating = document.getElementById("feedbackRating").value;
  const feedback = document.getElementById("feedbackText").value;

  fetch("/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      feedback: feedback,
      rating: rating,
      session_time: window.totalSessionTime,
    }),
  })
    .then((res) => res.json())
    .then(() => {
      alert("Thank you! Feedback saved.");
      document.getElementById("feedbackModal").style.display = "none";
    });
}

(() => {
  const canvas = document.querySelector(".love-canvas");
  if (canvas) startLoveField(canvas);

  function startLoveField(surface) {
    const gl = surface.getContext("webgl", { alpha: true, antialias: true });
    if (!gl) {
      surface.classList.add("webgl-unavailable");
      return;
    }

    const vertexSource = `
      attribute vec2 a_position;
      attribute float a_size;
      attribute float a_phase;
      uniform float u_time;
      uniform float u_pixel_ratio;
      varying float v_glow;
      void main() {
        float rise = mod(a_position.y + u_time * (0.035 + a_phase * 0.025) + 1.0, 2.0) - 1.0;
        float drift = sin(u_time * 0.45 + a_phase * 6.283) * 0.035;
        gl_Position = vec4(a_position.x + drift, rise, 0.0, 1.0);
        gl_PointSize = a_size * u_pixel_ratio;
        v_glow = 0.72 + 0.28 * sin(u_time * 1.4 + a_phase * 6.283);
      }
    `;
    const fragmentSource = `
      precision mediump float;
      varying float v_glow;
      void main() {
        vec2 p = (gl_PointCoord - 0.5) * 2.0;
        p.y = -p.y;
        float x2 = p.x * p.x;
        float y2 = p.y * p.y;
        float shape = pow(x2 + y2 - 1.0, 3.0) - x2 * y2 * p.y;
        float edge = 1.0 - smoothstep(-0.035, 0.055, shape);
        float glow = (1.0 - smoothstep(0.0, 1.0, length(p))) * 0.24;
        vec3 color = mix(vec3(1.0, 0.56, 0.69), vec3(0.91, 0.20, 0.43), clamp(p.y + 0.45, 0.0, 1.0));
        gl_FragColor = vec4(color, (edge + glow) * v_glow * 0.72);
      }
    `;

    function compile(type, source) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    }

    const vertex = compile(gl.VERTEX_SHADER, vertexSource);
    const fragment = compile(gl.FRAGMENT_SHADER, fragmentSource);
    if (!vertex || !fragment) {
      surface.classList.add("webgl-unavailable");
      return;
    }

    const program = gl.createProgram();
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      surface.classList.add("webgl-unavailable");
      return;
    }

    const count = 64;
    const particles = new Float32Array(count * 4);
    for (let i = 0; i < count; i += 1) {
      particles[i * 4] = Math.random() * 2 - 1;
      particles[i * 4 + 1] = Math.random() * 2 - 1;
      particles[i * 4 + 2] = 9 + Math.random() * 17;
      particles[i * 4 + 3] = Math.random();
    }

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, particles, gl.STATIC_DRAW);
    gl.useProgram(program);
    const stride = 4 * Float32Array.BYTES_PER_ELEMENT;
    const position = gl.getAttribLocation(program, "a_position");
    const size = gl.getAttribLocation(program, "a_size");
    const phase = gl.getAttribLocation(program, "a_phase");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(size);
    gl.vertexAttribPointer(size, 1, gl.FLOAT, false, stride, 2 * Float32Array.BYTES_PER_ELEMENT);
    gl.enableVertexAttribArray(phase);
    gl.vertexAttribPointer(phase, 1, gl.FLOAT, false, stride, 3 * Float32Array.BYTES_PER_ELEMENT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    const timeLocation = gl.getUniformLocation(program, "u_time");
    const ratioLocation = gl.getUniformLocation(program, "u_pixel_ratio");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    const started = performance.now();

    function resize() {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      surface.width = Math.round(window.innerWidth * ratio);
      surface.height = Math.round(window.innerHeight * ratio);
      gl.viewport(0, 0, surface.width, surface.height);
      gl.useProgram(program);
      gl.uniform1f(ratioLocation, ratio);
      draw(performance.now());
    }

    function draw(now) {
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform1f(timeLocation, reducedMotion.matches ? 0 : (now - started) / 1000);
      gl.drawArrays(gl.POINTS, 0, count);
    }

    function animate(now) {
      draw(now);
      if (!reducedMotion.matches) frame = requestAnimationFrame(animate);
    }

    window.addEventListener("resize", resize, { passive: true });
    reducedMotion.addEventListener?.("change", () => {
      cancelAnimationFrame(frame);
      if (reducedMotion.matches) draw(performance.now());
      else frame = requestAnimationFrame(animate);
    });
    resize();
    if (!reducedMotion.matches) frame = requestAnimationFrame(animate);
  }

  // Use the Web Audio API to synthesize a gentle, MIDI-style ambient loop and fireworks.
  // Browsers require a user gesture before audio can play, so sound starts from this toggle.
  const soundToggle = document.querySelector(".sound-toggle");
  if (soundToggle) {
    let audio;
    let master;
    let melodyTimer;
    let noteIndex = 0;
    const isCelebration = document.body.classList.contains("celebration");
    const melody = [261.63, 329.63, 392, 329.63, 293.66, 349.23, 440, 349.23];

    function playNote(frequency, start, duration, volume = 0.035, type = "sine") {
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(volume, start + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
      oscillator.connect(gain);
      gain.connect(master);
      oscillator.start(start);
      oscillator.stop(start + duration + 0.03);
    }

    function playFirework(delay = 0) {
      const start = audio.currentTime + delay;
      const oscillator = audio.createOscillator();
      const tone = audio.createGain();
      oscillator.type = "sawtooth";
      oscillator.frequency.setValueAtTime(520, start);
      oscillator.frequency.exponentialRampToValueAtTime(95, start + 0.48);
      tone.gain.setValueAtTime(0.0001, start);
      tone.gain.exponentialRampToValueAtTime(0.12, start + 0.07);
      tone.gain.exponentialRampToValueAtTime(0.001, start + 0.52);
      oscillator.connect(tone);
      tone.connect(master);
      oscillator.start(start);
      oscillator.stop(start + 0.55);

      const length = Math.floor(audio.sampleRate * 0.7);
      const noiseBuffer = audio.createBuffer(1, length, audio.sampleRate);
      const samples = noiseBuffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) {
        samples[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 2;
      }
      const noise = audio.createBufferSource();
      const filter = audio.createBiquadFilter();
      const crackle = audio.createGain();
      noise.buffer = noiseBuffer;
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(5200, start);
      filter.frequency.exponentialRampToValueAtTime(650, start + 0.62);
      crackle.gain.setValueAtTime(0.0001, start);
      crackle.gain.exponentialRampToValueAtTime(0.13, start + 0.035);
      crackle.gain.exponentialRampToValueAtTime(0.001, start + 0.68);
      noise.connect(filter);
      filter.connect(crackle);
      crackle.connect(master);
      noise.start(start);
      noise.stop(start + 0.7);
    }

    function startSound() {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) {
        soundToggle.textContent = "Audio unavailable";
        soundToggle.disabled = true;
        return;
      }
      audio = new AudioContext();
      master = audio.createGain();
      master.gain.value = 0.55;
      master.connect(audio.destination);
      audio.resume();

      const playNext = () => {
        const now = audio.currentTime;
        const root = melody[noteIndex % melody.length];
        playNote(root, now, 1.25, 0.025, "sine");
        playNote(root * 1.5, now + 0.12, 1.05, 0.012, "triangle");
        if (noteIndex % 4 === 0) playNote(root / 2, now, 1.8, 0.016, "sine");
        noteIndex += 1;
      };
      playNext();
      melodyTimer = window.setInterval(playNext, 1150);
      if (isCelebration) {
        playFirework(0.15);
        playFirework(0.85);
        playFirework(1.55);
      }
    }

    function stopSound() {
      window.clearInterval(melodyTimer);
      if (audio) {
        const oldAudio = audio;
        audio = null;
        master = null;
        oldAudio.close();
      }
    }

    soundToggle.addEventListener("click", () => {
      const enabled = soundToggle.getAttribute("aria-pressed") !== "true";
      soundToggle.setAttribute("aria-pressed", String(enabled));
      soundToggle.setAttribute("aria-label", enabled ? "Turn sound off" : "Turn sound on");
      soundToggle.textContent = enabled ? "♫ Sound on" : "♫ Sound off";
      if (enabled) startSound();
      else stopSound();
    });
  }

  const noButton = document.querySelector("#move-random");
  if (noButton) {
    const dodge = () => {
      const margin = 12;
      const maxX = Math.max(margin, window.innerWidth - noButton.offsetWidth - margin);
      const maxY = Math.max(margin, window.innerHeight - noButton.offsetHeight - margin);
      noButton.classList.add("is-dodging");
      noButton.style.left = `${margin + Math.random() * (maxX - margin)}px`;
      noButton.style.top = `${margin + Math.random() * (maxY - margin)}px`;
    };
    noButton.addEventListener("pointerenter", dodge);
    noButton.addEventListener("touchstart", (event) => {
      event.preventDefault();
      dodge();
    }, { passive: false });
  }
})();

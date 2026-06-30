export function createAudioSystem() {
  let audioCtx = null;
  let audioBus = null;

  return {
    init,
    resume,
    isReady,
    setMusicMode,
    updateMusic,
    playSound,
  };

  function init() {
    if (audioCtx) {
      return;
    }

    try {
      audioCtx = new window.AudioContext();
      const master = audioCtx.createGain();
      const bgm = audioCtx.createGain();
      const sfx = audioCtx.createGain();
      const compressor = audioCtx.createDynamicsCompressor();
      compressor.threshold.value = -22;
      compressor.knee.value = 16;
      compressor.ratio.value = 4;
      compressor.attack.value = 0.01;
      compressor.release.value = 0.18;

      master.gain.value = 0.7;
      bgm.gain.value = 0.0001;
      sfx.gain.value = 0.18;

      bgm.connect(master);
      sfx.connect(master);
      master.connect(compressor);
      compressor.connect(audioCtx.destination);

      audioBus = {
        master,
        bgm,
        sfx,
        noise: createNoiseBuffer(audioCtx),
      };
    } catch {
      audioCtx = null;
      audioBus = null;
    }
  }

  function resume() {
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {});
    }
  }

  function isReady() {
    return Boolean(audioCtx && audioBus);
  }

  function createNoiseBuffer(context) {
    const buffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  function setMusicMode(game, modeName) {
    game.musicState.mode = modeName;
    if (!audioCtx || !audioBus) {
      return;
    }
    game.musicState.nodesReady = true;
    game.musicState.step = 0;
    game.musicState.nextNoteAt = audioCtx.currentTime + 0.05;
    const target = getBgmLevel(modeName);
    audioBus.bgm.gain.cancelScheduledValues(audioCtx.currentTime);
    audioBus.bgm.gain.setTargetAtTime(Math.max(0.0001, target), audioCtx.currentTime, 0.04);
  }

  function getBgmLevel(modeName) {
    if (modeName === "boss") {
      return 0.052;
    }
    if (modeName === "normal") {
      return 0.045;
    }
    return 0.0001;
  }

  function updateMusic(game) {
    if (!audioCtx || !audioBus || !game.musicState.nodesReady || game.musicState.mode === "none") {
      return;
    }

    const stepDuration = game.musicState.mode === "boss" ? 60 / 118 / 2 : 60 / 92 / 2;
    const horizon = audioCtx.currentTime + 0.18;

    while (game.musicState.nextNoteAt < horizon) {
      scheduleMusicStep(game.musicState.mode, game.musicState.step, game.musicState.nextNoteAt);
      game.musicState.nextNoteAt += stepDuration;
      game.musicState.step = (game.musicState.step + 1) % 16;
    }
  }

  function scheduleMusicStep(modeName, step, start) {
    if (!audioBus) {
      return;
    }

    if (modeName === "normal") {
      const bass = [92, 110, 82, 123];
      if (step % 4 === 0) {
        scheduleTone(audioBus.bgm, {
          type: "triangle",
          freq: bass[(step / 4) % bass.length],
          freqEnd: bass[(step / 4) % bass.length] * 0.92,
          start,
          duration: 0.28,
          volume: 0.012,
          attack: 0.01,
          release: 0.12,
        });
      }

      if (step === 0 || step === 8) {
        scheduleTone(audioBus.bgm, {
          type: "sine",
          freq: step === 0 ? 220 : 246,
          freqEnd: step === 0 ? 208 : 232,
          start,
          duration: 0.82,
          volume: 0.006,
          attack: 0.04,
          release: 0.24,
        });
      }

      if (step === 2 || step === 6 || step === 10 || step === 14) {
        scheduleTone(audioBus.bgm, {
          type: "square",
          freq: [392, 466, 523, 466][((step - 2) / 4) % 4],
          start,
          duration: 0.08,
          volume: 0.0038,
          attack: 0.005,
          release: 0.03,
        });
      }
      return;
    }

    const bossBass = [78, 104, 92, 110];
    if (step % 2 === 0) {
      scheduleTone(audioBus.bgm, {
        type: "sawtooth",
        freq: bossBass[(step / 2) % bossBass.length],
        freqEnd: bossBass[(step / 2) % bossBass.length] * 0.88,
        start,
        duration: 0.18,
        volume: 0.013,
        attack: 0.004,
        release: 0.08,
      });
    }

    if (step === 1 || step === 5 || step === 9 || step === 13) {
      scheduleTone(audioBus.bgm, {
        type: "square",
        freq: [622, 554, 698, 554][((step - 1) / 4) % 4],
        freqEnd: [466, 440, 523, 440][((step - 1) / 4) % 4],
        start,
        duration: 0.11,
        volume: 0.0048,
        attack: 0.004,
        release: 0.05,
      });
    }

    if (step === 0 || step === 8) {
      scheduleTone(audioBus.bgm, {
        type: "triangle",
        freq: 156,
        freqEnd: 148,
        start,
        duration: 0.5,
        volume: 0.007,
        attack: 0.02,
        release: 0.16,
      });
    }
  }

  function duckMusic(game, factor = 0.7, duration = 0.18) {
    if (!audioCtx || !audioBus) {
      return;
    }
    const now = audioCtx.currentTime;
    const base = getBgmLevel(game.musicState.mode);
    const reduced = Math.max(0.0001, base * factor);
    audioBus.bgm.gain.cancelScheduledValues(now);
    audioBus.bgm.gain.setValueAtTime(Math.max(audioBus.bgm.gain.value, 0.0001), now);
    audioBus.bgm.gain.exponentialRampToValueAtTime(reduced, now + 0.01);
    audioBus.bgm.gain.exponentialRampToValueAtTime(Math.max(base, 0.0001), now + duration);
    game.musicState.duckUntil = now + duration;
  }

  function scheduleTone(bus, options) {
    if (!audioCtx || !bus) {
      return;
    }
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = options.type ?? "sine";
    osc.frequency.setValueAtTime(options.freq, options.start);
    if (options.freqEnd) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, options.freqEnd), options.start + options.duration);
    }
    gain.gain.setValueAtTime(0.0001, options.start);
    gain.gain.linearRampToValueAtTime(options.volume ?? 0.01, options.start + (options.attack ?? 0.01));
    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      options.start + options.duration + (options.release ?? 0.05)
    );
    osc.connect(gain);
    gain.connect(bus);
    osc.start(options.start);
    osc.stop(options.start + options.duration + (options.release ?? 0.05) + 0.02);
  }

  function scheduleNoise(bus, options) {
    if (!audioCtx || !audioBus?.noise || !bus) {
      return;
    }
    const source = audioCtx.createBufferSource();
    const gain = audioCtx.createGain();
    const filter = audioCtx.createBiquadFilter();
    source.buffer = audioBus.noise;
    source.loop = false;
    filter.type = options.filterType ?? "highpass";
    filter.frequency.value = options.filterFreq ?? 700;
    gain.gain.setValueAtTime(0.0001, options.start);
    gain.gain.linearRampToValueAtTime(options.volume ?? 0.01, options.start + (options.attack ?? 0.005));
    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      options.start + options.duration + (options.release ?? 0.05)
    );
    source.connect(filter);
    filter.connect(gain);
    gain.connect(bus);
    source.start(options.start);
    source.stop(options.start + options.duration + (options.release ?? 0.05) + 0.02);
  }

  function playSound(game, type) {
    if (!audioCtx || !audioBus) {
      return;
    }

    const at = audioCtx.currentTime;

    if (type === "shot") {
      duckMusic(game, 0.9, 0.09);
      scheduleTone(audioBus.sfx, {
        type: "square",
        freq: 520,
        freqEnd: 180,
        start: at,
        duration: 0.09,
        volume: 0.05,
        attack: 0.002,
        release: 0.04,
      });
      scheduleNoise(audioBus.sfx, {
        start: at,
        duration: 0.04,
        volume: 0.014,
        filterType: "highpass",
        filterFreq: 900,
      });
      return;
    }

    if (type === "hit") {
      scheduleTone(audioBus.sfx, {
        type: "triangle",
        freq: 640,
        freqEnd: 280,
        start: at,
        duration: 0.07,
        volume: 0.032,
        attack: 0.003,
        release: 0.04,
      });
      return;
    }

    if (type === "crit") {
      duckMusic(game, 0.76, 0.14);
      scheduleTone(audioBus.sfx, {
        type: "triangle",
        freq: 960,
        freqEnd: 440,
        start: at,
        duration: 0.08,
        volume: 0.038,
        attack: 0.002,
        release: 0.05,
      });
      scheduleTone(audioBus.sfx, {
        type: "square",
        freq: 1200,
        freqEnd: 620,
        start: at + 0.015,
        duration: 0.05,
        volume: 0.02,
        attack: 0.002,
        release: 0.03,
      });
      return;
    }

    if (type === "explode") {
      duckMusic(game, 0.72, 0.22);
      scheduleTone(audioBus.sfx, {
        type: "sawtooth",
        freq: 170,
        freqEnd: 55,
        start: at,
        duration: 0.18,
        volume: 0.065,
        attack: 0.01,
        release: 0.08,
      });
      scheduleNoise(audioBus.sfx, {
        start: at,
        duration: 0.18,
        volume: 0.03,
        filterType: "bandpass",
        filterFreq: 550,
      });
      return;
    }

    if (type === "hurt") {
      scheduleTone(audioBus.sfx, {
        type: "square",
        freq: 220,
        freqEnd: 90,
        start: at,
        duration: 0.12,
        volume: 0.03,
        attack: 0.005,
        release: 0.06,
      });
      scheduleNoise(audioBus.sfx, {
        start: at,
        duration: 0.07,
        volume: 0.01,
        filterType: "highpass",
        filterFreq: 1200,
      });
      return;
    }

    if (type === "bossIntro") {
      duckMusic(game, 0.5, 0.4);
      scheduleTone(audioBus.sfx, {
        type: "sawtooth",
        freq: 180,
        freqEnd: 90,
        start: at,
        duration: 0.26,
        volume: 0.07,
        attack: 0.01,
        release: 0.12,
      });
      scheduleTone(audioBus.sfx, {
        type: "square",
        freq: 740,
        freqEnd: 340,
        start: at + 0.04,
        duration: 0.18,
        volume: 0.028,
        attack: 0.004,
        release: 0.08,
      });
      scheduleNoise(audioBus.sfx, {
        start: at,
        duration: 0.22,
        volume: 0.02,
        filterType: "bandpass",
        filterFreq: 420,
      });
      return;
    }

    if (type === "bossWarn") {
      scheduleTone(audioBus.sfx, {
        type: "square",
        freq: 540,
        freqEnd: 620,
        start: at,
        duration: 0.08,
        volume: 0.02,
        attack: 0.003,
        release: 0.04,
      });
      scheduleTone(audioBus.sfx, {
        type: "square",
        freq: 540,
        freqEnd: 660,
        start: at + 0.11,
        duration: 0.08,
        volume: 0.016,
        attack: 0.003,
        release: 0.04,
      });
      return;
    }

    if (type === "bossPrep") {
      scheduleTone(audioBus.sfx, {
        type: "triangle",
        freq: 280,
        freqEnd: 420,
        start: at,
        duration: 0.2,
        volume: 0.022,
        attack: 0.01,
        release: 0.08,
      });
      return;
    }

    if (type === "bossCharge") {
      duckMusic(game, 0.58, 0.24);
      scheduleTone(audioBus.sfx, {
        type: "square",
        freq: 160,
        freqEnd: 420,
        start: at,
        duration: 0.24,
        volume: 0.05,
        attack: 0.006,
        release: 0.08,
      });
      scheduleNoise(audioBus.sfx, {
        start: at + 0.04,
        duration: 0.12,
        volume: 0.02,
        filterType: "highpass",
        filterFreq: 900,
      });
      return;
    }

    if (type === "bossStomp") {
      duckMusic(game, 0.56, 0.28);
      scheduleTone(audioBus.sfx, {
        type: "sawtooth",
        freq: 90,
        freqEnd: 36,
        start: at,
        duration: 0.26,
        volume: 0.075,
        attack: 0.008,
        release: 0.1,
      });
      scheduleNoise(audioBus.sfx, {
        start: at,
        duration: 0.18,
        volume: 0.026,
        filterType: "bandpass",
        filterFreq: 280,
      });
      return;
    }

    if (type === "bossHalf") {
      scheduleTone(audioBus.sfx, {
        type: "triangle",
        freq: 520,
        freqEnd: 260,
        start: at,
        duration: 0.18,
        volume: 0.032,
        attack: 0.008,
        release: 0.06,
      });
      return;
    }

    if (type === "bossDeath") {
      duckMusic(game, 0.38, 0.44);
      scheduleTone(audioBus.sfx, {
        type: "sawtooth",
        freq: 220,
        freqEnd: 44,
        start: at,
        duration: 0.34,
        volume: 0.09,
        attack: 0.01,
        release: 0.12,
      });
      scheduleTone(audioBus.sfx, {
        type: "square",
        freq: 720,
        freqEnd: 180,
        start: at + 0.03,
        duration: 0.22,
        volume: 0.03,
        attack: 0.004,
        release: 0.08,
      });
      scheduleNoise(audioBus.sfx, {
        start: at,
        duration: 0.28,
        volume: 0.034,
        filterType: "bandpass",
        filterFreq: 520,
      });
      return;
    }

    if (type === "fail") {
      setMusicMode(game, "none");
      scheduleTone(audioBus.sfx, {
        type: "sawtooth",
        freq: 190,
        freqEnd: 90,
        start: at,
        duration: 0.24,
        volume: 0.05,
        attack: 0.02,
        release: 0.08,
      });
    }
  }
}

// src/sound.ts — Процедурный Calm Tech саунд-движок для dombro (0 внешних файлов)

export class CalmSoundEngine {
  private ctx: AudioContext | null = null;
  public enabled: boolean = true;

  constructor() {
    // Читаем сохраненную настройку (отключение в 1 клик)
    if (typeof localStorage !== 'undefined') {
      try {
        const saved = localStorage.getItem('dombro:sound-enabled');
        if (saved !== null) this.enabled = saved === 'true';
      } catch {
        // ignore storage errors
      }
    }
  }

  public toggle(): boolean {
    this.enabled = !this.enabled;
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem('dombro:sound-enabled', String(this.enabled));
      } catch {
        // ignore storage errors
      }
    }
    if (this.enabled) this.playWoodSnap(); // Мягкое подтверждение при включении
    return this.enabled;
  }

  private getContext(): AudioContext | null {
    if (!this.enabled) return null;
    if (typeof window === 'undefined') return null;
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return null;
    try {
      if (!this.ctx) {
        this.ctx = new AudioContextClass();
      }
      if (this.ctx.state === 'suspended') {
        void this.ctx.resume().catch(() => {});
      }
      return this.ctx;
    } catch {
      return null;
    }
  }

  // Случайное микро-отклонение питча (±3%), чтобы звуки ощущались живыми
  private jitter(base: number, spread = 0.03): number {
    return base * (1 + (Math.random() * 2 - 1) * spread);
  }

  /**
   * 1. МЯГКИЙ ДЕРЕВЯННЫЙ ЩЕЛЧОК (Приземление карточки в 12-колоночную сетку)
   * Глухой резонанс дерева + мягкое касание фетра
   */
  public playWoodSnap(variant: 'hover' | 'land' = 'land') {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      // Для наведения на Ghost Snap Outline — чуть выше и тише, для посадки — глубже
      const baseFreq = variant === 'land' ? this.jitter(195) : this.jitter(260);
      const volume = variant === 'land' ? 0.18 : 0.06;
      const duration = variant === 'land' ? 0.045 : 0.025;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(baseFreq, now);
      osc.frequency.exponentialRampToValueAtTime(58, now + duration);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(900, now);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(volume, now + 0.003);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + duration);
    } catch {
      // ignore audio errors
    }
  }

  /**
   * 2. ШЕЛЕСТ ПЛОТНОЙ БУМАГИ (Складывание вкладок веером в карточку «Продолжить»)
   * Три быстрых каскадных микро-шороха матового картона
   */
  public playPaperFold() {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      // 3 карточки в стопке с интервалом 35 мс
      [0, 0.035, 0.075].forEach((offset, index) => {
        const now = ctx.currentTime + offset;
        const dur = 0.065;

        // Генерируем буфер мягкого шума трения бумаги
        const bufferSize = Math.floor(ctx.sampleRate * dur);
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        let lastOut = 0;
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          data[i] = (lastOut + 0.08 * white) / 1.08; // Тёплый розовый/коричневый шум
          lastOut = data[i];
        }

        const noise = ctx.createBufferSource();
        noise.buffer = buffer;

        // Полосовой фильтр имитирует текстуру плотной бумаги (900–1500 Гц)
        const bandpass = ctx.createBiquadFilter();
        bandpass.type = 'bandpass';
        bandpass.frequency.setValueAtTime(this.jitter(1100 + index * 180), now);
        bandpass.Q.setValueAtTime(2.2, now);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.12 - index * 0.02, now + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

        noise.connect(bandpass);
        bandpass.connect(gain);
        gain.connect(ctx.destination);

        noise.start(now);
        noise.stop(now + dur);
      });
    } catch {
      // ignore audio errors
    }
  }

  /**
   * 3. ТИХИЙ ТУМБЛЕР (Голосовой инбокс Capture по Ctrl+Shift+Space)
   * Двухфазный аналоговый переключатель: восходящий при старте, нисходящий при стопе
   */
  public playCaptureToggle(active: boolean) {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const pairs = active ? [280, 420] : [400, 240];
      pairs.forEach((freq, idx) => {
        const now = ctx.currentTime + idx * 0.028;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(this.jitter(freq, 0.01), now);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.5, now + 0.022);

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.11, now + 0.002);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.022);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.024);
      });
    } catch {
      // ignore audio errors
    }
  }

  /**
   * 4. ВЫДОХ ОПЕРАТИВКИ / ВЫДУВАНИЕ ШУМА (Остров внимания и удаление заметки)
   * Мягкий воздушный фильтр сверху вниз без резких частот
   */
  public playCalmExhale() {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const dur = 0.28;
      const bufferSize = Math.floor(ctx.sampleRate * dur);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * 0.5;
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(750, now);
      filter.frequency.exponentialRampToValueAtTime(160, now + dur);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.07, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      noise.start(now);
      noise.stop(now + dur);
    } catch {
      // ignore audio errors
    }
  }

  /**
   * 5. КАПЛЯ ВОДЫ (Привычки / Водный баланс)
   * Чистый органический всплеск капли с экспоненциальным затуханием
   */
  public playWaterDrop() {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(this.jitter(540), now);
      osc.frequency.exponentialRampToValueAtTime(1080, now + 0.08);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.14, now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.18);
    } catch {
      // ignore audio errors
    }
  }
}

export const sound = new CalmSoundEngine();

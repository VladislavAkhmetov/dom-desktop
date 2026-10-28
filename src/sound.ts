// src/sound.ts — Процедурный Calm Tech саунд-движок для dombro (0 внешних файлов)

/**
 * Karplus–Strong: a soft (7× smoothed, «felt») noise strike ringing in a damped delay line. Pure, so it is testable.
 * Peak-normalised, so the level is steady while the timbre differs a little every time.
 */
export function renderPluck(sampleRate: number, freq: number, seconds: number, damping = 0.996, random: () => number = Math.random): Float32Array {
  const length = Math.floor(sampleRate * seconds);
  const data = new Float32Array(length);
  const period = Math.max(2, Math.round(sampleRate / freq));
  const ring = new Float32Array(period);
  for (let i = 0; i < period; i++) ring[i] = random() * 2 - 1;
  for (let pass = 0; pass < 7; pass++) for (let i = 1; i < period; i++) ring[i] = (ring[i] + ring[i - 1]) * 0.5;
  let peak = 0; for (let i = 0; i < period; i++) peak = Math.max(peak, Math.abs(ring[i]));
  if (peak > 0) for (let i = 0; i < period; i++) ring[i] /= peak;
  for (let n = 0; n < length; n++) {
    const i = n % period;
    const value = ring[i];
    ring[i] = damping * 0.5 * (value + ring[(i + 1) % period]);
    data[n] = value;
  }
  return data;
}

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

  private masterBus: AudioNode | null = null;
  private masterCtx: BaseAudioContext | null = null;

  /**
   * Общая шина всех звуков: −5 дБ и мягкий срез верхов (3 кГц) — ничего не звенит «цифрой».
   */
  private bus(ctx: BaseAudioContext): AudioNode {
    if (this.masterBus && this.masterCtx === ctx) return this.masterBus;
    const gain = ctx.createGain();
    gain.gain.value = 0.56;
    const soften = ctx.createBiquadFilter();
    soften.type = 'lowpass';
    soften.frequency.value = 3000;
    soften.Q.value = 0.5;
    gain.connect(soften);
    soften.connect(ctx.destination);
    this.masterBus = gain;
    this.masterCtx = ctx;
    return gain;
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
      const volume = variant === 'land' ? 0.065 : 0.025; // тише: щелчок — тактильный намёк, не событие
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
      gain.connect(this.bus(ctx));

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
        gain.connect(this.bus(ctx));

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
        gain.gain.linearRampToValueAtTime(0.055, now + 0.006); // мягче атака и вдвое тише
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.022);

        osc.connect(gain);
        gain.connect(this.bus(ctx));

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
      gain.connect(this.bus(ctx));

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
    // Короткий приглушённый щипок вместо синусового «буль» — живой, не цифровой
    this.safely(ctx => this.pluck(ctx, 523.25, 0, { gain: 0.04, decay: 0.5, damping: 0.988, tone: 1050 }));
  }

  /**
   * Щипок «войлоком» по струне — физическая модель Karplus–Strong: шумовой удар звучит в затухающем резонаторе.
   * Каждый раз немного иначе (шум, ±0,4% высоты), спектр тёплый и живой — как приглушённая калимба или нейлон, не синус.
   */
  private pluck(ctx: BaseAudioContext, freq: number, at: number, opts: { gain: number; decay: number; damping?: number; tone?: number }) {
    const sr = ctx.sampleRate;
    const samples = renderPluck(sr, this.jitter(freq, 0.004), opts.decay, opts.damping ?? 0.996);
    const buffer = ctx.createBuffer(1, samples.length, sr);
    buffer.getChannelData(0).set(samples);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = opts.tone ?? 1400;
    tone.Q.value = 0.3;
    const gain = ctx.createGain();
    const t = ctx.currentTime + 0.01 + at;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(opts.gain, t + 0.014);
    gain.gain.setValueAtTime(opts.gain, t + opts.decay * 0.45);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + opts.decay);
    source.connect(tone);
    tone.connect(gain);
    gain.connect(this.bus(ctx));
    source.start(t);
    source.stop(t + opts.decay + 0.02);
  }

  /** Деревянный «ток»: короткий шумовой удар в резонансном теле (полосовой фильтр), без тона-сигнала */
  private tap(ctx: BaseAudioContext, body: number, at: number, gain: number) {
    const sr = ctx.sampleRate;
    const dur = 0.09;
    const buffer = ctx.createBuffer(1, Math.floor(sr * dur), sr);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (sr * 0.012));
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const resonance = ctx.createBiquadFilter();
    resonance.type = 'bandpass';
    resonance.frequency.value = this.jitter(body, 0.02);
    resonance.Q.value = 9;
    const warmth = ctx.createBiquadFilter();
    warmth.type = 'lowpass';
    warmth.frequency.value = 1500;
    const out = ctx.createGain();
    const t = ctx.currentTime + 0.01 + at;
    out.gain.setValueAtTime(gain, t);
    source.connect(resonance);
    resonance.connect(warmth);
    warmth.connect(out);
    out.connect(this.bus(ctx));
    source.start(t);
    source.stop(t + dur);
  }

  /** Едва слышный выдох без высоты — шум, плавно уходящий вниз */
  private breath(ctx: BaseAudioContext, from: number, to: number, dur: number, gain: number) {
    const sr = ctx.sampleRate;
    const buffer = ctx.createBuffer(1, Math.floor(sr * dur), sr);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    const t = ctx.currentTime + 0.01;
    filter.frequency.setValueAtTime(from, t);
    filter.frequency.exponentialRampToValueAtTime(to, t + dur);
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, t);
    out.gain.linearRampToValueAtTime(gain, t + dur * 0.35);
    out.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    source.connect(filter);
    filter.connect(out);
    out.connect(this.bus(ctx));
    source.start(t);
    source.stop(t + dur);
  }

  private safely(play: (ctx: BaseAudioContext) => void) {
    const ctx = this.getContext();
    if (!ctx) return;
    try { play(ctx); } catch { /* ignore audio errors */ }
  }

  /** 6. НАПОМИНАНИЕ — два тихих щипка вверх на большую терцию (G4 → B4): «посмотри, когда удобно» */
  public playReminderChime() {
    this.safely(ctx => {
      this.pluck(ctx, 392, 0, { gain: 0.055, decay: 1.2, tone: 950 });
      this.pluck(ctx, 493.88, 0.22, { gain: 0.038, decay: 1.3, tone: 950 });
    });
  }

  /** 7. СКОРО ВСТРЕЧА — один низкий тёплый щипок (E4) */
  public playEventSoon() {
    this.safely(ctx => this.pluck(ctx, 329.63, 0, { gain: 0.05, decay: 1.3, tone: 850 }));
  }

  /** 8. СДЕЛАНО — мягкий деревянный «ток», как карандаш по столу */
  public playTaskDone() {
    this.safely(ctx => this.tap(ctx, 520, 0, 0.6));
  }

  /** 9. ПОЗЖЕ — тихий выдох без высоты: ничего не «падает», просто откладывается */
  public playReminderLater() {
    this.safely(ctx => this.breath(ctx, 800, 200, 0.32, 0.05));
  }
}

export const sound = new CalmSoundEngine();

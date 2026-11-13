class ChessSoundService {
  private ctx: AudioContext | null = null;
  private enabled = true;

  setEnabled(val: boolean) {
    this.enabled = val;
  }

  private getContext(): AudioContext | null {
    if (!this.enabled || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private playTone(
    freq: number,
    duration: number,
    type: OscillatorType = 'triangle',
    gainPeak = 0.14,
    delay = 0
  ) {
    const ctx = this.getContext();
    if (!ctx) return;

    const start = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    osc.frequency.exponentialRampToValueAtTime(Math.max(60, freq * 0.65), start + duration);

    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(gainPeak, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }

  playMove() {
    this.playTone(210, 0.065, 'triangle', 0.14);
  }

  playCapture() {
    this.playTone(300, 0.055, 'sawtooth', 0.11);
    this.playTone(150, 0.075, 'triangle', 0.15, 0.02);
  }

  playCastle() {
    this.playTone(220, 0.06, 'triangle', 0.12);
    this.playTone(260, 0.06, 'triangle', 0.12, 0.08);
  }

  playCheck() {
    this.playTone(540, 0.12, 'sine', 0.12);
    this.playTone(420, 0.14, 'triangle', 0.1, 0.05);
  }

  playSuccess() {
    this.playTone(523.25, 0.14, 'sine', 0.11, 0);
    this.playTone(659.25, 0.14, 'sine', 0.11, 0.09);
    this.playTone(783.99, 0.22, 'sine', 0.12, 0.18);
  }

  playError() {
    this.playTone(165, 0.12, 'sawtooth', 0.08);
  }
}

export const soundService = new ChessSoundService();

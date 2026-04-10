/**
 * Audio service to generate frequencies for the rhythm trainer.
 */

class AudioService {
  private audioCtx: AudioContext | null = null;

  private async init() {
    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume();
    }
  }

  private async playTone(frequency: number, duration: number, type: OscillatorType = 'sine') {
    await this.init();
    if (!this.audioCtx) return;

    const oscillator = this.audioCtx.createOscillator();
    const gainNode = this.audioCtx.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, this.audioCtx.currentTime);

    gainNode.gain.setValueAtTime(0.1, this.audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, this.audioCtx.currentTime + duration);

    oscillator.connect(gainNode);
    gainNode.connect(this.audioCtx.destination);

    oscillator.start();
    oscillator.stop(this.audioCtx.currentTime + duration);
  }

  // Sound A: Success (High)
  playA() {
    this.playTone(880, 0.1, 'sine');
  }

  // Sound B: Checkpoint (Metronome)
  playB() {
    this.playTone(440, 0.05, 'square');
  }

  // Sound C: Warning (Mid-Low)
  playC() {
    this.playTone(220, 0.1, 'sine');
  }

  // Sound D: Error (Low)
  playD() {
    this.playTone(110, 0.1, 'sine');
  }
}

export const audioService = new AudioService();

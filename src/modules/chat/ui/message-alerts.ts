export const UNREAD_MESSAGES_EVENT = 'satal:unread-messages';
export const MESSAGE_SOUND_STORAGE_KEY = 'satal:message-sound-enabled';

let audioContext: AudioContext | null = null;

export function getMessageSoundEnabled() {
  if (typeof window === 'undefined') return true;
  return window.localStorage.getItem(MESSAGE_SOUND_STORAGE_KEY) !== 'false';
}

export function setMessageSoundEnabled(enabled: boolean) {
  window.localStorage.setItem(MESSAGE_SOUND_STORAGE_KEY, String(enabled));
  if (enabled) primeMessageSound();
}

export function primeMessageSound() {
  if (typeof window === 'undefined' || !getMessageSoundEnabled()) return;
  audioContext ??= new AudioContext();
  if (audioContext.state === 'suspended') void audioContext.resume().catch(() => undefined);
}

export function playMessageSound() {
  if (typeof window === 'undefined' || !getMessageSoundEnabled()) return;
  audioContext ??= new AudioContext();

  const play = () => {
    if (!audioContext) return;
    const start = audioContext.currentTime;
    const gain = audioContext.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.12, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.34);
    gain.connect(audioContext.destination);

    const first = audioContext.createOscillator();
    first.type = 'sine';
    first.frequency.setValueAtTime(740, start);
    first.connect(gain);
    first.start(start);
    first.stop(start + 0.14);

    const second = audioContext.createOscillator();
    second.type = 'sine';
    second.frequency.setValueAtTime(988, start + 0.12);
    second.connect(gain);
    second.start(start + 0.12);
    second.stop(start + 0.34);
  };

  if (audioContext.state === 'suspended') {
    void audioContext
      .resume()
      .then(play)
      .catch(() => undefined);
  } else {
    play();
  }
}

export function publishUnreadMessageCount(unreadCount: number) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<{unreadCount: number}>(UNREAD_MESSAGES_EVENT, {detail: {unreadCount}})
  );
}

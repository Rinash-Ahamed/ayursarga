type NotificationSoundCandidate = { id: string; readAt: unknown };

export type NotificationSoundTracker = {
  authoritativeBaselineReady: boolean;
  seenIds: Set<string>;
};

export function createNotificationSoundTracker(): NotificationSoundTracker {
  return { authoritativeBaselineReady: false, seenIds: new Set<string>() };
}

/** Returns true only for an unread notification first observed after the server baseline. */
export function consumeNotificationSnapshot(
  tracker: NotificationSoundTracker,
  items: NotificationSoundCandidate[],
  fromCache: boolean,
) {
  if (!tracker.authoritativeBaselineReady) {
    items.forEach((item) => tracker.seenIds.add(item.id));
    if (!fromCache) tracker.authoritativeBaselineReady = true;
    return false;
  }

  let hasNewUnread = false;
  for (const item of items) {
    if (!tracker.seenIds.has(item.id) && !item.readAt) hasNewUnread = true;
    tracker.seenIds.add(item.id);
  }
  return hasNewUnread;
}

type AudioWindow = Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext };
let notificationAudioContext: AudioContext | null = null;

/** Must be called from a user gesture before browsers will permit later notification audio. */
export async function primePortalNotificationSound() {
  if (typeof window === "undefined") return false;
  const audioWindow = window as AudioWindow;
  const AudioContextConstructor = audioWindow.AudioContext ?? audioWindow.webkitAudioContext;
  if (!AudioContextConstructor) return false;
  try {
    notificationAudioContext ??= new AudioContextConstructor();
    if (notificationAudioContext.state === "suspended") await notificationAudioContext.resume();
    return notificationAudioContext.state === "running";
  } catch {
    return false;
  }
}

/** Plays a short, low-volume two-note chime without loading an audio asset. */
export function playPortalNotificationSound() {
  const context = notificationAudioContext;
  if (!context || context.state !== "running") return false;

  const start = context.currentTime;
  for (const [frequency, offset] of [[659.25, 0], [783.99, 0.11]] as const) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, start + offset);
    gain.gain.setValueAtTime(0.0001, start + offset);
    gain.gain.exponentialRampToValueAtTime(0.055, start + offset + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + 0.18);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.addEventListener("ended", () => { oscillator.disconnect(); gain.disconnect(); }, { once: true });
    oscillator.start(start + offset);
    oscillator.stop(start + offset + 0.2);
  }
  return true;
}

export const pushSupported = false;
export const isIOS = false;
export const isStandalone = true;
export const DEFAULT_HOUR = 9;
export const fmtHour = (h) => `${h}:00`;
export const canAskPush = () => false;
export const alreadyAsked = () => true;
export function markAsked() {}
export async function pushPrefs() { return { on: false, hour: DEFAULT_HOUR }; }
export async function setPushHour() {}
export async function testNotification() {}
export async function currentSubscription() { return null; }
export async function enablePush() { throw new Error('Las notificaciones no están disponibles en la demo'); }
export async function disablePush() {}

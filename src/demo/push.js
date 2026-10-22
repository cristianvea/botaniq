export const pushSupported = false;
export const isIOS = false;
export const isStandalone = true;
export async function currentSubscription() { return null; }
export async function enablePush() { throw new Error('Las notificaciones no están disponibles en la demo'); }
export async function disablePush() {}

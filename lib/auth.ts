export function getPasscode(): string {
  return process.env.CLASS_PASSCODE || '';
}

export function isPasscodeConfigured(): boolean {
  return !!process.env.CLASS_PASSCODE;
}

export async function authToken(passcode: string): Promise<string> {
  const data = new TextEncoder().encode('feminism-class:' + passcode);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

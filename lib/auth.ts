export function getPasscode(): string {
  return process.env.CLASS_PASSCODE || '';
}

export function isPasscodeConfigured(): boolean {
  return !!process.env.CLASS_PASSCODE;
}

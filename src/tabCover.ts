/** Tab covers are frozen frames from Electron's capturePage(), held in memory as data URLs. */
export function isTabCover(value: string | undefined): value is string {
  return Boolean(value) && /^data:image\/(png|jpeg);base64,/i.test(value!)
}

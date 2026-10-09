/** Cabinet pilot mode. Active in browser preview with ?cabinet=1, or in Electron desktop pilot (--cabinet-pilot). */
export const isCabinetPreview = typeof window !== 'undefined'
  && (
    Boolean(window.dom?.cabinetPilot)
    || new URLSearchParams(window.location.search).get('cabinet') === '1'
  )

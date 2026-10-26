/** Cabinet mode is the standard default mode of dombro. Only legacy mode if explicitly requested (?cabinet=0). */
export const isCabinetPreview = typeof window === 'undefined'
  || (
    new URLSearchParams(window.location.search).get('cabinet') !== '0'
    && new URLSearchParams(window.location.search).get('legacy') !== '1'
  )

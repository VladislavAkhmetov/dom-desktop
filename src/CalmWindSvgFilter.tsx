export function CalmWindSvgFilter() {
  return (
    <svg
      width="0"
      height="0"
      style={{ position: 'absolute', width: 0, height: 0, pointerEvents: 'none', opacity: 0 }}
      aria-hidden="true"
    >
      <defs>
        <filter id="calm-wind-dissolve" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.04 0.08" numOctaves="2" result="noise" />
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            scale="38"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </defs>
    </svg>
  )
}

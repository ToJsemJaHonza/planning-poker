export default function PixelSpark({ size = 16, color = '#f5c542', style, className }) {
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 7 7" shapeRendering="crispEdges" className={className} style={style}>
    <path fill={color} d="M3 0h1v2h1v1h2v1H5v1H4v2H3V5H2V4H0V3h2V2h1Z" />
    <rect x="3" y="3" width="1" height="1" fill="#fffdf6" />
  </svg>;
}

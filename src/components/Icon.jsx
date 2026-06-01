// Wrapper para Material Symbols (Rounded).
// name = nome do icone (ex.: 'home', 'add', 'receipt_long')
export default function Icon({ name, size, fill = 0, weight = 400, className = '', style }) {
  return (
    <span
      className={`material-symbols-rounded ${className}`}
      aria-hidden="true"
      style={{
        fontSize: size ? `${size}px` : undefined,
        fontVariationSettings: `'FILL' ${fill}, 'wght' ${weight}, 'GRAD' 0, 'opsz' ${size || 24}`,
        ...style,
      }}
    >
      {name}
    </span>
  )
}

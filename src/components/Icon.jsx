import { ICONS, VIEWBOX, DEFAULT_VIEWBOX } from '../icons/symbols'

// Ícones Material Symbols Rounded como SVG inline (sem fonte web). A API é a
// mesma de antes: name, size, fill (0/1 → variante preenchida), className, style.
// O tamanho vem de `size` (1em) ou, sem size, do font-size herdado via CSS;
// a cor segue `currentColor`. Para adicionar um ícone, baixe o SVG e registre
// o conteúdo em src/icons/symbols.js.

// A fonte renderia o glifo com uma folga interna (fica menor que 1em). Para que
// o SVG (que preenche o viewBox todo) tenha o MESMO tamanho visual da fonte,
// "afastamos" o viewBox por este fator — mantendo a caixa em 1em, só o desenho
// encolhe. Ajuste fino do tamanho aparente dos ícones acontece aqui.
const ICON_SCALE = 0.9

function scaledViewBox(vb) {
  const [x, y, w, h] = vb.split(/\s+/).map(Number)
  const nw = w / ICON_SCALE
  const nh = h / ICON_SCALE
  return `${x - (nw - w) / 2} ${y - (nh - h) / 2} ${nw} ${nh}`
}

export default function Icon({ name, size, fill = 0, className = '', style }) {
  const body = (fill ? ICONS[`${name}@fill`] : null) || ICONS[name]
  if (!body) {
    if (import.meta.env.DEV) console.warn(`[Icon] ícone não registrado: "${name}"`)
    return null
  }
  return (
    <svg
      className={`material-symbols-rounded ${className}`}
      viewBox={scaledViewBox(VIEWBOX[name] || DEFAULT_VIEWBOX)}
      role="img"
      aria-hidden="true"
      focusable="false"
      style={size ? { fontSize: `${size}px`, ...style } : style}
      dangerouslySetInnerHTML={{ __html: body }}
    />
  )
}

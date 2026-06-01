import { useEffect, useRef, useState } from 'react'
import Icon from './Icon'
import styles from './KebabMenu.module.css'

// items: [{ label, icon, onClick, danger }]
export default function KebabMenu({ items }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('touchstart', onDoc)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('touchstart', onDoc)
    }
  }, [open])

  return (
    <div className={styles.wrap} ref={ref}>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setOpen((o) => !o)}
        aria-label="Mais opções"
        aria-haspopup="true"
        aria-expanded={open}
      >
        <Icon name="more_vert" size={22} />
      </button>
      {open && (
        <div className={styles.menu} role="menu">
          {items.map((it, i) => (
            <button
              key={i}
              type="button"
              role="menuitem"
              className={`${styles.item} ${it.danger ? styles.danger : ''}`}
              onClick={() => { setOpen(false); it.onClick() }}
            >
              {it.icon && <Icon name={it.icon} size={18} />}
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

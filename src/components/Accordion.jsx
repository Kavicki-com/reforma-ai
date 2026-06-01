import { useState } from 'react'
import Icon from './Icon'
import styles from './Accordion.module.css'

export default function Accordion({ icon, title, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className={`card ${styles.acc}`}>
      <button className={styles.head} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        {icon && <Icon name={icon} className={styles.icon} />}
        <span className={styles.title}>{title}</span>
        <Icon name={open ? 'expand_less' : 'expand_more'} className={styles.chevron} />
      </button>
      {open && <div className={styles.body}>{children}</div>}
    </div>
  )
}

import styles from './Spinner.module.css'

export default function Spinner({ small }) {
  return <span className={small ? styles.small : styles.dot} aria-label="carregando" />
}

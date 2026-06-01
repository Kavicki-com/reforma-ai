import styles from './CompanyFooter.module.css'

export default function CompanyFooter() {
  return (
    <p className={styles.footer}>
      Uma empresa <a href="https://kavicki.com" target="_blank" rel="noreferrer">kavicki.com</a>
    </p>
  )
}

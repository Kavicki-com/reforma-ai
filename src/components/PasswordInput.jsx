import { useState } from 'react'
import Icon from './Icon'
import styles from './PasswordInput.module.css'

// Campo de senha com botão de mostrar/ocultar (ícone de olho).
export default function PasswordInput({ value, onChange, autoComplete = 'current-password', required, placeholder }) {
  const [show, setShow] = useState(false)
  return (
    <div className={styles.wrap}>
      <input
        className={`input ${styles.input}`}
        type={show ? 'text' : 'password'}
        autoComplete={autoComplete}
        value={value}
        onChange={onChange}
        required={required}
        placeholder={placeholder}
      />
      <button
        type="button"
        className={styles.toggle}
        onClick={() => setShow((s) => !s)}
        aria-label={show ? 'Ocultar senha' : 'Mostrar senha'}
      >
        <Icon name={show ? 'visibility_off' : 'visibility'} size={20} />
      </button>
    </div>
  )
}

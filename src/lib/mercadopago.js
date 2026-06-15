// Loader sob demanda do SDK do Mercado Pago (Checkout Transparente).
// Carrega o script só quando a tela de pagamento precisa, e memoiza a instância.

const SDK_URL = 'https://sdk.mercadopago.com/js/v2'
let sdkPromise = null
let mpInstance = null

function loadSdk() {
  if (window.MercadoPago) return Promise.resolve()
  if (sdkPromise) return sdkPromise
  sdkPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = SDK_URL
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => { sdkPromise = null; reject(new Error('Falha ao carregar o SDK do Mercado Pago.')) }
    document.head.appendChild(s)
  })
  return sdkPromise
}

function resolvePublicKey() {
  const isProd = import.meta.env.VITE_MP_ENV === 'production'
  return (
    (isProd
      ? import.meta.env.VITE_MERCADO_PAGO_PUBLIC_KEY_PROD
      : import.meta.env.VITE_MERCADO_PAGO_PUBLIC_KEY_TEST) ||
    import.meta.env.VITE_MERCADO_PAGO_PUBLIC_KEY
  )
}

export async function getMercadoPago() {
  const publicKey = resolvePublicKey()
  if (!publicKey) throw new Error('Public Key do Mercado Pago ausente. Confira o .env')
  await loadSdk()
  if (!mpInstance) {
    // eslint-disable-next-line no-undef
    mpInstance = new MercadoPago(publicKey, { locale: 'pt-BR' })
  }
  return mpInstance
}

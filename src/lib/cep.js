// Consulta de CEP via ViaCEP (gratuito, sem chave).
// Retorna { street, neighborhood, city, uf, complement } ou null se inválido.
export async function lookupCep(cep) {
  const clean = String(cep || '').replace(/\D/g, '')
  if (clean.length !== 8) return null
  try {
    const resp = await fetch(`https://viacep.com.br/ws/${clean}/json/`)
    if (!resp.ok) return null
    const data = await resp.json()
    if (data.erro) return null
    return {
      street: data.logradouro || '',
      neighborhood: data.bairro || '',
      city: data.localidade || '',
      uf: data.uf || '',
      complement: data.complemento || '',
    }
  } catch {
    return null
  }
}

// Máscara visual 00000-000
export function maskCep(value) {
  const d = String(value || '').replace(/\D/g, '').slice(0, 8)
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d
}

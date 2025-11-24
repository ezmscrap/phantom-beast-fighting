export const resolveAssetPath = (relativePath: string): string => {
  const base = import.meta.env.BASE_URL ?? '/'
  const normalizedBase = base.endsWith('/') ? base.slice(0, -1) : base
  const normalizedRelative = relativePath.startsWith('/')
    ? relativePath.slice(1)
    : relativePath
  return `${normalizedBase}/${normalizedRelative}`
}

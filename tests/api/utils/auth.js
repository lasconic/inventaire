import CONFIG from 'config'

export const sessionCookieName = `${CONFIG.name}:session`
export const sessionSignatureCookieName = `${sessionCookieName}.sig`
const sessionCookiePattern = new RegExp(`${sessionCookieName}=([^;]+);`)
const sessionSignatureCookiePattern = new RegExp(`${sessionCookieName}\\.sig=([^;]+);`)

export const parseSessionCookies = cookieStr => {
  const sessionCookieMatch = cookieStr.match(sessionCookiePattern)
  const sessionSignatureCookieMatch = cookieStr.match(sessionSignatureCookiePattern)
  const sessionCookie = sessionCookieMatch && sessionCookieMatch[1]
  const signatureCookie = sessionSignatureCookieMatch && sessionSignatureCookieMatch[1]
  return [ sessionCookie, signatureCookie ]
}

export const buildSessionCookies = (sessionCookie, signatureCookie) => {
  return `${sessionCookieName}=${sessionCookie}; ${sessionSignatureCookieName}=${signatureCookie};`
}

export const buildBase64EncodedJson = obj => Buffer.from(JSON.stringify(obj)).toString('base64')

export const parseBase64EncodedJson = base64Str => JSON.parse(Buffer.from(base64Str, 'base64').toString())

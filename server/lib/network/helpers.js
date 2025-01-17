import dns from 'node:dns'
import { promisify } from 'node:util'

export const dnsLookup = promisify(dns.lookup)

export const getHostname = origin => origin ? new URL(origin).hostname : null

export async function getHostnameIp (hostname) {
  const { address } = await dnsLookup(hostname)
  return address
}

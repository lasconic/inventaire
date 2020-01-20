// Identity: v3
// Swift: v2
const CONFIG = require('config')
const __ = CONFIG.universalPath
const _ = __.require('builders', 'utils')
const promises_ = __.require('lib', 'promises')
const error_ = __.require('lib', 'error/error')
const breq = require('bluereq')
const { tenMinutes } = __.require('lib', 'times')

let lastToken
let lastTokenExpirationTime = 0
// let a 10 minutes margin before token expiration
const tokenExpired = () => Date.now() > (lastTokenExpirationTime - tenMinutes)

const { username, password, authUrl, tenantName } = CONFIG.mediaStorage.swift

// source: https://docs.openstack.org/keystone/pike/contributor/http-api.html#i-have-a-non-python-client
const postParams = {
  url: `${authUrl}/v3/auth/tokens`,
  headers: { 'Content-Type': 'application/json' },
  body: {
    auth: {
      identity: {
        methods: [ 'password' ],
        password: {
          user: {
            domain: { id: 'default' },
            name: username,
            password
          }
        }
      },
      scope: {
        project: {
          domain: { id: 'default' },
          name: tenantName
        }
      }
    }
  }
}

module.exports = () => {
  if (lastToken && !tokenExpired()) return promises_.resolve(lastToken)

  return breq.post(postParams)
  .then(parseIdentificationRes)
  .catch(err => {
    err.serviceStatusCode = err.statusCode
    // Override status code to fit the status that should be return to users
    err.statusCode = 500
    _.error(err, 'getToken')
    throw err
  })
}

const parseIdentificationRes = ({ body, headers }) => {
  const newToken = headers['x-subject-token']
  console.log('newToken', newToken)
  if (!newToken) throw error_.new('swift token not found', 500, { headers })

  const expirationTime = body.token.expires_at && (new Date(body.token.expires_at)).getTime()
  if (!expirationTime) throw error_.new('swift expiration time not found', 500, { body, headers })

  lastToken = newToken
  lastTokenExpirationTime = expirationTime
  return lastToken
}

import CONFIG from 'config'
import OAuthServer from 'express-oauth-server'
import { error_ } from '#lib/error/error'
import oauthServerModel from './lib/oauth/model.js'
import { getAcceptedScopes, allScopes } from './lib/oauth/scopes.js'

const { authorizationCodeLifetimeMs } = CONFIG.oauthServer

const oauthServer = new OAuthServer({
  useErrorHandler: true,
  model: oauthServerModel,
})

const authorize = oauthServer.authorize({
  authorizationCodeLifetime: authorizationCodeLifetimeMs / 1000,
  authenticateHandler: {
    handle: (req, res) => {
      return req.user
    },
  },
})

// See https://oauth2-server.readthedocs.io/en/latest/api/oauth2-server.html
export default {
  // Step 1: the user authorizes a client to get tokens on its behalf, for certain scopes
  // by doing a GET on the authorize endpoint
  // Implements https://aaronparecki.com/oauth-2-simplified/#web-server-apps "Authorization"
  authorize: {
    get: (req, res, next) => {
      if (req.user == null) return error_.unauthorizedApiAccess(req, res)

      const { scope } = req.query
      if (!scope) return error_.bundleMissingQuery(req, res, 'scope')
      const scopes = scope.split(/[\s+]/)

      for (const scopeName of scopes) {
        if (!allScopes.includes(scopeName)) {
          return error_.bundle(req, res, `invalid scope: ${scopeName}`, 400, { invalid: scopeName, valid: allScopes })
        }
      }

      authorize(req, res, next)
    },
  },

  // Step 2: the client requests a token
  // by doing a POST on the token endpoint
  // Implements https://aaronparecki.com/oauth-2-simplified/#web-server-apps "Getting an Access Token"
  token: {
    post: oauthServer.token(),
  },

  // Step 3: the client uses a token to access resources within the token authorized scopes
  // That token is used by the authenticate middleware to accept or decline the access on any endpoint
  // Implements https://aaronparecki.com/oauth-2-simplified/#making-authenticated-requests
  authenticate: (req, res, next) => {
    const scope = getAcceptedScopes(req)
    if (scope != null) oauthServer.authenticate({ scope })(req, res, next)
    else return error_.bundle(req, res, 'this resource can not be accessed with an OAuth bearer token', 403)
  },
}

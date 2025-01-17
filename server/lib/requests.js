import { URL } from 'node:url'
import CONFIG from 'config'
import fetch from 'node-fetch'
import { magenta, green, cyan, yellow, red, grey } from 'tiny-chalk'
import { absolutePath } from '#lib/absolute_path'
import { addContextToStack, error_ } from '#lib/error/error'
import { wait } from '#lib/promises'
import { assert_ } from '#lib/utils/assert_types'
import { requireJson } from '#lib/utils/json'
import { warn } from '#lib/utils/logs'
import { isUrl } from './boolean_validations.js'
import isPrivateUrl from './network/is_private_url.js'
import { getAgent, insecureHttpsAgent } from './requests_agent.js'
import { assertHostIsNotTemporarilyBanned, resetBanData, declareHostError } from './requests_temporary_host_ban.js'
import { coloredElapsedTime } from './time.js'

const { repository } = requireJson(absolutePath('root', 'package.json'))
const { logStart, logEnd, logOngoingAtInterval, ongoingRequestLogInterval, bodyLogLimit } = CONFIG.outgoingRequests
export const userAgent = `${CONFIG.name} (${repository.url})`
const defaultTimeout = 30 * 1000

let requestCount = 0

async function req (method, url, options = {}) {
  assert_.string(url)
  assert_.object(options)

  if (options.sanitize) {
    if (!isUrl(url) || (await isPrivateUrl(url))) {
      throw error_.newInvalid('url', url)
    }
  }

  const { host } = new URL(url)
  assertHostIsNotTemporarilyBanned(host)

  const { returnBodyOnly = true, parseJson = true, body: reqBody, retryOnceOnError = false, noRetry = false } = options
  const fetchOptions = getFetchOptions(method, options)

  const timer = startReqTimer(method, url, fetchOptions)

  let res, statusCode, errorCode
  try {
    res = await fetch(url, fetchOptions)
  } catch (err) {
    errorCode = err.code || err.type || err.name || err.message
    if (!noRetry && (err.code === 'ECONNRESET' || retryOnceOnError)) {
      // Retry after a short delay when socket hang up
      await wait(100)
      warn(err, `retrying request ${timer.requestId}`)
      res = await fetch(url, fetchOptions)
    } else {
      if (err.type === 'request-timeout' || err.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE') declareHostError(host)
      throw err
    }
  } finally {
    statusCode = res?.status
    endReqTimer(timer, statusCode || errorCode)
  }

  // Always parse as text, even if JSON, as in case of an error in the JSON response
  // (such as HTML being retunred instead of JSON), it allows to include the actual response
  // in the error message
  // It shouldn't have any performance cost, as that's what node-fetch does in the background anyway
  const responseText = await res.text()

  let body
  if (parseJson) {
    try {
      body = JSON.parse(responseText)
    } catch (err) {
      // Some web services return errors with a different content-type
      // Known cases:
      // - CouchDB returns errors as plain text by default
      // - SPARQL services too
      // Let the error be raised as a request error instead of a JSON.parse error
      if (statusCode < 400) {
        err.context = { url, options, statusCode, responseText }
        addContextToStack(err)
        declareHostError(host)
        throw err
      } else {
        // Above 400, let it be raised as a request error hereafter
        body = responseText
      }
    }
  } else {
    body = responseText
  }

  if (statusCode >= 400) {
    if (statusCode >= 500) declareHostError(host)
    const err = error_.new('request error', statusCode, { method, url, reqBody, statusCode, resBody: body })
    err.body = body
    addContextToStack(err)
    throw err
  }

  resetBanData(host)

  if (returnBodyOnly) {
    return body
  } else {
    const headers = formatHeaders(res.headers.raw())
    return { statusCode, headers, body }
  }
}

const formatHeaders = headers => {
  const flattenedHeaders = {}
  Object.keys(headers).forEach(key => {
    flattenedHeaders[key] = headers[key].join(';')
  })
  return flattenedHeaders
}

const getFetchOptions = (method, options) => {
  const headers = options.headers || {}
  const fetchOptions = {
    method,
    headers,
    timeout: options.timeout || defaultTimeout,
    redirect: options.redirect,
    compress: true,
  }
  headers.accept = headers.accept || 'application/json'
  // A user agent is required by Wikimedia services
  // (reject with a 403 error otherwise)
  headers['user-agent'] = userAgent

  if (options.body && typeof options.body !== 'string') {
    fetchOptions.body = JSON.stringify(options.body)
    headers['content-type'] = 'application/json'
  } else if (options.bodyStream != null) {
    // Pass stream bodies as a 'bodyStream' option to avoid having it JSON.stringified
    fetchOptions.body = options.bodyStream
  } else {
    fetchOptions.body = options.body
  }

  if (options.ignoreCertificateErrors) {
    fetchOptions.agent = insecureHttpsAgent
  } else {
    fetchOptions.agent = getAgent
  }
  return fetchOptions
}

const basicAuthPattern = /\/\/\w+:[^@:]+@/

const requestIntervalLogs = {}

const startReqTimer = (method, url, fetchOptions) => {
  // Prevent logging Basic Auth credentials
  url = url.replace(basicAuthPattern, '//')

  let body = ''
  if (fetchOptions.bodyStream) body += ' [stream]'
  else if (typeof fetchOptions.body === 'string') {
    const { length } = fetchOptions.body
    if (length < bodyLogLimit) body += ' ' + fetchOptions.body
    else body += ` ${fetchOptions.body.slice(0, bodyLogLimit)} [${length} total characters...]`
  }

  const requestId = `r${++requestCount}`
  const reqTimerKey = `${method.toUpperCase()} ${url}${body.trimEnd()} [${requestId}]`
  const startTime = process.hrtime()
  if (logStart) process.stdout.write(`${grey(`${reqTimerKey} started`)}\n`)
  if (logOngoingAtInterval) startLoggingRequestAtInterval({ requestId, reqTimerKey, startTime })
  return { reqTimerKey, requestId, startTime }
}

const startLoggingRequestAtInterval = ({ requestId, reqTimerKey, startTime }) => {
  requestIntervalLogs[requestId] = setInterval(() => {
    const elapsed = coloredElapsedTime(startTime)
    process.stdout.write(`${grey(`${reqTimerKey} ongoing`)} ${elapsed}\n`)
  }, ongoingRequestLogInterval)
}

const stopLoggingRequestAtInterval = requestId => {
  clearInterval(requestIntervalLogs[requestId])
  delete requestIntervalLogs[requestId]
}

const endReqTimer = ({ reqTimerKey, requestId, startTime }, statusCode) => {
  if (logOngoingAtInterval) stopLoggingRequestAtInterval(requestId)
  if (!logEnd) return
  const elapsed = coloredElapsedTime(startTime)
  const statusColor = getStatusColor(statusCode)
  process.stdout.write(`${magenta(reqTimerKey)} ${statusColor(statusCode)} ${elapsed}\n`)
}

const getStatusColor = statusCode => {
  if (typeof statusCode !== 'number') return red
  if (statusCode < 300) return green
  if (statusCode < 400) return cyan
  if (statusCode < 500) return yellow
  return red
}

export const requests_ = {
  get: req.bind(null, 'get'),
  post: req.bind(null, 'post'),
  put: req.bind(null, 'put'),
  delete: req.bind(null, 'delete'),
  head: (url, options = {}) => {
    options.parseJson = false
    options.returnBodyOnly = false
    return req('head', url, options)
  },
  options: req.bind(null, 'options'),
  userAgent,
}

export const get = requests_.get

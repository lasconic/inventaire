const { offline, verbose } = require('config')
const chalk = require('chalk')
const { red, grey } = chalk
const { isArguments } = require('lodash')
// Log full objects
require('util').inspect.defaultOptions.depth = 20
let errorCounter = 0

const print = str => process.stdout.write(str + '\n')

const log = (obj, label, color = 'cyan') => {
  if (!verbose) return
  if ((typeof obj === 'string') && (label == null)) {
    print(chalk[color](obj))
  } else {
    // converting arguments object to array for readablilty
    if (isArguments(obj)) obj = Array.from(obj)
    if (label != null) {
      print(grey('****** ') + chalk[color](label.toString()) + grey(' ******'))
    } else {
      print(chalk[color]('******************************'))
    }
    let objCopy = obj
    let context
    if (obj && obj.context) {
      context = obj.context
      objCopy = Object.assign({}, obj)
      delete objCopy.context
    }
    if (typeof objCopy === 'object') console.log(objCopy)
    else print(objCopy)
    if (context != null) {
      console.log('Context:', context)
    }
    print(grey('-----'))
  }
}

const loggers = {
  log,
  success: (obj, label) => log(obj, label, 'green'),
  info: (obj, label) => log(obj, label, 'blue'),
  warn: (err, label) => {
    const url = err.context && err.context.url
    // Local 404 errors don't need to be logged, as they will be logged
    // by the request logger middleware and logging the error object is of no help,
    // everything is in the URL
    if (err.statusCode === 404 && url && url[0] === '/') return
    if (err instanceof Error) {
      // shorten the stack trace
      err.stack = err.stack.split('\n').slice(0, 3).join('\n')
    }

    log(err, label, 'yellow')
  },
  error: (err, label) => {
    if (!(err instanceof Error)) {
      throw new Error('invalid error object')
    }

    // If the error is of a lower lever than 500, make it a warning, not an error
    if ((err.statusCode != null) && (err.statusCode < 500)) {
      return loggers.warn(err, label)
    }

    // Prevent logging big error stack traces for network errors
    // in offline development mode
    if (offline && (err.code === 'ENOTFOUND')) {
      log(err.message, `${label} (offline)`, 'red')
      return
    }

    log(err, label, 'red')

    errorCounter++
  },
}

const tapLogger = logger => label => obj => {
  logger(obj, label)
  return obj
}

loggers.Log = tapLogger(loggers.log)
loggers.Error = tapLogger(loggers.error)

const errorRethrow = (err, label) => {
  loggers.error(err, label)
  throw err
}

loggers.ErrorRethrow = tapLogger(errorRethrow)

// logs the errors total if there was an error
// in the last 5 seconds
// -> just a convenience for debugging
const logErrorsCount = () => {
  let prev = 0
  const counter = () => {
    if (errorCounter !== prev) {
      prev = errorCounter
      console.log(red('errors: ') + errorCounter)
    }
  }
  setInterval(counter, 5000)
}

module.exports = {
  ...loggers,
  logErrorsCount,
}

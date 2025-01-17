import CONFIG from 'config'
import _ from '#builders/utils'
import { waitForCPUsLoadToBeBelow } from '#lib/os'
import { log } from '#lib/utils/logs'
import CreateUnresolvedEntry from './create_unresolved_entry.js'
import resolve from './resolve.js'
import sanitizeEntry from './sanitize_entry.js'
import UpdateResolvedEntry from './update_resolved_entry.js'

const { nice } = CONFIG

export async function resolveUpdateAndCreate (params) {
  params.batchId = Date.now()
  const { create, update, strict } = params
  const { entries, errors } = sanitizeEntries(params.entries, strict)

  const resolvedEntries = []
  if (entries.length === 0) return { resolvedEntries, errors }

  const updateResolvedEntry = buildActionFn(update, UpdateResolvedEntry, params)
  const createUnresolvedEntry = buildActionFn(create, CreateUnresolvedEntry, params)
  const addResolvedEntry = entry => resolvedEntries.push(entry)

  const resolveNext = async () => {
    if (nice) await waitForCPUsLoadToBeBelow({ threshold: 1 })
    const nextEntry = entries.shift()
    if (nextEntry == null) return { resolvedEntries, errors }

    log(nextEntry, 'next entry')

    return resolve(nextEntry)
    .then(updateResolvedEntry)
    .then(createUnresolvedEntry)
    .then(addResolvedEntry)
    .catch(err => handleError(strict, errors, err, nextEntry))
    .then(resolveNext)
  }

  return resolveNext()
}

const buildActionFn = (flag, ActionFn, params) => {
  if (flag) return ActionFn(params)
  else return _.identity
}

const handleError = (strict, errors, err, entry) => {
  err.context = err.context || {}
  err.context.entry = entry
  if (strict) {
    throw err
  } else {
    err.entry = entry
    errors.push(err)
  }
}

export const sanitizeEntries = (entries, strict) => {
  const errors = []
  const sanitizedEntries = []
  entries.forEach(sanitizeEntryAndDispatch(sanitizedEntries, errors, strict))
  return { entries: sanitizedEntries, errors }
}

const sanitizeEntryAndDispatch = (sanitizedEntries, errors, strict) => entry => {
  try {
    sanitizedEntries.push(sanitizeEntry(entry))
  } catch (err) {
    handleError(strict, errors, err, entry)
  }
}

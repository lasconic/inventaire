export const wait = ms => new Promise(resolve => setTimeout(resolve, ms))

export async function objectPromise (obj) {
  const keys = []
  const values = []
  for (const key in obj) {
    const value = obj[key]
    keys.push(key)
    values.push(value)
  }

  const res = await Promise.all(values)
  const resultObj = {}
  res.forEach((valRes, index) => {
    const key = keys[index]
    resultObj[key] = valRes
  })
  return resultObj
}

export const tap = fn => async res => {
  const tapRes = fn(res)
  if (tapRes instanceof Promise) await tapRes
  return res
}

export const mappedArrayPromise = fn => array => Promise.all(array.map(fn))

// Source: http://bluebirdjs.com/docs/api/deferred-migration.html
export const defer = () => {
  // Initialized in the defer function scope
  let resolveFn, rejectFn

  const promise = new Promise((resolve, reject) => {
    // Set the previously initialized variables
    // to the promise internal resolve/reject functions
    resolveFn = resolve
    rejectFn = reject
  })

  return {
    // A function to resolve the promise at will:
    // the promise will stay pending until 'resolve' or 'reject' is called
    resolve: resolveFn,
    reject: rejectFn,
    // The promise object, still pending at the moment this is returned
    promise,
  }
}

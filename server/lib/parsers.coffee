# parsers are meant to reverse type changes occuring during data transfer
# ex: numbers converted to strings
# parsers are placed before tests to test only parsed values

# arbitrary default to true
booleanString = (value)-> if value is 'false' then false else true

allParsers =
  user:
    position: (latLng)->
      # allow the user to delete her position by passing a null value
      unless _.isArray latLng then return null
      return latLng.map (str)-> Number(str)
    summaryPeriodicity: (days)->
      if _.isString days
        try days = Number days
        catch err then _.warn err, "couldn't parse summaryPeriodicity value"
      return days

  group:
    searchable: booleanString


module.exports = (domain)->
  parsers = allParsers[domain]
  hasParser = Object.keys parsers
  return parse = (attribute, value)->
    if attribute in hasParser then parsers[attribute](value)
    else value

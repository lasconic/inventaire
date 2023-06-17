// The list of all the properties used server-side or client-side
// to keep when formatting Wikidata entities
// Motivations:
// - counter-balancing the extra work on picking properties by not having
//   to simplify claims that won't be used
// - saving space in server and client cache
// - saving everyone's bandwidth

import { unprefixify } from '#controllers/entities/lib/prefix'
import propertiesValuesConstraints from '#controllers/entities/lib/properties/properties_values_constraints'

const editedProperties = Object.keys(propertiesValuesConstraints)
  .filter(property => property.startsWith('wdt:'))
  .map(unprefixify)

// Properties used to avoid false positives in duplicates detection
const relationsProperties = [
  'P22', // father
  'P25', // mother
  'P26', // spouse
  'P40', // child
  'P1038', // relative
  'P1889', // different from
  'P3342', // significant person
  'P3373', // sibling
  'P3448', // stepparent
  'P8810', // parent
]

// Properties that can not be edited from Inventaire, but that might
// still be displayed or used in some way
const otherNonEditedProperties = [
  'P18', // image
  'P27', // country of citizenship
  'P39', // position held
  'P58', // screen writer
  'P69', // educated at
  'P103', // native language
  'P106', // occupation
  'P109', // signature
  'P110', // illustrator
  'P138', // named after
  'P154', // logo image
  'P155', // follow
  'P156', // is follow by
  'P166', // award received
  'P356', // DOI
  'P361', // part of
  'P349', // NDL of Japan Auth ID
  'P674', // characters
  'P724', // Internet Archive ID
  'P738', // influence of
  'P953', // full text available at
  'P906', // SELIBR ID (Swedish)
  'P1066', // student of
  'P1433', // published in
  'P2034', // Project Gutenberg ebook ID
  'P2093', // author name string
  'P2716', // collage image
  'P2860', // cite
  'P2959', // permanent duplicated item
  'P4258', // Gallica ID
  'P6338', // colorist
  'P6802', // related image
]

export const allowlistedProperties = editedProperties.concat(otherNonEditedProperties, relationsProperties)

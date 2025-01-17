import _ from '#builders/utils'
import { isVisibilityKeyArray } from '#models/validations/visibility'
import itemAttributes from '../attributes/item.js'
import commonValidations from './common.js'

const { pass, itemId, userId, entityUri, BoundedString, imgUrl } = commonValidations
const { constrained } = itemAttributes
const constrainedAttributes = Object.keys(constrained)

export default {
  pass,
  itemId,
  userId,
  entity: entityUri,
  lang: lang => lang ? _.isLang(lang) : true,
  pictures: pictures => _.isArray(pictures) && _.every(pictures, imgUrl),
  attribute: attribute => constrainedAttributes.includes(attribute),
  transaction: transaction => {
    return constrained.transaction.possibilities.includes(transaction)
  },
  visibility: isVisibilityKeyArray,
  details: _.isString,
  notes: _.isString,
  snapshotValidations: {
    'entity:title': BoundedString(1, 500),
    'entity:image': _.isExtendedUrl,
    'entity:lang': _.isLang,
    'entity:authors': _.isString,
    'entity:series': _.isString,
    'entity:ordinal': _.isString,
  },
}

import _ from '#builders/utils'
import { getAuthorWorks } from '#controllers/entities/lib/get_author_works'
import { getEntitiesList } from '#controllers/entities/lib/get_entities_list'
import mergeEntities from '#controllers/entities/lib/merge_entities'
import { getEntityNormalizedTerms } from '#controllers/entities/lib/terms_normalization'
import { hardCodedUsers } from '#db/couchdb/hard_coded_documents'
import { log } from '#lib/utils/logs'

const { _id: reconcilerUserId } = hardCodedUsers.reconciler

export default authorUri => {
  return getAuthorWorksByDomain(authorUri)
  .then(findMergeableWorks)
  .then(automergeWorks(authorUri))
}

const getAuthorWorksByDomain = authorUri => {
  return getAuthorWorks({ uri: authorUri })
  .then(({ works }) => works)
  .then(works => {
    const uris = _.map(works, _.property('uri'))
    return getEntitiesList(uris)
  })
}

const findMergeableWorks = works => {
  let { wd: wdWorks, inv: invWorks } = works
    .reduce(spreadWorksPerDomain, { wd: [], inv: [] })
  invWorks = invWorks.filter(isntSeriePart)
  return getPossibleWorksMerge(wdWorks, invWorks)
}

const spreadWorksPerDomain = (lists, work) => {
  const prefix = work.uri.split(':')[0]
  lists[prefix].push(work)
  return lists
}

const isntSeriePart = work => work.claims['wdt:P179'] == null

const getPossibleWorksMerge = (wdWorks, invWorks) => {
  wdWorks = wdWorks.map(addNormalizedTerms)
  invWorks = invWorks.map(addNormalizedTerms)
  return _.compact(invWorks.map(findPossibleMerge(wdWorks)))
}

const addNormalizedTerms = work => {
  work.terms = getEntityNormalizedTerms(work)
  return work
}

const findPossibleMerge = wdWorks => invWork => {
  const matches = wdWorks.filter(haveSomeMatchingTerms(invWork))
  if (matches.length === 1) return [ invWork.uri, matches[0].uri ]
}

const haveSomeMatchingTerms = invWork => wdWork => _.someMatch(invWork.terms, wdWork.terms)

const automergeWorks = authorUri => mergeableCouples => {
  if (mergeableCouples.length === 0) return

  log(mergeableCouples, `automerging works from author ${authorUri}`)

  const mergeNext = () => {
    const nextCouple = mergeableCouples.pop()
    if (nextCouple == null) return
    const [ fromUri, toUri ] = nextCouple
    return mergeEntities({ userId: reconcilerUserId, fromUri, toUri })
    .then(mergeNext)
  }

  return mergeNext()
}

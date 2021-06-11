const should = require('should')
const getResolvedSeed = require('data/dataseed/get_resolved_seed')
const getEntityByUri = require('controllers/entities/lib/get_entity_by_uri')

describe('get resolved seed', () => {
  it('should get an edition entity when only one authority returns a seed', async () => {
    // Expect only BNF to return a seed
    const edition = await getResolvedSeed('978-2-207-11674-6')
    edition.claims['wdt:P629'].should.deepEqual([ 'wd:Q3210286' ])
    edition.claims['wdt:P268'].should.deepEqual([ '437169336' ])
  })

  it('should get an edition entity when multiple authorities return a seed', async () => {
    // Expect both BNE and BNF to return seeds
    const edition = await getResolvedSeed('84-00-06759-2')
    // with the BNF seed to be considered more resolved, and thus be selected
    edition.claims['wdt:P268'].should.deepEqual([ '43031012r' ])
    const workUri = edition.claims['wdt:P629'][0]
    const work = await getEntityByUri({ uri: workUri })
    const authorUri = work.claims['wdt:P50'][0]
    authorUri.should.equal('wd:Q470568')
  })

  it('should not get an entry from an unknown ISBN', async () => {
    const edition = await getResolvedSeed('978-3-9818987-4-3')
    should(edition).not.be.ok()
  })
})

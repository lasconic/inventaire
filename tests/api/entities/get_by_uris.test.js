const should = require('should')
const { authReq, shouldNotBeCalled, rethrowShouldNotBeCalledErrors, publicReq } = require('../utils/utils')

const { createEditionWithIsbn, createWorkWithAuthor, createEditionWithWorkAuthorAndSerie, createHuman, someFakeUri, generateIsbn13 } = require('../fixtures/entities')
const { getByUris, merge, deleteByUris } = require('../utils/entities')
const workWithAuthorPromise = createWorkWithAuthor()
const getWdEntity = require('data/wikidata/get_entity')
const { buildPath } = require('lib/utils/base')

describe('entities:get:by-uris', () => {
  it('should reject invalid uri', async () => {
    const invalidUri = 'bla'
    try {
      await getByUris(invalidUri)
      .then(shouldNotBeCalled)
    } catch (err) {
      rethrowShouldNotBeCalledErrors(err)
      err.statusCode.should.equal(400)
      err.body.status_verbose.should.startWith('invalid uri')
    }
  })

  it('should reject uri with wrong prefix', async () => {
    const invalidUri = 'foo:Q535'
    try {
      await getByUris(invalidUri)
      .then(shouldNotBeCalled)
    } catch (err) {
      rethrowShouldNotBeCalledErrors(err)
      err.statusCode.should.equal(400)
      err.body.status_verbose.should.startWith('invalid uri')
    }
  })

  it('should accept inventaire uri', async () => {
    const work = await workWithAuthorPromise
    const res = await getByUris(work.uri)
    res.entities[work.uri].should.be.an.Object()
  })

  it('should return uris not found', async () => {
    const { notFound } = await getByUris(someFakeUri)
    notFound.should.deepEqual([ someFakeUri ])
  })

  it('should return redirected uris', async () => {
    const [ humanA, humanB ] = await Promise.all([ createHuman(), createHuman() ])
    await merge(humanA.uri, humanB.uri)
    const { entities, notFound, redirects } = await getByUris(humanA.uri)
    Object.keys(entities).length.should.equal(1)
    entities[humanB.uri].should.be.an.Object()
    entities[humanB.uri].uri.should.equal(humanB.uri)
    redirects[humanA.uri].should.equal(humanB.uri)
    should(notFound).not.be.ok()
  })

  it('should accept wikidata uri', async () => {
    const validWdUri = 'wd:Q2300248'
    const { entities } = await getByUris(validWdUri)
    const entity = entities[validWdUri]
    entity.uri.should.equal(validWdUri)
  })

  it('should accept strict ISBN 13 syntax', async () => {
    const { uri } = await createEditionWithIsbn()
    uri.should.match(/isbn:\d{13}/)
    const { entities } = await getByUris(uri)
    const entity = entities[uri]
    entity.uri.should.equal(uri)
  })

  describe('props', () => {
    it("should return only the requested 'props'", async () => {
      const work = await workWithAuthorPromise
      const { uri: invWorkUri } = work
      const invAuthorUri = work.claims['wdt:P50'][0]
      const wdUri = 'wd:Q2300248'
      const url = buildPath('/api/entities', {
        action: 'by-uris',
        uris: `${invWorkUri}|${invAuthorUri}|${wdUri}`,
        props: 'labels|descriptions',
      })
      const { entities } = await publicReq('get', url)
      entities[invWorkUri].uri.should.be.ok()
      entities[invAuthorUri].uri.should.be.ok()
      entities[wdUri].uri.should.be.ok()
      entities[invWorkUri].labels.should.be.ok()
      entities[invAuthorUri].labels.should.be.ok()
      entities[wdUri].labels.should.be.ok()
      entities[wdUri].descriptions.should.be.ok()
      should(entities[invWorkUri].claims).not.be.ok()
      should(entities[invAuthorUri].claims).not.be.ok()
      should(entities[wdUri].aliases).not.be.ok()
      should(entities[wdUri].claims).not.be.ok()
      should(entities[wdUri].sitelinks).not.be.ok()
    })
  })

  describe('relatives', () => {
    it("should accept a 'relatives' parameter", async () => {
      const work = await workWithAuthorPromise
      const { uri: workUri } = work
      const authorUri = work.claims['wdt:P50'][0]
      const res = await getByUris(workUri, 'wdt:P50')
      res.entities[workUri].should.be.an.Object()
      res.entities[authorUri].should.be.an.Object()
    })

    it("should reject a non-allowlisted 'relatives' parameter", async () => {
      const work = await workWithAuthorPromise
      const { uri: workUri } = work
      try {
        await getByUris(workUri, 'wdt:P31')
        .then(shouldNotBeCalled)
      } catch (err) {
        rethrowShouldNotBeCalledErrors(err)
        err.statusCode.should.equal(400)
        err.body.status_verbose.should.startWith('invalid relative')
      }
    })

    it('should be able to include the works, authors, and series of an edition', async () => {
      const { uri: editionUri } = await createEditionWithWorkAuthorAndSerie()
      const res = await getByUris(editionUri, 'wdt:P50|wdt:P179|wdt:P629')
      const edition = res.entities[editionUri]
      edition.should.be.an.Object()

      const workUri = edition.claims['wdt:P629'][0]
      const work = res.entities[workUri]
      work.should.be.an.Object()

      const authorUri = work.claims['wdt:P50'][0]
      const author = res.entities[authorUri]
      author.should.be.an.Object()

      const serieUri = work.claims['wdt:P179'][0]
      const serie = res.entities[serieUri]
      serie.should.be.an.Object()
    })
  })
})

describe('entities:get:by-isbns', () => {
  it('should return existing edition', async () => {
    const { uri } = await createEditionWithIsbn()
    const res = await getByUris(uri)
    res.entities[uri].should.be.an.Object()
    res.entities[uri].uri.should.equal(uri)
    should(res.notFound).not.be.ok()
  })

  it('should return editions isbn in notFound array when autocreation is false', async () => {
    const uri = `isbn:${generateIsbn13()}`
    const res = await authReq('get', `/api/entities?action=by-uris&uris=${uri}&autocreate=false`)
    res.entities.should.deepEqual({})
    res.notFound[0].should.equal(uri)
  })

  it('should return editions isbn in notFound array when autocreation is true', async () => {
    const isbnUnknownBySeedsSources = '9783981898743'
    const uri = `isbn:${isbnUnknownBySeedsSources}`
    const res = await authReq('get', `/api/entities?action=by-uris&uris=${uri}&autocreate=true`)
    res.entities.should.deepEqual({})
    res.notFound[0].should.equal(uri)
  })

  it('should autocreate from seed when autocreation is true', async () => {
    const isbnKnownBySeedsSources = '9782207116746'
    const uri = `isbn:${isbnKnownBySeedsSources}`
    await deleteByUris([ uri ])
    const { notFound } = await authReq('get', `/api/entities?action=by-uris&uris=${uri}&autocreate=false`)
    notFound.should.deepEqual([ uri ])
    const res = await authReq('get', `/api/entities?action=by-uris&uris=${uri}&autocreate=true`)
    const entity = res.entities[uri]
    entity.should.be.an.Object()
    entity.uri.should.equal(uri)
    should(res.notFound).not.be.ok()
  })
})

describe('wikidata qualifiers adapter', () => {
  it('should flatten wikidata qualifier properties used as mainsnak in inventaire', async () => {
    const id = 'Q3024217'
    const uri = `wd:${id}`

    // The test relies on the state of an entity on Wikidata that needs
    // to be checked to assert that we are actually testing the desired behavior
    const rawEntity = await getWdEntity(id)
    if (rawEntity.claims.P1545) throw new Error(`${id} should not have a P1545 claim`)

    const { entities } = await getByUris(uri, null, true)
    const entity = entities[uri]
    entity.claims['wdt:P179'].should.deepEqual([ 'wd:Q1130014' ])
    // This claim is expected to be a qualifier from the one above
    entity.claims['wdt:P1545'].should.deepEqual([ '111' ])
  })

  it('should not flatten wikidata qualifier properties when there are too many', async () => {
    const id = 'Q54802792'
    const uri = `wd:${id}`

    // The test relies on the state of an entity on Wikidata that needs
    // to be checked to assert that we are actually testing the desired behavior
    const rawEntity = await getWdEntity(id)
    if (rawEntity.claims.P179.length !== 2) throw new Error(`${id} should have 2 P179 claims`)
    if (rawEntity.claims.P1545) throw new Error(`${id} should not have a P1545 claim`)

    const { entities } = await getByUris(uri, null, true)
    const entity = entities[uri]
    should(entity.claims['wdt:P1545']).not.be.ok()
  })
})

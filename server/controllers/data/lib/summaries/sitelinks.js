import { getSitelinkData, getSitelinkUrl } from 'wikibase-sdk'

export const getWikipediaSitelinksData = sitelinks => {
  if (!sitelinks) return []
  return Object.entries(sitelinks).map(getWikipediaSummaryData)
}

const getWikipediaSummaryData = ([ key, { title, badges } ]) => {
  if (badges.includes(redirectionBadge)) return
  const { lang, project } = getSitelinkData(key)
  if (project === 'wikipedia') {
    const link = getSitelinkUrl({ site: key, title })
    return {
      key,
      name: `Wikipedia (${lang})`,
      lang,
      link,
      sitelink: {
        title,
        lang,
      },
    }
  }
}

const redirectionBadge = 'Q70893996'

/*
  generates the graph and canonical data files in dist

  fetches the country list from the registers api, filters out inactive countries
  then goes throught each entry in graph.json and writes all the countries that are in the result
  from the api call, and all the nyms for each of those countries into dist/location-autocomplete-graph.json

  then it generates the canonical list from all the countries in the graph file
*/

const fetch = require('cross-fetch')
const apiKey = process.env.REGISTERS_API_KEY
const graph = require('./graph')
const fs = require('fs')

console.log('Generating Country Data...')
if(!apiKey) {
  console.log('\tThere is no "REGISTERS_API_KEY" in your environment!')
  process.exit(0)
}

const url = 'https://country.register.gov.uk/records.json?page-size=5000'
const newGraph = {}

/*
  if a country has a start date after now, or an end date before now, its invalid
*/
isCurrentlyActive = item => {
  const now = new Date()
  if(item['start-date']) {
    const start = Date.parse(item['start-date'])
    if (now < start) { return false }
  } else if (item['end-date']) {
    const end = Date.parse(item['end-date'])
    if(now > end) { return false }
  }
  return true
}

fetch(url, {
  headers: {
    'Authorization': process.env.REGISTERS_API_KEY
  }
}).then(response => response.json()).then(json => {
  console.log(`fetched new country list from ${url}...`)
  const existingCountries = Object.keys(graph)
    .filter(item => item.match(/(country:)/))
    .map(item => item.split(':')[1])

  let oldStyleKey

  Object.keys(json).forEach(key => {
    oldStyleKey = `country:${key}`
    if(existingCountries.includes(key) && isCurrentlyActive(json[key].item[0])) {
      newGraph[oldStyleKey] = graph[oldStyleKey]
    } else {
      console.log(`  ...the country "${graph[oldStyleKey].names['en-GB']}" is not valid at this time!`)
    }
  })

  const existingTerritories = Object.keys(graph)
    .filter(item => item.match(/territory:/))

  console.log('adding territories to graph...')

  existingTerritories.forEach(territory => {
    newGraph[territory] = graph[territory]
  })

  console.log('adding nyms to graph...')
  const locations = Object.keys(newGraph)

  Object.keys(graph)
    .filter(item => graph[item].edges.from && graph[item].edges.from.length > 0)
    .forEach(item => {
      const from = graph[item].edges.from[0]
      if(
        locations.includes(from) ||
        from.match(/uk:/) ||
        item.match(/uk:/)
      ) {
        newGraph[item] = graph[item]
      } else {
        console.log(`  ...the nym "${graph[item].names['en-GB']}" is for a location that is no longer valid!`)
      }
    })

  console.log('writing graph file...')
  fs.writeFileSync('./dist/location-autocomplete-graph.json', JSON.stringify(newGraph))

  console.log('writing canonical file...')
  const canonical = Object.keys(newGraph)
    .filter(item => item.match(/country:|territory:/))
    .map(item => {
      return [
        newGraph[item].names['en-GB'],
        item
      ]
    })

  fs.writeFileSync('./dist/location-autocomplete-canonical-list.json', JSON.stringify(canonical))

  console.log('...done')

})

import 'purecss/build/pure-min.css'
import 'purecss/build/grids-responsive-min.css'

import './styles.css'

import * as Chart from 'chart.js'

const distinctColors = require ('distinct-colors')

interface value { daily : number ; cumulative : number }

const join_data = (original : value[] | undefined, values : value[]) : value[] => {
  if (original == undefined) return values
  return original.map(function (o, i) { 
    return { daily: o.daily + (isNaN(values[i].daily) ? 0 : values[i].daily), cumulative: o.cumulative + (isNaN(values[i].cumulative) ? 0 : values[i].cumulative)}
  })
}

const fix_country = (country : string) => {
  if (country == 'Mainland China') return 'China'
  if (country == 'Korea, South') return 'South Korea'
  if (country == 'Saint Vincent and the Grenadines') return 'Saint Vincent'
  return country
}

const extract_data = (json : any[]) => {
  const data : Map<string, value[]> = new Map
  json.forEach(line => {
    const state = line[0]
    const country = fix_country(line[1])

    if (country == undefined) return

    const values = line.splice(4).map((v : string) => parseInt(v)).map(function (_v : number, i : number, a : []) : value {
      return {daily : a[i] - (i > 0 ? a[i - 1] : 0), cumulative : a[i]}
    })
    if (state != '') data.set(country, join_data(data.get(country), values))
    else data.set(country, values)
  })

  const world : value[] = []
  const worldminuschina : value[] = []

  data.forEach((country, c) => {
    country.forEach((day, index) => {
      while (world.length <= index) world.push({daily: 0, cumulative: 0})
      while (worldminuschina.length <= index) worldminuschina.push({daily: 0, cumulative: 0})
      world[index].daily += !isNaN(day.daily) ? day.daily : 0
      world[index].cumulative += !isNaN(day.cumulative) ? day.cumulative : 0
      if (c != 'China') {
        worldminuschina[index].daily += !isNaN(day.daily) ? day.daily : 0
        worldminuschina[index].cumulative += !isNaN(day.cumulative) ? day.cumulative : 0  
      }
    })
  })

  data.forEach((country, c) => {
    if (!country.every(v => v.cumulative == 0))
      while (country.length > 0 && country[country.length - 1].daily == 0) country.pop() 
  })

  data.set('World', world)
  data.set('World minus China', worldminuschina)

  return data
}

const capitalize = (s : string) => {
  if (typeof s !== 'string') return ''
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/**
 * Creates a title for the chart based on its configuration
 * @param type 
 * @param datatype 
 * @param alignStart 
 * @param smooth 
 */
const makeTitle = (type: string, datatype: string, alignStart: number, smooth : number) => {
  let title = `${capitalize(datatype)} (${type}) `

  if (alignStart > 0) title += ` aligned to first ${alignStart}`
  if (smooth > 0) title += ` moving average ${smooth}`

  return title
}

const type_function = (type: string) => {
  if (type == 'daily') 
    return (v: value, _i: number, _a: value[]) => v.daily
  
  if (type == 'cumulative') 
    return (v: value, _i: number, _a: value[]) => v.cumulative
  
  if (type == 'growth') 
    return (_v: value, i: number, a: value[]) => (i > 0 && a[i - 1].cumulative != 0 ? a[i].daily / a[i - 1].cumulative * 100 : 0)
  
  if (type == 'difference') 
    return (_v: value, i: number, a: value[]) => a[i].daily - (i > 0 ? a[i - 1].daily : 0)
  
    return (v : value, _i : number, _a : value[]) : number => v.daily
}

const get_palette = (count : number) => distinctColors.default({count, chromaMin: 50, lightMin: 50, lightMax: 100})

/*const get_values = (datatype : string, country : string, f : any) => {
  let values : number[] | undefined = []

  const confirmed = data.confirmed.get(country)
  const recovered = data.recovered.get(country)
  const deaths = data.deaths.get(country)

  if (datatype == 'confirmed') values = data.confirmed.get(country)?.map(f)
  if (datatype == 'recovered') values = data.recovered.get(country)?.map(f)
  if (datatype == 'deaths') values = data.deaths.get(country)?.map(f)
  if (datatype == 'mortality') {
    const cfr = confirmed?.map((c, idx) => {
      return {cumulative : deaths ? (c.cumulative == 0 ? 0 : deaths[idx].cumulative / c.cumulative * 100) : 0, daily : deaths ? (c.daily == 0 ? 0 : deaths[idx].daily / c.daily * 100) : 0}
    })

    values = cfr?.map(f)
  }

  if (datatype == 'active') {
    const cfr = confirmed?.map((c, idx) => {
      return { 
        cumulative : (recovered && deaths) ? (c.cumulative - deaths[idx].cumulative - recovered[idx].cumulative) : 0, 
        daily : (recovered && deaths) ? (c.daily - deaths[idx].daily - recovered[idx].daily) : 0
      }
    })

    values = cfr?.map(f)
  }

  return values ? values : []
} */

/**
 * Make chart use a logarithmic scale
 * @param chart 
 */
const logarithmicChart = (chart : Chart) => {
  chart.options.scales = {
    yAxes: [{
      type: 'logarithmic',          
      ticks: {
          autoSkip: false,
          callback: function (value, index, _values) {
            return Number.isInteger(Math.log10(value)) || index == 0 ? value : ''
          }
      }
    }]
  }
}

/** 
 * Calculates the average value of an array 
 */
const average = (array : number[]) => array.reduce((sum, value) => sum + value, 0) / array.length

/**
 * Returns the moving average of an array
 * @param values The array
 * @param count Window size
 */
const movingAverage = (values : number[], count : number) => {
  if (!count || count < 2) return values

  const averaged : number[] = []
  const window : number[] = []

  values.forEach((value) => {
    window.push(value)
    if (window.length > count) window.shift()
    averaged.push(average(window))
  })

  return averaged
}

/**
 * Creates the chart object
 */
const createChart = () => {
  Chart.defaults.global.defaultFontColor = '#EEE'
  Chart.defaults.scale.gridLines.color = "#666"
  
  if (Chart.defaults.global.elements?.point?.radius) Chart.defaults.global.elements.point.radius = 2

  const ctx = <HTMLCanvasElement>document.getElementById('chart')

  return new Chart(ctx, {
    type: 'line', data: { labels: [], datasets: [] },
    options: { responsive: true, maintainAspectRatio: false, tooltips: { mode: 'index' }}
  })
}

/**
 * Extracts values from JSON data for a single country aligned to
 * predetermined labels
 * @param country The country to extract data from
 */
const extractValues = (country : string, datatype : string, dates : string[], alignStart : number) => {
  const confirmed = data.get(country)?.confirmed
  const values = []
  
  switch (datatype) {
    case 'confirmed': values.push(...Array.from(data.get(country)?.confirmed || [])); break
    case 'deaths': values.push(...Array.from(data.get(country)?.deaths || [])); break
    case 'recovered': values.push(...Array.from(data.get(country)?.recovered || [])); break
    case 'active':
      for (let i = 0; i < (data.get(country)?.confirmed?.length || 0); i++) {
        const confirmed = <singleData>{ ...data.get(country)?.confirmed[i] } // cloning
        if (confirmed) {
          confirmed.Cases -= data.get(country)?.recovered[i]?.Cases || 0
          confirmed.Cases -= data.get(country)?.deaths[i]?.Cases || 0
          values.push(confirmed)
        }
      }
      break
    case 'mortality':
      for (let i = 0; i < (data.get(country)?.confirmed?.length || 0); i++) {
        const deaths = <singleData>{ ...data.get(country)?.deaths[i] } // cloning
        if (deaths) {
          deaths.Cases /= data.get(country)?.confirmed[i]?.Cases || 0
          deaths.Cases *= 100
          values.push(deaths)
        }
      }
      break
    }

  const result : Map<string, number> = new Map 

  dates.forEach(date => result.set(date, 0))

  if (alignStart > 0 && confirmed && values) {
    for (let i = 0; i < confirmed.length && i < values.length; i++)
      if (confirmed[i].Cases > alignStart) result.set(confirmed[i].Date.substring(0, 10), values[i].Cases)
  } else values?.forEach(d => result.set(d.Date.substring(0, 10), d.Cases))

  return Array.from(result.values())
}

/**
 * Extracts an array of dates from JSON data for a single country
 * @param country The country to extract dates from
 */
const extractDates = (country : string) => {
  const values = data.get(country)?.confirmed

  return values?.map(value => value.Date.substring(0, 10)) || []
}

/**
 * Extracts date labels for the selected countries
 */
const extractLabels = () => {
  const dates : Set<string> = new Set
  selectedCountries.forEach((country) => extractDates(country).forEach(dates.add, dates))
  return Array.from(dates).sort()
}

/**
 * Align chart labels
 * @param datasets 
 */
const alignLabels = (datasets : Chart.ChartDataSets[]) => {
  const largest = datasets.reduce((max, dataset) => Math.max(max, dataset.data?.length || 0), 0)
  return Array.from(Array(largest).keys())
}

/**
 * Updates chart values
 */
const updateChart = () => {
  const type = (<HTMLSelectElement>document.querySelector('#type')).value
  const scale = (<HTMLSelectElement>document.querySelector('#scale')).value
  const datatype = (<HTMLSelectElement>document.querySelector('#data-type')).value

  const smooth = parseInt((<HTMLInputElement>document.querySelector('#smooth')).value)
  const alignStart = parseInt((<HTMLInputElement>document.querySelector('#alignstart')).value)

  const f = type_function(type)

  const palette = get_palette(selectedCountries.size)

  if (chart != undefined && chart.data.datasets != undefined) {
    chart.data.labels = extractLabels()

    chart.data.datasets.length = 0
    chart.options.title = {display: true, text: makeTitle(type, datatype, alignStart, smooth)}

    selectedCountries.forEach((country) => {
      if (chart != undefined && chart.data.datasets != undefined) {
        const values = movingAverage(extractValues(country, datatype, <string[]>chart.data.labels, alignStart), smooth)
        
        if (alignStart > 0) while (values.length > 0 && values[0] == 0) values.shift()

        const color = palette[chart.data.datasets.length].hex()
        chart.data.datasets.push({ label: countries.get(country)?.Country, data: values, fill: false, backgroundColor: color, borderColor: color, borderWidth: 1.5})
      }
    })

    if (alignStart > 0) chart.data.labels = alignLabels(chart.data.datasets)

    if (scale == 'logarithmic') logarithmicChart(chart)      
    else chart.options.scales = undefined

    chart.update()
  }
}

/**
 * Load data from covid19api.com for a single country
 * @param country The country to load
 */
const loadCountry = async (country : string)  => {
  const confirmed : Promise<singleData[]> = fetch(`https://api.covid19api.com/total/country/${country}/status/confirmed`)
    .then(response => response.json())

  const deaths : Promise<singleData[]> = fetch(`https://api.covid19api.com/total/country/${country}/status/deaths`)
    .then(response => response.json())

  const recovered : Promise<singleData[]> = fetch(`https://api.covid19api.com/total/country/${country}/status/recovered`)
    .then(response => response.json())

  return Promise.all([confirmed, deaths, recovered])
}

/**
 * Called when a country is selected / unselected
 */
const toggleCountry = () => {
  const selector = <HTMLSelectElement>document.querySelector('#country')
  const country = selector.value

  if (country == '') return
  if (selector.selectedIndex == 0) return

  if (selectedCountries.has(country)) selectedCountries.delete(country)
  else selectedCountries.add(country)

  selector.selectedIndex = 0

  updateCountries()

  if (!data.get(country))
    loadCountry(country)
      .then(response => data.set(country, { confirmed : response[0], deaths : response[1], recovered : response[2] }))
      .then(updateChart)
  else updateChart()
}

/**
 * Compares two countries based on being selected or number of cases.
 */
 const compareCountries = (c1 : country, c2 : country) => {
  const v1 = data.get(c1.Slug)?.confirmed || []
  const v2 = data.get(c2.Slug)?.confirmed || []

  if (selectedCountries.has(c1.Slug) && !selectedCountries.has(c2.Slug)) return -1
  if (selectedCountries.has(c2.Slug) && !selectedCountries.has(c1.Slug)) return 1

  if (v1.length == 0 || v2.length == 0) return v2.length - v1.length

  return v2[v2.length - 1].Cases - v1[v1.length - 1].Cases
}

/**
 * Updates and sorts list of countries in country selector.
 */
const updateCountries = () => {
  const existing = Array.from(countries.values()).sort((c1, c2) => compareCountries(c1, c2))
  const select = document.querySelector('#country')
  
  if (select) 
    select.innerHTML = '<option value="" disabled selected hidden>Countries...</option>'
  
  existing.forEach(country => {
    const option = <HTMLOptionElement>document.createElement('OPTION')
    option.innerText = country.Country.concat(selectedCountries.has(country.Slug) ? ' *' : '')
    option.value = country.Slug
    select?.appendChild(option)
  })
} 

let chart = createChart()

type singleData = { Country : string, Province : string, Lat : number, Lon : number, Date : string, Cases : number, Status : string } 
type countryData = { confirmed : singleData[], deaths : singleData[], recovered : singleData[] } 
type country = { Country : string, Provinces : string[], Slug : string }

const countries : Map<string, country> = new Map
const data : Map<string, countryData> = new Map

const selectedCountries : Set<string> = new Set

const loadCountries = async () => {
  fetch(`https://api.covid19api.com/countries`)
    .then(response => response.json())
    .then(response => response.forEach((country : country) => countries.set(country.Slug, country)))
    .then(updateCountries)
}

document.querySelector('#country')?.addEventListener('change', toggleCountry)
document.querySelector('#type')?.addEventListener('change', updateChart)
document.querySelector('#scale')?.addEventListener('change', updateChart)
document.querySelector('#data-type')?.addEventListener('change', updateChart)

document.querySelector('#alignstart')?.addEventListener('input', updateChart)
document.querySelector('#smooth')?.addEventListener('input', updateChart)

document.querySelector('#scale')?.addEventListener('change', updateChart)

loadCountries()
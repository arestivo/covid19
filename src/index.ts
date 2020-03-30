import 'purecss/build/pure-min.css'
import 'purecss/build/grids-responsive-min.css'

import './styles.css'

import * as Chart from 'chart.js'
import * as ChartAnnotation from 'chartjs-plugin-annotation'
Chart.plugins.register(ChartAnnotation)

const distinctColors = require('distinct-colors')

const capitalize = (s: string) => {
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
const makeTitle = (type: string, datatype: string, alignStart: number, alignType: string, smooth: number) => {
  if (datatype == 'recovered-percentage') datatype = 'recovered (%)'

  let title = `${capitalize(datatype)} (${type}) `

  if (alignStart > 0 && alignType != '') title += ` aligned to first ${alignStart} ${alignType}`
  if (smooth > 0) title += ` moving average ${smooth}`

  return title
}

/**
 * Constructs a palette with a certain number of colors
 */
const getPalette = (count: number) => distinctColors.default({ count, chromaMin: 50, lightMin: 50, lightMax: 100 })

/**
 * Make chart use a logarithmic scale
 * @param chart 
 */
const logarithmicChart = (chart: Chart) => {
  chart.options.scales = {
    xAxes: [{
      type: 'time',
    }],
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
 * Make chart use a linear scale
 * @param chart 
 */
const linearChart = (char: Chart) => {
  chart.options.scales = {
    xAxes: [{
      type: 'time',
    }]
  }
}

/** 
 * Calculates the average value of an array 
 */
const average = (array: number[]) => array.reduce((sum, value) => sum + value, 0) / array.length

/**
 * Returns the moving average of an array
 * @param values The array
 * @param count Window size
 */
const movingAverage = (values: number[], count: number): number[] => {
  if (!count || count < 2) return values

  const averaged: number[] = []
  const window: number[] = []

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
    options: {
      responsive: true,
      maintainAspectRatio: false,
      tooltips: { mode: 'index' },
      annotation: {
        annotations: [1]
      }
    }
  })
}

/**
 * Extracts values from JSON data for a single country aligned to
 * predetermined labels
 * @param country The country to extract data from
 */
const extractValues = (country: string, datatype: string, dates: string[], alignStart: number, aligntype : string, type : string) => {
  const confirmed = data.get(country)?.confirmed
  const deaths = data.get(country)?.deaths
  const recovered = data.get(country)?.recovered

  let values : singleData[] = []

  switch (datatype) {
    case 'confirmed': values.push(...Array.from(confirmed || [])); break
    case 'deaths': values.push(...Array.from(deaths || [])); break
    case 'recovered': values.push(...Array.from(recovered || [])); break
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
    case 'recovered-percentage':
      for (let i = 0; i < (data.get(country)?.confirmed?.length || 0); i++) {
        const recovered = <singleData>{ ...data.get(country)?.recovered[i] } // cloning
        if (recovered) {
          recovered.Cases /= data.get(country)?.confirmed[i]?.Cases || 0
          recovered.Cases *= 100
          values.push(recovered)
        }
      }
      break
  }

  values = JSON.parse(JSON.stringify(values)) // cloning

  if (type == 'growth') {
    let last = NaN 
    values?.forEach((v, idx) => {
      const temp = v.Cases
      v.Cases = (idx == 0 ? 0 : (v.Cases - last) / last * 100)
      last = temp
    })  
  }

  if (type == 'daily') {
    let last = NaN 
    values?.forEach((v, idx) => {
      const temp = v.Cases
      v.Cases = (idx == 0 ? 0 : v.Cases - last)
      last = temp
    })  
  }

  const result: Map<string, number> = new Map

  dates.forEach(date => result.set(date, 0))

  if (alignStart > 0 && aligntype == 'confirmed' && confirmed && values) {
    for (let i = 0; i < confirmed.length && i < values.length; i++)
      if (confirmed[i].Cases > alignStart) result.set(confirmed[i].Date.substring(0, 10), values[i].Cases)
  } else if (alignStart > 0 && aligntype == 'deaths' && deaths && values) {
    for (let i = 0; i < deaths.length && i < values.length; i++)
      if (deaths[i].Cases > alignStart) result.set(deaths[i].Date.substring(0, 10), values[i].Cases)
  } else values?.forEach(d => result.set(d.Date.substring(0, 10), d.Cases))

  return Array.from(result.values())
}

/**
 * Extracts an array of dates from JSON data for a single country
 * @param country The country to extract dates from
 */
const extractDates = (country: string) => {
  const values = data.get(country)?.confirmed

  return values?.map(value => value.Date.substring(0, 10)) || []
}

/**
 * Extracts date labels for the selected countries
 */
const extractLabels = () => {
  const dates: Set<string> = new Set
  selectedCountries.forEach((country) => extractDates(country).forEach(dates.add, dates))
  return Array.from(dates).sort()
}

/**
 * Align chart labels
 * @param datasets 
 */
const alignLabels = (datasets: Chart.ChartDataSets[]) => {
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
  const alignType = (<HTMLInputElement>document.querySelector('#aligntype')).value

  const palette = getPalette(selectedCountries.size)

  let min = Number.MAX_VALUE
  let max = Number.MIN_VALUE

  if (chart != undefined && chart.data.datasets != undefined) {
    chart.data.labels = extractLabels()

    chart.data.datasets.length = 0
    chart.options.title = { display: true, text: makeTitle(type, datatype, alignStart, alignType, smooth) }

    selectedCountries.forEach((country) => {
      if (chart != undefined && chart.data.datasets != undefined) {
        const values = movingAverage(extractValues(country, datatype, <string[]>chart.data.labels, alignStart, alignType, type), smooth)

        if (alignStart > 0 && alignType != '') while (values.length > 0 && (values[0] == 0 || isNaN(values[0]))) values.shift()

        min = Math.min(min, ...values.filter(v => v != 0 && v != Infinity && !isNaN(v)))
        max = Math.max(max, ...values.filter(v => v != 0 && v != Infinity && !isNaN(v)))

        const color = palette[chart.data.datasets.length].hex()
        chart.data.datasets.push({ label: countries.get(country)?.Country, data: values, fill: false, backgroundColor: color, borderColor: color, borderWidth: 1.5 })
      }
    })

    if (alignStart > 0 && alignType != '') chart.data.labels = alignLabels(chart.data.datasets)

    if (scale == 'logarithmic') logarithmicChart(chart)
    else if (alignStart > 0 && alignType != '') chart.options.scales = undefined
    else linearChart(chart)

    if (chart.options.annotation) {
      chart.options.annotation.annotations = [1]
      if (type == 'growth' && ['confirmed', 'recovered', 'deaths'].includes(datatype))
      [1, 2, 3, 5, 10].forEach(d => {
        if ((Math.pow(2, (1 / d)) - 1) * 100 > min && (Math.pow(2, (1 / d)) - 1) * 100 < max)
          chart.options.annotation?.annotations.push(
            {
              value: (Math.pow(2, (1 / d)) - 1) * 100,
              type: 'line',
              mode: 'horizontal',
              scaleID: 'y-axis-0',
              borderColor: 'white',
              borderWidth: 1,
              label: {
                backgroundColor: '#26465399',
                position: 'left',
                enabled: true,
                content: `2x/${d}d`
              }
            }
          )
      })
    }

    chart.update()
  }
}

/**
 * Load data from covid19api.com for a single country
 * @param country The country to load
 */
const loadCountry = async (country: string) => {
  const confirmed: Promise<singleData[]> = fetch(`https://api.covid19api.com/total/country/${country}/status/confirmed`)
    .then(response => response.json())

  const deaths: Promise<singleData[]> = fetch(`https://api.covid19api.com/total/country/${country}/status/deaths`)
    .then(response => response.json())

  const recovered: Promise<singleData[]> = fetch(`https://api.covid19api.com/total/country/${country}/status/recovered`)
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
      .then(response => data.set(country, { confirmed: response[0], deaths: response[1], recovered: response[2] }))
      .then(updateChart)
  else updateChart()
}

/**
 * Compares two countries based on being selected or number of cases.
 */
const compareCountries = (c1: country, c2: country) => {
  if (selectedCountries.has(c1.Slug) && !selectedCountries.has(c2.Slug)) return -1
  if (selectedCountries.has(c2.Slug) && !selectedCountries.has(c1.Slug)) return 1

  return c2.TotalConfirmed - c1.TotalConfirmed
}

/**
 * Updates and sorts list of countries in country selector.
 */
const updateCountries = () => {
  const existing = Array.from(countries.values()).sort((c1, c2) => compareCountries(c1, c2))
  const select = <HTMLSelectElement>document.querySelector('#country')

  if (select)
    select.innerHTML = '<option value="" disabled selected hidden>Countries...</option>'

  existing.forEach(country => {
    const option = <HTMLOptionElement>document.createElement('OPTION')
    option.innerText = country.Country.concat(selectedCountries.has(country.Slug) ? ' *' : '')
    option.value = country.Slug
    select?.appendChild(option)
  })
}

/**
 * Loads the list of countries from https://api.covid19api.com/summary
 */
const loadCountries = async () => {
  document.querySelector('#loader')?.setAttribute('display', 'inline')
  fetch(`https://api.covid19api.com/summary`)
    .then(response => response.json())
    .then(response => response.Countries.filter((country: country) => country.Slug != ''))
    .then(response => response.forEach((country: country) => countries.set(country.Slug, country)))
    .then(updateCountries)
}

type country = { Country: string, Slug: string, NewConfirmed: number, TotalConfirmed: number, NewDeaths: number, TotalDeaths: number, NewRecovered: number, TotalRecovered: number }
type singleData = { Country: string, Province: string, Lat: number, Lon: number, Date: string, Cases: number, Status: string }
type countryData = { confirmed: singleData[], deaths: singleData[], recovered: singleData[] }

const countries: Map<string, country> = new Map
const data: Map<string, countryData> = new Map

const selectedCountries: Set<string> = new Set

document.querySelector('#country')?.addEventListener('change', toggleCountry)
document.querySelector('#type')?.addEventListener('change', updateChart)
document.querySelector('#scale')?.addEventListener('change', updateChart)
document.querySelector('#data-type')?.addEventListener('change', updateChart)

document.querySelector('#alignstart')?.addEventListener('input', updateChart)
document.querySelector('#aligntype')?.addEventListener('input', updateChart)

document.querySelector('#smooth')?.addEventListener('input', updateChart)

document.querySelector('#scale')?.addEventListener('change', updateChart)

const chart = createChart()
loadCountries()
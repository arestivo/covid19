import 'purecss/build/pure-min.css'
import 'purecss/build/grids-responsive-min.css'

import './styles.css'

import * as Chart from 'chart.js'

import { parse } from 'papaparse'

const distinctColors = require ('distinct-colors')

interface value { daily : number ; cumulative : number }

const countries : Set<String> = new Set()

countries.add('Portugal')

const create_chart = (type : string) => {
  Chart.defaults.global.defaultFontColor = '#EEE'
  Chart.defaults.scale.gridLines.color = "#666"

  const ctx = document.getElementById('chart')

  if (ctx instanceof HTMLCanvasElement) {
    return new Chart(ctx, {
      type,
      data: {
        labels: [],
        datasets: [],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        tooltips: { mode: 'index' }
      }
    })
  }
  return undefined
}

let chart = create_chart('line')
let labels : string[] = []
let data : { 
  confirmed : Map<string, value[]>, 
  recovered : Map<string, value[]>, 
  deaths : Map<string, value[]> 
} = { confirmed : new Map, recovered : new Map, deaths : new Map }

const ajax = async (type: String) => {
  return fetch(`https://raw.githubusercontent.com/CSSEGISandData/COVID-19/master/csse_covid_19_data/csse_covid_19_time_series/time_series_19-covid-${type}.csv`)
    .then(response => response.text())
    .then(csv => parse(csv).data)
}

const extract_labels = (json : any[]) => json[0].splice(4)

const join_data = (original : value[] | undefined, values : value[]) : value[] => {
  if (original == undefined) return values
  return original.map(function (o, i) { 
    return { daily: o.daily + (isNaN(values[i].daily) ? 0 : values[i].daily), cumulative: o.cumulative + (isNaN(values[i].cumulative) ? 0 : values[i].cumulative)}
  })
}

const fix_country = (country : string) => {
  if (country == 'Mainland China') return 'China'
  if (country == 'Korea, South') return 'South Korea'
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

  data.set('World', world)
  data.set('World minus China', worldminuschina)

  return data
}

const capitalize = (s : string) => {
  if (typeof s !== 'string') return ''
  return s.charAt(0).toUpperCase() + s.slice(1)
}

const load_data = async (type : 'confirmed' | 'recovered' | 'deaths') => {
  return ajax(capitalize(type)).then(json => {
    labels = extract_labels(json)
    json.shift()
    data[type] = extract_data(json)
  })
}

const make_title = (type: string, datatype: string, alignstart: string) => {
  if (parseInt(alignstart) > 0)
    return `${capitalize(datatype)} (${type}) aligned to first ${alignstart}`
  else
    return `${capitalize(datatype)} (${type})`
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

const get_values = (datatype : string, country : string, f : any) => {
  let values : number[] | undefined = []

  const confirmed = data.confirmed.get(country)
  const recovered = data.recovered.get(country)
  const deaths = data.deaths.get(country)

  if (datatype == 'confirmed') values = data.confirmed.get(country)?.map(f)
  if (datatype == 'recovered') values = data.recovered.get(country)?.map(f)
  if (datatype == 'deaths') values = data.deaths.get(country)?.map(f)
  if (datatype == 'cfr') {
    const cfr = confirmed?.map((c, idx) => {
      return {cumulative : deaths ? deaths[idx].cumulative / c.cumulative * 100 : 0, daily : deaths ? deaths[idx].daily / c.daily * 100 : 0}
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
}

const align_chart = () => {
  const labels = []

  if (chart?.data?.datasets) {
    let largest = 0

    for (let dataset of chart.data.datasets)
      if (dataset.data && dataset.data.length > largest)
        largest = dataset.data.length
  
    for (let i = 0; i < largest; i++)
        labels.push(`${i}`)
  
    chart.data.labels = labels
  }
}

const logarithmic_chart = () => {
  if (chart) {
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
}

const average = (array : number[]) => array.reduce((sum, value) => sum + value, 0) / array.length

const moving_average = (values : number[], count : number) => {
  if (count < 2) return values

  const averaged : number[] = []
  const window : number[] = []

  values.forEach((value) => {
    window.push(value)
    if (window.length > count) window.shift()
    averaged.push(average(window))
  })

  return averaged
}

const update_chart = () => {
  const type = (<HTMLSelectElement>document.querySelector('#type')).value
  const scale = (<HTMLSelectElement>document.querySelector('#scale')).value
  const datatype = (<HTMLSelectElement>document.querySelector('#data-type')).value

  const smooth = (<HTMLInputElement>document.querySelector('#smooth')).value

  const alignstart = (<HTMLInputElement>document.querySelector('#alignstart')).value
  const align = parseInt(alignstart) > 0

  const f = type_function(type)

  const palette = get_palette(countries.size)

  if (chart != undefined && chart.data.datasets != undefined) {

    chart.data.labels = labels
    chart.data.datasets.length = 0
    chart.options.title = {display: true, text: make_title(type, datatype, alignstart)}

    countries.forEach((country) => {
      if (chart != undefined && chart.data.datasets != undefined) {
        const values = moving_average(get_values(datatype, country.toString(), f), parseInt(smooth))

        if (align) while (values && values?.length > 0 && values[1] < parseInt(alignstart))
          values.shift()

        const color = palette[chart.data.datasets.length].hex()
        chart.data.datasets.push({ label: country.toString(), data: values, fill: false, backgroundColor: color, borderColor: color, borderWidth: 1.5})
      }
    })

    if (align) align_chart()

    if (scale == 'logarithmic') logarithmic_chart()      
    else chart.options.scales = undefined

    chart.update()
  }
}

const compare_countries = (c1 : string, c2 : string) => {
  const v1 = data.confirmed.get(c1)
  const v2 = data.confirmed.get(c2)

  if (v1 && v2 && countries.has(c1) && !countries.has(c2)) return -1
  if (v1 && v2 && countries.has(c2) && !countries.has(c1)) return 1
  
  if (v1 && v2) return v2[v2.length - 1].cumulative - v1[v1.length - 1].cumulative

  return 0
}

const update_countries = () => {
  const existing = Array.from(data.confirmed.keys()).sort((c1, c2) => compare_countries(c1, c2))
  const select = document.querySelector('#country')
  if (select) select.innerHTML = '<option value="" disabled selected hidden>Countries...</option>'
  existing.forEach(country => {
    const option = <HTMLOptionElement>document.createElement('OPTION')
    option.innerText = country.concat(countries.has(country) ? ' *' : '')
    option.value = country
    select?.appendChild(option)
  })
} 

const promises = [load_data('confirmed'), load_data('recovered'), load_data('deaths')]
Promise.all(promises).then(() => {
  update_countries()
  update_chart()
})

const toggle_country = () => {
  const selector = <HTMLSelectElement>document.querySelector('#country')
  const country = selector.value

  if (selector.selectedIndex == 0) return

  if (countries.has(country)) 
    countries.delete(country)
  else
    countries.add(country)

  selector.selectedIndex = 0

  update_countries()
  update_chart()
}

document.querySelector('#country')?.addEventListener('change', toggle_country)
document.querySelector('#type')?.addEventListener('change', update_chart)
document.querySelector('#scale')?.addEventListener('change', update_chart)
document.querySelector('#data-type')?.addEventListener('change', update_chart)

document.querySelector('#alignstart')?.addEventListener('input', update_chart)
document.querySelector('#smooth')?.addEventListener('input', update_chart)

document.querySelector('#scale')?.addEventListener('change', update_chart)
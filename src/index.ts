import 'purecss/build/pure-min.css'
import 'purecss/build/grids-responsive-min.css'

import './styles.css'

import * as Chart from 'chart.js'

import { parse } from 'papaparse'

const distinctColors = require ('distinct-colors')

interface value { daily : number ; cumulative : number }

const countries : Set<String> = new Set()

countries.add('Portugal')
countries.add('Italy')
countries.add('Spain')

const create_chart = (type : string) => {
  const ctx = document.getElementById('chart')

  if (ctx instanceof HTMLCanvasElement) {
    return new Chart(ctx, {
      type,
      data: {
        labels: [],
        datasets: []
      },
      options: {
        responsive: true,
        maintainAspectRatio: false
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
  return fetch(`data/${type}.csv`)
    .then(response => response.text())
    .then(csv => parse(csv).data)
}

const extract_labels = (json : any[]) => json[0].splice(4)

const join_data = (original : value[] | undefined, values : value[]) : value[] => {
  if (original == undefined) return values
  return original.map(function (o, i) { 
    return { daily: o.daily + values[i].daily, cumulative: o.cumulative + values[i].cumulative}
  })
}

const extract_data = (json : any[]) => {
  const data : Map<string, value[]> = new Map
  json.forEach(line => {
    const state = line[0]
    const country = line[1] == 'Mainland China' ? 'China' : line[1]

    const values = line.splice(4).map((v : string) => parseInt(v)).map(function (v : number, i : number, a : []) : value {
      return {daily : a[i] - (i > 0 ? a[i - 1] : 0), cumulative : a[i]}
    })
    if (state != '') data.set(country, join_data(data.get(country), values))
    else data.set(country, values)
  })
  return data
}

const load_data = async (type : 'confirmed' | 'recovered' | 'deaths') => {
  return ajax(type).then(json => {
    labels = extract_labels(json)
    json.shift()
    data[type] = extract_data(json)
  })
}

const update_chart = () => {
  const type = (<HTMLSelectElement>document.querySelector('#type')).value
  const scale = (<HTMLSelectElement>document.querySelector('#scale')).value
  const datatype = (<HTMLSelectElement>document.querySelector('#data-type')).value

  const align = (<HTMLInputElement>document.querySelector('#align')).checked

  let f = (v : value, i : number, a : value[]) : number => v.daily
  if (type == 'daily') f = (v, i, a) => v.daily
  if (type == 'cumulative') f = (v, i, a) => v.cumulative
  if (type == 'growth') f = (v, i, a) => (i > 0 && a[i - 1].cumulative != 0 ? a[i].daily / a[i - 1].cumulative * 100 : 0)
  if (type == 'difference') f = (v, i, a) => a[i].daily - (i > 0 ? a[i - 1].daily : 0)

  const palette = distinctColors.default({count: countries.size, chromaMin: 50, lightMin: 20, lightMax: 80})

  if (chart != undefined && chart.data.datasets != undefined) {
    chart.data.labels = labels
    chart.data.datasets.length = 0

    countries.forEach((country) => {
      if (chart != undefined && chart.data.datasets != undefined) {
        let values : number[] | undefined = []

        if (datatype == 'confirmed') values = data.confirmed.get(country.toString())?.map(f)
        if (datatype == 'recovered') values = data.recovered.get(country.toString())?.map(f)
        if (datatype == 'deaths') values = data.deaths.get(country.toString())?.map(f)

        if (align) while (values && values?.length > 0 && values[1] == 0)
          values.shift()

        const color = palette[chart.data.datasets.length].hex()
        chart.data.datasets.push({ label: country.toString(), data: values, fill: false, backgroundColor: color, borderColor: color, borderWidth: 1.5})
      }
    })

    if (align) {
      const labels = []
      let largest = 0
      for (let dataset of chart.data.datasets)
        if (dataset.data && dataset.data.length > largest)
          largest = dataset.data.length

      for (let i = 0; i < largest; i++)
        labels.push(`${i}`)

      chart.data.labels = labels
    }

    chart.options.title = {display: true, text: `${Array.from(countries).join(', ')}`}

    if (scale == 'logarithmic')
      chart.options.scales = {
        yAxes: [{
          type: 'logarithmic',          
          ticks: {
              autoSkip: false,
              callback: function (value, index, values) {
                return Number.isInteger(Math.log10(value)) || index == 0 ? value : ''
              }
          }
        }]
      }
    else chart.options.scales = undefined

    chart.update()
  }
}

const update_countries = () => {
  const countries = Array.from(data.confirmed.keys()).sort()
  const select = document.querySelector('#country')
  countries.forEach(country => {
    const option = document.createElement('OPTION')
    option.innerText = country
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

  if (country == 'Add country...') return

  if (countries.has(country)) 
    countries.delete(country)
  else
    countries.add(country)

  selector.selectedIndex = 0

  update_chart()
}

document.querySelector('#country')?.addEventListener('change', toggle_country)
document.querySelector('#type')?.addEventListener('change', update_chart)
document.querySelector('#scale')?.addEventListener('change', update_chart)
document.querySelector('#data-type')?.addEventListener('change', update_chart)

document.querySelector('#align')?.addEventListener('change', update_chart)

document.querySelector('#scale')?.addEventListener('change', update_chart)
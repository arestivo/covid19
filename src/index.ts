import 'purecss/build/pure-min.css'
import 'purecss/build/grids-responsive-min.css'

import './styles.css'

import * as Chart from 'chart.js'

import { parse } from 'papaparse'

interface value { daily : number ; cumulative : number }

const create_chart = () => {
  const ctx = document.getElementById('chart')

  if (ctx instanceof HTMLCanvasElement) {
    return new Chart(ctx, {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          { label: 'Confirmed',data: [], fill: false, backgroundColor: 'white', borderColor: 'blue', borderWidth: 1.5},
          { label: 'Recovered',data: [], fill: false, backgroundColor: 'white', borderColor: 'green', borderWidth: 1.5},
          { label: 'Deaths',data: [], fill: false, backgroundColor: 'white', borderColor: 'red', borderWidth: 1.5}
        ]
      },
      options: {
        responsive: true
      }

    })
  }
  return undefined
}

const chart = create_chart()

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
  const country = (<HTMLSelectElement>document.querySelector('#country')).value
  const type = (<HTMLSelectElement>document.querySelector('#type')).value
  const scale = (<HTMLSelectElement>document.querySelector('#scale')).value

  const confirmed = (<HTMLInputElement>document.querySelector('#confirmed')).checked
  const recovered = (<HTMLInputElement>document.querySelector('#recovered')).checked
  const deaths = (<HTMLInputElement>document.querySelector('#deaths')).checked

  let f = (v : value, i : number, a : value[]) : number => v.daily
  if (type == 'daily') f = (v, i, a) => v.daily
  if (type == 'cumulative') f = (v, i, a) => v.cumulative
  if (type == 'growth') f = (v, i, a) => (i > 0 && a[i - 1].cumulative != 0 ? a[i].daily / a[i - 1].cumulative : 0)
  if (type == 'difference') f = (v, i, a) => a[i].daily - (i > 0 ? a[i - 1].daily : 0)

  if (chart != undefined && chart.data.datasets != undefined) {
    chart.data.labels = labels

    chart.data.datasets[0].data = data.confirmed.get(country)?.map(f)
    chart.data.datasets[1].data = data.recovered.get(country)?.map(f)
    chart.data.datasets[2].data = data.deaths.get(country)?.map(f)

    chart.data.datasets[0].hidden = !confirmed
    chart.data.datasets[1].hidden = !recovered
    chart.data.datasets[2].hidden = !deaths

    chart.options.title = {display: true, text: `${country} (${type})`}

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

document.querySelector('#country')?.addEventListener('change', update_chart)
document.querySelector('#type')?.addEventListener('change', update_chart)
document.querySelector('#scale')?.addEventListener('change', update_chart)

document.querySelector('#confirmed')?.addEventListener('change', update_chart)
document.querySelector('#recovered')?.addEventListener('change', update_chart)
document.querySelector('#deaths')?.addEventListener('change', update_chart)

document.querySelector('#scale')?.addEventListener('change', update_chart)
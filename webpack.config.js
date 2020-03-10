const path = require('path')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const CopyPlugin = require('copy-webpack-plugin')

module.exports = {
  entry: './src/index.ts',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.js'
  },
  module: {
    rules: [
      {
        test: /\.ts(x)?$/,
        use: [
          'awesome-typescript-loader'
        ],
        exclude: /node_modules/
      },
      {
        test: /\.css$/,
        use: [
          'style-loader',
          'css-loader'
        ]
      },
      {
        test: /\.png$/,
        use: [
          {
            loader: 'url-loader',
            options: {
              mimetype: 'image/png'
            }
          }
        ]
      }
    ]
  },
  resolve: {
    extensions: [
      '.tsx',
      '.ts',
      '.js'
    ]
  },
  plugins: [
    new HtmlWebpackPlugin({  // Also generate a test.html
      filename: 'index.html',
      template: 'src/index.html',
    }),
    new CopyPlugin([
      { from: 'data/csse_covid_19_data/csse_covid_19_time_series/time_series_19-covid-Confirmed.csv', to: 'data/confirmed.csv' },
      { from: 'data/csse_covid_19_data/csse_covid_19_time_series/time_series_19-covid-Deaths.csv', to: 'data/deaths.csv' },
      { from: 'data/csse_covid_19_data/csse_covid_19_time_series/time_series_19-covid-Recovered.csv', to: 'data/recovered.csv' },
    ]),
  ],
}
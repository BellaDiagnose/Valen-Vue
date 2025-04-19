const path = require('path');
const { VueLoaderPlugin } = require('vue-loader');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
  entry: './source/valen.js',
  output: {
    path: path.resolve(__dirname, 'build'),
    filename: '[name].[contenthash].js',
    clean: true
  },
  module: {
    rules: [
      {
        test: /\.vue$/,
        loader: 'vue-loader'
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      },
      {
        test: /\.obj$/i,
        type: 'asset/inline', // changed from asset/resource to asset/inline
      },
      {
        test: /\.(png|jpe?g|gif|svg|webp|ico)$/i,
        type: 'asset',
        generator: {
          filename: 'assets/images/[hash][ext][query]'
        }
      }
    ]
  },
  resolve: {
    extensions: ['.js', '.vue'],
    alias: {
      '@': path.resolve(__dirname, 'source')
    }
  },
  plugins: [
    new VueLoaderPlugin(),
    new HtmlWebpackPlugin({
      template: './source/valen.html'
    }),
    new CopyWebpackPlugin({
      patterns: [
        { 
          from: path.resolve(__dirname, './source/assets'), 
          to: 'assets',
          globOptions: {
            ignore: [
              '**/.DS_Store',
              '**/.Spotlight-V100',
              '**/.Trashes',
              '**/._*',
              '**/*.tmp',
              '**/Thumbs.db',
              '**/.git/**'
            ]
          }
        }
      ]
    })
  ]
};

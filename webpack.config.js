// webpack.config.js

const path = require('path');
const webpack = require('webpack');

module.exports = {
  entry: {
    main: './public/js/main.js',
    'video-room': './public/js/video-room.js',
  },
  output: {
    filename: '[name].bundle.js',
    path: path.resolve(__dirname, 'public/dist'),
    publicPath: '/dist/',
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env'],
          },
        },
      },
    ],
  },
  resolve: {
    fallback: {
      "process": require.resolve("process/browser"),
      "util": require.resolve("util/")
    }
  },
  plugins: [
    new webpack.DefinePlugin({
      'process.env': JSON.stringify(process.env)
    }),
  ],
};
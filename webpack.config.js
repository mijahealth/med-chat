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
        test: /\.js$/, // Apply this rule to all .js files
        exclude: /node_modules/, // Exclude node_modules from transpilation
        use: {
          loader: 'babel-loader', // Use Babel to transpile JavaScript files
          options: {
            presets: ['@babel/preset-env'], // Preset for compiling ES6+ down to ES5
          },
        },
      },
      // You can add more rules here if needed (e.g., for CSS, images)
    ],
  },
  resolve: {
    fallback: {
      process: require.resolve('process/browser'), // Polyfill for 'process' module
      util: require.resolve('util/'), // Polyfill for 'util' module
      // Add other polyfills if necessary
    },
  },
  plugins: [
    new webpack.DefinePlugin({
      'process.env': JSON.stringify(process.env), // Define environment variables
    }),
    new webpack.ProvidePlugin({
      axios: 'axios', // Automatically load axios when it's used
    }),
  ],
  devtool: 'source-map', // Enable source maps for easier debugging
};
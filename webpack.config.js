// webpack.config.js

const path = require('path');
const webpack = require('webpack');

// Dynamically set mode based on NODE_ENV, defaulting to 'development'
const mode = process.env.NODE_ENV || 'development';

// Define environment variables to inject into the frontend (exclude 'process.env.NODE_ENV')
const envVariables = {
  'process.env.TWILIO_PHONE_NUMBER': JSON.stringify(process.env.TWILIO_PHONE_NUMBER),
  'process.env.NGROK_URL': JSON.stringify(process.env.NGROK_URL),
  'process.env.TWILIO_ACCOUNT_SID': JSON.stringify(process.env.TWILIO_ACCOUNT_SID),
  'process.env.TWILIO_API_KEY': JSON.stringify(process.env.TWILIO_API_KEY),
  'process.env.TWILIO_API_SECRET': JSON.stringify(process.env.TWILIO_API_SECRET),
  'process.env.TWILIO_TWIML_APP_SID': JSON.stringify(process.env.TWILIO_TWIML_APP_SID),
  // Add other environment variables as needed
};

module.exports = {
  mode, // Use the dynamically set mode
  entry: {
    main: ['webpack-hot-middleware/client?reload=true', './public/js/main.js'],
    'video-room': ['webpack-hot-middleware/client?reload=true', './public/js/video-room.js'],
  },
  output: {
    filename: '[name].bundle.js',
    path: path.resolve(__dirname, 'public/dist'),
    publicPath: '/dist/',
    globalObject: 'this', // Ensure globalObject is correctly set
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
      process: require.resolve('process/browser'),
      util: require.resolve('util/'),
    },
    alias: {
      'process/browser': path.resolve(__dirname, 'node_modules/process/browser.js'), // Add this line
    },
  },
  plugins: [
    new webpack.DefinePlugin(envVariables), // Inject specific env variables
    new webpack.ProvidePlugin({
      axios: 'axios',
      process: 'process/browser', // Provide 'process' globally
    }),
    new webpack.HotModuleReplacementPlugin(),
  ],
  devtool: 'eval-source-map',
};
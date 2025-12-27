const path = require('path');

module.exports = {
  resolve: {
    alias: {
      'react-native$': 'react-native-web',
    },
  },
  module: {
    rules: [
      {
        test: /\.(png|jpe?g|gif|svg)$/,
        use: [
          {
            loader: 'file-loader',
            options: {
              publicPath: '/',
              outputPath: 'assets/',
            },
          },
        ],
      },
    ],
  },
};
const { join } = require('path');
const { merge } = require('webpack-merge');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = (config, context) => {
  return merge(config, {
    devtool: 'eval-cheap-module-source-map',
    optimization: {
      nodeEnv: process.env.NODE_ENV || 'development',
    },
    plugins: [
      new CopyPlugin({
        patterns: [
          {
            from: 'apps/db-cli/src/assets/package.json',
            to: join(config.output.path, 'package.json'),
          },
        ],
      }),
    ],
  });
};

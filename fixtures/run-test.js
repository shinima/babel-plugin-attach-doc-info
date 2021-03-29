const babel = require('@babel/core');
const types = require('@babel/types');
const fs = require('fs');
const path = require('path');
const prettier = require('prettier');

const prettierConfig = { ...prettier.resolveConfig.sync(__filename), parser: 'babel' };

const filename = path.resolve(__dirname, 'test-input.js');

const result = babel.transformFileSync(filename, {
  configFile: false,
  plugins: [
    '@babel/plugin-syntax-jsx',
    [
      require('../src/index'),
      {
        preserveTypeAnnotations: false,
      },
    ],
  ],
});

console.log(prettier.format(result.code, prettierConfig));
// console.log(result.code);

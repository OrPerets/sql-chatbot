'use strict';

/**
 * Server-only alasql: loads the in-memory build (alasql.js) by path so we avoid
 * the package default (alasql.fs.js) which pulls in react-native-fs and
 * react-native-fetch-blob and breaks Next.js.
 * Uses a static relative path so Next.js/webpack can resolve the module at build time.
 */
const alasql = require('../node_modules/alasql/dist/alasql.js');

module.exports = alasql;
module.exports.default = alasql;

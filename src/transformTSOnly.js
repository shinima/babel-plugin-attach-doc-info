const { HelperManager } = require('sucrase/dist/HelperManager');
const { default: identifyShadowedGlobals } = require('sucrase/dist/identifyShadowedGlobals');
const { default: NameManager } = require('sucrase/dist/NameManager');
const { parse } = require('sucrase/dist/parser');
const { default: TokenProcessor } = require('sucrase/dist/TokenProcessor');
const { default: RootTransformer } = require('sucrase/dist/transformers/RootTransformer');
const { default: getTSImportedNames } = require('sucrase/dist/util/getTSImportedNames');

// copied from https://github.com/alangpierce/sucrase/issues/559
module.exports = function transformTSOnly(code) {
  const { tokens, scopes } = parse(
    code,
    true /* isJSXEnabled */,
    true /* isTypeScriptEnabled */,
    false /* isFlowEnabled */,
  );
  const nameManager = new NameManager(code, tokens);
  const helperManager = new HelperManager(nameManager);
  const tokenProcessor = new TokenProcessor(code, tokens, false /* isFlowEnabled */, helperManager);

  identifyShadowedGlobals(tokenProcessor, scopes, getTSImportedNames(tokenProcessor));
  const sucraseContext = {
    tokenProcessor,
    scopes,
    nameManager,
    importProcessor: null,
    helperManager,
  };

  const transformer = new RootTransformer(sucraseContext, ['typescript'], false, {
    transforms: ['typescript'],
  });
  return transformer.transform();
};

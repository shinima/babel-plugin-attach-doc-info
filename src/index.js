const transformTSOnly = require('./transformTSOnly');
const t = require('@babel/types');

const COMPONENT_INNER_SOURCE = '__inner_source';
const DOC_INFO_FIELD = '__doc_info';
const DOC_INFO_PREFIX = DOC_INFO_FIELD + '_';

const isDocInfoIdentifierName = (name) => {
  return name.startsWith(DOC_INFO_PREFIX);
};

function nodeLocExpression(loc) {
  if (loc == null) {
    return t.objectExpression([
      t.objectProperty(t.identifier('start'), t.nullLiteral()),
      t.objectProperty(t.identifier('end'), t.nullLiteral()),
    ]);
  }

  return t.objectExpression([
    t.objectProperty(
      t.identifier('start'),
      t.objectExpression([
        t.objectProperty(t.identifier('line'), t.numericLiteral(loc.start.line)),
        t.objectProperty(t.identifier('column'), t.numericLiteral(loc.start.column)),
      ]),
    ),
    t.objectProperty(
      t.identifier('end'),
      t.objectExpression([
        t.objectProperty(t.identifier('line'), t.numericLiteral(loc.end.line)),
        t.objectProperty(t.identifier('column'), t.numericLiteral(loc.end.column)),
      ]),
    ),
  ]);
}

const getDocInfoIdentifierName = (name) => {
  return `${DOC_INFO_PREFIX}${name}`;
};

function getAppendDocInfoStatement(path, node) {
  let programScope;
  let componentName;
  if (t.isVariableDeclaration(node)) {
    programScope = path.scope;
    const firstDeclaration = node.declarations[0];
    if (!t.isVariableDeclarator(firstDeclaration)) {
      return;
    }

    componentName = firstDeclaration.id.name;
    if (isDocInfoIdentifierName(componentName)) {
      return;
    }
  } else if (t.isFunctionDeclaration(node)) {
    programScope = path.scope.parent;
    componentName = node.id.name;
  }

  if (!componentName) {
    return;
  }

  const deps = [];
  const provides = [];

  path.traverse({
    ['Identifier|JSXIdentifier'](idPath) {
      if (t.isJSXAttribute(idPath.parent, { name: idPath.node })) {
        return;
      }

      const depName = idPath.node.name;

      if (programScope.hasBinding(depName, true) && depName !== componentName) {
        const binding = programScope.bindings[depName];
        if (binding == null) {
          return;
        }
        if (binding.kind === 'module') {
          if (!provides.includes(depName)) {
            provides.push(depName);
          }
        } else {
          if (!deps.includes(depName)) {
            deps.push(depName);
          }
        }
      }
    },
  });

  let source = this.file.code.slice(node.start, node.end);

  if (!this.opts.preserveTypeAnnotations) {
    source = transformTSOnly(source);
  }

  return t.variableDeclaration('const', [
    t.variableDeclarator(
      t.identifier(getDocInfoIdentifierName(componentName)),
      t.objectExpression([
        t.objectProperty(t.identifier('filename'), t.stringLiteral(this.file.opts.filename)),
        t.objectProperty(t.identifier('loc'), nodeLocExpression(node.loc)),
        t.objectProperty(t.identifier('name'), t.stringLiteral(componentName)),
        t.objectProperty(t.identifier('value'), t.identifier(componentName)),
        t.objectProperty(t.identifier('source'), t.stringLiteral(source)),
        t.objectProperty(
          t.identifier('deps'),
          t.arrayExpression(deps.map((depName) => t.identifier(getDocInfoIdentifierName(depName)))),
        ),
        t.objectProperty(
          t.identifier('provides'),
          t.objectExpression(
            provides.map((provideName) =>
              t.objectProperty(t.identifier(provideName), t.identifier(provideName)),
            ),
          ),
        ),
      ]),
    ),
  ]);
}

function attachDocInfoPlugin() {
  return {
    visitor: {
      ['VariableDeclaration|FunctionDeclaration']: {
        enter(path) {
          if (t.isVariableDeclaration(path.node) && !t.isProgram(path.scope.block)) {
            return;
          }
          if (t.isFunctionDeclaration(path.node) && !t.isProgram(path.scope.parent.block)) {
            return;
          }

          const appendDocInfoStatement = getAppendDocInfoStatement.call(this, path, path.node);
          if (appendDocInfoStatement) {
            path.insertAfter(appendDocInfoStatement);
          }
        },
      },

      ExportNamedDeclaration: {
        enter(path) {
          const { declaration } = path.node;
          let instruction = null;

          if (t.isVariableDeclaration(declaration)) {
            const [decNode] = declaration.declarations;
            if (
              t.isVariableDeclarator(decNode) &&
              t.isArrowFunctionExpression(decNode.init) &&
              t.isIdentifier(decNode.id)
            ) {
              // 匹配 export const Test = () => {...}
              const componentName = decNode.id.name;
              const { start, end } = decNode.init;
              const storyFuncSource = transformTSOnly(this.file.code.slice(start, end));
              instruction = { componentName, storyFuncSource };
            }
          } else if (t.isFunctionDeclaration(declaration)) {
            // 匹配 export function Test = ()
            const componentName = declaration.id.name;
            const { start, end } = declaration;
            const storyFuncSource = transformTSOnly(this.file.code.slice(start, end));
            instruction = { componentName, storyFuncSource };
          }

          if (instruction) {
            const { componentName, storyFuncSource } = instruction;
            // 插入在 docInfo 后边
            const insertPath = path.getNextSibling();

            insertPath.insertBefore(
              t.expressionStatement(
                t.assignmentExpression(
                  '=',
                  t.memberExpression(t.identifier(componentName), t.identifier(DOC_INFO_FIELD)),
                  t.identifier(getDocInfoIdentifierName(componentName)),
                ),
              ),
            );

            insertPath.insertBefore(
              t.expressionStatement(
                t.assignmentExpression(
                  '=',
                  t.memberExpression(
                    t.identifier(componentName),
                    t.identifier(COMPONENT_INNER_SOURCE),
                  ),
                  t.stringLiteral(storyFuncSource),
                ),
              ),
            );
          }
        },
      },
    },
  };
}

module.exports = attachDocInfoPlugin;

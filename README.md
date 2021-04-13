# babel-plugin-attach-doc-info

[![NPM Package](https://img.shields.io/npm/v/babel-plugin-attach-doc-info?style=flat-square)](https://www.npmjs.org/package/babel-plugin-attach-doc-info)

babel 插件，为 React 组件添加附加信息，方便在文档页中渲染组件源码。

## 使用

babel.config.json：

```json
{
  "plugins": [
    [
      "babel-plugin-attach-doc-info",
      {
        "preserveTypeAnnotations": false
      }
    ]
  ]
}
```

- preserveTypeAnnotations: 是否在 `__doc_info.source` 中保留 TypeScript 的类型注解代码。默认为 false。

## 示例

```jsx
import { Button } from 'antd';

const data = { foo: [1, 2, 3] };

export const Test = () => {
  return <Button>Numbers: {data.foo.join(',')}</Button>;
};
```

↓ ↓ ↓ ↓ ↓ ↓

```jsx
import { Button } from 'antd';

const data = { foo: [1, 2, 3] };
const __doc_info_data = {
  filename: '/path/to/input.js',
  loc: { start: { line: 3, column: 0 }, end: { line: 3, column: 32 } },
  name: 'data',
  value: data,
  source: 'const data = { foo: [1, 2, 3] };',
  deps: () => [],
  provides: {},
};

export const Test = () => {
  return <Button>Numbers: {data.foo.join(',')}</Button>;
};
const __doc_info_Test = {
  filename: '/path/to/input.js',
  loc: { start: { line: 5, column: 7 }, end: { line: 7, column: 2 } },
  name: 'Test',
  value: Test,
  source: "const Test = () => {\n  return <Button>Numbers: {data.foo.join(',')}</Button>;\n};",
  deps: () => [__doc_info_data],
  provides: { Button: Button },
};

Test.__inner_source = "() => {\n  return <Button>Numbers: {data.foo.join(',')}</Button>;\n}";
Test.__doc_info = __doc_info_Test;
```

## 附加信息说明

从上面的例子可以看出，针对每个模块内的顶层变量，该 babel 插件会追加一个 `__doc_info_{name}` 的变量用来描述其元信息。附加信息中包含以下字段:

- `filename` 文件名
- `loc` 变量在源码中的位置
- `name` 变量的名称
- `value` 变量本身
- `source` 变量的源码
- `deps` 变量所依赖的模块内部变量
- `provides` 变量所依赖的外部变量（通过 import 的方式从其他文件中引入）

### 函数

对于函数（使用 function 关键字定义的函数或箭头函数），该 babel 插件会将 `SomeFunc.__doc_info` 赋值为 `SomeFunc` 的附加信息对象，并将 `Test.__inner_source` 设置为 `SomeFunc` 的源码。

### 使用附加信息

对于 React 函数组件而言，以 `SomeFunc.__doc_info` 为入口，不断解析 deps 和 provides，可以获取到整个函数组件运行时所需要的所有变量（包括模块内和模块外），以及每个模块内变量的源码。按照变量的依赖关系对源码进行拼接，可以在「运行时」得到该函数组件所需要的完整源码。

### 获取其他模块下非函数变量的附加信息

注意只有函数类型的变量才会附加上 `__doc_info`，如果需要使用来自其他模块的变量附加信息，则只能引入其他模块导出的函数。

```jsx
// A.js
export const data = {
  foo: [1, 2, 3],
  hello: <h1>world</h1>,
};
export const getData = () => data;

// B.js
import { getData } from './A.js';

export function TestComp() {
  return <div>{getData().hello}</div>;
}
// 通过以下代码可以获取到 A.js 中 data 的附加信息：
//   TestComp.__doc_info.provides.getData.__doc_info.deps() = [ __doc_info_data ]
```

## 配合 [react-live](https://github.com/FormidableLabs/react-live)

WIP

效果如下：

![react-live-demo](https://raw.githubusercontent.com/shinima/babel-plugin-attach-doc-info/main/docs/react-live-demo.png)

## 配合 [MDX](https://mdxjs.com/)

WIP

## 目前的限制

限制 1：插件目前无法正确识别「用 var/let/const 一次声明多个变量」的用法，变量的附加信息可能会丢失。

```jsx
const hello = 1,
  Foo = () => 2,
  Bar = {};
```

限制 2：生成 `__doc_info.source` 时，插件会使用 [sucrase](https://github.com/alangpierce/sucrase) 来移除源代码中的 TS 类型注解。 `a?.b`, `a ?? b`, `class C { x = 1; }` 等用法会导致生成的 `__doc_info.source` 中出现 sucrase 生成的 helper 函数，大大降低 source 的可读性。尽量避免使用这些用法。

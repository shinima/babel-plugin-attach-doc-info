import { Button } from 'antd';

const data = { foo: [1, 2, 3] };

export const Test = () => {
  return <Button>Numbers: {data.foo.join(',')}</Button>;
};

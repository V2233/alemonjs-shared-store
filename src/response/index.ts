import { defineRouter, lazy } from 'alemonjs';

export const responseRouter = defineRouter([
  {
    prefix: '/store ',
    selects: ['message.create'],
    handler: lazy(() => import('./example/res')),
  },
]);

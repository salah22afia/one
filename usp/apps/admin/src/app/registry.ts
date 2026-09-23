import type { AppModule } from './module';
import { timeleave } from '../modules/timeleave';
import { needs } from '../modules/needs';
import { mydata } from '../modules/mydata';
import { letters } from '../modules/letters';
import { finance } from '../modules/finance';
// @gen:imports

/** All business modules of this app, in navigation order. Maintained by `pnpm gen:module`. */
export const modules: AppModule[] = [
  timeleave,
  needs,
  mydata,
  letters,
  finance,
  // @gen:modules
];

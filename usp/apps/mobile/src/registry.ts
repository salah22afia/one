import type { MobileModule } from './module';
import { timeleave } from './modules/timeleave';
import { needs } from './modules/needs';
import { mydata } from './modules/mydata';
import { letters } from './modules/letters';
import { finance } from './modules/finance';
// @gen:imports

/** All business modules, in navigation order. Maintained by `pnpm gen:module`. */
export const modules: MobileModule[] = [
  timeleave,
  needs,
  mydata,
  letters,
  finance,
  // @gen:modules
];

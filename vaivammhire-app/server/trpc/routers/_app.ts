import { router } from '../init';
import { applicationsRouter } from './applications';
import { candidatesRouter } from './candidates';
import { commsRouter } from './comms';
import { compBandsRouter } from './comp-bands';
import { interviewsRouter } from './interviews';
import { jobsRouter } from './jobs';
import { labelingRouter } from './labeling';
import { modelsRouter } from './models';
import { offersRouter } from './offers';

export const appRouter = router({
  jobs: jobsRouter,
  candidates: candidatesRouter,
  applications: applicationsRouter,
  interviews: interviewsRouter,
  offers: offersRouter,
  comms: commsRouter,
  models: modelsRouter,
  labeling: labelingRouter,
  compBands: compBandsRouter,
});

export type AppRouter = typeof appRouter;

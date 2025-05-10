import { register } from 'tsconfig-paths';

register({
  baseUrl: './dist',
  paths: {
    '@core/*': ['core/*'],
    '@shared/*': ['shared/*'],
    '@/*': ['*']
  }
});

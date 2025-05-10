/**
 * Конфигурация для поддержки алиасов при запуске приложения
 */
import { register } from 'tsconfig-paths';

// Регистрируем пути из tsconfig.json
register({
  baseUrl: './dist',
  paths: {
    '@core/*': ['core/*'],
    '@shared/*': ['shared/*'],
    '@mock/*': ['mock/*'],
    '@eth/*': ['eth/*'],
    '@tron/*': ['tron/*'],
    '@/*': ['*']
  }
});

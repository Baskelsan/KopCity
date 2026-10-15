import { defineConfig } from 'vitest/config';

// Simulation d'équilibrage, séparée de `npm test` car longue.
export default defineConfig({
  test: {
    include: ['tests/balance/**/*.sim.ts'],
    environment: 'node',
  },
});

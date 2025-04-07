import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Use the 'forks' pool and force a single fork
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    // Optional: You might want to set a longer timeout if serial execution is slow
    // testTimeout: 30000, // 30 seconds
  },
});
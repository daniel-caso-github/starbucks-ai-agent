import ky from 'ky';

export const apiClient = ky.create({
  prefixUrl: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

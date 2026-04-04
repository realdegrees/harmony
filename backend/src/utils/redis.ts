import RedisMock from 'ioredis-mock';

const redis = new RedisMock();

export function getRedis(): RedisMock {
  return redis;
}

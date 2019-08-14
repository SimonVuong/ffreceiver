import { merge } from 'lodash';

const env = process.env.NODE_ENV; // 'development' or 'production'

const secrets = {
  receiver: {
    rsaKey: 'REPLACE ME',
  },
};

const development = {
  receiver: {
    id: 'test',
  },
  registration: {
    host: '192.168.123.15',
    port: 8443,
  },
};

const production = {
  receiver: {
    id: 'AQn6Nq-xr3',
  },
  registration: {
    host: 'foodflick.herokuapp.com',
    port: 80,
  },
};

const config = {
  development: merge(development, secrets),
  production: merge(production, secrets),
};

export const activeConfig = config[env];

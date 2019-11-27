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
    host: 'http://192.168.0.12:8443',
  },
};

const production = {
  receiver: {
    id: 'AQn6Nq-xr3',
  },
  registration: {
    host: 'https://foodflick.co',
  },
};

const config = {
  development: merge(development, secrets),
  production: merge(production, secrets),
};

export const activeConfig = config[env];

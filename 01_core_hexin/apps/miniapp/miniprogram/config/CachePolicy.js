// Generated from 02_platform_pingtai/config/cache.yml. Do not edit.
module.exports = Object.freeze({
  "experience": {
    "key": "mall:version",
    "maximumSeconds": 86400,
    "staleSeconds": 30,
    "commandRevalidate": false
  },
  "catalog": {
    "key": "mall:listing:version",
    "maximumSeconds": 300,
    "staleSeconds": 30,
    "commandRevalidate": true
  },
  "category": {
    "key": "mall:categoryversion",
    "maximumSeconds": 3600,
    "staleSeconds": 60,
    "commandRevalidate": true
  },
  "access": {
    "key": "membership:authzversion:capabilityversion",
    "maximumSeconds": 60,
    "staleSeconds": 0,
    "commandRevalidate": true
  },
  "reporting": {
    "key": "scope:metric:period:projectionversion",
    "maximumSeconds": 300,
    "staleSeconds": 60,
    "commandRevalidate": false
  },
  "session": {
    "key": "session:version",
    "maximumSeconds": 60,
    "staleSeconds": 0,
    "commandRevalidate": true
  }
});

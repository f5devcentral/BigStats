# v0.1.1-release

## Features

No new features

## Fixes

**Legacy 'config' object model breaking 'http' destination**

## Known Issues
none

# v0.1.0-release

## Features

Supported destinations:

* HTTP
* HTTPS
* StatsD

## Known Issues

1. Legacy 'config' object model breaking 'http' destination

BigStats was looking for `http` in `config.adapter:`. Should be `config.destination.proto:`.

Correct object structure:

```json
{
    "config": {
        "destination": {
          "proto": "http",
          "address": "192.168.1.42",
          "port": "8080",
          "uri":"/stats"
        },
        "interval": "10",
        "debug": false
      }
}
```
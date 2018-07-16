# RELEASE NOTES

## v0.3.0-release

### Features

* Added Kafka Topic configuration: all stats in one topic, or per-app topics
* Added Stats sizing: small (VIPs), medium (VIPs + Pool Members)
* Added BigStats Schema: `SRC/bigstats-schema.json`

### Fixes

* Mega refactor to break down some big functions.

### Known Issues

* No 'large' stats size.

## v0.2.0-release

### Features

* Added Kafka Producer to support posting stats to an Apache Kafka Message Bus.
* Added minimum polling interval of 10 seconds, for safes...

### Fixes

None

### Known Issues

Kafka Producer implementation doesnt support message bus discovery. Should add Zookeeper support to facilitate this.

---

## v0.1.1-release

### Features

No new features

### Fixes

**Legacy 'config' object model breaking 'http' destination**

### Known Issues
none

---

## v0.1.0-release

### Features

Supported destinations:

* HTTP
* HTTPS
* StatsD

### Known Issues

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
# RELEASE NOTES

## v0.5.0-release

### Features

* Added Support for scrapers/pollers through `GET /mgmt/shared/bigstats_exporter`
* 

---

## v0.4.1-release

Bug fix release:

### Fixes

* removed 'example.com' from BigStatsSettings schema.
* changed CPU stats from raw 'clock ticks' to '5 second average' percentages, for readability.
* added suport for BIG-IP v14 object structure change

---

## v0.4.0-release

### Features

* Added supoprt for tradition configurations (prior to AS3). Previous version required the use of AS3 (F5 BIG-IP's declarative interface). Traditional, AS3 (declarative) and mixed configurations are now suported.
* Added `"enabled": true|false` setting.
* Added `device` stats for CPU and Memory utilization.
* Added some configuration validation to ensure it will run.

### Fixes

* StatsD TCP Port is no longer hard coded. Now using `config.destination.port`
* Undefined 'error' fixed and handled
* Attempt to parse settings to resolve an issue where customer was using `curl` without specifying `Content-Type: application/json`. Previously, valid JSON was being interpreted as a string without the `Content-Type` header.

### Known Issues

* No 'large' stats size.

---

## v0.3.0-release

### Features

* Added Kafka Topic configuration: all stats in one topic, or per-app topics
* Added Stats sizing: small (VIPs), medium (VIPs + Pool Members)
* Added BigStats Schema: `SRC/bigstats-schema.json`

### Fixes

* Mega refactor to break down some big functions.

### Known Issues

* No 'large' stats size.

---

## v0.2.0-release

### Features

* Added Kafka Producer to support posting stats to an Apache Kafka Message Bus.
* Added minimum polling interval of 10 seconds, for safes...

### Fixes

* None

### Known Issues

* None

---

## v0.1.1-release

### Features

* No new features

### Fixes

* **Legacy 'config' object model breaking 'http' destination**

### Known Issues

* None

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
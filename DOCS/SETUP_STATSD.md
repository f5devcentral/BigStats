# BigStats Setup - StatsD

## Example comnfigurations

**StatsD destination:**

NOTE: This functionality uses https://github.com/sivy/node-statsd 

`POST https://{{mgmt_ip_address}}/mgmt/shared/bigstats_settings`

```json
{
    "config": {
        "destination": {
          "protocol": "statsd",
          "address": "192.168.1.42",
          "port": 8125
        },
        "size": "small",
        "interval": 10,
        "enabled": true,
        "debug": false
      }
}
```

Example using curl:

```sh
curl -u <username>:<password> -X POST http://localhost:8100/mgmt/shared/bigstats_settings -d '{"config":{"destination":{"protocol": "statsd","address": "192.168.1.202","port": 8125},"size": "small","interval": 10, "enabled": true, "debug": false}}'
```

> NOTE: To build your own StatsD/GraphiteDB/Grafana lab environment, refer to `DOCS/LAB_SETUP.md`

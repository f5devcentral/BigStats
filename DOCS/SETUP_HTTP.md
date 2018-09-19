# BigStats Setup - HTTP(S)

## Example comnfigurations

**HTTP destination:**

`POST https://{{mgmt_ip_address}}/mgmt/shared/bigstats_settings`

```json
{
    "config": {
        "destination": {
          "protocol": "http",
          "address": "192.168.1.42",
          "port": "8080",
          "uri": "/stats"
        },
        "size": "small",
        "interval": "10",
        "enabled": true,
        "debug": false
      }
}
```
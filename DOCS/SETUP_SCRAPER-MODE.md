# BigStats Setup - NO DESTINATION (SCRAPER MODE)

This mode doesn't send the data anywhere. You have to fetch if with a HTTP GET to `/mgmt/shared/bigstats_exporter`

## Example comnfigurations

**destination:**

`POST https://{{mgmt_ip_address}}/mgmt/shared/bigstats_settings`

```json
{
    "config": {
        "destination": {
          "protocol": "none"
        },
        "size": "small",
        "interval": 10,
        "enabled": true,
        "debug": false
      }
}
```
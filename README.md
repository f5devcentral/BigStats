# n8-BigStats
Push BIG-IP stats to remote logging services.

1. Install the RPM in /DIST to your BIG-IP.
2. Configure the logging destination:

```
POST https://172.31.1.20/mgmt/shared/n8/bigstats_settings
{
    "config": {
        "destination": {
          "proto": "http",
          "address": "172.31.1.79",
          "port": "8080",
          "uri": "/stats"
        },
        "interval": "12",
        "debug": false
      }
}
```

* **proto:** [http|https]
* **address** ip address or resolvable domain name
* **port** destination tcp port
* **uri** [OPTINAL] End-point to post data to. Can be blank.
* **interval** - how often to send the stats. Default is 5 seconds.
* **debug** - this will put a LOT of data into the BIG-IPs `/var/log/restnoded/restnoded.log`. Remember to turn this off when done.

## Example http output:

```http

POST /stats HTTP/1.1
Content-Type: application/json
Cache-Control: no-cache
Host: 172.31.1.79:8080
Connection: keep-alive
Transfer-Encoding: chunked

{
    "App1a": {
        "vip": {
            "clientside_curConns": 0,
            "clientside_maxConns": 0,
            "clientside_bitsIn": 0,
            "clientside_bitsOut": 0,
            "clientside_pktsIn": 0,
            "clientside_pktsOut": 0
        },
        "pool": {
            "serverside_curConns": 0,
            "serverside_maxConns": 0,
            "serverside_bitsIn": 0,
            "serverside_bitsOut": 0,
            "serverside_pktsIn": 0,
            "serverside_pktsOut": 0
        }
    },
    "App1b": {
        "vip": {
            "clientside_curConns": 0,
            "clientside_maxConns": 0,
            "clientside_bitsIn": 0,
            "clientside_bitsOut": 0,
            "clientside_pktsIn": 0,
            "clientside_pktsOut": 0
        },
        "pool": {
            "serverside_curConns": 0,
            "serverside_maxConns": 0,
            "serverside_bitsIn": 0,
            "serverside_bitsOut": 0,
            "serverside_pktsIn": 0,
            "serverside_pktsOut": 0
        }
    },
    "App2": {
        "vip": {
            "clientside_curConns": 0,
            "clientside_maxConns": 0,
            "clientside_bitsIn": 0,
            "clientside_bitsOut": 0,
            "clientside_pktsIn": 0,
            "clientside_pktsOut": 0
        },
        "pool": {
            "serverside_curConns": 0,
            "serverside_maxConns": 0,
            "serverside_bitsIn": 0,
            "serverside_bitsOut": 0,
            "serverside_pktsIn": 0,
            "serverside_pktsOut": 0
        }
    }
}
```
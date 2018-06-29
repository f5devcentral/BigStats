# n8-BigStats

Push BIG-IP stats to remote logging services. Supports http, https, statsd, and Apache Kafka destinations.

1. Install the RPM in /DIST to your BIG-IP.
2. Configure the destination

## Install

To implement this solution you must install with the AS3 worker and the BigStats worker. This document will cover BigStats only. Details on AS3 can be found here: http://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/3/

1. Download the latest BigStats RPM from the here: https://github.com/npearce/n8-BigStats It's name will be something like (numbers may differ): `n8-BigStats-0.1.0-0002.noarch.rpm`
2. Copy the BigStats RPM into the following directory on your BIG-IP: `/var/config/rest/downloads/`
3. Execute the following command on your BIG-IP (shell prompt, not tmsh) to install:

```sh
curl -u <username>:<password> -X POST http://localhost:8100/mgmt/shared/iapp/package-management-tasks -d '{ "operation":"INSTALL","packageFilePath": "/var/config/rest/downloads/n8-BigStats-0.1.0-0002.noarch.rpm"}'
```

NOTE: Use your admin username/password and check the name of the RPM carefaully as release numbers may differ from the example above.

The response will look something like this:

```json
{"packageFilePath":"/var/config/rest/downloads/n8-BigStats-0.1.0-0002.noarch.rpm","operation":"INSTALL","id":"fa13463f-6556-44cc-a699-7a7981dcc295","status":"CREATED","userReference":{"link":"https://localhost/mgmt/shared/authz/users/admin"},"identityReferences":[{"link":"https://localhost/mgmt/shared/authz/users/admin"}],"ownerMachineId":"3ed07ac1-8c3e-43c5-aacf-53eebf4cb2f8","generation":1,"lastUpdateMicros":1524932793810249,"kind":"shared:iapp:package-management-tasks:iapppackagemanagementtaskstate","selfLink":"https://localhost/mgmt/shared/iapp/package-management-tasks/fa13463f-6556-44cc-a699-7a7981dcc295"}
```

4. [OPTIONAL] Using the 'id' value in the response above, you can confirm the installation results like this (using your own unique job id):

`curl -u <username>:<password> -X GET http://localhost:8100/mgmt/shared/iapp/package-management-tasks/fa13463f-6556-44cc-a699-7a7981dcc295`

The response will look something like this:

```json
{"packageFilePath":"/var/config/rest/downloads/n8-BigStats-0.1.0-0005.noarch.rpm","packageName":"n8-BigStats-0.1.0-0005.noarch","operation":"INSTALL","packageManifest":{"tags":["IAPP"]},"id":"fa13463f-6556-44cc-a699-7a7981dcc295","status":"FINISHED","startTime":"2018-04-28T09:26:33.818-0700","endTime":"2018-04-28T09:26:34.711-0700","userReference":{"link":"https://localhost/mgmt/shared/authz/users/admin"},"identityReferences":[{"link":"https://localhost/mgmt/shared/authz/users/admin"}],"ownerMachineId":"3ed07ac1-8c3e-43c5-aacf-53eebf4cb2f8","generation":3,"lastUpdateMicros":1524932794714759,"kind":"shared:iapp:package-management-tasks:iapppackagemanagementtaskstate","selfLink":"https://localhost/mgmt/shared/iapp/package-management-tasks/fa13463f-6556-44cc-a699-7a7981dcc295"}
```

Note the `"status":"FINISHED"` indicating that installation was successful.

## Configure

To configure, POST settings to `/mgmt/shared/n8/bigstats_settings`:

* **proto:** [http|https|statsd|kafka]
* **address** ip address or resolvable domain name
* **port** destination tcp port
* **uri** [OPTIONAL] End-point to post data to. Can be blank. Used only for http or https destinations.
* **interval** - how often, in seconds, to send the stats. Default: 10 seconds.
* **debug** - this will put a LOT of data into the BIG-IPs `/var/log/restnoded/restnoded.log`. Remember to turn this off when done.

### Example comnfigurations:

**HTTP destination:**

`POST https://{{mgmt_ip_address}}/mgmt/shared/n8/bigstats_settings`

```json
{
    "config": {
        "destination": {
          "proto": "http",
          "address": "192.168.1.42",
          "port": "8080",
          "uri": "/stats"
        },
        "size": "small",
        "interval": "10",
        "debug": false
      }
}
```

**StatsD destination:**

NOTE: This functionality uses https://github.com/sivy/node-statsd 

`POST https://{{mgmt_ip_address}}/mgmt/shared/n8/bigstats_settings`

```json
{
    "config": {
        "destination": {
          "proto": "statsd",
          "address": "192.168.1.42",
          "port": "8125"
        },
        "size": "small",
        "interval": "10",
        "debug": false
      }
}
```

**Kafka Message Bus Destination:**

NOTE: This functionality uses https://github.com/SOHU-Co/kafka-node

`POST https://{{mgmt_ip_address}}/mgmt/shared/n8/bigstats_settings`

```json
{
    "config": {
        "destination": {
          "proto": "kafka",
          "kafka": {
                  "topic": "per-app"
          },
          "address": "172.31.1.78",
          "port": "9092"
        },
        "size": "small",
        "interval": "10",
        "debug": false
      }
}
```

BigStats creates a new Kafka Topic for each AS3 application found on the BIG-IP. 

```sh
/ # kafka-topics.sh --list --zookeeper zookeeper
App1a
App1b
App2
```

A Kafka message for sample application (topic) `App1a` looks like:

```sh
/ # kafka-simple-consumer-shell.sh --broker-list localhost:9092 --topic App1a
{"vip":{"clientside_curConns":0,"clientside_maxConns":6,"clientside_bitsIn":668184240,"clientside_bitsOut":37371977200,"clientside_pktsIn":1500027,"clientside_pktsOut":2031911},"pool":{"serverside_curConns":0,"serverside_maxConns":9,"serverside_bitsIn":537711552,"serverside_bitsOut":36314664160,"serverside_pktsIn":1270792,"serverside_pktsOut":2353845}}
```

**Example BigStats http output:**

```http

POST /stats HTTP/1.1
Content-Type: application/json
Cache-Control: no-cache
Host: 192.168.1.42:8080
Connection: keep-alive
Transfer-Encoding: chunked

{
        "App1a": {
                "class": "app",
                "/Sample_01/172.31.4.11:80": {
                        "class": "service",
                        "clientside_curConns": 0,
                        "clientside_maxConns": 0,
                        "clientside_bitsIn": 0,
                        "clientside_bitsOut": 0,
                        "clientside_pktsIn": 0,
                        "clientside_pktsOut": 0,
                        "/Sample_01/App1a/web_pool1a": [
                                {
                                        "172.31.10.101:8080": {
                                                "class": "pool",
                                                "serverside_curConns": 0,
                                                "serverside_maxConns": 0,
                                                "serverside_bitsIn": 0,
                                                "monitorStatus": "down",
                                                "serverside_bitsOut": 0,
                                                "serverside_pktsIn": 0,
                                                "serverside_pktsOut": 0
                                        }
                                },
                                {
                                        "172.31.10.102:8080": {
                                                "class": "pool",
                                                "serverside_curConns": 0,
                                                "serverside_maxConns": 0,
                                                "serverside_bitsIn": 0,
                                                "monitorStatus": "down",
                                                "serverside_bitsOut": 0,
                                                "serverside_pktsIn": 0,
                                                "serverside_pktsOut": 0
                                        }
                                },
                                {
                                        "172.31.10.103:8080": {
                                                "class": "pool",
                                                "serverside_curConns": 0,
                                                "serverside_maxConns": 0,
                                                "serverside_bitsIn": 0,
                                                "monitorStatus": "down",
                                                "serverside_bitsOut": 0,
                                                "serverside_pktsIn": 0,
                                                "serverside_pktsOut": 0
                                        }
                                }
                        ]
                }
        },
        "App1b": {
                "class": "app",
                "/Sample_01/172.31.4.12:80": {
                        "class": "service",
                        "clientside_curConns": 0,
                        "clientside_maxConns": 0,
                        "clientside_bitsIn": 0,
                        "clientside_bitsOut": 0,
                        "clientside_pktsIn": 0,
                        "clientside_pktsOut": 0,
                        "/Sample_01/App1b/web_pool1b": [
                                {
                                        "172.31.10.104:8080": {
                                                "class": "pool",
                                                "serverside_curConns": 0,
                                                "serverside_maxConns": 0,
                                                "serverside_bitsIn": 0,
                                                "monitorStatus": "down",
                                                "serverside_bitsOut": 0,
                                                "serverside_pktsIn": 0,
                                                "serverside_pktsOut": 0
                                        }
                                },
                                {
                                        "172.31.10.105:8080": {
                                                "class": "pool",
                                                "serverside_curConns": 0,
                                                "serverside_maxConns": 0,
                                                "serverside_bitsIn": 0,
                                                "monitorStatus": "down",
                                                "serverside_bitsOut": 0,
                                                "serverside_pktsIn": 0,
                                                "serverside_pktsOut": 0
                                        }
                                },
                                {
                                        "172.31.10.106:8080": {
                                                "class": "pool",
                                                "serverside_curConns": 0,
                                                "serverside_maxConns": 0,
                                                "serverside_bitsIn": 0,
                                                "monitorStatus": "down",
                                                "serverside_bitsOut": 0,
                                                "serverside_pktsIn": 0,
                                                "serverside_pktsOut": 0
                                        }
                                }
                        ]
                }
        },
        "App2": {
                "class": "app",
                "/Sample_02/172.31.4.22:80": {
                        "class": "service",
                        "clientside_curConns": 0,
                        "clientside_maxConns": 0,
                        "clientside_bitsIn": 0,
                        "clientside_bitsOut": 0,
                        "clientside_pktsIn": 0,
                        "clientside_pktsOut": 0,
                        "/Sample_02/App2/web_pool2": [
                                {
                                        "172.31.10.120:8080": {
                                                "class": "pool",
                                                "serverside_curConns": 0,
                                                "serverside_maxConns": 0,
                                                "serverside_bitsIn": 0,
                                                "monitorStatus": "down",
                                                "serverside_bitsOut": 0,
                                                "serverside_pktsIn": 0,
                                                "serverside_pktsOut": 0
                                        }
                                },
                                {
                                        "172.31.10.121:8080": {
                                                "class": "pool",
                                                "serverside_curConns": 0,
                                                "serverside_maxConns": 0,
                                                "serverside_bitsIn": 0,
                                                "monitorStatus": "down",
                                                "serverside_bitsOut": 0,
                                                "serverside_pktsIn": 0,
                                                "serverside_pktsOut": 0
                                        }
                                },
                                {
                                        "172.31.10.122:8080": {
                                                "class": "pool",
                                                "serverside_curConns": 0,
                                                "serverside_maxConns": 0,
                                                "serverside_bitsIn": 0,
                                                "monitorStatus": "down",
                                                "serverside_bitsOut": 0,
                                                "serverside_pktsIn": 0,
                                                "serverside_pktsOut": 0
                                        }
                                }
                        ]
                }
        }
}
```
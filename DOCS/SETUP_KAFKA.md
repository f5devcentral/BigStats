# BigStats Setup - Kafka

## Example comnfigurations

**Kafka Message Bus Destination:**

NOTE: This functionality uses https://github.com/SOHU-Co/kafka-node

`POST https://{{mgmt_ip_address}}/mgmt/shared/bigstats_settings`

```json
{
    "config": {
        "destination": {
          "protocol": "kafka",
          "kafka": {
                  "topic": "partition"
          },
          "address": "172.31.1.42",
          "port": "9092"
        },
        "size": "small",
        "interval": "10",
        "enabled": true,
        "debug": false
      }
}
```

Depending on your configuration above (`'topic': 'all'` or `'topic': 'partition'`) BigStats will put all the stats into one kafka topic, or create seperate topics per BIG-IP Administrative Partition.

Example, using curl:
```sh
curl -u <username>:<password> -X POST http://localhost:8100/mgmt/shared/bigstats_settings -d '{"config":{"destination":{"protocol": "kafka","kafka": { "topic":"partition" },"address": "172.31.1.78","port": "9092"},"size": "small","interval": 10,"enabled": true,"debug": false}}'
```

> NOTE: To build your own Apache Kafka Broker lab environment, refer to `DOCS/LAB_SETUP.md`


Dependong on your Apache Kafka Broker implementation, viewing the list of Kafka Topics might look like this:

```sh
/ # kafka-topics.sh --list --zookeeper zookeeper
ip-172-31-1-20-us-west-1-compute-internal-Common
ip-172-31-1-20-us-west-1-compute-internal-Tenant_01-App1
ip-172-31-1-20-us-west-1-compute-internal-Tenant_03-App3
ip-172-31-1-20-us-west-1-compute-internal-Tenant_07-App7
ip-172-31-1-20-us-west-1-compute-internal-Tenant_08-App8
ip-172-31-1-20-us-west-1-compute-internal-device_stats
```

And viewing the contents of a Kafka Topic Kafka for sample BIG-IP Administrative partition `Tenant_01-App1` looks like:

```sh
/ # kafka-simple-consumer-shell.sh --broker-list localhost:9092 --topic Tenant_01-App1
{"vip":{"clientside_curConns":0,"clientside_maxConns":6,"clientside_bitsIn":668184240,"clientside_bitsOut":37371977200,"clientside_pktsIn":1500027,"clientside_pktsOut":2031911},"pool":{"serverside_curConns":0,"serverside_maxConns":9,"serverside_bitsIn":537711552,"serverside_bitsOut":36314664160,"serverside_pktsIn":1270792,"serverside_pktsOut":2353845}}
```
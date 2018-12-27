{
  "device": {
    "id": "ip-172-31-1-20-us-west-1-compute-internal",
    "tenants": [
      {
        "id": "Tenant_01/App1",
        "services": [
          {
            "id": "/Tenant_01/172.31.4.11:80",
            "clientside_curConns": 0,
            "clientside_maxConns": 0,
            "clientside_bitsIn": 0,
            "clientside_bitsOut": 0,
            "clientside_pktsIn": 0,
            "clientside_pktsOut": 0,
            "pool": {
              "id": "/Tenant_01/App1/web_pool1",
              "members": [
                {
                  "id": "172.31.10.113:80",
                  "serverside_curConns": 0,
                  "serverside_maxConns": 0,
                  "serverside_bitsIn": 0,
                  "serverside_bitsOut": 0,
                  "serverside_pktsIn": 0,
                  "serverside_pktsOut": 0,
                  "monitorStatus": 0
                },
                {
                  "id": "172.31.10.111:80",
                  "serverside_curConns": 0,
                  "serverside_maxConns": 0,
                  "serverside_bitsIn": 0,
                  "serverside_bitsOut": 0,
                  "serverside_pktsIn": 0,
                  "serverside_pktsOut": 0,
                  "monitorStatus": 0
                },
                {
                  "id": "172.31.10.112:80",
                  "serverside_curConns": 0,
                  "serverside_maxConns": 0,
                  "serverside_bitsIn": 0,
                  "serverside_bitsOut": 0,
                  "serverside_pktsIn": 0,
                  "serverside_pktsOut": 0,
                  "monitorStatus": 0
                },
                {
                  "id": "172.31.10.114:80",
                  "serverside_curConns": 0,
                  "serverside_maxConns": 0,
                  "serverside_bitsIn": 0,
                  "serverside_bitsOut": 0,
                  "serverside_pktsIn": 0,
                  "serverside_pktsOut": 0,
                  "monitorStatus": 0
                }
              ]
            }
          }
        ]
      },
      {
        "id": "Common",
        "services": [
          {
            "id": "/Common/172.31.10.20:80",
            "clientside_curConns": 0,
            "clientside_maxConns": 0,
            "clientside_bitsIn": 0,
            "clientside_bitsOut": 0,
            "clientside_pktsIn": 0,
            "clientside_pktsOut": 0,
            "pool": {
              "id": "/Common/myPool",
              "members": [
                {
                  "id": "172.31.10.100:8080",
                  "serverside_curConns": 0,
                  "serverside_maxConns": 0,
                  "serverside_bitsIn": 0,
                  "serverside_bitsOut": 0,
                  "serverside_pktsIn": 0,
                  "serverside_pktsOut": 0,
                  "monitorStatus": 0
                },
                {
                  "id": "172.31.10.101:8080",
                  "serverside_curConns": 0,
                  "serverside_maxConns": 0,
                  "serverside_bitsIn": 0,
                  "serverside_bitsOut": 0,
                  "serverside_pktsIn": 0,
                  "serverside_pktsOut": 0,
                  "monitorStatus": 0
                }
              ]
            }
          },
          {
            "id": "/Common/172.31.10.20:8081",
            "clientside_curConns": 0,
            "clientside_maxConns": 0,
            "clientside_bitsIn": 0,
            "clientside_bitsOut": 0,
            "clientside_pktsIn": 0,
            "clientside_pktsOut": 0
          }
        ]
      },
      {
        "id": "Tenant_02/App2",
        "services": [
          {
            "id": "/Tenant_02/172.31.4.21:443",
            "clientside_curConns": 0,
            "clientside_maxConns": 0,
            "clientside_bitsIn": 0,
            "clientside_bitsOut": 0,
            "clientside_pktsIn": 0,
            "clientside_pktsOut": 0,
            "pool": {
              "id": "/Tenant_02/App2/web_pool2",
              "members": [
                {
                  "id": "172.31.4.120:80",
                  "serverside_curConns": 0,
                  "serverside_maxConns": 0,
                  "serverside_bitsIn": 0,
                  "serverside_bitsOut": 0,
                  "serverside_pktsIn": 0,
                  "serverside_pktsOut": 0,
                  "monitorStatus": 0
                },
                {
                  "id": "172.31.4.121:80",
                  "serverside_curConns": 0,
                  "serverside_maxConns": 0,
                  "serverside_bitsIn": 0,
                  "serverside_bitsOut": 0,
                  "serverside_pktsIn": 0,
                  "serverside_pktsOut": 0,
                  "monitorStatus": 0
                },
                {
                  "id": "172.31.4.122:80",
                  "serverside_curConns": 0,
                  "serverside_maxConns": 0,
                  "serverside_bitsIn": 0,
                  "serverside_bitsOut": 0,
                  "serverside_pktsIn": 0,
                  "serverside_pktsOut": 0,
                  "monitorStatus": 0
                },
                {
                  "id": "172.31.4.123:80",
                  "serverside_curConns": 0,
                  "serverside_maxConns": 0,
                  "serverside_bitsIn": 0,
                  "serverside_bitsOut": 0,
                  "serverside_pktsIn": 0,
                  "serverside_pktsOut": 0,
                  "monitorStatus": 0
                }
              ]
            }
          },
          {
            "id": "/Tenant_02/172.31.4.21:80",
            "clientside_curConns": 0,
            "clientside_maxConns": 0,
            "clientside_bitsIn": 0,
            "clientside_bitsOut": 0,
            "clientside_pktsIn": 0,
            "clientside_pktsOut": 0
          }
        ]
      },
      {
        "id": "Tenant_03/App3",
        "services": [
          {
            "id": "/Tenant_03/172.31.4.31:80",
            "clientside_curConns": 0,
            "clientside_maxConns": 0,
            "clientside_bitsIn": 0,
            "clientside_bitsOut": 0,
            "clientside_pktsIn": 0,
            "clientside_pktsOut": 0,
            "pool": {
              "id": "/Tenant_03/App3/web_pool3",
              "members": [
                {
                  "id": "172.31.10.131:80",
                  "serverside_curConns": 0,
                  "serverside_maxConns": 0,
                  "serverside_bitsIn": 0,
                  "serverside_bitsOut": 0,
                  "serverside_pktsIn": 0,
                  "serverside_pktsOut": 0,
                  "monitorStatus": 0
                },
                {
                  "id": "172.31.10.132:80",
                  "serverside_curConns": 0,
                  "serverside_maxConns": 0,
                  "serverside_bitsIn": 0,
                  "serverside_bitsOut": 0,
                  "serverside_pktsIn": 0,
                  "serverside_pktsOut": 0,
                  "monitorStatus": 0
                },
                {
                  "id": "172.31.10.134:80",
                  "serverside_curConns": 0,
                  "serverside_maxConns": 0,
                  "serverside_bitsIn": 0,
                  "serverside_bitsOut": 0,
                  "serverside_pktsIn": 0,
                  "serverside_pktsOut": 0,
                  "monitorStatus": 0
                }
              ]
            }
          }
        ]
      }
    ],
    "global": {
      "memory": {
        "memoryTotal": 8063369216,
        "memoryUsed": 2335978400
      },
      "cpus": [
        {
          "id": "cpu0",
          "fiveSecAvgIdle": 99,
          "fiveSecAvgIowait": 0,
          "fiveSecAvgIrq": 0,
          "fiveSecAvgNiced": 0,
          "fiveSecAvgRatio": 1,
          "fiveSecAvgSoftirq": 0,
          "fiveSecAvgStolen": 0,
          "fiveSecAvgSystem": 0,
          "fiveSecAvgUser": 0
        },
        {
          "id": "cpu1",
          "fiveSecAvgIdle": 98,
          "fiveSecAvgIowait": 0,
          "fiveSecAvgIrq": 0,
          "fiveSecAvgNiced": 0,
          "fiveSecAvgRatio": 1,
          "fiveSecAvgSoftirq": 0,
          "fiveSecAvgStolen": 0,
          "fiveSecAvgSystem": 1,
          "fiveSecAvgUser": 0
        }
      ]
    }
  }
}
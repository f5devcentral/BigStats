# DEV Notes

## Build Package

curl -u admin:e4d8ba3c -X POST http://localhost:8100/mgmt/shared/iapp/build-package -d '{ "appName": "n8-BigipStatsd", "packageVersion":"0.1.0", "packageRelease":"0001" }'

## Install

curl -u user:pass -X POST http://localhost:8100/mgmt/shared/iapp/package-management-tasks -d '{ "operation":"INSTALL","packageFilePath": "/var/config/rest/downloads/MemoryWorker-0.1.0-0001.noarch.rpm"}'

## Stats collections

**This:**

`https://admin:e4d8ba3c@172.31.1.20/mgmt/tm/ltm/virtual/?$select=partition,subPath,fullPath,pool`

**Gives you:**

```json
{
    "kind": "tm:ltm:virtual:virtualcollectionstate",
    "selfLink": "https://localhost/mgmt/tm/ltm/virtual?$select=partition%2CsubPath%2CfullPath%2Cpool&ver=13.1.0.2",
    "items": [
        {
            "partition": "Sample_01",
            "subPath": "A1",
            "fullPath": "/Sample_01/A1/serviceMain",
            "pool": "/Sample_01/A1/web_pool",
            "poolReference": {
                "link": "https://localhost/mgmt/tm/ltm/pool/~Sample_01~A1~web_pool?ver=13.1.0.2"
            }
        },
        {
            "partition": "Sample_02",
            "subPath": "A2",
            "fullPath": "/Sample_02/A2/serviceMain",
            "pool": "/Sample_02/A2/web_pool2",
            "poolReference": {
                "link": "https://localhost/mgmt/tm/ltm/pool/~Sample_02~A2~web_pool2?ver=13.1.0.2"
            }
        }
    ]
}
```

### VIPS

GET /mgmt/tm/ltm/virtual/~Sample_01~A1~serviceMain/stats
{
    "entries": {
        "https://localhost/mgmt/tm/ltm/virtual/~Sample_01~A1~serviceMain/~Sample_01~A1~serviceMain/stats": {
            "nestedStats": {
                "entries": {
                    "clientside.curConns": {
                        "value": "0"
                    }
                }
            }
        }
    }
}

### Pools

GET /mgmt/tm/ltm/pool/~Sample_01~A1~web_pool/stats
{
    "entries": {
        "https://localhost/mgmt/tm/ltm/pool/~Sample_01~A1~web_pool/~Sample_01~A1~web_pool/stats": {
            "nestedStats": {
                "entries":  {

                }
            }
        }
    }
}


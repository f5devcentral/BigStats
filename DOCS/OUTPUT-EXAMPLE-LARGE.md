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
                  "id": "172.31.10.114:80",
                  "serverside_curConns": 0,
                  "serverside_maxConns": 0,
                  "serverside_bitsIn": 0,
                  "serverside_bitsOut": 0,
                  "serverside_pktsIn": 0,
                  "serverside_pktsOut": 0,
                  "monitorStatus": 0
                },
                {
                  "id": "172.31.10.113:80",
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
            "id": "/Common/172.31.10.20:8081",
            "clientside_curConns": 0,
            "clientside_maxConns": 0,
            "clientside_bitsIn": 0,
            "clientside_bitsOut": 0,
            "clientside_pktsIn": 0,
            "clientside_pktsOut": 0
          },
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
            },
            "ssl": {
              "id": "/Tenant_02/App2/webtls",
              "common_activeHandshakeRejected": 0,
              "common_aggregateRenegotiationsRejected": 0,
              "common_badRecords": 0,
              "common_c3dUses_conns": 0,
              "common_cipherUses_adhKeyxchg": 0,
              "common_cipherUses_aesBulk": 0,
              "common_cipherUses_aesGcmBulk": 0,
              "common_cipherUses_camelliaBulk": 0,
              "common_cipherUses_desBulk": 0,
              "common_cipherUses_dhRsaKeyxchg": 0,
              "common_cipherUses_dheDssKeyxchg": 0,
              "common_cipherUses_ecdhEcdsaKeyxchg": 0,
              "common_cipherUses_ecdhRsaKeyxchg": 0,
              "common_cipherUses_ecdheEcdsaKeyxchg": 0,
              "common_cipherUses_ecdheRsaKeyxchg": 0,
              "common_cipherUses_edhRsaKeyxchg": 0,
              "common_cipherUses_ideaBulk": 0,
              "common_cipherUses_md5Digest": 0,
              "common_cipherUses_nullBulk": 0,
              "common_cipherUses_nullDigest": 0,
              "common_cipherUses_rc2Bulk": 0,
              "common_cipherUses_rc4Bulk": 0,
              "common_cipherUses_rsaKeyxchg": 0,
              "common_cipherUses_shaDigest": 0,
              "common_connectionMirroring_haCtxRecv": 0,
              "common_connectionMirroring_haCtxSent": 0,
              "common_connectionMirroring_haFailure": 0,
              "common_connectionMirroring_haHsSuccess": 0,
              "common_connectionMirroring_haPeerReady": 0,
              "common_connectionMirroring_haTimeout": 0,
              "common_curCompatConns": 0,
              "common_curConns": 0,
              "common_curNativeConns": 0,
              "common_currentActiveHandshakes": 0,
              "common_decryptedBytesIn": 0,
              "common_decryptedBytesOut": 0,
              "common_dtlsTxPushbacks": 0,
              "common_encryptedBytesIn": 0,
              "common_encryptedBytesOut": 0,
              "common_extendedMasterSecrets": 0,
              "common_fatalAlerts": 0,
              "common_fullyHwAcceleratedConns": 0,
              "common_fwdpUses_alertBypasses": 0,
              "common_fwdpUses_cachedCerts": 0,
              "common_fwdpUses_clicertFailBypasses": 0,
              "common_fwdpUses_conns": 0,
              "common_fwdpUses_dipBypasses": 0,
              "common_fwdpUses_hnBypasses": 0,
              "common_fwdpUses_sipBypasses": 0,
              "common_handshakeFailures": 0,
              "common_insecureHandshakeAccepts": 0,
              "common_insecureHandshakeRejects": 0,
              "common_insecureRenegotiationRejects": 0,
              "common_maxCompatConns": 0,
              "common_maxConns": 0,
              "common_maxNativeConns": 0,
              "common_midstreamRenegotiations": 0,
              "common_nonHwAcceleratedConns": 0,
              "common_ocspFwdpClientssl_cachedResp": 0,
              "common_ocspFwdpClientssl_certStatusReq": 0,
              "common_ocspFwdpClientssl_invalidCertResp": 0,
              "common_ocspFwdpClientssl_respstatusErrResp": 0,
              "common_ocspFwdpClientssl_revokedResp": 0,
              "common_ocspFwdpClientssl_stapledResp": 0,
              "common_ocspFwdpClientssl_unknownResp": 0,
              "common_partiallyHwAcceleratedConns": 0,
              "common_peercertInvalid": 0,
              "common_peercertNone": 0,
              "common_peercertValid": 0,
              "common_prematureDisconnects": 0,
              "common_protocolUses_dtlsv1": 0,
              "common_protocolUses_sslv2": 0,
              "common_protocolUses_sslv3": 0,
              "common_protocolUses_tlsv1": 0,
              "common_protocolUses_tlsv1_1": 0,
              "common_protocolUses_tlsv1_2": 0,
              "common_recordsIn": 0,
              "common_recordsOut": 0,
              "common_renegotiationsRejected": 0,
              "common_secureHandshakes": 0,
              "common_sessCacheCurEntries": 0,
              "common_sessCacheHits": 0,
              "common_sessCacheInvalidations": 0,
              "common_sessCacheLookups": 0,
              "common_sessCacheOverflows": 0,
              "common_sessionMirroring_failure": 0,
              "common_sessionMirroring_success": 0,
              "common_sesstickUses_reuseFailed": 0,
              "common_sesstickUses_reused": 0,
              "common_sniRejects": 0,
              "common_totCompatConns": 0,
              "common_totNativeConns": 0,
              "dynamicRecord_x1": 0,
              "dynamicRecord_x10": 0,
              "dynamicRecord_x11": 0,
              "dynamicRecord_x12": 0,
              "dynamicRecord_x13": 0,
              "dynamicRecord_x14": 0,
              "dynamicRecord_x15": 0,
              "dynamicRecord_x16": 0,
              "dynamicRecord_x2": 0,
              "dynamicRecord_x3": 0,
              "dynamicRecord_x4": 0,
              "dynamicRecord_x5": 0,
              "dynamicRecord_x6": 0,
              "dynamicRecord_x7": 0,
              "dynamicRecord_x8": 0,
              "dynamicRecord_x9": 0
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
                  "id": "172.31.10.133:80",
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
        "memoryUsed": 2323387776
      },
      "cpus": [
        {
          "id": "cpu0",
          "fiveSecAvgIdle": 70,
          "fiveSecAvgIowait": 0,
          "fiveSecAvgIrq": 0,
          "fiveSecAvgNiced": 0,
          "fiveSecAvgRatio": 29,
          "fiveSecAvgSoftirq": 0,
          "fiveSecAvgStolen": 0,
          "fiveSecAvgSystem": 8,
          "fiveSecAvgUser": 20
        },
        {
          "id": "cpu1",
          "fiveSecAvgIdle": 53,
          "fiveSecAvgIowait": 0,
          "fiveSecAvgIrq": 0,
          "fiveSecAvgNiced": 0,
          "fiveSecAvgRatio": 46,
          "fiveSecAvgSoftirq": 0,
          "fiveSecAvgStolen": 0,
          "fiveSecAvgSystem": 7,
          "fiveSecAvgUser": 39
        }
      ]
    }
  }
}
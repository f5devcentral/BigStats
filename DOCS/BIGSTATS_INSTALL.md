# BigStats Install

1. Download the latest BigStats RPM from the `/DIST` directory here: https://github.com/npearce/n8-BigStats It's name will be something like (numbers may differ): `BigStats-0.4.0-0005.noarch.rpm`
2. Copy (scp) the BigStats RPM into the following directory on your BIG-IP: `/var/config/rest/downloads/`
3. Execute the following command on your BIG-IP (shell prompt, not tmsh) to install:

```sh
curl -u <username>:<password> -X POST http://localhost:8100/mgmt/shared/iapp/package-management-tasks -d '{ "operation":"INSTALL","packageFilePath": "/var/config/rest/downloads/BigStats-0.4.0-0005.noarch.rpm"}'
```

NOTE: Use your admin username/password and check the name of the RPM carefaully as release numbers may differ from the example above.

The response will look something like this:

```json
{"packageFilePath":"/var/config/rest/downloads/BigStats-0.4.0-0002.noarch.rpm","operation":"INSTALL","id":"fa13463f-6556-44cc-a699-7a7981dcc295","status":"CREATED","userReference":{"link":"https://localhost/mgmt/shared/authz/users/admin"},"identityReferences":[{"link":"https://localhost/mgmt/shared/authz/users/admin"}],"ownerMachineId":"3ed07ac1-8c3e-43c5-aacf-53eebf4cb2f8","generation":1,"lastUpdateMicros":1524932793810249,"kind":"shared:iapp:package-management-tasks:iapppackagemanagementtaskstate","selfLink":"https://localhost/mgmt/shared/iapp/package-management-tasks/fa13463f-6556-44cc-a699-7a7981dcc295"}
```
4. [OPTIONAL] You can see what packages/versions are installed by executing:

`curl -u <username>:<password> -X GET http://localhost:8100/mgmt/shared/iapp/global-installed-packages`

5. [OPTIONAL] Using the 'id' value in the response from step 3. above, you can confirm the installation results like this (using your own unique job id):

`curl -u <username>:<password> -X GET http://localhost:8100/mgmt/shared/iapp/package-management-tasks/fa13463f-6556-44cc-a699-7a7981dcc295`

The response will look something like this:

```json
{"packageFilePath":"/var/config/rest/downloads/BigStats-0.4.0-0002.noarch.rpm","packageName":"BigStats-0.4.0-0005.noarch","operation":"INSTALL","packageManifest":{"tags":["IAPP"]},"id":"fa13463f-6556-44cc-a699-7a7981dcc295","status":"FINISHED","startTime":"2018-04-28T09:26:33.818-0700","endTime":"2018-04-28T09:26:34.711-0700","userReference":{"link":"https://localhost/mgmt/shared/authz/users/admin"},"identityReferences":[{"link":"https://localhost/mgmt/shared/authz/users/admin"}],"ownerMachineId":"3ed07ac1-8c3e-43c5-aacf-53eebf4cb2f8","generation":3,"lastUpdateMicros":1524932794714759,"kind":"shared:iapp:package-management-tasks:iapppackagemanagementtaskstate","selfLink":"https://localhost/mgmt/shared/iapp/package-management-tasks/fa13463f-6556-44cc-a699-7a7981dcc295"}
```

Note the `"status":"FINISHED"` indicating that installation was successful.

5. [OPTIONAL] View the installed packages using:

`curl <username>:<password> -X GET http://localhost:8100/shared/iapp/global-installed-packages`

The response will look something like:

```json
{"items":[{"id":"3616c231-6973-3608-8d74-1b87fc3d95e0","appName":"BigStats","packageName":"BigStats-0.4.0-0005.noarch","version":"0.4.0","release":"0005","arch":"noarch","tags":["IAPP"],"generation":2,"lastUpdateMicros":1534972313326949,"kind":"shared:iapp:global-installed-packages:installedpackagestate","selfLink":"https://localhost/mgmt/shared/iapp/global-installed-packages/3616c231-6973-3608-8d74-1b87fc3d95e0"}],"generation":2,"kind":"shared:iapp:global-installed-packages:installedpackagecollectionstate","lastUpdateMicros":1534972313328758,"selfLink":"https://localhost/mgmt/shared/iapp/global-installed-packages"}
```
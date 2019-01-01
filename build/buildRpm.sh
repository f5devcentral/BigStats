#!/bin/bash
VERSION=0.6
RELEASE=0010
RPM_NAME=bigstats-${VERSION}-${RELEASE}.noarch.rpm
rm -rf node_modules
npm install --production
rpmbuild -bb --define "main $(pwd)" --define '_topdir %{main}/build/rpmbuild' --define "_version ${VERSION}" --define "_release ${RELEASE}" build/bigstats.spec
pushd build/rpmbuild/RPMS/noarch
sha256sum ${RPM_NAME} > ${RPM_NAME}.sha256
popd
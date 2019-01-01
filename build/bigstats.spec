Summary: F5 BigStats iControlLX extension
Name: BigStats
Version: %{_version}
Release: %{_release}
BuildArch: noarch
Group: Development/Libraries
License: Commercial
Packager: F5 Networks <support@f5.com>

%description
The BIG-IP Telemetry Exporter

%global __os_install_post %{nil}

%define _rpmfilename %%{ARCH}/%%{NAME}-%%{VERSION}-%%{RELEASE}.%%{ARCH}.rpm
%define IAPP_INSTALL_DIR /var/config/rest/iapps/%{name}

%prep
rm -rf %{_builddir}/*
cp %{main}/package.json %{_builddir}
cp -r %{main}/SRC/BigStats/nodejs %{_builddir}
cp -r %{main}/node_modules %{_builddir}/nodejs

%install
rm -rf $RPM_BUILD_ROOT
mkdir -p $RPM_BUILD_ROOT%{IAPP_INSTALL_DIR}
cp %{_builddir}/package.json $RPM_BUILD_ROOT%{IAPP_INSTALL_DIR}
cp -r %{_builddir}/nodejs $RPM_BUILD_ROOT%{IAPP_INSTALL_DIR}

%clean
rm -rf $RPM_BUILD_ROOT

%files
%defattr(-,restnoded,restnoded)
%{IAPP_INSTALL_DIR}

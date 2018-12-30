Summary: BigStats
Name: BigStats
Version: 0.6.0
Release: 0002
BuildArch: noarch
Group: Development/Libraries
License: Commercial
Packager: F5 Networks <support@f5.com>

%description
BigStats pushes BIG-IP telemetry to remote logging services/pipelines. It supports HTTP, HTTPS, StatsD, and Apache Kafka destinations.

%define APP_DIR /var/config/rest/iapps/%{name}

%prep
cp -r %{main}/src %{_builddir}/%{name}-%{version}
cp -r %{main}/node_modules %{_builddir}/%{name}-%{version}/node_modules

%build
npm prune --production

%install
rm -rf $RPM_BUILD_ROOT
mkdir -p $RPM_BUILD_ROOT/%{APP_DIR}
cp -r $RPM_BUILD_DIR/%{name}-%{version}/* $RPM_BUILD_ROOT/%{APP_DIR}

%clean
rm -rf ${buildroot}

%files
%defattr(-,root,root)
%{APP_DIR}

%changelog
* Mon Jun 18 2018 iApp Dev <iappsdev@f5.com>
- auto-generated this spec file
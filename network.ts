import {
  CLOUDFLARE_ACCOUNT,
  OCI_SERVICES,
  _DOMAIN_NAME,
  _PROJECT,
} from "@/config";
import { compartment } from "@/organization";
import * as cloudflare from "@pulumi/cloudflare";
import * as oci from "@pulumi/oci";

export const publicIp = new oci.core.PublicIp(
  "main",
  {
    compartmentId: compartment.id,
    displayName: `${_PROJECT}-public-ip`,
    lifetime: "RESERVED",
  },
  { ignoreChanges: ["privateIpId"], protect: true },
);

export const vcn = new oci.core.Vcn(
  "main",
  {
    cidrBlocks: ["10.0.0.0/16"],
    compartmentId: compartment.id,
    displayName: `${_PROJECT}-vcn`,
    dnsLabel: _PROJECT,
  },
  { protect: true },
);

export const zone = new cloudflare.Zone(
  "main",
  { account: CLOUDFLARE_ACCOUNT, name: _DOMAIN_NAME },
  { protect: true },
);

export const apiDevRecord = new cloudflare.DnsRecord(
  "api-dev",
  {
    content: publicIp.ipAddress,
    name: `dev-api.${_DOMAIN_NAME}`,
    proxied: true,
    ttl: 1,
    type: "A",
    zoneId: zone.id,
  },
  { protect: true },
);

export const apiMainRecord = new cloudflare.DnsRecord(
  "api-main",
  {
    content: publicIp.ipAddress,
    name: `api.${_DOMAIN_NAME}`,
    proxied: true,
    ttl: 1,
    type: "A",
    zoneId: zone.id,
  },
  { protect: true },
);

export const internetGateway = new oci.core.InternetGateway(
  "main",
  {
    compartmentId: compartment.id,
    displayName: `${_PROJECT}-internet-gateway`,
    vcnId: vcn.id,
  },
  { protect: true },
);

export const loadBalancerNetworkSecurityGroup =
  new oci.core.NetworkSecurityGroup(
    "load-balancer",
    {
      compartmentId: compartment.id,
      displayName: `${_PROJECT}-network-security-group-load-balancer`,
      vcnId: vcn.id,
    },
    { protect: true },
  );

export const mainNetworkSecurityGroup = new oci.core.NetworkSecurityGroup(
  "main",
  {
    compartmentId: compartment.id,
    displayName: `${_PROJECT}-network-security-group-main`,
    vcnId: vcn.id,
  },
  { protect: true },
);

export const natGateway = new oci.core.NatGateway(
  "main",
  {
    compartmentId: compartment.id,
    displayName: `${_PROJECT}-nat-gateway`,
    vcnId: vcn.id,
  },
  { protect: true },
);

export const secureMode = new cloudflare.ZoneSetting(
  "secure-mode",
  { settingId: "always_use_https", value: "on", zoneId: zone.id },
  { protect: true },
);

export const securityLevel = new cloudflare.ZoneSetting(
  "security-level",
  { settingId: "security_level", value: "medium", zoneId: zone.id },
  { protect: true },
);

export const serviceGateway = new oci.core.ServiceGateway(
  "main",
  {
    compartmentId: compartment.id,
    displayName: `${_PROJECT}-service-gateway`,
    services: OCI_SERVICES.apply((services) => {
      const service = services[0];
      if (!service) throw new Error("OCI service is required");
      return [{ serviceId: service.id }];
    }),
    vcnId: vcn.id,
  },
  { protect: true },
);

export const sslMode = new cloudflare.ZoneSetting(
  "ssl-mode",
  { settingId: "ssl", value: "full", zoneId: zone.id },
  { protect: true },
);

export const tlsVersion = new cloudflare.ZoneSetting(
  "tls-version",
  { settingId: "min_tls_version", value: "1.2", zoneId: zone.id },
  { protect: true },
);

export const websocket = new cloudflare.ZoneSetting(
  "websocket",
  { settingId: "websockets", value: "on", zoneId: zone.id },
  { protect: true },
);

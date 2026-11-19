import { CLOUDFLARE_ACCOUNT, _DOMAIN_NAME, _PROJECT } from "@/config";
import { compartment } from "@/organization";
import * as cloudflare from "@pulumi/cloudflare";
import * as oci from "@pulumi/oci";

export const zone = new cloudflare.Zone(
  "main",
  { account: CLOUDFLARE_ACCOUNT, name: _DOMAIN_NAME },
  { protect: true },
);

export const publicIp = new oci.core.PublicIp(
  "main",
  {
    compartmentId: compartment.id,
    displayName: `${_PROJECT}-public-ip`,
    lifetime: "RESERVED",
  },
  { ignoreChanges: ["privateIpId"], protect: true },
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

export const websocket = new cloudflare.ZoneSetting(
  "websocket",
  { settingId: "websockets", value: "on", zoneId: zone.id },
  { protect: true },
);

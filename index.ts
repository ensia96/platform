import { PROJECT, TENANCY_OCID } from "@/config";
import { setUpNetwork } from "@/set-up-network";
import { setUpFoundation } from "@/set-up-foundation";
import * as cloudflare from "@pulumi/cloudflare";
import * as oci from "@pulumi/oci";
import * as tailscale from "@pulumi/tailscale";

const DOMAIN_NAME = "mangocraft.work";
const TAILSCALE_TAG = "tag:main";

const cloudflareIpv4Cidrs = cloudflare
  .getIpRanges()
  .then(({ ipv4Cidrs }) => ipv4Cidrs);
const availabilityDomains = oci.identity.getAvailabilityDomainsOutput({
  compartmentId: TENANCY_OCID,
}).availabilityDomains;
const availabilityDomain = availabilityDomains.apply((domains) => {
  const domain = domains[0];
  if (!domain) throw new Error("OCI availability domain is required");
  return domain.name;
});
const cloudflareAccount = {
  id: cloudflare.getZoneOutput({ filter: { name: DOMAIN_NAME } }).account.id,
};

const foundation = setUpFoundation();

const network = setUpNetwork({ compartment: foundation.compartment });
const zone = new cloudflare.Zone(
  "main",
  { account: cloudflareAccount, name: DOMAIN_NAME },
  { protect: true },
);

const containerRepository = new oci.artifacts.ContainerRepository(
  "application",
  {
    compartmentId: foundation.compartment.id,
    displayName: `${PROJECT}-repository-application`,
    isPublic: true,
  },
  { protect: true },
);
const volume = new oci.core.Volume(
  "main",
  {
    availabilityDomain,
    compartmentId: foundation.compartment.id,
    displayName: `${PROJECT}-volume-main`,
    sizeInGbs: "50",
  },
  { protect: true },
);

const apiDevRecord = new cloudflare.DnsRecord(
  "api-dev",
  {
    content: network.publicIp.ipAddress,
    name: `dev-api.${DOMAIN_NAME}`,
    proxied: true,
    ttl: 1,
    type: "A",
    zoneId: zone.id,
  },
  { protect: true },
);
const apiMainRecord = new cloudflare.DnsRecord(
  "api-main",
  {
    content: network.publicIp.ipAddress,
    name: `api.${DOMAIN_NAME}`,
    proxied: true,
    ttl: 1,
    type: "A",
    zoneId: zone.id,
  },
  { protect: true },
);
const loadBalancerNetworkSecurityGroup = new oci.core.NetworkSecurityGroup(
  "load-balancer",
  {
    compartmentId: foundation.compartment.id,
    displayName: `${PROJECT}-network-security-group-load-balancer`,
    vcnId: network.vcn.id,
  },
  { protect: true },
);
const mainNetworkSecurityGroup = new oci.core.NetworkSecurityGroup(
  "main",
  {
    compartmentId: foundation.compartment.id,
    displayName: `${PROJECT}-network-security-group-main`,
    vcnId: network.vcn.id,
  },
  { protect: true },
);
const secureMode = new cloudflare.ZoneSetting(
  "secure-mode",
  { settingId: "always_use_https", value: "on", zoneId: zone.id },
  { protect: true },
);
const securityLevel = new cloudflare.ZoneSetting(
  "security-level",
  { settingId: "security_level", value: "medium", zoneId: zone.id },
  { protect: true },
);
const sslMode = new cloudflare.ZoneSetting(
  "ssl-mode",
  { settingId: "ssl", value: "full", zoneId: zone.id },
  { protect: true },
);
const tlsVersion = new cloudflare.ZoneSetting(
  "tls-version",
  { settingId: "min_tls_version", value: "1.2", zoneId: zone.id },
  { protect: true },
);
const websocket = new cloudflare.ZoneSetting(
  "websocket",
  { settingId: "websockets", value: "on", zoneId: zone.id },
  { protect: true },
);

const httpsLoadBalancerFromCloudflareRules = cloudflareIpv4Cidrs.then((cidrs) =>
  Array.from(new Set(cidrs))
    .sort()
    .map(
      (cidr) =>
        new oci.core.NetworkSecurityGroupSecurityRule(
          `https-load-balancer-from-cloudflare-${cidr}`,
          {
            direction: "INGRESS",
            networkSecurityGroupId: loadBalancerNetworkSecurityGroup.id,
            protocol: "6",
            source: cidr,
            sourceType: "CIDR_BLOCK",
            tcpOptions: { destinationPortRange: { max: 443, min: 443 } },
          },
          { protect: true },
        ),
    ),
);
const httpsMainFromLoadBalancerRule =
  new oci.core.NetworkSecurityGroupSecurityRule(
    "https-main-from-load-balancer",
    {
      direction: "INGRESS",
      networkSecurityGroupId: mainNetworkSecurityGroup.id,
      protocol: "6",
      source: loadBalancerNetworkSecurityGroup.id,
      sourceType: "NETWORK_SECURITY_GROUP",
      tcpOptions: { destinationPortRange: { max: 443, min: 443 } },
    },
    { protect: true },
  );

const networkLoadBalancer = new oci.networkloadbalancer.NetworkLoadBalancer(
  "main",
  {
    compartmentId: foundation.compartment.id,
    displayName: `${PROJECT}-network-load-balancer`,
    isPrivate: false,
    networkSecurityGroupIds: [loadBalancerNetworkSecurityGroup.id],
    reservedIps: [{ id: network.publicIp.id }],
    subnetId: network.publicSubnet.id,
  },
  { protect: true },
);
const aclDocument = network.privateSubnet.cidrBlock.apply((cidr) =>
  JSON.stringify({
    acls: [
      {
        action: "accept",
        dst: ["*:*"],
        src: ["*"],
      },
    ],
    autoApprovers: { routes: { [cidr]: [TAILSCALE_TAG] } },
    ssh: [
      {
        action: "accept",
        dst: ["autogroup:self", TAILSCALE_TAG],
        src: ["autogroup:member"],
        users: ["autogroup:nonroot"],
      },
    ],
    tagOwners: { [TAILSCALE_TAG]: ["autogroup:member"] },
  }),
);
const acl = new tailscale.Acl("main", { acl: aclDocument }, { protect: true });
const existingCoolifyInstanceId = oci.core
  .getInstancesOutput({
    compartmentId: foundation.compartment.id,
    displayName: `${PROJECT}-instance-main`,
    state: "RUNNING",
  })
  .instances.apply((instances) => {
    if (instances.length !== 1) {
      throw new Error("exactly one running legacy OCI instance is required");
    }
    return instances[0].id;
  });

const httpsBackendSet = new oci.networkloadbalancer.BackendSet(
  "https",
  {
    healthChecker: { protocol: "TCP" },
    isPreserveSource: false,
    name: "https",
    networkLoadBalancerId: networkLoadBalancer.id,
    policy: "FIVE_TUPLE",
  },
  { protect: true },
);
const httpsListener = new oci.networkloadbalancer.Listener(
  "https",
  {
    defaultBackendSetName: httpsBackendSet.name,
    name: "https",
    networkLoadBalancerId: networkLoadBalancer.id,
    port: 443,
    protocol: "TCP",
  },
  { protect: true },
);
const httpsBackend = new oci.networkloadbalancer.Backend(
  "https",
  {
    backendSetName: httpsBackendSet.name,
    networkLoadBalancerId: networkLoadBalancer.id,
    port: 443,
    targetId: existingCoolifyInstanceId,
  },
  { protect: true },
);

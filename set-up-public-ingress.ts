import { DOMAIN_NAME, PROJECT } from "@/config";
import * as cloudflare from "@pulumi/cloudflare";
import * as oci from "@pulumi/oci";
import { Output } from "@pulumi/pulumi";

type SetUpPublicIngressArgs = {
  compartment: oci.identity.Compartment;
  mainInstance: Output<oci.core.GetInstancesResult["instances"][number]>;
  publicIp: oci.core.PublicIp;
  publicSubnet: oci.core.Subnet;
  vcn: oci.core.Vcn;
};

export function setUpPublicIngress({
  compartment,
  mainInstance,
  publicIp,
  publicSubnet,
  vcn,
}: SetUpPublicIngressArgs) {
  const cloudflareAccount = {
    id: cloudflare.getZoneOutput({ filter: { name: DOMAIN_NAME } }).account.id,
  };
  const cloudflareIpv4Cidrs = cloudflare
    .getIpRanges()
    .then(({ ipv4Cidrs }) => ipv4Cidrs);
  const loadBalancerNetworkSecurityGroup = new oci.core.NetworkSecurityGroup(
    "load-balancer",
    {
      compartmentId: compartment.id,
      displayName: `${PROJECT}-network-security-group-load-balancer`,
      vcnId: vcn.id,
    },
    { protect: true },
  );
  const mainNetworkSecurityGroup = new oci.core.NetworkSecurityGroup(
    "main",
    {
      compartmentId: compartment.id,
      displayName: `${PROJECT}-network-security-group-main`,
      vcnId: vcn.id,
    },
    { protect: true },
  );

  const httpsLoadBalancerFromCloudflareRules = cloudflareIpv4Cidrs.then(
    (cidrs) =>
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
      compartmentId: compartment.id,
      displayName: `${PROJECT}-network-load-balancer`,
      isPrivate: false,
      networkSecurityGroupIds: [loadBalancerNetworkSecurityGroup.id],
      reservedIps: [{ id: publicIp.id }],
      subnetId: publicSubnet.id,
    },
    { protect: true },
  );
  const zone = new cloudflare.Zone(
    "main",
    { account: cloudflareAccount, name: DOMAIN_NAME },
    { protect: true },
  );

  const apiDevRecord = new cloudflare.DnsRecord(
    "api-dev",
    {
      content: publicIp.ipAddress,
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
      content: publicIp.ipAddress,
      name: `api.${DOMAIN_NAME}`,
      proxied: true,
      ttl: 1,
      type: "A",
      zoneId: zone.id,
    },
    { protect: true },
  );
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

  const httpsBackend = new oci.networkloadbalancer.Backend(
    "https",
    {
      backendSetName: httpsBackendSet.name,
      networkLoadBalancerId: networkLoadBalancer.id,
      port: 443,
      targetId: mainInstance.id,
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

  return {
    apiDevRecord,
    apiMainRecord,
    httpsBackend,
    httpsBackendSet,
    httpsListener,
    httpsLoadBalancerFromCloudflareRules,
    httpsMainFromLoadBalancerRule,
    loadBalancerNetworkSecurityGroup,
    mainNetworkSecurityGroup,
    networkLoadBalancer,
    secureMode,
    securityLevel,
    sslMode,
    tlsVersion,
    websocket,
    zone,
  };
}

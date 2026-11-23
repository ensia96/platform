import { env } from "@/lib";
import * as cloudflare from "@pulumi/cloudflare";
import * as oci from "@pulumi/oci";
import * as tailscale from "@pulumi/tailscale";

const DOMAIN_NAME = "mangocraft.work";
const EMAIL = env("EMAIL");
const INSTANCE_SHAPE = "VM.Standard.A1.Flex";
const PROJECT = "platform";
const TAILSCALE_TAG = "tag:main";
const TENANCY_OCID = env("OCI_TENANCY_OCID");

const cloudflareIpv4Cidrs = cloudflare
  .getIpRanges()
  .then(({ ipv4Cidrs }) => ipv4Cidrs);
const ociServices = oci.core.getServicesOutput({
  filters: [
    {
      name: "name",
      regex: true,
      values: ["All .* Services In Oracle Services Network"],
    },
  ],
}).services;
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

const budget = new oci.budget.Budget(
  "main",
  {
    amount: 1,
    compartmentId: TENANCY_OCID,
    resetPeriod: "MONTHLY",
    targets: [TENANCY_OCID],
    targetType: "COMPARTMENT",
  },
  { protect: true },
);
const compartment = new oci.identity.Compartment(
  "main",
  { compartmentId: TENANCY_OCID, description: PROJECT, name: PROJECT },
  { protect: true },
);
const manager = new oci.identity.User(
  "manager",
  {
    compartmentId: TENANCY_OCID,
    description: `manage ${PROJECT}`,
    email: `${PROJECT}@terraform.com`,
    name: `${PROJECT}-identity-user-manager`,
  },
  { protect: true },
);
const managers = new oci.identity.Group(
  "managers",
  {
    compartmentId: TENANCY_OCID,
    description: `manage ${PROJECT}`,
    name: `${PROJECT}-identity-group-managers`,
  },
  { protect: true },
);
const stateBucket = new oci.objectstorage.Bucket(
  "state",
  {
    compartmentId: TENANCY_OCID,
    name: `${PROJECT}-state`,
    namespace: "cnm7patunz1z",
  },
  { protect: true },
);
const zone = new cloudflare.Zone(
  "main",
  { account: cloudflareAccount, name: DOMAIN_NAME },
  { protect: true },
);

const authToken = new oci.identity.AuthToken(
  "application",
  {
    description: `${PROJECT}-auth-token-application`,
    userId: manager.id,
  },
  { protect: true },
);
const budgetAlert = new oci.budget.Rule(
  "main",
  {
    budgetId: budget.id,
    recipients: EMAIL,
    threshold: 1,
    thresholdType: "PERCENTAGE",
    type: "FORECAST",
  },
  { protect: true },
);
const managerMembership = new oci.identity.UserGroupMembership(
  "manager",
  { groupId: managers.id, userId: manager.id },
  { protect: true },
);
const managerPolicy = new oci.identity.Policy(
  "manager",
  {
    compartmentId: TENANCY_OCID,
    description: `manage ${PROJECT}`,
    name: `${PROJECT}-identity-policy-manager`,
    statements: managers.name.apply((name) => [
      `Allow group ${name} to manage all-resources in tenancy`,
    ]),
  },
  { protect: true },
);
const containerRepository = new oci.artifacts.ContainerRepository(
  "application",
  {
    compartmentId: compartment.id,
    displayName: `${PROJECT}-repository-application`,
    isPublic: true,
  },
  { protect: true },
);
const publicIp = new oci.core.PublicIp(
  "main",
  {
    compartmentId: compartment.id,
    displayName: `${PROJECT}-public-ip`,
    lifetime: "RESERVED",
  },
  { ignoreChanges: ["privateIpId"], protect: true },
);
const vcn = new oci.core.Vcn(
  "main",
  {
    cidrBlocks: ["10.0.0.0/16"],
    compartmentId: compartment.id,
    displayName: `${PROJECT}-vcn`,
    dnsLabel: PROJECT,
  },
  { protect: true },
);
const volume = new oci.core.Volume(
  "main",
  {
    availabilityDomain,
    compartmentId: compartment.id,
    displayName: `${PROJECT}-volume-main`,
    sizeInGbs: "50",
  },
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
const internetGateway = new oci.core.InternetGateway(
  "main",
  {
    compartmentId: compartment.id,
    displayName: `${PROJECT}-internet-gateway`,
    vcnId: vcn.id,
  },
  { protect: true },
);
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
const natGateway = new oci.core.NatGateway(
  "main",
  {
    compartmentId: compartment.id,
    displayName: `${PROJECT}-nat-gateway`,
    vcnId: vcn.id,
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
const serviceGateway = new oci.core.ServiceGateway(
  "main",
  {
    compartmentId: compartment.id,
    displayName: `${PROJECT}-service-gateway`,
    services: ociServices.apply((services) => {
      const service = services[0];
      if (!service) throw new Error("OCI service is required");
      return [{ serviceId: service.id }];
    }),
    vcnId: vcn.id,
  },
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
const privateRouteTable = new oci.core.RouteTable(
  "private",
  {
    compartmentId: compartment.id,
    displayName: `${PROJECT}-route-table-private`,
    routeRules: [
      {
        destination: "0.0.0.0/0",
        destinationType: "CIDR_BLOCK",
        networkEntityId: natGateway.id,
        routeType: "STATIC",
      },
      {
        destination: ociServices.apply((services) => {
          const service = services[0];
          if (!service) throw new Error("OCI service is required");
          return service.cidrBlock;
        }),
        destinationType: "SERVICE_CIDR_BLOCK",
        networkEntityId: serviceGateway.id,
        routeType: "STATIC",
      },
    ],
    vcnId: vcn.id,
  },
  { protect: true },
);
const publicRouteTable = new oci.core.RouteTable(
  "public",
  {
    compartmentId: compartment.id,
    displayName: `${PROJECT}-route-table-public`,
    routeRules: [
      {
        destination: "0.0.0.0/0",
        destinationType: "CIDR_BLOCK",
        networkEntityId: internetGateway.id,
        routeType: "STATIC",
      },
    ],
    vcnId: vcn.id,
  },
  { protect: true },
);

const privateSubnet = new oci.core.Subnet(
  "private",
  {
    cidrBlock: "10.0.10.0/24",
    compartmentId: compartment.id,
    displayName: `${PROJECT}-subnet-private`,
    dnsLabel: "private",
    prohibitPublicIpOnVnic: true,
    routeTableId: privateRouteTable.id,
    vcnId: vcn.id,
  },
  { protect: true },
);
const publicSubnet = new oci.core.Subnet(
  "public",
  {
    cidrBlock: "10.0.1.0/24",
    compartmentId: compartment.id,
    displayName: `${PROJECT}-subnet-public`,
    dnsLabel: "public",
    prohibitPublicIpOnVnic: false,
    routeTableId: publicRouteTable.id,
    vcnId: vcn.id,
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
const aclDocument = privateSubnet.cidrBlock.apply((cidr) =>
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
const tailnetKey = new tailscale.TailnetKey(
  "main",
  {
    ephemeral: true,
    preauthorized: true,
    recreateIfInvalid: "never",
    reusable: true,
    tags: [TAILSCALE_TAG],
  },
  {
    additionalSecretOutputs: ["key"],
    dependsOn: [acl],
    protect: true,
  },
);
const ubuntuImages = oci.core.getImagesOutput({
  compartmentId: compartment.id,
  filters: [
    {
      name: "display_name",
      regex: true,
      values: ["^Canonical-Ubuntu-([0-9][02468])\\.04-aarch64-[0-9.-]+$"],
    },
  ],
  shape: INSTANCE_SHAPE,
  sortBy: "DISPLAYNAME",
  sortOrder: "DESC",
}).images;
const ubuntuImageId = ubuntuImages.apply((images) => {
  const image = images[0];
  if (!image) throw new Error("OCI Ubuntu image is required");
  return image.id;
});
const instance = new oci.core.Instance(
  "main",
  {
    agentConfig: {
      isManagementDisabled: true,
      pluginsConfigs: [
        { desiredState: "DISABLED", name: "Vulnerability Scanning" },
        { desiredState: "DISABLED", name: "Compute Instance Monitoring" },
      ],
    },
    availabilityDomain,
    compartmentId: compartment.id,
    createVnicDetails: {
      assignPublicIp: "false",
      displayName: `${PROJECT}-virtual-network-interface-card-main`,
      nsgIds: [mainNetworkSecurityGroup.id],
      subnetId: privateSubnet.id,
    },
    displayName: `${PROJECT}-instance-main`,
    launchOptions: {
      isConsistentVolumeNamingEnabled: true,
      networkType: "PARAVIRTUALIZED",
    },
    launchVolumeAttachments: [
      {
        device: "/dev/oracleoci/oraclevdb",
        type: "paravirtualized",
        volumeId: volume.id,
      },
    ],
    shape: INSTANCE_SHAPE,
    shapeConfig: { memoryInGbs: 12, ocpus: 2 },
    sourceDetails: { sourceId: ubuntuImageId, sourceType: "image" },
  },
  {
    additionalSecretOutputs: ["metadata"],
    ignoreChanges: ["metadata"],
    protect: true,
  },
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
    targetId: instance.id,
  },
  { protect: true },
);

import { PROJECT } from "@/config";
import * as oci from "@pulumi/oci";

type SetUpNetworkArgs = {
  compartment: oci.identity.Compartment;
};

export function setUpNetwork({ compartment }: SetUpNetworkArgs) {
  const ociServices = oci.core.getServicesOutput({
    filters: [
      {
        name: "name",
        regex: true,
        values: ["All .* Services In Oracle Services Network"],
      },
    ],
  }).services;
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

  const internetGateway = new oci.core.InternetGateway("main", {
    compartmentId: compartment.id,
    displayName: `${PROJECT}-internet-gateway`,
    vcnId: vcn.id,
  });
  const mainNetworkSecurityGroup = new oci.core.NetworkSecurityGroup(
    "main",
    {
      compartmentId: compartment.id,
      displayName: `${PROJECT}-network-security-group-main`,
      vcnId: vcn.id,
    },
    { protect: true },
  );
  const natGateway = new oci.core.NatGateway("main", {
    compartmentId: compartment.id,
    displayName: `${PROJECT}-nat-gateway`,
    vcnId: vcn.id,
  });
  const serviceGateway = new oci.core.ServiceGateway("main", {
    compartmentId: compartment.id,
    displayName: `${PROJECT}-service-gateway`,
    services: ociServices.apply((services) => {
      const service = services[0];
      if (!service) throw new Error("OCI service is required");
      return [{ serviceId: service.id }];
    }),
    vcnId: vcn.id,
  });

  const privateRouteTable = new oci.core.RouteTable("private", {
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
  });
  const publicRouteTable = new oci.core.RouteTable("public", {
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
  });

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

  return {
    internetGateway,
    mainNetworkSecurityGroup,
    natGateway,
    privateRouteTable,
    privateSubnet,
    publicIp,
    publicRouteTable,
    publicSubnet,
    serviceGateway,
    vcn,
  };
}

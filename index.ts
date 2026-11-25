import { PROJECT, TENANCY_OCID } from "@/config";
import { setUpCompute } from "@/set-up-compute";
import { setUpNetwork } from "@/set-up-network";
import { setUpFoundation } from "@/set-up-foundation";
import { setUpPrivateAccess } from "@/set-up-private-access";
import { setUpPublicIngress } from "@/set-up-public-ingress";
import * as oci from "@pulumi/oci";

const availabilityDomains = oci.identity.getAvailabilityDomainsOutput({
  compartmentId: TENANCY_OCID,
}).availabilityDomains;
const availabilityDomain = availabilityDomains.apply((domains) => {
  const domain = domains[0];
  if (!domain) throw new Error("OCI availability domain is required");
  return domain.name;
});

const foundation = setUpFoundation();

const compute = setUpCompute({ compartment: foundation.compartment });
const network = setUpNetwork({ compartment: foundation.compartment });

setUpPrivateAccess({ privateSubnet: network.privateSubnet });
setUpPublicIngress({
  compartment: foundation.compartment,
  mainInstance: compute.mainInstance,
  publicIp: network.publicIp,
  publicSubnet: network.publicSubnet,
  vcn: network.vcn,
});

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

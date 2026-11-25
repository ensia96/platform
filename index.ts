import { setUpCompute } from "@/set-up-compute";
import { setUpFoundation } from "@/set-up-foundation";
import { setUpNetwork } from "@/set-up-network";
import { setUpPrivateAccess } from "@/set-up-private-access";
import { setUpPublicIngress } from "@/set-up-public-ingress";
import { setUpStorage } from "@/set-up-storage";

const foundation = setUpFoundation();

const compute = setUpCompute({ compartment: foundation.compartment });
const network = setUpNetwork({ compartment: foundation.compartment });
setUpStorage({ compartment: foundation.compartment });

setUpPrivateAccess({ privateSubnet: network.privateSubnet });
setUpPublicIngress({
  compartment: foundation.compartment,
  mainInstance: compute.mainInstance,
  publicIp: network.publicIp,
  publicSubnet: network.publicSubnet,
  vcn: network.vcn,
});

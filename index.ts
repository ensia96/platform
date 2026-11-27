import { setUpCompute } from "@/set-up-compute";
import { setUpFoundation } from "@/set-up-foundation";
import { setUpNetwork } from "@/set-up-network";
import { setUpPrivateAccess } from "@/set-up-private-access";
import { setUpPublicIngress } from "@/set-up-public-ingress";
import { setUpStorage } from "@/set-up-storage";

const foundation = setUpFoundation();

const network = setUpNetwork({ compartment: foundation.compartment });
const storage = setUpStorage({ compartment: foundation.compartment });

const compute = setUpCompute({
  compartment: foundation.compartment,
  mainNetworkSecurityGroup: network.mainNetworkSecurityGroup,
  privateSubnet: network.privateSubnet,
  volume: storage.volume,
});
setUpPrivateAccess({ privateSubnet: network.privateSubnet });

setUpPublicIngress({
  compartment: foundation.compartment,
  mainInstance: compute.mainInstance,
  mainNetworkSecurityGroup: network.mainNetworkSecurityGroup,
  publicIp: network.publicIp,
  publicSubnet: network.publicSubnet,
  vcn: network.vcn,
});

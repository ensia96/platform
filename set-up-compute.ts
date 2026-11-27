import { PROJECT } from "@/config";
import * as oci from "@pulumi/oci";

const IMAGE_NAME = "Canonical-Ubuntu-24.04-aarch64-2026.09.18-0";
const SHAPE = "VM.Standard.A1.Flex";

type SetUpComputeArgs = {
  compartment: oci.identity.Compartment;
  mainNetworkSecurityGroup: oci.core.NetworkSecurityGroup;
  privateSubnet: oci.core.Subnet;
  volume: oci.core.Volume;
};

export function setUpCompute({
  compartment,
  mainNetworkSecurityGroup,
  privateSubnet,
  volume,
}: SetUpComputeArgs) {
  const imageId = oci.core
    .getImagesOutput({
      compartmentId: compartment.id,
      displayName: IMAGE_NAME,
      shape: SHAPE,
      state: "AVAILABLE",
    })
    .images.apply((images) => {
      if (images.length !== 1)
        throw new Error(`Expected one image: ${IMAGE_NAME}`);
      return images[0].id;
    });

  const mainInstance = new oci.core.Instance(
    "main",
    {
      availabilityDomain: volume.availabilityDomain,
      compartmentId: compartment.id,
      createVnicDetails: {
        assignPublicIp: "false",
        displayName: `${PROJECT}-virtual-network-interface-card-main`,
        nsgIds: [mainNetworkSecurityGroup.id],
        subnetId: privateSubnet.id,
      },
      displayName: `${PROJECT}-instance-dokploy`,
      launchOptions: {
        isConsistentVolumeNamingEnabled: true,
        networkType: "PARAVIRTUALIZED",
      },
      launchVolumeAttachments: [
        {
          device: "/dev/oracleoci/oraclevdb",
          isReadOnly: true,
          type: "paravirtualized",
          volumeId: volume.id,
        },
      ],
      shape: SHAPE,
      shapeConfig: { memoryInGbs: 12, ocpus: 2 },
      sourceDetails: { sourceId: imageId, sourceType: "image" },
    },
    {
      additionalSecretOutputs: ["metadata", "extendedMetadata"],
      deleteBeforeReplace: true,
      replaceOnChanges: ["displayName", "sourceDetails.sourceId"],
    },
  );

  return { mainInstance };
}

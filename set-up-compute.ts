import { PROJECT } from "@/config";
import * as oci from "@pulumi/oci";

type SetUpComputeArgs = {
  compartment: oci.identity.Compartment;
};

export function setUpCompute({ compartment }: SetUpComputeArgs) {
  const displayName = `${PROJECT}-instance-main`;
  const existing = oci.core
    .getInstancesOutput({
      compartmentId: compartment.id,
      displayName,
      state: "RUNNING",
    })
    .instances.apply((instances) => {
      if (instances.length !== 1)
        throw new Error("exactly one running legacy OCI instance is required");
      const [vm] = instances;
      const [source] = vm.sourceDetails;
      const [shape] = vm.shapeConfigs;
      if (
        !vm.availabilityDomain ||
        !vm.shape ||
        !shape ||
        source?.sourceType !== "image" ||
        !source.sourceId
      )
        throw new Error(
          "legacy instance placement, shape and source image are required",
        );
      return {
        availabilityDomain: vm.availabilityDomain,
        shape: vm.shape,
        shapeConfig: { memoryInGbs: shape.memoryInGbs, ocpus: shape.ocpus },
        sourceDetails: {
          sourceId: source.sourceId,
          sourceType: source.sourceType,
        },
      };
    });

  const mainInstance = new oci.core.Instance(
    "main",
    {
      availabilityDomain: existing.availabilityDomain,
      compartmentId: compartment.id,
      displayName,
      shape: existing.shape,
      shapeConfig: existing.shapeConfig,
      sourceDetails: existing.sourceDetails,
    },
    {
      additionalSecretOutputs: ["metadata", "extendedMetadata"],
      ignoreChanges: ["metadata"],
    },
  );

  return { mainInstance };
}

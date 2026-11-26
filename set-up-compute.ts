import { PROJECT } from "@/config";
import { env } from "@/lib";
import * as oci from "@pulumi/oci";
import { all } from "@pulumi/pulumi";

type SetUpComputeArgs = {
  compartment: oci.identity.Compartment;
};

export function setUpCompute({ compartment }: SetUpComputeArgs) {
  const importId = env("PULUMI_IMPORT_INSTANCE_ID");
  const displayName = `${PROJECT}-instance-main`;
  const instance = oci.core.getInstanceOutput({ instanceId: importId });
  const existing = all([instance, compartment.id]).apply(
    ([vm, compartmentId]) => {
      if (
        vm.compartmentId !== compartmentId ||
        vm.displayName !== displayName ||
        vm.state !== "RUNNING"
      )
        throw new Error("legacy instance import identity mismatch");
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
    },
  );

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
      import: importId,
      protect: true,
    },
  );

  return { mainInstance };
}

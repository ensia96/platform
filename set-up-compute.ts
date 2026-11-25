import { PROJECT } from "@/config";
import * as oci from "@pulumi/oci";

type SetUpComputeArgs = {
  compartment: oci.identity.Compartment;
};

export function setUpCompute({ compartment }: SetUpComputeArgs) {
  const mainInstance = oci.core
    .getInstancesOutput({
      compartmentId: compartment.id,
      displayName: `${PROJECT}-instance-main`,
      state: "RUNNING",
    })
    .instances.apply((instances) => {
      if (instances.length !== 1)
        throw new Error("exactly one running legacy OCI instance is required");
      return instances[0];
    });

  return { mainInstance };
}

import { PROJECT, TENANCY_OCID } from "@/config";
import * as oci from "@pulumi/oci";

type SetUpStorageArgs = {
  compartment: oci.identity.Compartment;
};

export function setUpStorage({ compartment }: SetUpStorageArgs) {
  const containerRepository = new oci.artifacts.ContainerRepository(
    "application",
    {
      compartmentId: compartment.id,
      displayName: `${PROJECT}-repository-application`,
      isPublic: true,
    },
    { protect: true },
  );
  const volume = new oci.core.Volume(
    "main",
    {
      availabilityDomain: oci.identity
        .getAvailabilityDomainsOutput({ compartmentId: TENANCY_OCID })
        .availabilityDomains.apply((domains) => {
          const [domain] = domains;
          if (!domain) throw new Error("OCI availability domain is required");
          return domain.name;
        }),
      compartmentId: compartment.id,
      displayName: `${PROJECT}-volume-database`,
      sizeInGbs: "50",
    },
    { deleteBeforeReplace: true, replaceOnChanges: ["displayName"] },
  );

  return { containerRepository, volume };
}

import { AVAILABILITY_DOMAINS, PROJECT } from "@/config";
import { compartment } from "@/organization";
import * as oci from "@pulumi/oci";

export const containerRepository = new oci.artifacts.ContainerRepository(
  "application",
  {
    compartmentId: compartment.id,
    displayName: `${PROJECT}-repository-application`,
    isPublic: true,
  },
  { protect: true },
);
export const volume = new oci.core.Volume(
  "main",
  {
    availabilityDomain: AVAILABILITY_DOMAINS.apply(
      (domains) => domains[0].name,
    ),
    compartmentId: compartment.id,
    displayName: `${PROJECT}-volume-main`,
    sizeInGbs: "50",
  },
  { protect: true },
);
